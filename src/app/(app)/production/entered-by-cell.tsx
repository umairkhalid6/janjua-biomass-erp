"use client";

import { useEffect, useState } from "react";

export type ShiftAudit = {
  createdByName: string | null;
  updatedByName: string | null;
  updatedAt: string | null; // ISO string, when the shift was last edited
};

// Compact summary shown in the table cell: first name of each shift's creator.
function summary(day: ShiftAudit, night: ShiftAudit): string {
  const parts: string[] = [];
  if (day.createdByName) parts.push(`D: ${day.createdByName}`);
  if (night.createdByName) parts.push(`N: ${night.createdByName}`);
  return parts.length ? parts.join(" · ") : "—";
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ShiftRow({ title, audit }: { title: string; audit: ShiftAudit }) {
  const editedWhen = formatWhen(audit.updatedAt);
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h4>
      {audit.createdByName ? (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Entered by</dt>
            <dd className="font-medium text-neutral-900 dark:text-neutral-50">
              {audit.createdByName}
            </dd>
          </div>
          {audit.updatedByName && (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Last edited by</dt>
              <dd className="text-right font-medium text-neutral-900 dark:text-neutral-50">
                {audit.updatedByName}
                {editedWhen && (
                  <span className="block text-xs font-normal text-neutral-400">
                    {editedWhen}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-neutral-400">No entry for this shift.</p>
      )}
    </div>
  );
}

export function EnteredByCell({
  date,
  day,
  night,
}: {
  date: string; // display date, e.g. 01/07/2026
  day: ShiftAudit;
  night: ShiftAudit;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-xs text-green-700 underline decoration-dotted underline-offset-2 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
      >
        {summary(day, night)}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                Entry Details — {date}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <ShiftRow title="Day Shift" audit={day} />
              <ShiftRow title="Night Shift" audit={night} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
