"use client";

import { CheckCircle2, Calendar, Clock, MapPin, UserCheck, Printer, ArrowRight } from "lucide-react";

interface BookingReceipt {
  id: string;
  roomNumber: string;
  floor: string;
  dateString: string;
  displayDate: string;
  timeSlot: string;
  staffAssistance: boolean;
  createdAt: string;
}

interface BookingReceiptModalProps {
  receipt: BookingReceipt | null;
  onClose: () => void;
}

export default function BookingReceiptModal({ receipt, onClose }: BookingReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-teal-950/40 text-white overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20 animate-bounce">
            <CheckCircle2 className="w-9 h-9 text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Booking Confirmed!
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Your AC cleaning service slot has been securely reserved.
          </p>
          <div className="inline-block mt-3 px-3 py-1 bg-slate-800/90 border border-slate-700 rounded-full text-xs font-mono text-slate-300">
            Ref ID: <span className="text-teal-400 font-semibold">{receipt.id.slice(-8).toUpperCase()}</span>
          </div>
        </div>

        {/* Receipt Card Details */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4 mb-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-slate-300">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-sm font-medium">Room & Floor</span>
            </div>
            <span className="text-sm font-bold text-white">
              Room {receipt.roomNumber} ({receipt.floor.toLowerCase().includes("floor") ? receipt.floor : `Floor ${receipt.floor}`})
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-sm font-medium">Cleaning Date</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {receipt.displayDate}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Clock className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-sm font-medium">Reserved Time Slot</span>
            </div>
            <span className="text-base font-bold text-teal-300 bg-teal-500/10 px-2.5 py-0.5 rounded-lg border border-teal-500/20">
              {receipt.timeSlot}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-300">
              <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-sm font-medium">Staff Assistance</span>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                receipt.staffAssistance
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-slate-800 text-slate-300 border border-slate-700"
              }`}
            >
              {receipt.staffAssistance ? "Yes (Supervision Required)" : "No (Self / Unaccompanied)"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition-all"
          >
            <span>Done / Return Home</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
