import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { id: "singleton" },
    });

    if (!setting?.hasActiveSession) {
      return NextResponse.json({ rooms: [] });
    }

    const rooms = await prisma.room.findMany({
      where: { isBooked: false },
      include: {
        cleaningDate: true,
      },
      orderBy: [
        { floor: "asc" },
        { roomNumber: "asc" },
      ],
    });

    return NextResponse.json({
      rooms: rooms.map((r) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        cleaningDateId: r.cleaningDateId,
        dateString: r.cleaningDate.dateString,
        displayDate: r.cleaningDate.displayDate,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}
