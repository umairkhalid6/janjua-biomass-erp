"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/nav-items";

type ShellUser = { name: string; role: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  items,
  user,
  signOut,
  children,
}: {
  items: NavItem[];
  user: ShellUser;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navLinks = (onClick?: () => void) =>
    items.map((item) => {
      const active = isActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
            active
              ? "bg-green-700 text-white"
              : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Janjua Biomass ERP
        </span>
        <span className="w-8" />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <nav
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-64 flex-col gap-1 overflow-y-auto bg-white p-4 dark:bg-neutral-900"
          >
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {user.name}
              </p>
              <p className="text-xs text-neutral-500">{user.role}</p>
            </div>
            {navLinks(() => setOpen(false))}
            <div className="mt-auto pt-3">{signOut}</div>
          </nav>
        </div>
      )}

      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white p-4 md:flex dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 px-1">
          <p className="text-base font-bold text-neutral-900 dark:text-neutral-50">
            Janjua Biomass
          </p>
          <p className="text-xs text-neutral-500">ERP</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">{navLinks()}</nav>
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="px-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {user.name}
          </p>
          <p className="mb-2 px-1 text-xs text-neutral-500">{user.role}</p>
          {signOut}
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
    </div>
  );
}
