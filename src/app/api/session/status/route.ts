import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { id: "singleton" },
    });

    const totalRooms = await prisma.room.count();
    const bookedRooms = await prisma.room.count({ where: { isBooked: true } });
    const availableRooms = totalRooms - bookedRooms;

    const hasActiveSession = Boolean(setting?.hasActiveSession && totalRooms > 0);

    return NextResponse.json({
      hasActiveSession,
      sessionTitle: setting?.sessionTitle || "BPS AC Cleaning Booking Schedule",
      uploadedFilename: setting?.uploadedFilename || null,
      totalRooms,
      bookedRooms,
      availableRooms,
    });
  } catch (error: any) {
    console.error("Error fetching session status:", error);
    return NextResponse.json(
      { hasActiveSession: false, error: "Failed to fetch session status" },
      { status: 500 }
    );
  }
}
