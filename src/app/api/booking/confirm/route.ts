import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

class BookingConflictError extends Error {
  conflictType: "SLOT_CONFLICT" | "ROOM_CONFLICT";
  conflictItem: string;

  constructor(message: string, conflictType: "SLOT_CONFLICT" | "ROOM_CONFLICT", conflictItem: string) {
    super(message);
    this.name = "BookingConflictError";
    this.conflictType = conflictType;
    this.conflictItem = conflictItem;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, timeSlotId, staffAssistance } = body;

    if (!roomId || !timeSlotId) {
      return NextResponse.json(
        { error: "Both roomId and timeSlotId are required to confirm a booking." },
        { status: 400 }
      );
    }

    // Atomic transaction to ensure concurrency safety
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Check room
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: { cleaningDate: true },
      });

      if (!room) {
        throw new Error("The selected room could not be found.");
      }
      if (room.isBooked) {
        throw new BookingConflictError(
          `Room ${room.roomNumber} was just confirmed by another resident a moment ago. Please select another room.`,
          "ROOM_CONFLICT",
          room.roomNumber
        );
      }

      // 2. Check timeSlot
      const slot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!slot) {
        throw new Error("The selected time slot could not be found.");
      }

      // Ensure slot belongs to the room's assigned date
      if (slot.cleaningDateId !== room.cleaningDateId) {
        throw new Error("The chosen time slot does not match the room's assigned cleaning date.");
      }

      // 3. Mark room as booked
      const roomClaim = await tx.room.updateMany({
        where: { id: roomId, isBooked: false },
        data: { isBooked: true },
      });
      if (roomClaim.count !== 1) {
        throw new BookingConflictError("This room has just been booked. Please select another room.", "ROOM_CONFLICT", room.roomNumber);
      }

      // The public choice is a time. Claim any remaining place at that time,
      // including when another request has just taken the representative ID.
      const candidates = await tx.timeSlot.findMany({
        where: { cleaningDateId: room.cleaningDateId, timeSlot: slot.timeSlot, isBooked: false },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      let claimedSlotId: string | null = null;
      for (const candidate of candidates) {
        const claim = await tx.timeSlot.updateMany({
          where: { id: candidate.id, isBooked: false },
          data: { isBooked: true },
        });
        if (claim.count === 1) {
          claimedSlotId = candidate.id;
          break;
        }
      }
      if (!claimedSlotId) {
        throw new BookingConflictError("This time is fully booked. Please select another time.", "SLOT_CONFLICT", slot.timeSlot);
      }

      // 5. Create booking record
      const newBooking = await tx.booking.create({
        data: {
          roomId: room.id,
          timeSlotId: claimedSlotId,
          roomNumber: room.roomNumber,
          floor: room.floor,
          dateString: room.cleaningDate.dateString,
          timeString: slot.timeSlot,
          staffAssistance: Boolean(staffAssistance),
        },
        include: {
          room: {
            include: { cleaningDate: true },
          },
        },
      });

      return newBooking;
    });

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        timeSlotId: booking.timeSlotId,
        roomNumber: booking.roomNumber,
        floor: booking.floor,
        dateString: booking.dateString,
        displayDate: booking.room.cleaningDate.displayDate,
        timeSlot: booking.timeString,
        staffAssistance: booking.staffAssistance,
        createdAt: booking.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Booking confirmation error:", error);

    // Return structured 409 Conflict for concurrent race conditions
    if (error?.name === "BookingConflictError") {
      return NextResponse.json(
        {
          error: error.message,
          conflictType: error.conflictType,
          conflictItem: error.conflictItem,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to confirm booking. Please try again." },
      { status: 400 }
    );
  }
}
