import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config: no Prisma / bcrypt here (middleware runs on the edge
// runtime where the Prisma pg adapter cannot run). The Credentials provider
// with the DB lookup is added only in src/auth.ts (Node runtime).
//
// Role-gated route prefixes — ADMIN only.
const ADMIN_PREFIXES = ["/reports", "/settings", "/users"];

export const authConfig = {
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

      // ADMIN-only areas: bounce OPERATORs to /production.
      const adminOnly = ADMIN_PREFIXES.some(
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
