import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: Update an existing booking without releasing room or time slot
export async function PATCH(req: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { id, staffAssistance, timeString } = body;

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existingBooking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const updateData: { staffAssistance?: boolean; timeString?: string } = {};
    if (typeof staffAssistance === "boolean") {
      updateData.staffAssistance = staffAssistance;
    }
    if (typeof timeString === "string" && timeString.trim()) {
      updateData.timeString = timeString.trim();
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Booking updated successfully",
      booking: updatedBooking,
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

      // 2. Release TimeSlot so it becomes chooseable again
      if (booking.timeSlotId) {
        await tx.timeSlot.update({
          where: { id: booking.timeSlotId },
          data: { isBooked: false },
        });
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
