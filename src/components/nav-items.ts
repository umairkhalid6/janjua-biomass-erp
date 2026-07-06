import type { Role } from "@prisma/client";

// Single source of truth for app navigation. `adminOnly` items are hidden from
// OPERATORs (and their routes are also blocked in middleware / auth.config.ts).
export type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/production", label: "Production" },
  { href: "/sales", label: "Sales" },
  { href: "/purchases", label: "Purchases" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports", adminOnly: true },
  { href: "/customers", label: "Customers", adminOnly: true },
  { href: "/vendors", label: "Vendors", adminOnly: true },
  { href: "/contractor", label: "Contractor", adminOnly: true },
  { href: "/electricity", label: "Electricity", adminOnly: true },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: true },
];

export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.adminOnly || role === "ADMIN");
}
