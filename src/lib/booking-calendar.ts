export interface CalendarBooking {
  id: string;
  roomNumber: string;
  floor: string;
  dateString: string;
  timeSlot: string;
  staffAssistance: boolean;
}

// Use all slots, including booked ones. Repeated gaps identify the normal
// appointment length; a longer lunch break must not extend an appointment.
export function inferSlotDuration(times: string[]): number | null {
  const minutes = [...new Set(times.filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    .map((time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))))].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (let index = 1; index < minutes.length; index++) {
    const gap = minutes[index] - minutes[index - 1];
    counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  // If equally frequent, prefer the shorter gap rather than a break.
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function calendarTimes(booking: CalendarBooking, durationMinutes: number) {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
    throw new Error("Invalid calendar duration");
  }
  // Booking times are always Thailand time, regardless of the visitor's device.
  const start = new Date(`${booking.dateString}T${booking.timeSlot}:00+07:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start: timestamp(start), end: timestamp(end) };
}

function details(booking: CalendarBooking) {
  return `Room ${booking.roomNumber}, ${booking.floor}\nStaff assistance: ${booking.staffAssistance ? "Yes" : "No"}\nBooking reference: ${booking.id}`;
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

// RFC 5545 limits content lines to 75 octets, including multibyte Thai text.
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += char;
    length += bytes;
  }
  return result;
}

export function bookingIcs(booking: CalendarBooking, durationMinutes: number, now = new Date()) {
  const { start, end } = calendarTimes(booking, durationMinutes);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BPS//AC Cleaning Booking//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${encodeURIComponent(booking.id)}@bps-ac-booking`,
    `DTSTAMP:${timestamp(now)}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${escapeText(`AC cleaning - Room ${booking.roomNumber}`)}`,
    `DESCRIPTION:${escapeText(details(booking))}`,
    `LOCATION:${escapeText(`Room ${booking.roomNumber}, ${booking.floor}`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(foldLine).join("\r\n");
}
