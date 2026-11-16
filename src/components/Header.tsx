"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

interface HeaderProps {
  isAdmin?: boolean;
  onLogout?: () => void;
  hasActiveSession?: boolean;
}

export default function Header({ isAdmin = false, onLogout, hasActiveSession }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-18 py-3 flex items-center justify-between gap-3">
        {/* Logo & Brand Title */}
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image src="/favicon.ico" alt="" width={40} height={40} unoptimized className="shrink-0 object-contain" />
          <div className="flex flex-col">
            <span className="font-semibold text-lg sm:text-2xl text-blue-950 tracking-tight leading-tight">
              BPS AC Cleaning Booking
            </span>
            <span className="text-sm text-slate-500 hidden sm:block">
              Air conditioner cleaning schedule
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {hasActiveSession !== undefined && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasActiveSession ? "bg-blue-600" : "bg-slate-400"
                }`}
              />
              <span>{hasActiveSession ? "Bookings open" : "Bookings closed"}</span>
            </div>
          )}

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="px-3 py-2 text-xs sm:text-sm font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </Link>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="px-3 py-2 text-xs sm:text-sm font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/admin"
              id="admin-nav-button"
              className="px-3 py-2 text-xs sm:text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
