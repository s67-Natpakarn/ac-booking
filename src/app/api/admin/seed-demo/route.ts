import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { seedDemoSchedule } from "@/lib/sample-data";

export async function POST() {
  try {
    const isAuthed = await isAdminAuthenticated();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const result = await seedDemoSchedule();

    return NextResponse.json({
      success: true,
      message: "Sample demo schedule seeded successfully!",
      summary: {
        totalDates: result.totalDates,
        totalRooms: result.totalRooms,
        totalSlots: result.totalUniqueSlots,
        ignoredRows: result.ignoredRows,
      },
    });
  } catch (error: any) {
    console.error("Seed demo error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to seed demo schedule." },
      { status: 500 }
    );
  }
}
