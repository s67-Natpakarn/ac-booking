"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Header from "@/components/Header";
import { useToast } from "@/components/ToastContext";
import {
  Shield,
  KeyRound,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Plus,
  AlertTriangle,
  RotateCcw,
  Search,
  Users,
  Building,
  Loader2,
  Check,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface CleaningDate {
  id: string;
  dateString: string;
  displayDate: string;
}

interface RoomItem {
  id: string;
  roomNumber: string;
  floor: string;
  cleaningDateId: string;
  isBooked: boolean;
  cleaningDate: CleaningDate;
  booking?: {
    id: string;
    timeString: string;
    staffAssistance: boolean;
    createdAt: string;
  } | null;
}

interface TimeSlotItem {
  id: string;
  cleaningDateId: string;
  timeSlot: string;
  isBooked: boolean;
  cleaningDate: CleaningDate;
}

interface BookingRecord {
  id: string;
  roomNumber: string;
  floor: string;
  dateString: string;
  timeString: string;
  staffAssistance: boolean;
  createdAt: string;
  room: {
    cleaningDate: {
      displayDate: string;
    };
  };
}

interface DashboardStats {
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  totalDates: number;
}

export default function AdminPage() {
  const { showToast } = useToast();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Data State
  const [loadingData, setLoadingData] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("BPS AC Cleaning Booking Schedule");
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [dates, setDates] = useState<CleaningDate[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [slots, setSlots] = useState<TimeSlotItem[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Navigation Tabs: 'bookings' | 'rooms' | 'slots' | 'danger'
  const [activeTab, setActiveTab] = useState<"bookings" | "rooms" | "slots" | "danger">("bookings");

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");

  // Modal States
  // Room modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomModalMode, setRoomModalMode] = useState<"add" | "edit">("add");
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomFormNumber, setRoomFormNumber] = useState("");
  const [roomFormFloor, setRoomFormFloor] = useState("1");
  const [roomFormDateId, setRoomFormDateId] = useState("");

  // Slot modal
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotModalMode, setSlotModalMode] = useState<"add" | "edit">("add");
  const [currentSlotId, setCurrentSlotId] = useState<string | null>(null);
  const [slotFormTime, setSlotFormTime] = useState("");
  const [slotFormDateId, setSlotFormDateId] = useState("");

  // Reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [resetting, setResetting] = useState(false);

  // Check auth on mount
  const checkAuth = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch("/api/admin/check-auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        await fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoadingData(true);
      const res = await fetch("/api/admin/data");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setHasActiveSession(Boolean(data.systemSetting?.hasActiveSession));
      setSessionTitle(data.systemSetting?.sessionTitle || "BPS AC Cleaning Booking Schedule");
      setUploadedFilename(data.systemSetting?.uploadedFilename || null);
      setDates(data.dates || []);
      setRooms(data.rooms || []);
      setSlots(data.timeSlots || []);
      setBookings(data.bookings || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error(err);
      showToast("Failed to load admin schedule data.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast("Please enter the administrator password.", "error");
      return;
    }
    try {
      setLoginLoading(true);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Incorrect password.");
      }

      showToast("Authenticated as Administrator.", "success");
      setIsAuthenticated(true);
      setPassword("");
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Authentication failed.", "error");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      setIsAuthenticated(false);
      showToast("Signed out successfully.", "info");
    } catch (err) {
      console.error(err);
    }
  };

  // Handle File Upload
  const handleUploadExcel = async () => {
    if (!selectedFile) {
      showToast("Please select an Excel file (.xlsx or .xls) first.", "error");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse schedule.");
      }

      showToast(
        `Schedule initialized! Extracted ${data.summary.totalRooms} rooms & ${data.summary.totalSlots} slots across ${data.summary.totalDates} dates.`,
        "success"
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to process Excel file.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Handle Seed Demo Schedule
  const handleSeedDemo = async () => {
    try {
      setUploading(true);
      const res = await fetch("/api/admin/seed-demo", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to seed demo schedule.");
      }

      showToast("Demo schedule seeded with 19 rooms and standard decimal slots!", "success");
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to seed demo.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Handle Room Actions
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormNumber || !roomFormDateId) {
      showToast("Room number and assigned date are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: roomModalMode === "add" ? "create" : "update",
          id: currentRoomId,
          roomNumber: roomFormNumber,
          floor: roomFormFloor,
          cleaningDateId: roomFormDateId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save room.");
      }

      showToast(
        roomModalMode === "add" ? "Room added successfully." : "Room updated successfully.",
        "success"
      );
      setRoomModalOpen(false);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Error saving room.", "error");
    }
  };

  const handleDeleteRoom = async (id: string, roomNum: string) => {
    if (!confirm(`Are you sure you want to delete Room ${roomNum}?`)) return;

    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete room.");

      showToast(`Room ${roomNum} deleted.`, "info");
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Error deleting room.", "error");
    }
  };

  // Handle Slot Actions
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotFormTime || !slotFormDateId) {
      showToast("Time slot and assigned date are required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: slotModalMode === "add" ? "create" : "update",
          id: currentSlotId,
          timeSlot: slotFormTime,
          cleaningDateId: slotFormDateId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save slot.");
      }

      showToast(
        slotModalMode === "add" ? "Time slot added." : "Time slot updated.",
        "success"
      );
      setSlotModalOpen(false);
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Error saving slot.", "error");
    }
  };

  const handleDeleteSlot = async (id: string, timeStr: string) => {
    if (!confirm(`Delete slot ${timeStr}?`)) return;

    try {
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete slot.");

      showToast(`Slot ${timeStr} deleted.`, "info");
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Error deleting slot.", "error");
    }
  };

  // Handle Danger Reset
  const handleResetSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmationText !== "RESET") {
      showToast('Please type "RESET" in all capital letters to confirm.', "error");
      return;
    }

    try {
      setResetting(true);
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "RESET" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset session.");
      }

      showToast("Booking session has been completely reset.", "success");
      setResetModalOpen(false);
      setResetConfirmationText("");
      await fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Error resetting session.", "error");
    } finally {
      setResetting(false);
    }
  };

  // Export Results
  const handleExport = () => {
    window.location.href = "/api/admin/export";
    showToast("Generating and downloading multi-sheet Excel export...", "info");
  };

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.floor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.timeString.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = selectedDateFilter === "all" || b.dateString === selectedDateFilter;
      return matchesSearch && matchesDate;
    });
  }, [bookings, searchQuery, selectedDateFilter]);

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.floor.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate =
        selectedDateFilter === "all" || r.cleaningDate.dateString === selectedDateFilter;
      return matchesSearch && matchesDate;
    });
  }, [rooms, searchQuery, selectedDateFilter]);

  // Filtered Slots
  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      const matchesSearch = s.timeSlot.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate =
        selectedDateFilter === "all" || s.cleaningDate.dateString === selectedDateFilter;
      return matchesSearch && matchesDate;
    });
  }, [slots, searchQuery, selectedDateFilter]);

  // 1. Loading screen
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  // 2. Authentication Password Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto mb-3 text-teal-400">
                <KeyRound className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Access</h1>
              <p className="text-xs text-slate-400 mt-1">
                Enter your administrative password to access schedule management.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admin Password
                </label>
                <input
                  type="password"
                  id="admin-password-input"
                  placeholder="Enter admin password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                id="admin-login-submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25"
              >
                {loginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                <span>Sign In to Admin Portal</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <Link href="/" className="text-xs text-slate-400 hover:text-teal-300 transition-colors">
                &larr; Return to Public Booking Portal
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header isAdmin={true} onLogout={handleLogout} hasActiveSession={hasActiveSession} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Administration Console
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  hasActiveSession
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {hasActiveSession ? "Active Session" : "Pre-Upload"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {uploadedFilename ? `Loaded from: ${uploadedFilename}` : "No schedule uploaded yet"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/"
              target="_blank"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span>Preview Public View</span>
            </Link>

            {hasActiveSession && (
              <button
                onClick={handleExport}
                id="export-results-btn"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 flex items-center gap-2 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Results to Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* STATE A: PRE-UPLOAD STATE (When no active session exists) */}
        {!hasActiveSession ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Card */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Upload & Initialize Cleaning Schedule
                  </h2>
                  <p className="text-xs text-slate-400">
                    Upload your institutional Excel file (.xlsx or .xls) to launch the booking session.
                  </p>
                </div>
              </div>

              {/* Drag & drop upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all group"
              >
                <input
                  type="file"
                  id="excel-file-input"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 text-slate-500 group-hover:text-teal-400 mx-auto mb-3 transition-colors" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-teal-300">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to choose another file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-300">
                      Click to browse or drag & drop Excel workbook
                    </p>
                    <p className="text-xs text-slate-500">Supports .xlsx and .xls formats</p>
                  </div>
                )}
              </div>

              {/* Upload Action Button */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <a
                  href="/api/admin/sample-template"
                  download="bps_ac_cleaning_template.xlsx"
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Excel Template</span>
                </a>

                <button
                  type="button"
                  id="process-excel-btn"
                  onClick={handleUploadExcel}
                  disabled={!selectedFile || uploading}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    !selectedFile || uploading
                      ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                      : "bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/25"
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Process & Initialize Schedule</span>
                </button>
              </div>
            </div>

            {/* Quick Demo Seed Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 mb-3">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Fast Setup / Demo</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">Seed Sample Schedule</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Don't have an Excel file ready? Instant-populate 19 institutional rooms across 3 dates
                  with the exact decimal time slots (`9.3`, `10.15`, `12`, etc.) and Club House exclusion
                  rule verified.
                </p>
              </div>

              <button
                type="button"
                id="seed-demo-btn"
                onClick={handleSeedDemo}
                disabled={uploading}
                className="w-full py-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 hover:border-teal-500/40 flex items-center justify-center gap-2 transition-all"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-teal-400" />
                )}
                <span>Load Demo Sample Schedule</span>
              </button>
            </div>
          </div>
        ) : (
          /* STATE B: ACTIVE MANAGEMENT DASHBOARD */
          <div className="space-y-8">
            {/* KPI Stat Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium">Total Rooms</span>
                    <Building className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{stats.totalRooms}</div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Across {stats.totalDates} cleaning dates
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium">Completed Bookings</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400">{stats.bookedRooms}</div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {((stats.bookedRooms / Math.max(stats.totalRooms, 1)) * 100).toFixed(0)}% completion rate
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium">Remaining Unbooked</span>
                    <Users className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300">{stats.availableRooms}</div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Rooms still pending booking
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-medium">Available Time Slots</span>
                    <Clock className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-cyan-300">{stats.availableSlots}</div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Out of {stats.totalSlots} total slots
                  </span>
                </div>
              </div>
            )}

            {/* Management Tabs */}
            <div className="border-b border-slate-800 flex items-center justify-between gap-4 overflow-x-auto pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tab-bookings"
                  onClick={() => setActiveTab("bookings")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "bookings"
                      ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completed Bookings ({bookings.length})</span>
                </button>

                <button
                  type="button"
                  id="tab-rooms"
                  onClick={() => setActiveTab("rooms")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "rooms"
                      ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>Rooms Management ({rooms.length})</span>
                </button>

                <button
                  type="button"
                  id="tab-slots"
                  onClick={() => setActiveTab("slots")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "slots"
                      ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Time Slots ({slots.length})</span>
                </button>

                <button
                  type="button"
                  id="tab-danger"
                  onClick={() => setActiveTab("danger")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "danger"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                      : "bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Danger Zone</span>
                </button>
              </div>

              {/* Action Buttons for Tabs */}
              {activeTab === "rooms" && (
                <button
                  onClick={() => {
                    setRoomModalMode("add");
                    setCurrentRoomId(null);
                    setRoomFormNumber("");
                    setRoomFormFloor("1");
                    setRoomFormDateId(dates[0]?.id || "");
                    setRoomModalOpen(true);
                  }}
                  id="add-room-btn"
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Room</span>
                </button>
              )}

              {activeTab === "slots" && (
                <button
                  onClick={() => {
                    setSlotModalMode("add");
                    setCurrentSlotId(null);
                    setSlotFormTime("");
                    setSlotFormDateId(dates[0]?.id || "");
                    setSlotModalOpen(true);
                  }}
                  id="add-slot-btn"
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Time Slot</span>
                </button>
              )}
            </div>

            {/* Filter / Search Bar for Tables */}
            {activeTab !== "danger" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by room, floor, or time..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">All Dates ({dates.length})</option>
                    {dates.map((d) => (
                      <option key={d.id} value={d.dateString}>
                        {d.dateString}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB 1: COMPLETED BOOKINGS VIEW */}
            {activeTab === "bookings" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Room No</th>
                        <th className="py-3.5 px-4">Floor</th>
                        <th className="py-3.5 px-4">Assigned Cleaning Date</th>
                        <th className="py-3.5 px-4">Time Slot</th>
                        <th className="py-3.5 px-4">Staff Assistance Required</th>
                        <th className="py-3.5 px-4">Booking Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            No bookings recorded yet.
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-white">{b.roomNumber}</td>
                            <td className="py-3.5 px-4 text-slate-300">{b.floor}</td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <span className="font-semibold text-white">{b.dateString}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                                {b.timeString}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                                  b.staffAssistance
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                                }`}
                              >
                                {b.staffAssistance ? "YES (Supervised)" : "No"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                              {new Date(b.createdAt).toLocaleString("en-US", {
                                timeZone: "Asia/Bangkok",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: ROOMS CRUD TABLE */}
            {activeTab === "rooms" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Room No</th>
                        <th className="py-3.5 px-4">Floor</th>
                        <th className="py-3.5 px-4">Assigned Date</th>
                        <th className="py-3.5 px-4">Booking Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRooms.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            No rooms found.
                          </td>
                        </tr>
                      ) : (
                        filteredRooms.map((room) => (
                          <tr key={room.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-white">{room.roomNumber}</td>
                            <td className="py-3.5 px-4 text-slate-300">{room.floor}</td>
                            <td className="py-3.5 px-4 text-slate-300">{room.cleaningDate.dateString}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  room.isBooked
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                                }`}
                              >
                                {room.isBooked ? "Booked" : "Available"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setRoomModalMode("edit");
                                  setCurrentRoomId(room.id);
                                  setRoomFormNumber(room.roomNumber);
                                  setRoomFormFloor(room.floor);
                                  setRoomFormDateId(room.cleaningDateId);
                                  setRoomModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Edit Room"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoom(room.id, room.roomNumber)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="Delete Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: TIME SLOTS CRUD TABLE */}
            {activeTab === "slots" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Cleaning Date</th>
                        <th className="py-3.5 px-4">Time Slot</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredSlots.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-500">
                            No slots found.
                          </td>
                        </tr>
                      ) : (
                        filteredSlots.map((slot) => (
                          <tr key={slot.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 text-slate-300">{slot.cleaningDate.dateString}</td>
                            <td className="py-3.5 px-4 font-bold text-teal-300">{slot.timeSlot}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  slot.isBooked
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                                }`}
                              >
                                {slot.isBooked ? "Reserved" : "Open"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setSlotModalMode("edit");
                                  setCurrentSlotId(slot.id);
                                  setSlotFormTime(slot.timeSlot);
                                  setSlotFormDateId(slot.cleaningDateId);
                                  setSlotModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Edit Slot"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSlot(slot.id, slot.timeSlot)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="Delete Slot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: DANGER ZONE / RESET */}
            {activeTab === "danger" && (
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Danger Zone: Reset Booking Session
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Clears all current bookings, rooms, and uploaded slots, returning the system to the initial pre-upload state.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-2xl border border-rose-500/20 text-xs text-slate-300 space-y-2">
                  <p className="font-semibold text-rose-400">Warning: This action cannot be undone.</p>
                  <p>
                    All residents' confirmed bookings, room entries, and date-slot allocations will be permanently wiped.
                    Make sure to click <span className="text-teal-300 font-semibold">"Export Results to Excel"</span> before proceeding if you need an archive.
                  </p>
                </div>

                <button
                  type="button"
                  id="open-reset-modal-btn"
                  onClick={() => {
                    setResetConfirmationText("");
                    setResetModalOpen(true);
                  }}
                  className="px-6 py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Booking Session</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ROOM ADD / EDIT MODAL */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">
                {roomModalMode === "add" ? "Add New Room" : "Edit Room"}
              </h3>
              <button
                onClick={() => setRoomModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room Number (e.g. 39/92)
                </label>
                <input
                  type="text"
                  required
                  value={roomFormNumber}
                  onChange={(e) => setRoomFormNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Floor</label>
                <input
                  type="text"
                  required
                  value={roomFormFloor}
                  onChange={(e) => setRoomFormFloor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Cleaning Date
                </label>
                <select
                  value={roomFormDateId}
                  onChange={(e) => setRoomFormDateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  {dates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dateString} ({d.displayDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400"
                >
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLOT ADD / EDIT MODAL */}
      {slotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">
                {slotModalMode === "add" ? "Add Time Slot" : "Edit Time Slot"}
              </h3>
              <button
                onClick={() => setSlotModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Time (e.g. 09:30 or 9.3)
                </label>
                <input
                  type="text"
                  required
                  placeholder="09:30"
                  value={slotFormTime}
                  onChange={(e) => setSlotFormTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cleaning Date
                </label>
                <select
                  value={slotFormDateId}
                  onChange={(e) => setSlotFormDateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  {dates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dateString} ({d.displayDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSlotModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400"
                >
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DANGER RESET CONFIRMATION MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Reset Booking Session?</h3>
              <p className="text-xs text-slate-400">
                This will irreversibly delete all rooms, time slots, and resident bookings.
              </p>
            </div>

            <form onSubmit={handleResetSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                  Type <span className="font-mono text-rose-400 font-bold">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  id="reset-confirmation-input"
                  required
                  placeholder="RESET"
                  value={resetConfirmationText}
                  onChange={(e) => setResetConfirmationText(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-500/30 focus:border-rose-400 text-center font-mono font-bold tracking-widest uppercase rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-reset-submit-btn"
                  disabled={resetConfirmationText !== "RESET" || resetting}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    resetConfirmationText !== "RESET" || resetting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50"
                  }`}
                >
                  {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
