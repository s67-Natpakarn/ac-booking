import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const systemSetting = await prisma.systemSetting.findUnique({
      where: { id: "singleton" },
    });

    const dates = await prisma.cleaningDate.findMany({
      orderBy: { dateString: "asc" },
      include: {
        _count: {
          select: { rooms: true, timeSlots: true },
        },
      },
    });

    const rooms = await prisma.room.findMany({
      include: {
        cleaningDate: true,
        booking: true,
      },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    });

    const timeSlots = await prisma.timeSlot.findMany({
      include: {
        cleaningDate: true,
        bookings: true,
      },
      orderBy: [{ cleaningDateId: "asc" }, { timeSlot: "asc" }],
    });

    const bookings = await prisma.booking.findMany({
      include: {
        room: { include: { cleaningDate: true } },
        timeSlot: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const totalRooms = rooms.length;
    const bookedRooms = rooms.filter((r) => r.isBooked).length;
    const availableRooms = totalRooms - bookedRooms;
    const totalSlots = timeSlots.length;
    const bookedSlots = timeSlots.filter((s) => s.isBooked).length;
    const availableSlots = totalSlots - bookedSlots;

    return NextResponse.json({
      systemSetting,
      dates,
      rooms,
      timeSlots,
      bookings,
      stats: {
        totalRooms,
        bookedRooms,
        availableRooms,
        totalSlots,
        bookedSlots,
        availableSlots,
        totalDates: dates.length,
      },
    });
  } catch (error: any) {
    console.error("Admin data fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch admin data" }, { status: 500 });
  }
}
