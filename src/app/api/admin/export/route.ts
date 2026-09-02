import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { generateMultiSheetExport, ExportDateSheet } from "@/lib/excel-parser";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json(
        { error: "Unauthorized access. Please sign in to administrator portal." },
        { status: 401 }
      );
    }

    const dates = await prisma.cleaningDate.findMany({
      orderBy: { dateString: "asc" },
      include: {
        rooms: {
          include: { booking: true },
          orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
        },
        timeSlots: {
          orderBy: { timeSlot: "asc" },
        },
      },
    });

    const sheets: ExportDateSheet[] = dates.map((d) => {
      const rows = d.rooms.map((r) => {
        const isBooked = r.isBooked && r.booking !== null;
        const b = r.booking;
        const timeSlot = isBooked ? b!.timeString : "-";
        const status = isBooked ? ("CONFIRMED" as const) : ("AVAILABLE" as const);
        const staffAssistance = isBooked
          ? b!.staffAssistance
            ? "YES (Supervised)"
            : "No (Self-Access)"
          : "Pending Booking";
        const bookingTimestamp = isBooked
          ? new Date(b!.createdAt).toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
          : "-";

        return {
          floor: r.floor,
          roomNumber: r.roomNumber,
          timeSlot,
          status,
          staffAssistance,
          bookingTimestamp,
        };
      });

      return {
        dateString: d.dateString,
        displayDate: d.displayDate,
        rows,
      };
    });

    const excelBuffer = await generateMultiSheetExport(sheets);
    const filename = `BPS_AC_Schedule_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(excelBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel export." },
      { status: 500 }
    );
  }
}
