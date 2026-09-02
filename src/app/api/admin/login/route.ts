import { NextRequest, NextResponse } from "next/server";
import { validatePassword, setAdminSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!validatePassword(password)) {
      return NextResponse.json({ error: "Incorrect admin password" }, { status: 401 });
    }

    await setAdminSessionCookie();

    return NextResponse.json({ success: true, message: "Logged in successfully" });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
