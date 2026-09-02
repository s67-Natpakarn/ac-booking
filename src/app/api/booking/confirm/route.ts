import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Atomic transaction
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
        throw new Error("This room has already been booked. Please choose another room.");
      }

      // 2. Check timeSlot
      const slot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!slot) {
        throw new Error("The selected time slot could not be found.");
      }
      if (slot.isBooked) {
        throw new Error("This time slot has already been booked. Please pick an alternative time slot.");
      }

      // Ensure slot belongs to the room's assigned date
      if (slot.cleaningDateId !== room.cleaningDateId) {
        throw new Error("The chosen time slot does not match the room's assigned cleaning date.");
      }

      // 3. Mark room as booked
      await tx.room.update({
        where: { id: roomId },
        data: { isBooked: true },
      });

      // 4. Mark slot as booked
      await tx.timeSlot.update({
        where: { id: timeSlotId },
        data: { isBooked: true },
      });

      // 5. Create booking record
      const newBooking = await tx.booking.create({
        data: {
          roomId: room.id,
          timeSlotId: slot.id,
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
    return NextResponse.json(
      { error: error.message || "Failed to confirm booking. Please try again." },
      { status: 400 }
    );
  }
}
