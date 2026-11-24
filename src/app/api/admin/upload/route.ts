import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { parseExcelBuffer } from "@/lib/excel-parser";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No Excel file provided." }, { status: 400 });
    }

    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls") &&
      file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload a valid Excel (.xlsx or .xls) file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parseResult = await parseExcelBuffer(buffer);

    if (parseResult.schedules.length === 0 || parseResult.totalRooms === 0) {
      return NextResponse.json(
        {
          error:
            "No valid rooms or dates could be extracted from the first sheet. Please check the column headers.",
        },
        { status: 400 }
      );
    }

    // Replace session data in an atomic transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.deleteMany();
      await tx.room.deleteMany();
      await tx.timeSlot.deleteMany();
      await tx.cleaningDate.deleteMany();

      for (const schedule of parseResult.schedules) {
        const createdDate = await tx.cleaningDate.create({
          data: {
            dateString: schedule.dateString,
            displayDate: schedule.displayDate,
          },
        });

        // Bulk writes avoid a network round trip for every Excel row.
        if (schedule.timeSlots.length > 0) {
          await tx.timeSlot.createMany({
            data: schedule.timeSlots.map((slot) => ({
              cleaningDateId: createdDate.id,
              timeSlot: slot,
              isBooked: false,
            })),
          });
        }

        if (schedule.rooms.length > 0) {
          await tx.room.createMany({
            data: schedule.rooms.map((room) => ({
              cleaningDateId: createdDate.id,
              roomNumber: room.roomNumber,
              floor: room.floor,
              isBooked: false,
            })),
          });
        }
      }

      await tx.systemSetting.upsert({
        where: { id: "singleton" },
        update: {
          hasActiveSession: true,
          sessionTitle: "BPS AC Cleaning Booking Schedule",
          uploadedFilename: file.name,
        },
        create: {
          id: "singleton",
          hasActiveSession: true,
          sessionTitle: "BPS AC Cleaning Booking Schedule",
          uploadedFilename: file.name,
        },
      });
    }, { maxWait: 10_000, timeout: 30_000 });

    return NextResponse.json({
      success: true,
      message: "Schedule initialized successfully!",
      summary: {
        filename: file.name,
        totalDates: parseResult.totalDates,
        totalRooms: parseResult.totalRooms,
        totalSlots: parseResult.totalSlots,
        ignoredRows: parseResult.ignoredRows,
      },
    });
  } catch (error: any) {
    console.error("Excel upload processing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process the uploaded Excel file." },
      { status: 500 }
    );
  }
}
