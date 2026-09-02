import { NextResponse } from "next/server";
import { generateSampleExcelBuffer } from "@/lib/sample-data";

export async function GET() {
  try {
    const buffer = await generateSampleExcelBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bps_ac_cleaning_template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error("Error generating sample template:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
