"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Header from "@/components/Header";
import BookingReceiptModal from "@/components/BookingReceiptModal";
import { useToast } from "@/components/ToastContext";
import {
  Calendar,
  Clock,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Search,
  Sparkles,
  Shield,
  Loader2,
  Building,
  RefreshCw,
  X,
} from "lucide-react";

interface AvailableRoom {
  id: string;
  roomNumber: string;
  floor: string;
  cleaningDateId: string;
  dateString: string;
  displayDate: string;
}

interface AvailableSlot {
  id: string;
  timeSlot: string;
  isBooked: boolean;
}

interface ConfirmedBooking {
  id: string;
  roomNumber: string;
  floor: string;
  dateString: string;
  displayDate: string;
  timeSlot: string;
  staffAssistance: boolean;
  createdAt: string;
}

export default function BookingPage() {
  const { showToast } = useToast();

  const [loadingSession, setLoadingSession] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("BPS AC Cleaning Booking Schedule");

  // Booking Data
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [staffAssistance, setStaffAssistance] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Modal State
  const [receipt, setReceipt] = useState<ConfirmedBooking | null>(null);

  // Conflict Alert State (for concurrent race conditions)
  const [conflictAlert, setConflictAlert] = useState<{
    type: "SLOT" | "ROOM";
    message: string;
    item: string;
  } | null>(null);

  // Fetch initial session status
  const checkSession = async () => {
    try {
      setLoadingSession(true);
      const res = await fetch("/api/session/status");
      const data = await res.json();

      setHasActiveSession(data.hasActiveSession);
      if (data.sessionTitle) setSessionTitle(data.sessionTitle);

      if (data.hasActiveSession) {
        await fetchRooms();
      }
    } catch (err) {
      console.error(err);
      showToast("Unable to load session status. Please try refreshing.", "error");
    } finally {
      setLoadingSession(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/booking/rooms");
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch available rooms.", "error");
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Currently selected room object
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Distinct floors for filtering
  const distinctFloors = useMemo(() => {
    const set = new Set(rooms.map((r) => r.floor));
    return Array.from(set).sort();
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        r.roomNumber.toLowerCase().includes(roomSearchQuery.toLowerCase()) ||
        r.floor.toLowerCase().includes(roomSearchQuery.toLowerCase());
      const matchesFloor = selectedFloor === "all" || r.floor === selectedFloor;
      return matchesSearch && matchesFloor;
    });
  }, [rooms, roomSearchQuery, selectedFloor]);

  // Fetch slots for a date
  const fetchSlotsForDate = useCallback(
    async (dateId: string) => {
      try {
        setLoadingSlots(true);
        const res = await fetch(`/api/booking/slots?dateId=${dateId}`);
        const data = await res.json();

        if (data.slots) {
          setSlots(data.slots);
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error(err);
        showToast("Error retrieving time slots for this date.", "error");
      } finally {
        setLoadingSlots(false);
      }
    },
    [showToast]
  );

  // When room changes, fetch slots for its assigned date
  useEffect(() => {
    if (!selectedRoom) {
      setSlots([]);
      setSelectedSlotId("");
      return;
    }

    setSelectedSlotId("");
    fetchSlotsForDate(selectedRoom.cleaningDateId);
  }, [selectedRoom, fetchSlotsForDate]);

  // Handle Booking Submission
  const handleConfirmBooking = async () => {
    if (!selectedRoomId) {
      showToast("Please select your room number first.", "error");
      return;
    }
    if (!selectedSlotId) {
      showToast("Please select a preferred time slot.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoomId,
          timeSlotId: selectedSlotId,
          staffAssistance,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle race conditions where another user booked at the same exact time
        if (res.status === 409 || data.conflictType) {
          if (data.conflictType === "SLOT_CONFLICT") {
            const slotName = data.conflictItem || "selected";
            setConflictAlert({
              type: "SLOT",
              message: `Time slot ${slotName} was just confirmed by another resident a moment ago.`,
              item: slotName,
            });

            // Automatically re-fetch slots so the conflicting slot turns into "Booked" immediately in UI
            if (selectedRoom) {
              await fetchSlotsForDate(selectedRoom.cleaningDateId);
            }
            setSelectedSlotId("");
            showToast(
              `Notice: Time slot ${slotName} was just booked by another resident. Please choose an alternative available time slot.`,
              "error"
            );
            return;
          } else if (data.conflictType === "ROOM_CONFLICT") {
            const roomName = data.conflictItem || "selected";
            setConflictAlert({
              type: "ROOM",
              message: `Room ${roomName} was just confirmed by another resident a moment ago.`,
              item: roomName,
            });

            await fetchRooms();
            setSelectedRoomId("");
            setSelectedSlotId("");
            showToast(
              `Notice: Room ${roomName} was just booked by another resident. Please choose another available room.`,
              "error"
            );
            return;
          }
        }

        throw new Error(data.error || "Failed to confirm booking.");
      }

      // Success
      setConflictAlert(null);
      setReceipt(data.booking);
      showToast("Booking confirmed successfully!", "success");

      // Immediate reactive update: remove booked room and booked slot from state
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoomId));
      setSlots((prev) =>
        prev.map((s) => (s.id === selectedSlotId ? { ...s, isBooked: true } : s))
      );
      setSelectedRoomId("");
      setSelectedSlotId("");
      setStaffAssistance(false);
    } catch (err: any) {
      showToast(err.message || "Something went wrong while confirming booking.", "error");
      fetchRooms();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-teal-500 selection:text-white">
      <Header hasActiveSession={hasActiveSession} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Loading Spinner */}
        {loadingSession ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
            <p className="text-slate-500 text-sm font-medium">Checking active booking sessions...</p>
          </div>
        ) : !hasActiveSession ? (
          /* State 1: No Active Session (Bright Theme) */
          <div className="max-w-2xl mx-auto my-12 bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl pointer-events-none" />
            <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-6 shadow-inner text-slate-500">
              <Calendar className="w-10 h-10 text-slate-500" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold mb-4 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Schedule Inactive
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-4">
              No Active Booking Session
            </h2>

            <p className="text-slate-600 text-base leading-relaxed max-w-lg mx-auto mb-8">
              No active booking session at this time. Please check back later or contact administration.
            </p>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 max-w-md mx-auto text-xs text-slate-600 flex items-start gap-3 text-left shadow-sm">
              <Shield className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Are you a system administrator?</span>
                <p className="mt-0.5 text-slate-600">
                  Log in via the <span className="text-teal-700 font-semibold">"For Admin"</span> button on the top right to upload the official schedule and initialize the booking window.
                </p>
              </div>
            </div>

            <button
              onClick={checkSession}
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        ) : (
          /* State 2: Active Booking Flow (Bright Theme) */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Session Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-50 via-white to-cyan-50 border border-teal-200/90 p-6 sm:p-8 shadow-sm">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Open for Booking
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {rooms.length} rooms remaining unbooked
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {sessionTitle}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                    Select your residential room to view its assigned maintenance date, then pick your preferred cleaning slot.
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Steps Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl space-y-10">
              {/* STEP 1: ROOM SELECTION */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-sm border border-teal-200 shadow-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Step 1: Select Your Room
                    </h2>
                    <p className="text-xs text-slate-500">
                      Choose from the list of unbooked rooms scheduled for this cycle.
                    </p>
                  </div>
                </div>

                {/* ROOM CONFLICT ALERT BANNER */}
                {conflictAlert && conflictAlert.type === "ROOM" && (
                  <div className="p-4.5 bg-rose-50 border-2 border-rose-400 rounded-2xl shadow-md flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-rose-950 flex items-center gap-1.5">
                          ⚠️ Room Conflict: Room Just Booked by Another Resident!
                        </h4>
                        <button
                          type="button"
                          onClick={() => setConflictAlert(null)}
                          className="text-rose-400 hover:text-rose-700 p-1 rounded-lg transition-colors"
                          title="Dismiss notice"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed mt-1">
                        Room <strong className="text-rose-950 font-bold bg-rose-200/80 px-2 py-0.5 rounded border border-rose-300">{conflictAlert.item}</strong> was confirmed by another resident just moments before you submitted.
                      </p>
                      <div className="mt-2.5 inline-flex items-center gap-2 bg-rose-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs">
                        <span>👉 Please choose another available room from the list below:</span>
                      </div>
                    </div>
                  </div>
                )}

                {rooms.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                    All rooms for this session have already completed their bookings!
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          id="room-search-input"
                          placeholder="Search room number (e.g. 39/92)..."
                          value={roomSearchQuery}
                          onChange={(e) => setRoomSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-sm transition-colors"
                        />
                      </div>

                      {distinctFloors.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                          <button
                            type="button"
                            onClick={() => setSelectedFloor("all")}
                            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${selectedFloor === "all"
                                ? "bg-teal-600 text-white border-teal-600 font-bold shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                          >
                            All Floors
                          </button>
                          {distinctFloors.map((fl) => (
                            <button
                              key={fl}
                              type="button"
                              onClick={() => setSelectedFloor(fl)}
                              className={`px-3 py-2 text-xs font-semibold rounded-xl border whitespace-nowrap transition-all ${selectedFloor === fl
                                  ? "bg-teal-600 text-white border-teal-600 font-bold shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {fl.toLowerCase().includes("floor") ? fl : `Floor ${fl}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Select Box */}
                    <div className="relative">
                      <select
                        id="room-select-dropdown"
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        className="w-full bg-white border border-slate-300 hover:border-slate-400 text-slate-900 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-sm"
                      >
                        <option value="">-- Choose your room from dropdown ({filteredRooms.length} available) --</option>
                        {filteredRooms.map((room) => (
                          <option key={room.id} value={room.id} className="text-slate-900 py-2">
                            {room.roomNumber} ({room.floor.toLowerCase().includes("floor") ? room.floor : `Floor ${room.floor}`})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs flex items-center gap-1">
                        <Building className="w-4 h-4 text-teal-600" />
                        <span>▼</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* STEP 2: DATE & SLOT DISPLAY */}
              <section
                className={`space-y-4 transition-all duration-300 ${selectedRoom ? "opacity-100" : "opacity-40 pointer-events-none"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-sm border border-teal-200 shadow-sm">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Step 2: Assigned Date & Preferred Time Slot
                    </h2>
                    <p className="text-xs text-slate-500">
                      Cleaning dates are assigned by floor wing. Choose an unbooked time slot on this date.
                    </p>
                  </div>
                </div>

                {selectedRoom && (
                  <div className="space-y-4 pt-1">
                    {/* Assigned Date Badge Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                            Assigned Cleaning Date
                          </span>
                          <p className="text-base sm:text-lg font-bold text-slate-900">
                            {selectedRoom.displayDate}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-700 font-medium px-3 py-1 bg-white rounded-lg border border-teal-200 self-start sm:self-auto shadow-sm">
                        Room: <span className="text-teal-900 font-bold">{selectedRoom.roomNumber}</span>
                      </div>
                    </div>

                    {/* TIME SLOT CONFLICT ALERT BANNER */}
                    {conflictAlert && conflictAlert.type === "SLOT" && (
                      <div className="p-4.5 bg-rose-50 border-2 border-rose-400 rounded-2xl shadow-md flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-rose-950 flex items-center gap-1.5">
                              ⚠️ Time Slot Conflict: Slot Just Booked by Another Resident!
                            </h4>
                            <button
                              type="button"
                              onClick={() => setConflictAlert(null)}
                              className="text-rose-400 hover:text-rose-700 p-1 rounded-lg transition-colors"
                              title="Dismiss notice"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-rose-800 leading-relaxed mt-1">
                            The time slot <strong className="text-rose-950 font-bold bg-rose-200/80 px-2 py-0.5 rounded border border-rose-300">{conflictAlert.item}</strong> you selected was confirmed by another resident just moments before you submitted.
                          </p>
                          <div className="mt-2.5 inline-flex items-center gap-2 bg-rose-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs">
                            <span>👉 Please choose an alternative available time slot from the updated list below:</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Time Slots Grid */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Available Time Slots on {selectedRoom.dateString}:
                      </label>

                      {loadingSlots ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-slate-500 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                          Loading open time slots...
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
                          <span>No time slots configured for this date. Please contact administrator.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {slots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            const isBooked = slot.isBooked;

                            if (isBooked) {
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  disabled
                                  className="relative p-3.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 shadow-2xs bg-slate-100/75 border-slate-200 text-slate-400 cursor-not-allowed select-none"
                                  title="This time slot has already been booked"
                                >
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-bold text-sm text-slate-400">{slot.timeSlot}</span>
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-500">
                                    Booked
                                  </span>
                                </button>
                              );
                            }

                            return (
                              <button
                                key={slot.id}
                                type="button"
                                id={`slot-btn-${slot.id}`}
                                onClick={() => {
                                  setSelectedSlotId(slot.id);
                                  if (conflictAlert?.type === "SLOT") {
                                    setConflictAlert(null);
                                  }
                                }}
                                className={`relative p-3.5 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 group shadow-sm ${isSelected
                                    ? "bg-teal-600 text-white border-teal-600 font-bold shadow-md shadow-teal-600/30 scale-[1.02]"
                                    : "bg-white hover:bg-teal-50/50 text-slate-800 border-slate-200 hover:border-teal-300"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-teal-600"}`} />
                                  <span className="font-bold text-sm">{slot.timeSlot}</span>
                                </div>
                                <span
                                  className={`text-[11px] ${isSelected ? "text-teal-100 font-medium" : "text-slate-500"
                                    }`}
                                >
                                  {isSelected ? "Selected" : "Available"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* STEP 3: ASSISTANCE INQUIRY */}
              <section
                className={`space-y-4 transition-all duration-300 ${selectedSlotId ? "opacity-100" : "opacity-40 pointer-events-none"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-sm border border-teal-200 shadow-sm">
                    3
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Step 3: Staff Assistance Inquiry
                    </h2>
                    <p className="text-xs text-slate-500">
                      Do you require staff assistance / supervision during the cleaning?
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Option: NO (Default) */}
                  <div
                    onClick={() => setStaffAssistance(false)}
                    id="assistance-no"
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3.5 shadow-sm ${!staffAssistance
                        ? "bg-teal-50/80 border-teal-500 shadow-teal-500/10"
                        : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${!staffAssistance
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-slate-300 bg-transparent"
                        }`}
                    >
                      {!staffAssistance && <CheckCircle className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">No (Default)</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Self-Access
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Resident or room representative will be present to directly grant room access to the cleaning team.
                      </p>
                    </div>
                  </div>

                  {/* Option: YES */}
                  <div
                    onClick={() => setStaffAssistance(true)}
                    id="assistance-yes"
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3.5 shadow-sm ${staffAssistance
                        ? "bg-amber-50 border-amber-500 shadow-amber-500/10"
                        : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${staffAssistance
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-slate-300 bg-transparent"
                        }`}
                    >
                      {staffAssistance && <CheckCircle className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">Yes, Require Staff</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Supervised
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Request institutional staff / building administration to accompany the technician during service.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* STEP 4: SUBMISSION & CONFIRMATION */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Your room and slot will be locked immediately upon confirmation.</span>
                </div>

                <button
                  type="button"
                  id="confirm-booking-btn"
                  onClick={handleConfirmBooking}
                  disabled={!selectedRoomId || !selectedSlotId || isSubmitting}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-md ${!selectedRoomId || !selectedSlotId || isSubmitting
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-teal-600/20 hover:scale-[1.01]"
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Confirming Reservation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm Booking</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <BookingReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/70 py-6 text-center text-xs text-slate-500">
        <p>BPS AC Cleaning Booking System &bull; Domain: bps.acbooking.com &bull; All Rights Reserved</p>
      </footer>
    </div>
  );
}
