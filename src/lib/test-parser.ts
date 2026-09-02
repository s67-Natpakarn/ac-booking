import ExcelJS from "exceljs";
import { formatDecimalTime, parseExcelBuffer } from "./excel-parser";

async function runTests() {
  console.log("=== RUNNING EXCEL PARSER TESTS ===");

  // 1. Test Decimal Time Conversion
  const testCases = [
    { input: 9.3, expected: "09:30" },
    { input: 10.15, expected: "10:15" },
    { input: 12, expected: "12:00" },
    { input: 12.45, expected: "12:45" },
    { input: 13.3, expected: "13:30" },
    { input: 14.15, expected: "14:15" },
    { input: 15, expected: "15:00" },
    { input: "9.3", expected: "09:30" },
    { input: "10.15", expected: "10:15" },
    { input: "09:30", expected: "09:30" },
  ];

  for (const tc of testCases) {
    const res = formatDecimalTime(tc.input);
    if (res !== tc.expected) {
      throw new Error(`Failed time conversion for ${tc.input}: expected ${tc.expected}, got ${res}`);
    }
    console.log(`✓ ${tc.input} => ${res}`);
  }

  // 2. Test Excel Workbook creation and parsing
  const wb = new ExcelJS.Workbook();
  const ws1 = wb.addWorksheet("Schedule Sheet 1");
  const ws2 = wb.addWorksheet("Ignore Sheet 2");

  // Populate sheet 2 with dummy data that must be ignored
  ws2.addRow(["FL", "ROOM NO.", "2026-09-10"]);
  ws2.addRow(["1", "Sheet2Room", 9.3]);

  // Sheet 1 Headers
  ws1.addRow(["FL", "ROOM NO.", "2026-09-07", "2026-09-08", "Maintenance Task"]);

  // Sheet 1 Data
  // Normal rooms
  ws1.addRow(["1st", "39/92", 9.3, null, "Filter replacement"]);
  ws1.addRow(["1st", "39/93", 10.15, null, "Normal cleaning"]);
  ws1.addRow(["2nd", "39/94", 12.45, null, "Normal cleaning"]);
  ws1.addRow(["2nd", "39/95", null, 13.3, "Normal cleaning"]);
  ws1.addRow(["3rd", "39/96", null, 14.15, "Normal cleaning"]);
  ws1.addRow(["3rd", "39/97", null, 15, "Normal cleaning"]);

  // Excluded row: Club House
  ws1.addRow(["G", "Club House", 9.3, null, "Do not clean"]);
  // Excluded row: summary/annotation
  ws1.addRow(["Total", "Total 6 Rooms", null, null, "Summary"]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = Buffer.from(await (wb.xlsx as any).writeBuffer());

  const result = await parseExcelBuffer(buffer);

  console.log("\nParse Result Summary:");
  console.log(`Total dates: ${result.totalDates}`);
  console.log(`Total rooms: ${result.totalRooms}`);
  console.log(`Total unique slots: ${result.totalUniqueSlots}`);
  console.log(`Ignored rows count: ${result.ignoredRows.length}`);
  console.log("Ignored rows:", result.ignoredRows);

  // Assertions
  if (result.totalDates !== 2) {
    throw new Error(`Expected 2 dates, got ${result.totalDates}`);
  }
  if (result.totalRooms !== 6) {
    throw new Error(`Expected 6 valid rooms, got ${result.totalRooms}`);
  }

  // Verify Club House was excluded
  for (const s of result.schedules) {
    for (const r of s.rooms) {
      if (r.roomNumber.toLowerCase().includes("club house")) {
        throw new Error("Club House was not filtered out!");
      }
    }
  }
  console.log("✓ Club House strictly excluded.");

  // Verify dates
  const dateStrings = result.schedules.map((s) => s.dateString);
  if (!dateStrings.includes("2026-09-07") || !dateStrings.includes("2026-09-08")) {
    throw new Error(`Unexpected date strings: ${dateStrings.join(", ")}`);
  }
  console.log("✓ Date columns parsed accurately.");

  // Verify Sheet 2 was ignored
  for (const s of result.schedules) {
    for (const r of s.rooms) {
      if (r.roomNumber === "Sheet2Room") {
        throw new Error("Sheet 2 was parsed when only sheet 1 should be parsed!");
      }
    }
  }
  console.log("✓ Only sheet 0 parsed; subsequent sheets completely ignored.");

  console.log("\n🎉 ALL PARSER TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
