import { requireUser } from "@/lib/auth-helpers";
import { visibleNavItems } from "@/components/nav-items";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";

// Wraps every authenticated page. Middleware already blocks anonymous access;
// this also resolves the user for the nav and enforces it at the render layer.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const items = visibleNavItems(user.role);

  return (
    <AppShell
      items={items}
      user={{ name: user.name ?? user.email ?? "User", role: user.role }}
      signOut={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
