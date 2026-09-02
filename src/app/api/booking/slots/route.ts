import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateId = searchParams.get("dateId");

    if (!dateId) {
      return NextResponse.json({ error: "dateId parameter is required" }, { status: 400 });
    }

    const slots = await prisma.timeSlot.findMany({
      where: {
        cleaningDateId: dateId,
        isBooked: false,
      },
      orderBy: {
        timeSlot: "asc",
      },
    });

    return NextResponse.json({
      slots: slots.map((s) => ({
        id: s.id,
        timeSlot: s.timeSlot,
        isBooked: s.isBooked,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching slots:", error);
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}
