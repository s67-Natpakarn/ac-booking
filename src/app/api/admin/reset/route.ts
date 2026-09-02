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
    const { confirmation } = body;

    if (confirmation !== "RESET") {
      return NextResponse.json(
        { error: 'Confirmation failed. Please type "RESET" exactly to confirm reset.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.deleteMany();
      await tx.room.deleteMany();
      await tx.timeSlot.deleteMany();
      await tx.cleaningDate.deleteMany();

      await tx.systemSetting.upsert({
        where: { id: "singleton" },
        update: {
          hasActiveSession: false,
          sessionTitle: "BPS AC Cleaning Booking Schedule",
          uploadedFilename: null,
        },
        create: {
          id: "singleton",
          hasActiveSession: false,
          sessionTitle: "BPS AC Cleaning Booking Schedule",
          uploadedFilename: null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Booking session has been completely reset to initial pre-upload state.",
    });
  } catch (error: any) {
    console.error("Session reset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset session." },
      { status: 500 }
    );
  }
}
