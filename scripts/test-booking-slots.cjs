const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ExcelJS = require('exceljs');

// Run the project's TypeScript directly without adding a test runtime dependency.
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args);
};
const { parseExcelBuffer, generateMultiSheetExport } = require('../src/lib/excel-parser.ts');
const { groupTimeSlots } = require('../src/lib/time-slot-groups.ts');

function testGroups() {
  const slots = ['09:30', '09:30', '12:00', '12:00'].map((timeSlot, index) => ({ id: String(index), timeSlot, isBooked: false }));
  assert.equal(groupTimeSlots(slots).length, 2);
  assert.equal(groupTimeSlots(slots)[0].remaining, 2);
  slots[0].isBooked = true;
  assert.equal(groupTimeSlots(slots)[0].remaining, 1);
  assert.equal(groupTimeSlots(slots)[0].availableId, '1');
  slots[1].isBooked = true;
  const full = groupTimeSlots(slots)[0];
  assert.equal(full.remaining, 0);
  assert.equal(full.capacity, 2);
  assert.equal(full.availableId, null);
  assert.equal(groupTimeSlots(slots).length, 2, 'Full choices stay visible');
  assert.equal(groupTimeSlots(slots)[1].remaining, 2);
  assert.deepEqual(groupTimeSlots([]), []);
  console.log('PASS: one choice per time, capacity counts down, and full times remain visible with no available place.');
}

async function testExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Schedule');
  sheet.addRow(['FL', 'ROOM NO.', '2026-09-07', '2026-09-08']);
  sheet.addRow(['1', '39/101', 9.3, null]);
  sheet.addRow(['1', '39/102', '09:30', null]);
  sheet.addRow(['1', '39/103', 12, null]);
  sheet.addRow(['1', '39/104', '12:00', null]);
  sheet.addRow(['2', '39/201', null, 9.3]);
  sheet.addRow(['2', '39/202', null, 9.3]);
  sheet.addRow(['G', 'Club House', 9.3, null]);
  sheet.addRow(['Total', 'Total 6 Rooms', 12, null]);
  const ignoredSheet = workbook.addWorksheet('Ignore');
  ignoredSheet.addRow(['FL', 'ROOM NO.', '2026-09-07']);
  ignoredSheet.addRow(['1', 'Not a real room', 9.3]);
  const result = await parseExcelBuffer(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(result.totalSlots, 6);
  assert.equal(result.totalRooms, 6);
  assert.equal(result.totalDates, 2);
  assert.deepEqual(result.schedules[0].timeSlots, ['09:30', '09:30', '12:00', '12:00']);
  assert.deepEqual(result.schedules[1].timeSlots, ['09:30', '09:30']);
  assert.equal(result.ignoredRows.length, 2);

  const rows = ['slot-a', 'slot-b'].map((timeSlotId, index) => ({
    timeSlotId, floor: '1', roomNumber: `39/10${index}`, timeSlot: '09:30',
    status: 'CONFIRMED', staffAssistance: 'NO', bookingTimestamp: '-',
  }));
  const exportBuffer = await generateMultiSheetExport([
    { dateString: '2026-09-07', displayDate: '7 Sep 2026', rows },
    { dateString: '2026-09-08', displayDate: '8 Sep 2026', rows: rows.map(row => ({ ...row, timeSlotId: 'same-slot' })) },
  ]);
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.load(exportBuffer);
  assert.equal(exported.worksheets[0].getCell('D4').value, 'CONFIRMED');
  assert.equal(exported.worksheets[0].getCell('D5').value, 'CONFIRMED');
  assert.equal(exported.worksheets[1].getCell('D4').value, 'CONFIRMED (OVERLAP)');
  console.log('PASS: Excel keeps parallel places, excludes non-room rows, separates dates, and exports valid parallel bookings without overlap warnings.');
}

async function testDatabase() {
  const testUrl = process.env.BOOKING_TEST_DATABASE_URL;
  assert.ok(testUrl, '--database requires BOOKING_TEST_DATABASE_URL for an isolated test database');
  const production = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
  const host = value => new URL(value).hostname.replace('-pooler', '');
  assert.notEqual(host(testUrl), host(production.DATABASE_URL), 'Refusing to test against the app database');
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  const { prisma } = require('../src/lib/prisma.ts');
  const { POST } = require('../src/app/api/booking/confirm/route.ts');
  let dateId;
  try {
    const date = await prisma.cleaningDate.create({ data: {
      dateString: `test-${crypto.randomUUID()}`, displayDate: 'Test only',
      rooms: { createMany: { data: Array.from({ length: 6 }, (_, index) => ({ roomNumber: `test-${index}`, floor: '1' })) } },
      timeSlots: { createMany: { data: ['09:30', '09:30', '12:00', '12:00'].map(timeSlot => ({ timeSlot })) } },
    }, include: { rooms: { orderBy: { roomNumber: 'asc' } }, timeSlots: { orderBy: [{ timeSlot: 'asc' }, { id: 'asc' }] } } });
    dateId = date.id;
    assert.equal(date.timeSlots.length, 4);
    const book = async (roomId, timeSlotId) => {
      const response = await POST(new Request('http://localhost/api/booking/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, timeSlotId, staffAssistance: false }),
      }));
      return { status: response.status, data: await response.json() };
    };
    const responses = await Promise.all([
      book(date.rooms[0].id, date.timeSlots[0].id),
      book(date.rooms[1].id, date.timeSlots[0].id),
      book(date.rooms[2].id, date.timeSlots[0].id),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 200, 409]);
    assert.equal(responses.find(response => response.status === 409).data.conflictType, 'SLOT_CONFLICT');
    assert.equal(new Set(responses.filter(response => response.status === 200).map(response => response.data.booking.timeSlotId)).size, 2);
    assert.equal(await prisma.booking.count({ where: { timeSlotId: { in: date.timeSlots.slice(0, 2).map(slot => slot.id) } } }), 2);
    assert.equal((await book(date.rooms[3].id, date.timeSlots[0].id)).status, 409);
    assert.equal((await prisma.room.findUnique({ where: { id: date.rooms[3].id } })).isBooked, false);

    const sameRoom = await Promise.all([
      book(date.rooms[4].id, date.timeSlots[2].id),
      book(date.rooms[4].id, date.timeSlots[3].id),
    ]);
    assert.deepEqual(sameRoom.map(response => response.status).sort(), [200, 409]);
    assert.equal(sameRoom.find(response => response.status === 409).data.conflictType, 'ROOM_CONFLICT');
    assert.equal(await prisma.timeSlot.count({ where: { cleaningDateId: dateId, timeSlot: '12:00', isBooked: true } }), 1);
    console.log('PASS: three concurrent requests for one time fill exactly two places; full capacity rejects further bookings; room conflicts roll back without consuming capacity.');
  } finally {
    if (dateId) await prisma.cleaningDate.delete({ where: { id: dateId } });
    await prisma.$disconnect();
  }
}

(async () => {
  testGroups();
  await testExcel();
  if (process.argv.includes('--database')) await testDatabase();
})().catch(error => {
  console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[connection hidden]'));
  process.exitCode = 1;
});
