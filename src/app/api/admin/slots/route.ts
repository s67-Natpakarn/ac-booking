import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { formatDecimalTime } from "@/lib/excel-parser";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, timeSlot, cleaningDateId } = body;

    if (action === "create") {
      if (!timeSlot || !cleaningDateId) {
        return NextResponse.json(
          { error: "Time slot and assigned date are required." },
          { status: 400 }
        );
      }

      const formattedSlot = formatDecimalTime(timeSlot) || timeSlot.trim();

      const existing = await prisma.timeSlot.findFirst({
        where: { cleaningDateId, timeSlot: formattedSlot },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Slot ${formattedSlot} already exists for this date.` },
          { status: 400 }
        );
      }

      const slot = await prisma.timeSlot.create({
        data: {
          cleaningDateId,
          timeSlot: formattedSlot,
          isBooked: false,
        },
        include: { cleaningDate: true },
      });

      return NextResponse.json({ success: true, slot });
    }

    if (action === "update") {
      if (!id || !timeSlot || !cleaningDateId) {
        return NextResponse.json({ error: "Missing required fields for update." }, { status: 400 });
      }

      const formattedSlot = formatDecimalTime(timeSlot) || timeSlot.trim();

      const updated = await prisma.timeSlot.update({
        where: { id },
        data: {
          cleaningDateId,
          timeSlot: formattedSlot,
        },
        include: { cleaningDate: true },
      });

      return NextResponse.json({ success: true, slot: updated });
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Slot ID is required to delete." }, { status: 400 });
      }

      await prisma.timeSlot.delete({
        where: { id },
      });

      return NextResponse.json({ success: true, message: "Time slot deleted successfully." });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    console.error("Slot CRUD error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process slot action." },
      { status: 500 }
    );
  }
}
