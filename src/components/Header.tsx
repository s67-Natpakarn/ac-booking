"use client";

import Link from "next/link";
import { ShieldCheck, Wind, Sparkles } from "lucide-react";

interface HeaderProps {
  isAdmin?: boolean;
  onLogout?: () => void;
  hasActiveSession?: boolean;
}

export default function Header({ isAdmin = false, onLogout, hasActiveSession }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo & Brand Title */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Wind className="w-6 h-6 text-teal-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg sm:text-xl text-white tracking-tight group-hover:text-teal-300 transition-colors">
                BPS AC Cleaning Booking System
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Sparkles className="w-2.5 h-2.5" /> bps.acbooking.com
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium hidden xs:block">
              Institutional AC Maintenance & Service Portal
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {hasActiveSession !== undefined && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasActiveSession ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              <span>{hasActiveSession ? "Active Booking Window" : "Session Offline"}</span>
            </div>
          )}

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Admin Dashboard</span>
              </Link>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="px-3 py-2 text-xs sm:text-sm font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/admin"
              id="admin-nav-button"
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-teal-950/60 hover:to-slate-900 text-slate-200 hover:text-teal-300 border border-slate-700/80 hover:border-teal-500/40 shadow-sm transition-all duration-200 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>For Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
