import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { parseExcelBuffer } from "./excel-parser";

/**
 * Creates a realistic sample Excel workbook conforming to the project spec
 */
export async function generateSampleExcelBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BPS Estate Management";

  const ws = wb.addWorksheet("AC Cleaning Schedule");

  // Headers
  const headerRow = ws.addRow(["FL", "ROOM NO.", "2026-09-07", "2026-09-08", "2026-09-09", "Maintenance Task"]);
  headerRow.font = { bold: true };

  // Sample data with decimal times as specified
  const rows = [
    // 2026-09-07 (Floor 1)
    ["1st", "39/101", 9.3, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/102", 10.15, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/103", 12, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/104", 12.45, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/105", 13.3, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/106", 14.15, null, null, "Filter Cleaning & Coil Sanitization"],
    ["1st", "39/107", 15, null, null, "Filter Cleaning & Coil Sanitization"],

    // 2026-09-08 (Floor 2)
    ["2nd", "39/201", null, 9.3, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/202", null, 10.15, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/203", null, 12, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/204", null, 12.45, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/205", null, 13.3, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/206", null, 14.15, null, "Filter Cleaning & Coil Sanitization"],
    ["2nd", "39/207", null, 15, null, "Filter Cleaning & Coil Sanitization"],

    // 2026-09-09 (Floor 3)
    ["3rd", "39/301", null, null, 9.3, "Filter Cleaning & Coil Sanitization"],
    ["3rd", "39/302", null, null, 10.15, "Filter Cleaning & Coil Sanitization"],
    ["3rd", "39/303", null, null, 12, "Filter Cleaning & Coil Sanitization"],
    ["3rd", "39/304", null, null, 13.3, "Filter Cleaning & Coil Sanitization"],
    ["3rd", "39/305", null, null, 14.15, "Filter Cleaning & Coil Sanitization"],

    // Excluded Club House row (must be ignored by parser)
    ["Ground", "Club House", 9.3, null, null, "Excluded non-room space"],
    // Non-room annotation row
    ["Total", "Total 19 Units", null, null, null, "Summary row"],
  ];

  for (const r of rows) {
    ws.addRow(r);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await (wb.xlsx as any).writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Direct seed helper that populates the database with sample schedule
 */
export async function seedDemoSchedule() {
  const sampleBuffer = await generateSampleExcelBuffer();
  const parsed = await parseExcelBuffer(sampleBuffer);

  // Clear existing session data
  await prisma.$transaction(async (tx) => {
    await tx.booking.deleteMany();
    await tx.room.deleteMany();
    await tx.timeSlot.deleteMany();
    await tx.cleaningDate.deleteMany();

    for (const schedule of parsed.schedules) {
      const createdDate = await tx.cleaningDate.create({
        data: {
          dateString: schedule.dateString,
          displayDate: schedule.displayDate,
        },
      });

      // Insert unique time slots for this date
      for (const slot of schedule.timeSlots) {
        await tx.timeSlot.create({
          data: {
            cleaningDateId: createdDate.id,
            timeSlot: slot,
            isBooked: false,
          },
        });
      }

      // Insert rooms for this date
      for (const room of schedule.rooms) {
        await tx.room.create({
          data: {
            cleaningDateId: createdDate.id,
            roomNumber: room.roomNumber,
            floor: room.floor,
            isBooked: false,
          },
        });
      }
    }

    // Update system setting
    await tx.systemSetting.upsert({
      where: { id: "singleton" },
      update: {
        hasActiveSession: true,
        sessionTitle: "BPS AC Cleaning Booking Schedule",
        uploadedFilename: "sample_bps_ac_cleaning_schedule.xlsx",
      },
      create: {
        id: "singleton",
        hasActiveSession: true,
        sessionTitle: "BPS AC Cleaning Booking Schedule",
        uploadedFilename: "sample_bps_ac_cleaning_schedule.xlsx",
      },
    });
  });

  return parsed;
}
