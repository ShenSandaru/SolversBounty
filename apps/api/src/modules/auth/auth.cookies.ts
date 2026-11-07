import { timingSafeEqual } from "node:crypto";
import { CSRF_COOKIE, SESSION_COOKIE } from "./auth.constants";

export function readNamedCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [cookieName, ...rest] = part.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function readSessionCookie(header: string | undefined): string | null {
  return readNamedCookie(header, SESSION_COOKIE);
}

export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return cookieLine(SESSION_COOKIE, token, maxAgeSeconds, secure, true);
}

export function csrfCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return cookieLine(CSRF_COOKIE, token, maxAgeSeconds, secure, true);
}

export function clearSessionCookie(secure: boolean): string {
  return sessionCookie("", 0, secure);
}

export function clearCsrfCookie(secure: boolean): string {
  return csrfCookie("", 0, secure);
}

export function csrfTokensMatch(cookieHeader: string | undefined, provided: string | undefined): boolean {
  const stored = readNamedCookie(cookieHeader, CSRF_COOKIE);
  if (!stored || !provided) {
    return false;
  }
  const left = Buffer.from(stored);
  const right = Buffer.from(provided);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function cookieLine(name: string, token: string, maxAgeSeconds: number, secure: boolean, httpOnly: boolean): string {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (httpOnly) {
    parts.splice(1, 0, "HttpOnly");
  }
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
