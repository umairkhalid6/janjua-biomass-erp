"use client";

import { useState } from "react";
import { captureElementPng } from "@/lib/capture-element";

// Downloads the on-page invoice (element `targetId`) as an A4 PDF file. The
// invoice is rendered to an image (same capture as the WhatsApp share) and
// placed on A4 pages, so the PDF matches the screen exactly on every device —
// no print dialog, which is clumsy on phones. Long invoices continue onto
// further pages. jsPDF is loaded on demand to keep it out of the page bundle.
export function DownloadPdfButton({
  targetId,
  fileBaseName,
}: {
  targetId: string;
  fileBaseName: string; // e.g. "invoice-JB-00001" (no extension)
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setPending(true);
    try {
      const [{ jsPDF }, shot] = await Promise.all([
        import("jspdf"),
        captureElementPng(targetId),
      ]);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (shot.height / shot.width) * imgW;
      const usableH = pageH - margin * 2;

      // Draw the full image once per page, shifted up by one page height each
      // time; the page edge crops it.
      let offset = 0;
      pdf.addImage(shot.dataUrl, "PNG", margin, margin, imgW, imgH);
      while (imgH - offset > usableH + 0.5) {
        offset += usableH;
        pdf.addPage();
        pdf.addImage(shot.dataUrl, "PNG", margin, margin - offset, imgW, imgH);
      }
      pdf.save(`${fileBaseName}.pdf`);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not create the PDF.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-start">
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-900 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 ${pending ? "animate-pulse" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {pending ? "Preparing…" : "Download PDF"}
      </button>
      {error && (
        <span
          role="alert"
          className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
        >
          {error}
        </span>
      )}
    </div>
  );
}
