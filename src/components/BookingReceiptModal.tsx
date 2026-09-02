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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-100 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/10 animate-bounce">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Booking Confirmed!
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Your AC cleaning service slot has been securely reserved.
          </p>
          <div className="inline-block mt-3 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-mono text-slate-700">
            Ref ID: <span className="text-teal-700 font-semibold">{receipt.id.slice(-8).toUpperCase()}</span>
          </div>
        </div>

        {/* Receipt Card Details */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4 mb-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-sm font-medium">Room & Floor</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              Room {receipt.roomNumber} ({receipt.floor.toLowerCase().includes("floor") ? receipt.floor : `Floor ${receipt.floor}`})
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-sm font-medium">Cleaning Date</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {receipt.displayDate}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Clock className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-sm font-medium">Reserved Time Slot</span>
            </div>
            <span className="text-base font-bold text-teal-800 bg-teal-100/70 px-2.5 py-0.5 rounded-lg border border-teal-200">
              {receipt.timeSlot}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-600">
              <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
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
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all"
          >
            <span>Done / Return Home</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
