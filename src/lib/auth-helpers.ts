import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

// Server-side guards for pages and server actions. Call at the top of any
// protected server action / RSC:
//
//   const user = await requireUser();   // any logged-in user
//   const admin = await requireAdmin(); // ADMIN only
//
// Both read the JWT session and redirect on failure (never return null), so
// the caller can safely use `user` afterwards. Middleware already gates routes;
// these defend server actions, which middleware does not cover.

/** Returns the session user, redirecting to /login if unauthenticated. */
export async function requireUser(): Promise<Session["user"]> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Returns the session user, redirecting non-admins away (403 by redirect). */
export async function requireAdmin(): Promise<Session["user"]> {
  const user = await requireUser();
  // Non-admins land on /production (the only always-allowed area). Redirecting
  // to "/" would bounce again in middleware (dashboard is admin-only) — avoid
  // that extra hop / any loop risk.
  if (user.role !== "ADMIN") redirect("/production");
  return user;
}
