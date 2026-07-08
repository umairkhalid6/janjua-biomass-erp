import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config: no Prisma / bcrypt here (middleware runs on the edge
// runtime where the Prisma pg adapter cannot run). The Credentials provider
// with the DB lookup is added only in src/auth.ts (Node runtime).

// --- AUTH_URL guard -------------------------------------------------------
// Auth.js builds internal URLs from AUTH_URL / NEXTAUTH_URL. A malformed value
// (e.g. `https://` when a Railway domain variable resolves empty) makes it
// throw `TypeError: Invalid URL` on EVERY request and the whole app 500s.
// If the value isn't a valid absolute URL with a host, drop it so Auth.js
// falls back to detecting the host from the proxy headers (trustHost below).
(() => {
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const raw = process.env[key];
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (!u.hostname) throw new Error("missing host");
    } catch {
      delete process.env[key];
    }
  }
})();

// Role-gated route prefixes — ADMIN only. Matched as exact path or `prefix/…`.
const ADMIN_PREFIXES = [
  "/reports",
  "/settings",
  "/users",
  "/customers",
  "/suppliers",
  "/contractor",
  "/electricity",
  "/purchases",
  "/expenses",
];

export const authConfig = {
  // Trust the host provided by Railway's proxy (x-forwarded-host). Required
  // for any self-hosted (non-Vercel) deployment behind a reverse proxy, and
  // makes auth work even if AUTH_URL is unset. Hardcoded (not read from
  // AUTH_TRUST_HOST) so a missing env var can't break login again.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    // Persist id + role into the JWT on sign-in.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // Expose id + role on the session.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    // Runs in middleware on every request. Returning false / a Response
    // redirects; true allows through.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      // Public tokenized invoice links (shared on WhatsApp) — no auth. The
      // token in the path is the only credential; the page shows a single
      // invoice and nothing else.
      if (pathname.startsWith("/i/")) return true;

      // /login is public. Send already-authed users to the dashboard.
      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl.origin));
        }
        return true;
      }

      if (!isLoggedIn) {
        const url = new URL("/login", request.nextUrl.origin);
        url.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
        return Response.redirect(url);
      }

      // ADMIN-only areas: bounce OPERATORs to /production. The dashboard at
      // exactly "/" is admin-only too — matched exactly (never prefix-matched,
      // or it would block every route).
      const adminOnly =
        pathname === "/" ||
        ADMIN_PREFIXES.some(
          (p) => pathname === p || pathname.startsWith(p + "/")
        );
      if (adminOnly && auth.user.role !== "ADMIN") {
        return Response.redirect(new URL("/production", request.nextUrl.origin));
      }

      return true;
    },
  },
  providers: [], // filled in src/auth.ts
} satisfies NextAuthConfig;
