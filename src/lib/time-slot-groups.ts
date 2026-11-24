interface Slot {
  id: string;
  timeSlot: string;
  isBooked: boolean;
}

export function groupTimeSlots(slots: Slot[]) {
  const groups = new Map<string, { timeSlot: string; slotIds: string[]; availableId: string | null; capacity: number; remaining: number }>();
  for (const slot of slots) {
    const group = groups.get(slot.timeSlot) ?? {
      timeSlot: slot.timeSlot, slotIds: [], availableId: null, capacity: 0, remaining: 0,
    };
    group.slotIds.push(slot.id);
    group.capacity++;
    if (!slot.isBooked) {
      group.remaining++;
      group.availableId ??= slot.id;
    }
    groups.set(slot.timeSlot, group);
  }
  return [...groups.values()].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
}
