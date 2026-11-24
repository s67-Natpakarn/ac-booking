import type { Metadata } from "next";
import { ToastProvider } from "@/components/ToastContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "A/C Cleaning Booking",
  description: "Bangkok Patana School A/C Cleaning Reservation System",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
