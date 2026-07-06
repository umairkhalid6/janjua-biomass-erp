import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge middleware uses the provider-less config (no Prisma). The `authorized`
// callback in auth.config.ts enforces login + ADMIN-only route gating.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except /api/auth (Auth.js routes), Next internals,
  // and static/asset files. /login is public but still runs the callback,
  // which lets it through because it isn't gated.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|apple-touch-icon.png|icons?/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
