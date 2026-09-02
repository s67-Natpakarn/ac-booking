import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "bps-ac-secret-key-salt-9988";
const COOKIE_NAME = "bps_admin_auth";

function generateAuthToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`admin:${timestamp}`)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

export function verifyAuthToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`admin:${timestamp}`)
    .digest("hex");

  if (signature !== expectedSig) return false;

  // Token valid for 7 days
  const time = parseInt(timestamp, 10);
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - time < maxAge;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    return verifyAuthToken(token);
  } catch (error) {
    return false;
  }
}

export function validatePassword(password: string): boolean {
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin1234";
  return password === expectedPassword;
}

export async function setAdminSessionCookie() {
  const token = generateAuthToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
