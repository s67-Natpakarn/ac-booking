import ExcelJS from "exceljs";

export interface ParsedRoom {
  floor: string;
  roomNumber: string;
  assignedDate: string;
  displayDate: string;
  initialTimeSlot?: string;
}

export interface ParsedDateSchedule {
  dateString: string;
  displayDate: string;
  timeSlots: string[];
  rooms: ParsedRoom[];
}

export interface ParseResult {
  schedules: ParsedDateSchedule[];
  totalRooms: number;
  totalDates: number;
  totalUniqueSlots: number;
  ignoredRows: string[];
}

/**
 * Safely extracts pure text string from any ExcelJS cell value.
 * Correctly handles:
 * - string
 * - number
 * - RichText: { richText: [{ text: "1" }, { text: "st" }] } -> "1st"
 * - Objects with .text or .result
 * NEVER returns "[object Object]"
 */
export function extractCellText(val: any): string {
  if (val === null || val === undefined) return "";

  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val).trim();
  if (typeof val === "boolean") return String(val).trim();

  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof val === "object") {
    // RichText support (e.g. 1st with superscript "st")
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText
        .map((chunk: any) => (chunk && chunk.text ? chunk.text : ""))
        .join("")
        .trim();
    }

    if ("text" in val && typeof val.text === "string") {
      return val.text.trim();
    }

    if ("result" in val && val.result !== null && val.result !== undefined) {
      return extractCellText(val.result);
    }
  }

  return String(val).trim();
}

/**
 * Format decimal time into HH:mm
 * Rules:
 * 9.3 -> 09:30
 * 10.15 -> 10:15
 * 12 -> 12:00
 * 12.45 -> 12:45
 * 13.3 -> 13:30
 * 14.15 -> 14:15
 * 15 -> 15:00
 */
export function formatDecimalTime(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "object" && "result" in val) {
    val = val.result;
  }

  if (val instanceof Date) {
    const hours = String(val.getUTCHours()).padStart(2, "0");
    const minutes = String(val.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  if (typeof val === "number") {
    const hour = Math.floor(val);
    const fracPart = Math.round((val - hour) * 100);
    let minute = "00";

    if (fracPart === 3 || fracPart === 30) {
      minute = "30";
    } else if (fracPart === 15) {
      minute = "15";
    } else if (fracPart === 45) {
      minute = "45";
    } else if (fracPart === 0) {
      minute = "00";
    } else {
      minute = String(fracPart).padStart(2, "0");
    }

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const str = extractCellText(val);
  if (!str) return null;

  if (str.includes(":")) {
    const parts = str.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    return formatDecimalTime(num);
  }

  return null;
}

/**
 * Parses header values into standard date format YYYY-MM-DD
 */
export function parseDateHeader(val: any): { dateString: string; displayDate: string } | null {
  if (val === null || val === undefined) return null;

  if (typeof val === "object" && "result" in val) {
    val = val.result;
  }

  let date: Date | null = null;

  if (val instanceof Date) {
    date = val;
  } else if (typeof val === "number") {
    if (val > 30000 && val < 60000) {
      date = new Date(Math.round((val - 25569) * 86400 * 1000));
    }
  } else if (typeof val === "string" || typeof val === "object") {
    const s = extractCellText(val);
    if (!s) return null;

    const lower = s.toLowerCase();
    if (
      lower.includes("task") ||
      lower.includes("remark") ||
      lower.includes("note") ||
      lower.includes("comment") ||
      lower.includes("fl") ||
      lower.includes("floor") ||
      lower.includes("room") ||
      lower.includes("club") ||
      lower.includes("detail") ||
      lower.includes("timeframe") ||
      lower.includes("impact") ||
      lower.includes("maintenance")
    ) {
      return null;
    }

    const dateMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      date = new Date(Date.UTC(year, month, day));
    } else {
      const parsed = Date.parse(s);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      }
    }
  }

  if (!date || isNaN(date.getTime())) return null;

  // Use UTC to prevent local timezone shifts
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const dateString = `${y}-${m}-${d}`;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayName = dayNames[date.getUTCDay()];
  const monthName = monthNames[date.getUTCMonth()];
  const displayDate = `${dayName}, ${monthName} ${d}, ${y}`;

  return { dateString, displayDate };
}

/**
 * Parse uploaded Excel buffer.
 * Reads ONLY 1st sheet.
 * Filters out "Club House" (case-insensitive).
 */
export async function parseExcelBuffer(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (workbook.xlsx as any).load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("The uploaded Excel workbook contains no sheets.");
  }

  let headerRowIndex = -1;
  let floorColIndex = -1;
  let roomColIndex = -1;

  // 1. Locate header row
  for (let r = 1; r <= Math.min(worksheet.rowCount, 15); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const cellText = extractCellText(row.getCell(c).value).toLowerCase();
      if (cellText === "fl" || cellText === "floor") {
        floorColIndex = c;
      }
      if (
        cellText === "room no." ||
        cellText === "room no" ||
        cellText === "room" ||
        cellText === "room #"
      ) {
        roomColIndex = c;
      }
    }

    if (floorColIndex !== -1 && roomColIndex !== -1) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1 || floorColIndex === -1 || roomColIndex === -1) {
    throw new Error(
      "Could not find valid header columns ('FL' / 'Floor' and 'ROOM NO.') in the first sheet."
    );
  }

  // 2. Locate Date columns
  const headerRow = worksheet.getRow(headerRowIndex);
  interface DateColInfo {
    colIndex: number;
    dateString: string;
    displayDate: string;
  }
  const dateColumns: DateColInfo[] = [];

  for (let c = Math.max(floorColIndex, roomColIndex) + 1; c <= worksheet.columnCount; c++) {
    const cellValue = headerRow.getCell(c).value;
    if (cellValue === null || cellValue === undefined || cellValue === "") {
      break;
    }

    const cellText = extractCellText(cellValue).toLowerCase();
    if (
      cellText.includes("task") ||
      cellText.includes("maintenance") ||
      cellText.includes("detail") ||
      cellText.includes("timeframe") ||
      cellText.includes("impact")
    ) {
      break;
    }

    const dateInfo = parseDateHeader(cellValue);
    if (dateInfo) {
      dateColumns.push({
        colIndex: c,
        dateString: dateInfo.dateString,
        displayDate: dateInfo.displayDate,
      });
    } else {
      break;
    }
  }

  if (dateColumns.length === 0) {
    throw new Error("No valid date columns found in the schedule header.");
  }

  // 3. Scan rows for rooms and slots
  const scheduleMap = new Map<
    string,
    {
      dateString: string;
      displayDate: string;
      timeSlotsSet: Set<string>;
      rooms: ParsedRoom[];
    }
  >();

  for (const dc of dateColumns) {
    scheduleMap.set(dc.dateString, {
      dateString: dc.dateString,
      displayDate: dc.displayDate,
      timeSlotsSet: new Set<string>(),
      rooms: [],
    });
  }

  const ignoredRows: string[] = [];
  let totalRooms = 0;

  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawFloor = extractCellText(row.getCell(floorColIndex).value);
    const rawRoom = extractCellText(row.getCell(roomColIndex).value);

    if (!rawRoom && !rawFloor) continue;

    // Check time slots on this row first
    let assignedDateCol: DateColInfo | null = null;
    let roomTimeSlot: string | null = null;

    for (const dc of dateColumns) {
      const cellVal = row.getCell(dc.colIndex).value;
      const parsedTime = formatDecimalTime(cellVal);
      if (parsedTime) {
        assignedDateCol = dc;
        roomTimeSlot = parsedTime;
        // Register time slot for this date
        scheduleMap.get(dc.dateString)?.timeSlotsSet.add(parsedTime);
      }
    }

    // Filtering rule: Completely IGNORE / EXCLUDE any row where Room Name is "Club House" (case-insensitive)
    if (rawRoom.toLowerCase().includes("club house") || rawRoom.toLowerCase() === "clubhouse") {
      ignoredRows.push(`Row ${r}: ${rawRoom} (Excluded: Club House)`);
      continue;
    }

    // Exclude annotation / summary rows
    if (
      !rawRoom ||
      rawRoom.toLowerCase().includes("supervision") ||
      rawFloor.toLowerCase().includes("supervision") ||
      rawRoom.toLowerCase().includes("total") ||
      rawRoom.toLowerCase().includes("summary") ||
      rawRoom.toLowerCase().includes("note") ||
      rawRoom.toLowerCase().includes("remark") ||
      rawRoom.toLowerCase().includes("cleaning")
    ) {
      ignoredRows.push(`Row ${r}: ${rawRoom || rawFloor} (Excluded: Annotation/Non-room row)`);
      continue;
    }

    if (assignedDateCol) {
      const schedule = scheduleMap.get(assignedDateCol.dateString);
      if (schedule) {
        schedule.rooms.push({
          floor: rawFloor || "1",
          roomNumber: rawRoom,
          assignedDate: assignedDateCol.dateString,
          displayDate: assignedDateCol.displayDate,
          initialTimeSlot: roomTimeSlot || undefined,
        });
        totalRooms++;
      }
    } else {
      ignoredRows.push(`Row ${r}: Room ${rawRoom} (No time slot found in any date column)`);
    }
  }

  // Convert map to array: include dates that have either rooms or time slots
  let totalUniqueSlots = 0;
  const schedules: ParsedDateSchedule[] = [];

  for (const dc of dateColumns) {
    const item = scheduleMap.get(dc.dateString);
    if (item && (item.rooms.length > 0 || item.timeSlotsSet.size > 0)) {
      const sortedSlots = Array.from(item.timeSlotsSet).sort((a, b) => a.localeCompare(b));
      totalUniqueSlots += sortedSlots.length;
      schedules.push({
        dateString: item.dateString,
        displayDate: item.displayDate,
        timeSlots: sortedSlots,
        rooms: item.rooms,
      });
    }
  }

  return {
    schedules,
    totalRooms,
    totalDates: schedules.length,
    totalUniqueSlots,
    ignoredRows,
  };
}

export interface ExportRowItem {
  floor: string;
  roomNumber: string;
  timeSlot: string;
  status: "CONFIRMED" | "AVAILABLE";
  staffAssistance: string;
  bookingTimestamp: string;
}

export interface ExportDateSheet {
  dateString: string;
  displayDate: string;
  rows: ExportRowItem[];
}

/**
 * Generates one .xlsx workbook containing multiple sheets, where each sheet is named
 * after a cleaning date (e.g., 2025-09-07, 2025-09-08).
 * Lists all rooms and their booking statuses.
 */
export async function generateMultiSheetExport(sheets: ExportDateSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BPS AC Cleaning Booking System";
  workbook.created = new Date();

  if (sheets.length === 0) {
    const ws = workbook.addWorksheet("Schedule");
    ws.addRow(["No cleaning dates or rooms scheduled."]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await (workbook.xlsx as any).writeBuffer();
    return Buffer.from(buf);
  }

  for (const sheet of sheets) {
    const sheetName = sheet.dateString.slice(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    // Title Row
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `AC Cleaning Schedule - ${sheet.displayDate} (${sheet.dateString})`;
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // Teal 700
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 30;

    // Header Row
    const headerRow = worksheet.getRow(3);
    headerRow.values = [
      "Floor",
      "Room Number",
      "Time Slot",
      "Booking Status",
      "Staff Assistance Required",
      "Booking Timestamp",
    ];
    headerRow.height = 24;
    headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Slate 800
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    if (sheet.rows.length === 0) {
      const emptyRow = worksheet.getRow(4);
      emptyRow.values = ["-", "No rooms or bookings recorded for this date", "-", "-", "-", "-"];
      emptyRow.alignment = { vertical: "middle", horizontal: "center" };
    } else {
      // Sort rows: first by time slot, then by floor/room
      const sorted = [...sheet.rows].sort((a, b) => {
        const timeCmp = (a.timeSlot || "").localeCompare(b.timeSlot || "");
        if (timeCmp !== 0) return timeCmp;
        return (a.roomNumber || "").localeCompare(b.roomNumber || "");
      });

      let rIdx = 4;
      for (const item of sorted) {
        const row = worksheet.getRow(rIdx);
        row.values = [
          item.floor,
          item.roomNumber,
          item.timeSlot || "Pending",
          item.status,
          item.staffAssistance,
          item.bookingTimestamp,
        ];
        row.alignment = { vertical: "middle", horizontal: "center" };
        row.font = { name: "Arial", size: 10 };

        // Highlight confirmed vs available
        if (item.status === "CONFIRMED") {
          row.getCell(4).font = { bold: true, color: { argb: "FF047857" } }; // Emerald 700
          row.getCell(4).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" }, // Emerald 100
          };
        } else {
          row.getCell(4).font = { color: { argb: "FF64748B" } };
        }

        // Highlight staff assistance if YES
        if (item.staffAssistance.toUpperCase().includes("YES")) {
          row.getCell(5).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" }, // Amber 100
          };
          row.getCell(5).font = { bold: true, color: { argb: "FFB45309" } };
        }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });

        row.height = 20;
        rIdx++;
      }
    }

    // Column widths
    worksheet.columns = [
      { width: 12 }, // Floor
      { width: 18 }, // Room Number
      { width: 15 }, // Time Slot
      { width: 18 }, // Booking Status
      { width: 28 }, // Staff Assistance Required
      { width: 26 }, // Booking Timestamp
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await (workbook.xlsx as any).writeBuffer();
  return Buffer.from(buffer);
}
