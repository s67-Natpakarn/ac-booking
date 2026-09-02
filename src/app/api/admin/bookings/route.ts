import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: Update an existing booking (re-allocates time slot or adjusts staffAssistance)
export async function PATCH(req: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { id, timeSlotId, staffAssistance } = body;

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingBooking = await tx.booking.findUnique({
        where: { id },
        include: { room: true, timeSlot: true },
      });

      if (!existingBooking) {
        throw new Error("Booking not found");
      }

      let isOverlapping = false;
      const updateData: { timeSlotId?: string; timeString?: string; staffAssistance?: boolean } = {};

      if (typeof staffAssistance === "boolean") {
        updateData.staffAssistance = staffAssistance;
      }

      // If time slot is being changed
      if (timeSlotId && timeSlotId !== existingBooking.timeSlotId) {
        const newSlot = await tx.timeSlot.findUnique({
          where: { id: timeSlotId },
        });

        if (!newSlot) {
          throw new Error("Selected time slot not found");
        }

        // 1. Release the old slot if no other room is occupying it
        const remainingOldSlotBookings = await tx.booking.count({
          where: {
            timeSlotId: existingBooking.timeSlotId,
            id: { not: existingBooking.id },
          },
        });

        if (remainingOldSlotBookings === 0) {
          await tx.timeSlot.update({
            where: { id: existingBooking.timeSlotId },
            data: { isBooked: false },
          });
        }

        // 2. Check if the new slot already has other room bookings (Overlap detection)
        const countOnNewSlot = await tx.booking.count({
          where: {
            timeSlotId: newSlot.id,
            id: { not: existingBooking.id },
          },
        });

        isOverlapping = countOnNewSlot > 0;

        // 3. Mark the new slot as booked (removes it from public user choice list)
        await tx.timeSlot.update({
          where: { id: newSlot.id },
          data: { isBooked: true },
        });

        updateData.timeSlotId = newSlot.id;
        updateData.timeString = newSlot.timeSlot;
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: updateData,
        include: { room: true, timeSlot: true },
      });

      return { updatedBooking, isOverlapping };
    });

    return NextResponse.json({
      success: true,
      message: result.isOverlapping
        ? `Booking updated. Note: Time slot ${result.updatedBooking.timeString} is overlapping with another room.`
        : `Booking updated successfully. Time slot set to ${result.updatedBooking.timeString}.`,
      isOverlapping: result.isOverlapping,
      booking: result.updatedBooking,
    });
  } catch (error: any) {
    console.error("Booking update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update booking" },
      { status: 500 }
    );
  }
}

// DELETE: Cancel/delete booking, making BOTH room and time slot available again
export async function DELETE(req: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { room: true, timeSlot: true },
      });

      if (!booking) {
        throw new Error("Booking record not found");
      }

      // 1. Release Room so it becomes chooseable again
      if (booking.roomId) {
        await tx.room.update({
          where: { id: booking.roomId },
          data: { isBooked: false },
        });
      }

      // 2. Release TimeSlot if no other booking is using it
      if (booking.timeSlotId) {
        const remainingBookings = await tx.booking.count({
          where: {
            timeSlotId: booking.timeSlotId,
            id: { not: booking.id },
          },
        });

        if (remainingBookings === 0) {
          await tx.timeSlot.update({
            where: { id: booking.timeSlotId },
            data: { isBooked: false },
          });
        }
      }

      // 3. Delete the Booking record
      await tx.booking.delete({
        where: { id },
      });

      return booking;
    });

    return NextResponse.json({
      success: true,
      message: `Booking for room ${result.roomNumber} deleted. Room and time slot (${result.timeString}) are now available again for booking.`,
    });
  } catch (error: any) {
    console.error("Booking deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete booking" },
      { status: 500 }
    );
  }
}
