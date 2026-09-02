"use client";

import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import BookingReceiptModal from "@/components/BookingReceiptModal";
import { useToast } from "@/components/ToastContext";
import {
  Calendar,
  Clock,
  MapPin,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Search,
  Sparkles,
  Shield,
  Loader2,
  Building,
  RefreshCw,
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

  // When room changes, fetch slots for its assigned date
  useEffect(() => {
    if (!selectedRoom) {
      setSlots([]);
      setSelectedSlotId("");
      return;
    }

    const fetchSlotsForDate = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlotId("");
        const res = await fetch(`/api/booking/slots?dateId=${selectedRoom.cleaningDateId}`);
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
    };

    fetchSlotsForDate();
  }, [selectedRoom, showToast]);

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
        throw new Error(data.error || "Failed to confirm booking.");
      }

      // Show receipt modal
      setReceipt(data.booking);
      showToast("Booking confirmed successfully!", "success");

      // Immediate reactive update: remove booked room and booked slot from state
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoomId));
      setSlots((prev) => prev.filter((s) => s.id !== selectedSlotId));
      setSelectedRoomId("");
      setSelectedSlotId("");
      setStaffAssistance(false);
    } catch (err: any) {
      showToast(err.message || "Something went wrong while confirming booking.", "error");
      // Refresh current rooms and slots in case another user booked it
      fetchRooms();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500/30 selection:text-teal-200">
      <Header hasActiveSession={hasActiveSession} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Loading Spinner */}
        {loadingSession ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
            <p className="text-slate-400 text-sm font-medium">Checking active booking sessions...</p>
          </div>
        ) : !hasActiveSession ? (
          /* State 1: No Active Session */
          <div className="max-w-2xl mx-auto my-12 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="w-20 h-20 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-6 shadow-inner text-slate-400">
              <Calendar className="w-10 h-10 text-slate-400" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-4 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Schedule Inactive
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4">
              No Active Booking Session
            </h2>

            <p className="text-slate-300 text-base leading-relaxed max-w-lg mx-auto mb-8">
              No active booking session at this time. Please check back later or contact administration.
            </p>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 max-w-md mx-auto text-xs text-slate-400 flex items-start gap-3 text-left">
              <Shield className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Are you a system administrator?</span>
                <p className="mt-0.5 text-slate-400">
                  Log in via the <span className="text-teal-300 font-medium">"For Admin"</span> link on the top right to upload the official schedule and initialize the booking window.
                </p>
              </div>
            </div>

            <button
              onClick={checkSession}
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        ) : (
          /* State 2: Active Booking Flow */
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Session Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 p-6 sm:p-8 shadow-xl">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Open for Booking
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {rooms.length} rooms remaining unbooked
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {sessionTitle}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                    Select your residential room to see its assigned maintenance date, then pick your preferred cleaning slot.
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Steps Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl space-y-10">
              {/* STEP 1: ROOM SELECTION */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-sm border border-teal-500/30 shadow-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Step 1: Select Your Room
                    </h2>
                    <p className="text-xs text-slate-400">
                      Choose from the list of unbooked rooms scheduled for this cycle.
                    </p>
                  </div>
                </div>

                {rooms.length === 0 ? (
                  <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
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
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                        />
                      </div>

                      {distinctFloors.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                          <button
                            type="button"
                            onClick={() => setSelectedFloor("all")}
                            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                              selectedFloor === "all"
                                ? "bg-teal-500 text-slate-950 border-teal-400 font-bold"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            All Floors
                          </button>
                          {distinctFloors.map((fl) => (
                            <button
                              key={fl}
                              type="button"
                              onClick={() => setSelectedFloor(fl)}
                              className={`px-3 py-2 text-xs font-semibold rounded-xl border whitespace-nowrap transition-all ${
                                selectedFloor === fl
                                  ? "bg-teal-500 text-slate-950 border-teal-400 font-bold"
                                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
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
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 text-white rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-inner"
                      >
                        <option value="">-- Choose your room from dropdown ({filteredRooms.length} available) --</option>
                        {filteredRooms.map((room) => (
                          <option key={room.id} value={room.id} className="bg-slate-900 text-white py-2">
                            {room.roomNumber} ({room.floor.toLowerCase().includes("floor") ? room.floor : `Floor ${room.floor}`}) — Scheduled on {room.dateString}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs flex items-center gap-1">
                        <Building className="w-4 h-4 text-teal-400" />
                        <span>▼</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* STEP 2: DATE & SLOT DISPLAY */}
              <section
                className={`space-y-4 transition-all duration-300 ${
                  selectedRoom ? "opacity-100" : "opacity-40 pointer-events-none"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-sm border border-teal-500/30 shadow-sm">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Step 2: Assigned Date & Preferred Time Slot
                    </h2>
                    <p className="text-xs text-slate-400">
                      Cleaning dates are assigned by floor wing. Choose an unbooked time slot on this date.
                    </p>
                  </div>
                </div>

                {selectedRoom && (
                  <div className="space-y-4 pt-1">
                    {/* Assigned Date Badge Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-teal-950/60 to-slate-950 border border-teal-500/30 rounded-2xl p-4 shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                            Assigned Cleaning Date
                          </span>
                          <p className="text-base sm:text-lg font-bold text-white">
                            {selectedRoom.displayDate}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-900 rounded-lg border border-slate-800 self-start sm:self-auto">
                        Room: <span className="text-white font-bold">{selectedRoom.roomNumber}</span>
                      </div>
                    </div>

                    {/* Time Slots Grid */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Available Time Slots on {selectedRoom.dateString}:
                      </label>

                      {loadingSlots ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                          Loading open time slots...
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="p-6 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-center text-amber-300 text-sm flex items-center justify-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          <span>No available slots remaining for this date. Please contact administrator.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {slots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                id={`slot-btn-${slot.id}`}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`relative p-3.5 rounded-2xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 group ${
                                  isSelected
                                    ? "bg-teal-500 text-slate-950 border-teal-300 font-bold shadow-lg shadow-teal-500/30 scale-[1.02]"
                                    : "bg-slate-950/80 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-teal-500/40"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-slate-950" : "text-teal-400"}`} />
                                  <span className="font-semibold text-sm">{slot.timeSlot}</span>
                                </div>
                                <span
                                  className={`text-[11px] ${
                                    isSelected ? "text-slate-900 font-semibold" : "text-slate-400"
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
                className={`space-y-4 transition-all duration-300 ${
                  selectedSlotId ? "opacity-100" : "opacity-40 pointer-events-none"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-sm border border-teal-500/30 shadow-sm">
                    3
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Step 3: Staff Assistance Inquiry
                    </h2>
                    <p className="text-xs text-slate-400">
                      Do you require staff assistance / supervision during the cleaning?
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Option: NO (Default) */}
                  <div
                    onClick={() => setStaffAssistance(false)}
                    id="assistance-no"
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      !staffAssistance
                        ? "bg-slate-800/90 border-teal-400/80 shadow-md shadow-teal-950/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        !staffAssistance
                          ? "border-teal-400 bg-teal-500 text-slate-950"
                          : "border-slate-600 bg-transparent"
                      }`}
                    >
                      {!staffAssistance && <CheckCircle className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">No (Default)</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          Self-Access
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Resident or room representative will be present to directly grant room access to the cleaning team.
                      </p>
                    </div>
                  </div>

                  {/* Option: YES */}
                  <div
                    onClick={() => setStaffAssistance(true)}
                    id="assistance-yes"
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      staffAssistance
                        ? "bg-amber-950/30 border-amber-400/80 shadow-md shadow-amber-950/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        staffAssistance
                          ? "border-amber-400 bg-amber-500 text-slate-950"
                          : "border-slate-600 bg-transparent"
                      }`}
                    >
                      {staffAssistance && <CheckCircle className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">Yes, Require Staff</span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Supervised
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Request institutional staff / building administration to accompany the technician during service.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* STEP 4: SUBMISSION & CONFIRMATION */}
              <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Your room and slot will be locked immediately upon confirmation.</span>
                </div>

                <button
                  type="button"
                  id="confirm-booking-btn"
                  onClick={handleConfirmBooking}
                  disabled={!selectedRoomId || !selectedSlotId || isSubmitting}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg ${
                    !selectedRoomId || !selectedSlotId || isSubmitting
                      ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 shadow-teal-500/25 hover:scale-[1.02]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
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
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>BPS AC Cleaning Booking System &bull; Domain: bps.acbooking.com &bull; All Rights Reserved</p>
      </footer>
    </div>
  );
}
