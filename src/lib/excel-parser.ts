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

  // Handle ExcelJS cell with formula/result
  if (typeof val === "object" && "result" in val) {
    val = val.result;
  }

  // Handle Date object
  if (val instanceof Date) {
    const hours = String(val.getHours()).padStart(2, "0");
    const minutes = String(val.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  // Handle numeric representation
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

  const str = String(val).trim();
  if (!str) return null;

  // Handle "HH:mm" or "H:mm" format
  if (str.includes(":")) {
    const parts = str.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Handle string numbers like "9.3" or "10.15" or "12"
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
    // Excel serial date representation
    if (val > 30000 && val < 60000) {
      date = new Date(Math.round((val - 25569) * 86400 * 1000));
    }
  } else if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;

    const lower = s.toLowerCase();
    // Stop / skip if non-date headers
    if (
      lower.includes("task") ||
      lower.includes("remark") ||
      lower.includes("note") ||
      lower.includes("comment") ||
      lower.includes("fl") ||
      lower.includes("floor") ||
      lower.includes("room") ||
      lower.includes("club")
    ) {
      return null;
    }

    // Check ISO or YYYY-MM-DD or YYYY/MM/DD
    const dateMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      date = new Date(year, month, day);
    } else {
      const parsed = Date.parse(s);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      }
    }
  }

  if (!date || isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateString = `${y}-${m}-${d}`;

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "2-digit",
  };
  const displayDate = date.toLocaleDateString("en-US", options);

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

  // Read ONLY the 1st sheet (index 0)
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
      const cellVal = String(row.getCell(c).value || "").trim().toLowerCase();
      if (cellVal === "fl" || cellVal === "floor") {
        floorColIndex = c;
      }
      if (
        cellVal === "room no." ||
        cellVal === "room no" ||
        cellVal === "room" ||
        cellVal === "room #"
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

  // 2. Locate Date columns starting from after the room column
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
      // Stop scanning when encountering blank headers
      break;
    }

    const cellText = String(cellValue).trim();
    if (cellText.toLowerCase().includes("task") || cellText.toLowerCase().includes("maintenance")) {
      // Stop scanning date columns when encountering non-date task headers
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
      // Non-date header encountered -> stop scanning
      break;
    }
  }

  if (dateColumns.length === 0) {
    throw new Error(
      "No valid date columns found in the schedule header. Please ensure dates are in format YYYY-MM-DD or valid date cells."
    );
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
    const rawFloor = String(row.getCell(floorColIndex).value ?? "").trim();
    const rawRoom = String(row.getCell(roomColIndex).value ?? "").trim();

    if (!rawRoom) continue;

    // Filtering rule: Completely IGNORE / EXCLUDE any row where Room Name is "Club House" (case-insensitive)
    if (rawRoom.toLowerCase().includes("club house") || rawRoom.toLowerCase() === "clubhouse") {
      ignoredRows.push(`Row ${r}: ${rawRoom} (Excluded: Club House)`);
      continue;
    }

    // Exclude summary / total rows
    if (
      rawRoom.toLowerCase().includes("total") ||
      rawRoom.toLowerCase().includes("summary") ||
      rawRoom.toLowerCase().includes("cleaning")
    ) {
      ignoredRows.push(`Row ${r}: ${rawRoom} (Excluded: Annotation row)`);
      continue;
    }

    // Check which date column contains a time slot for this room
    let assignedDateCol: DateColInfo | null = null;
    let roomTimeSlot: string | null = null;

    for (const dc of dateColumns) {
      const cellVal = row.getCell(dc.colIndex).value;
      const parsedTime = formatDecimalTime(cellVal);
      if (parsedTime) {
        assignedDateCol = dc;
        roomTimeSlot = parsedTime;
        // Also register this time slot for this date
        scheduleMap.get(dc.dateString)?.timeSlotsSet.add(parsedTime);
      }
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

  // Convert map to array
  let totalUniqueSlots = 0;
  const schedules: ParsedDateSchedule[] = [];

  for (const dc of dateColumns) {
    const item = scheduleMap.get(dc.dateString);
    if (item && (item.rooms.length > 0 || item.timeSlotsSet.size > 0)) {
      // Sort slots chronologically
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

/**
 * Multi-Sheet Excel Export
 * Generates one .xlsx file containing multiple sheets, where each sheet is named after a cleaning date (e.g., 2026-09-07, 2026-09-08).
 * Each sheet lists: Floor, Room Number, Time Slot, Staff Assistance Required.
 */
export async function generateMultiSheetExport(
  dateGroups: Array<{
    dateString: string;
    displayDate: string;
    bookings: Array<{
      floor: string;
      roomNumber: string;
      timeString: string;
      staffAssistance: boolean;
      createdAt: Date | string;
    }>;
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BPS AC Cleaning Booking System";
  workbook.created = new Date();

  // If no date groups, create an empty sheet
  if (dateGroups.length === 0) {
    const sheet = workbook.addWorksheet("No Bookings");
    sheet.addRow(["No bookings recorded yet."]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (workbook.xlsx as any).writeBuffer();
    return Buffer.from(buffer);
  }

  for (const group of dateGroups) {
    // Sheet name must be <= 31 chars
    const sheetName = group.dateString.slice(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    // Title Block
    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `AC Cleaning Schedule - ${group.displayDate} (${group.dateString})`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
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
      "Staff Assistance Required",
      "Booking Timestamp",
    ];
    headerRow.height = 24;
    headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
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

    // Data Rows
    // Sort bookings by timeSlot ascending
    const sorted = [...group.bookings].sort((a, b) => a.timeString.localeCompare(b.timeString));

    let rowIndex = 4;
    for (const b of sorted) {
      const row = worksheet.getRow(rowIndex);
      const timestampStr =
        b.createdAt instanceof Date
          ? b.createdAt.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
          : new Date(b.createdAt).toLocaleString("en-US", { timeZone: "Asia/Bangkok" });

      row.values = [
        b.floor,
        b.roomNumber,
        b.timeString,
        b.staffAssistance ? "YES (Required)" : "No",
        timestampStr,
      ];

      row.alignment = { vertical: "middle", horizontal: "center" };
      row.font = { name: "Arial", size: 10 };

      // Highlight staff assistance with amber tint
      if (b.staffAssistance) {
        row.getCell(4).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" }, // Amber 100
        };
        row.getCell(4).font = { bold: true, color: { argb: "FFB45309" } };
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
      rowIndex++;
    }

    // Auto-fit column widths
    worksheet.columns = [
      { width: 12 }, // Floor
      { width: 18 }, // Room Number
      { width: 15 }, // Time Slot
      { width: 28 }, // Staff Assistance Required
      { width: 26 }, // Booking Timestamp
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await (workbook.xlsx as any).writeBuffer();
  return Buffer.from(buffer);
}
