import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

type AdminRole = "importer" | "reviewer" | "publisher";

const COOKIE_NAME = "admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

function sign(value: string) {
  const secret = process.env.ADMIN_IMPORT_SECRET;
  if (!secret) return "";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isValidSession(token: string | undefined) {
  if (!token || !process.env.ADMIN_IMPORT_SECRET) return false;
  const [version, expiresAt, signature, ...extra] = token.split(".");
  if (version !== "v1" || !expiresAt || !signature || extra.length) return false;

  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) return false;

  const expected = sign(`${version}.${expiresAt}`);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function getUserRole() {
  return await isAdmin() ? { role: "publisher" as AdminRole, user: { id: "local-admin-import" } } : null;
}

export function verifyAdminPassword(password: string): boolean {
  const secret = process.env.ADMIN_IMPORT_SECRET;
  if (!secret || !password) return false;
  const passwordBuffer = Buffer.from(password);
  const secretBuffer = Buffer.from(secret);
  return (
    passwordBuffer.length === secretBuffer.length &&
    timingSafeEqual(passwordBuffer, secretBuffer)
  );
}

export async function setAdminCookie() {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  const payload = `v1.${expiresAt}`;
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.ADMIN_COOKIE_SECURE === "true",
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
