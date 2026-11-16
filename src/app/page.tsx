"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Header from "@/components/Header";
import RoomCombobox from "@/components/RoomCombobox";
import BookingReceiptModal from "@/components/BookingReceiptModal";
import { useToast } from "@/components/ToastContext";
import {
  Calendar,
  Clock,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Shield,
  Loader2,
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

  // The floor filter narrows the options before the combobox searches room numbers.
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => selectedFloor === "all" || room.floor === selectedFloor);
  }, [rooms, selectedFloor]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      <Header hasActiveSession={hasActiveSession} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Loading Spinner */}
        {loadingSession ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 text-sm font-medium">Checking active booking sessions...</p>
          </div>
        ) : !hasActiveSession ? (
          /* State 1: No Active Session (Bright Theme) */
          <div className="max-w-2xl mx-auto my-10 bg-white border border-slate-200/90 rounded-xl px-8 py-6 sm:px-12 sm:py-10 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-5 text-slate-500">
              <Calendar className="w-10 h-10 text-slate-500" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold mb-3 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Schedule Inactive
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              No Active Booking Session
            </h2>

            <p className="text-slate-600 text-base leading-relaxed max-w-lg mx-auto mb-6">
              No active booking session at this time. Please check back later or contact administration.
            </p>

            <div className="px-5 py-4 bg-slate-50 rounded-lg border border-slate-200 max-w-md mx-auto text-xs text-slate-600 flex items-start gap-3 text-left">
              <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Are you a system administrator?</span>
                <p className="mt-0.5 text-slate-600">
                  Log in via the <span className="text-blue-700 font-semibold">"Admin"</span> button on the top right to upload a schedule and open bookings.
                </p>
              </div>
            </div>

            <button
              onClick={checkSession}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        ) : (
          /* State 2: Active Booking Flow (Bright Theme) */
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Session Banner */}
            <div className="px-1">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Booking open
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {rooms.length} rooms remaining unbooked
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                    {sessionTitle}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                    Choose your room, check the cleaning date, and select a time.
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Steps Card */}
            <div className="bg-white border border-slate-200/90 rounded-xl px-6 py-5 sm:px-6 sm:py-5 space-y-4">
              {/* STEP 1: ROOM SELECTION */}
              <section className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Select your room
                    </h2>
                  </div>
                </div>

                {/* ROOM CONFLICT ALERT BANNER */}
                {conflictAlert && conflictAlert.type === "ROOM" && (
                  <div className="p-4.5 bg-rose-50 border-2 border-rose-400 rounded-lg flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="w-10 h-10 rounded-md bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-rose-950 flex items-center gap-1.5">
                           This room has just been booked
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
                      <div className="mt-2.5 inline-flex items-center gap-2 bg-rose-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-md">
                        <span> Choose another available room below.</span>
                      </div>
                    </div>
                  </div>
                )}

                {rooms.length === 0 ? (
                  <div className="px-6 py-5 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
                    All rooms in this schedule have been booked.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex-1 min-w-0">
                        <RoomCombobox
                          rooms={filteredRooms}
                          selectedRoom={selectedRoom}
                          onSelect={(id) => {
                            if (id === selectedRoomId) return;
                            setSelectedRoomId(id);
                            setSelectedSlotId("");
                            setSlots([]);
                          }}
                        />
                      </div>

                      {distinctFloors.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                          <button
                            type="button"
                            onClick={() => setSelectedFloor("all")}
                            className={`px-3 py-2 text-xs font-semibold rounded-md border transition-all ${selectedFloor === "all"
                                ? "bg-blue-600 text-white border-blue-600 font-bold "
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
                              className={`px-3 py-2 text-xs font-semibold rounded-md border whitespace-nowrap transition-all ${selectedFloor === fl
                                  ? "bg-blue-600 text-white border-blue-600 font-bold "
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {fl.toLowerCase().includes("floor") ? fl : `Floor ${fl}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </section>

              {/* STEP 2: DATE & SLOT DISPLAY */}
              <section
                className={`space-y-2 transition-all duration-300 ${selectedRoom ? "opacity-100" : "opacity-40 pointer-events-none"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Choose your time
                    </h2>
                  </div>
                </div>

                {selectedRoom && (
                  <div className="space-y-2">
                    {/* Assigned Date Badge Banner */}
                    <div className="flex items-center gap-2 text-sm text-blue-950">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-medium">{selectedRoom.displayDate}</span>
                    </div>

                    {/* TIME SLOT CONFLICT ALERT BANNER */}
                    {conflictAlert && conflictAlert.type === "SLOT" && (
                      <div className="p-4.5 bg-rose-50 border-2 border-rose-400 rounded-lg flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="w-10 h-10 rounded-md bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-rose-950 flex items-center gap-1.5">
                               This time has just been booked
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
                          <div className="mt-2.5 inline-flex items-center gap-2 bg-rose-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-md">
                            <span> Choose another available time below.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Time Slots Grid */}
                    <div className="space-y-2">

                      {loadingSlots ? (
                        <div className="px-8 py-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          Loading open time slots...
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="px-6 py-5 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
                          <span>No time slots configured for this date. Please contact administrator.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {slots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            const isBooked = slot.isBooked;

                            if (isBooked) {
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  disabled
                                  className="relative min-h-11 px-2 py-2 rounded-md border text-center flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 bg-slate-100/75 border-slate-200 text-slate-400 cursor-not-allowed select-none"
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
                                aria-pressed={isSelected}
                                className={`relative min-h-11 px-2 py-2 rounded-md border text-center transition-colors flex items-center justify-center gap-1.5 group ${isSelected
                                    ? "bg-blue-600 text-white border-blue-600 font-bold   "
                                    : "bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200 hover:border-blue-300"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-blue-600"}`} />
                                  <span className="font-bold text-sm">{slot.timeSlot}</span>
                                </div>
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
                className={`space-y-2 transition-all duration-300 ${selectedSlotId ? "opacity-100" : "opacity-40 pointer-events-none"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                    3
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Staff assistance
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6" role="radiogroup" aria-label="Staff assistance">
                  <label className="flex min-h-11 items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="staff-assistance"
                      id="assistance-no"
                      checked={!staffAssistance}
                      onChange={() => setStaffAssistance(false)}
                      disabled={!selectedSlotId}
                      className="w-4 h-4 shrink-0 appearance-auto accent-blue-600"
                    />
                    <span>
                      <span className="block font-medium text-sm text-slate-900">No assistance</span>
                      <span className="block text-xs text-slate-500">I will arrange room access.</span>
                    </span>
                  </label>
                  <label className="flex min-h-11 items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="staff-assistance"
                      id="assistance-yes"
                      checked={staffAssistance}
                      onChange={() => setStaffAssistance(true)}
                      disabled={!selectedSlotId}
                      className="w-4 h-4 shrink-0 appearance-auto accent-blue-600"
                    />
                    <span>
                      <span className="block font-medium text-sm text-slate-900">Request assistance</span>
                      <span className="block text-xs text-slate-500">Staff will accompany the technician.</span>
                    </span>
                  </label>
                </div>
              </section>

              {/* STEP 4: SUBMISSION & CONFIRMATION */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Check your room and time before confirming.</span>
                </div>

                <button
                  type="button"
                  id="confirm-booking-btn"
                  onClick={handleConfirmBooking}
                  disabled={!selectedRoomId || !selectedSlotId || isSubmitting}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5  ${!selectedRoomId || !selectedSlotId || isSubmitting
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
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

    </div>
  );
}
