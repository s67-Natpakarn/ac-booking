import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, roomNumber, floor, cleaningDateId } = body;

    if (action === "create") {
      if (!roomNumber || !cleaningDateId) {
        return NextResponse.json(
          { error: "Room number and assigned date are required." },
          { status: 400 }
        );
      }

      // Check if room already exists on this date
      const existing = await prisma.room.findFirst({
        where: { roomNumber: roomNumber.trim(), cleaningDateId },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Room ${roomNumber} already exists for this date.` },
          { status: 400 }
        );
      }

      const room = await prisma.room.create({
        data: {
          roomNumber: roomNumber.trim(),
          floor: (floor || "1").trim(),
          cleaningDateId,
          isBooked: false,
        },
        include: { cleaningDate: true },
      });

      return NextResponse.json({ success: true, room });
    }

    if (action === "update") {
      if (!id || !roomNumber || !cleaningDateId) {
        return NextResponse.json({ error: "Missing required fields for update." }, { status: 400 });
      }

      const updated = await prisma.room.update({
        where: { id },
        data: {
          roomNumber: roomNumber.trim(),
          floor: (floor || "1").trim(),
          cleaningDateId,
        },
        include: { cleaningDate: true },
      });

      return NextResponse.json({ success: true, room: updated });
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Room ID is required to delete." }, { status: 400 });
      }

      await prisma.room.delete({
        where: { id },
      });

      return NextResponse.json({ success: true, message: "Room deleted successfully." });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    console.error("Room CRUD error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process room action." },
      { status: 500 }
    );
  }
}
