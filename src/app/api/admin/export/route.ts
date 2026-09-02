import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { generateMultiSheetExport } from "@/lib/excel-parser";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const dates = await prisma.cleaningDate.findMany({
      orderBy: { dateString: "asc" },
      include: {
        rooms: {
          where: { isBooked: true },
          include: { booking: true },
        },
      },
    });

    const dateGroups = dates.map((d) => {
      const bookingsList = d.rooms
        .filter((r) => r.booking !== null)
        .map((r) => ({
          floor: r.floor,
          roomNumber: r.roomNumber,
          timeString: r.booking!.timeString,
          staffAssistance: r.booking!.staffAssistance,
          createdAt: r.booking!.createdAt,
        }));

      return {
        dateString: d.dateString,
        displayDate: d.displayDate,
        bookings: bookingsList,
      };
    });

    const excelBuffer = await generateMultiSheetExport(dateGroups);

    const filename = `BPS_AC_Bookings_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
