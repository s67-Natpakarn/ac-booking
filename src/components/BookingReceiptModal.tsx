"use client";

import { CheckCircle2, Calendar, CalendarPlus, Clock, MapPin, UserCheck, ArrowRight } from "lucide-react";
import { bookingIcs } from "@/lib/booking-calendar";

interface BookingReceipt {
  id: string;
  roomNumber: string;
  floor: string;
  dateString: string;
  displayDate: string;
  timeSlot: string;
  staffAssistance: boolean;
  createdAt: string;
  durationMinutes: number | null;
}

interface BookingReceiptModalProps {
  receipt: BookingReceipt | null;
  onClose: () => void;
}

export default function BookingReceiptModal({ receipt, onClose }: BookingReceiptModalProps) {
  if (!receipt) return null;

  const addToCalendar = () => {
    // A single-slot schedule has no gap to infer; use the standard 45 minutes.
    const duration = receipt.durationMinutes ?? 45;
    const file = new Blob([bookingIcs(receipt, duration)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ac-cleaning-${receipt.id}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-3 bg-slate-900/60 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="booking-confirmed-title" className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white border border-slate-200 rounded-xl px-6 py-5 sm:px-8 sm:py-6 text-slate-900">
        {/* Success Icon */}
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 id="booking-confirmed-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Booking confirmed
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Your cleaning appointment is booked.
          </p>
          <div className="inline-block mt-3 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-mono text-slate-700">
            Ref ID: <span className="text-blue-700 font-semibold">{receipt.id.slice(-8).toUpperCase()}</span>
          </div>
        </div>

        {/* Receipt Card Details */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-lg px-5 py-4 space-y-3 mb-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium">Room & Floor</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              Room {receipt.roomNumber} ({receipt.floor.toLowerCase().includes("floor") ? receipt.floor : `Floor ${receipt.floor}`})
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium">Cleaning Date</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {receipt.displayDate}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium">Reserved Time Slot</span>
            </div>
            <span className="text-base font-bold text-blue-800 bg-blue-100/70 px-2.5 py-0.5 rounded-lg border border-blue-200">
              {receipt.timeSlot}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-600">
              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium">Staff Assistance</span>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                receipt.staffAssistance
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-slate-200 text-slate-700 border border-slate-300"
              }`}
            >
              {receipt.staffAssistance ? "Yes (Supervision Required)" : "No (Self / Unaccompanied)"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 print:hidden">
          <button
            type="button"
            onClick={addToCalendar}
            className="py-3 px-3 rounded-md font-medium text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center gap-2 transition-colors"
          >
            <CalendarPlus className="w-4 h-4 shrink-0" />
            <span>Add to calendar</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-3 px-4 rounded-md font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors print:hidden"
        >
          <span>Done</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
