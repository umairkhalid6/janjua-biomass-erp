"use client";

import { useState } from "react";
import { captureElementPng, downloadFile } from "@/lib/capture-element";
import { invoiceCaption, type InvoiceAmounts } from "@/lib/invoice-share";

// Shares the invoice as an IMAGE (not a link): renders the on-page invoice
// (element `targetId`) to a PNG on the client, then hands the file to WhatsApp
// via the native share sheet (navigator.share with files). Zero backend cost.
// On platforms without file-sharing (most desktops) it downloads the PNG so it
// can be attached manually. The recipient is chosen in the share sheet — a file
// attachment can't pre-select a WhatsApp contact the way a wa.me link could.
export function ShareWhatsappButton({
  targetId,
  fileBaseName,
  customerName,
  invoiceLabel,
  amounts,
  caption: captionOverride,
  className,
}: {
  targetId: string;
  fileBaseName: string; // e.g. "invoice-INV-00006" (no extension)
  customerName: string;
  invoiceLabel: string;
  amounts?: InvoiceAmounts; // pre-formatted amount breakdown for the caption
  caption?: string; // full caption text; replaces the amounts-based one
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function renderInvoicePng(): Promise<File> {
    const { dataUrl } = await captureElementPng(targetId);
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], `${fileBaseName}.png`, { type: "image/png" });
  }

  async function handleShare() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const file = await renderInvoicePng();
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      const caption =
        captionOverride ??
        (amounts
          ? invoiceCaption({ customerName, invoiceLabel, amounts })
          : "");

      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        try {
          // Native share sheet: user picks WhatsApp → picks a contact → sends,
          // with the invoice PNG attached. This is the "banking app" flow.
          await nav.share({
            files: [file],
            title: `Invoice ${invoiceLabel}`,
            text: caption,
          });
        } catch (shareErr) {
          // User dismissing the share sheet throws AbortError — not an error.
          if ((shareErr as Error)?.name === "AbortError") return;
          // Any other failure (e.g. iOS user-activation expiring after the
          // render): fall back to saving the image so it's never a dead end.
          downloadFile(file);
          setNotice("Invoice image saved — open WhatsApp and attach it.");
        }
      } else {
        // Desktop / unsupported: save the image so it can be attached manually.
        downloadFile(file);
        setNotice("Invoice image saved — open WhatsApp and attach it.");
      }
    } catch (e) {
      setError(
        (e as Error)?.message ?? "Could not prepare the invoice image."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-start">
      <button
        type="button"
        onClick={handleShare}
        disabled={pending}
        aria-busy={pending}
        className={
          className ??
          "group inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:w-auto sm:py-2"
        }
      >
        {pending ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 animate-spin"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 transition-transform duration-150 group-hover:scale-110"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2" />
          </svg>
        )}
        {pending ? "Preparing…" : "Share on WhatsApp"}
      </button>
      {notice && (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          {notice}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4.5M12 15.5v.5" />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}
