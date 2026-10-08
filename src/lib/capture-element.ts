import { domToPng } from "modern-screenshot";

// Client-only: renders an on-page invoice (by DOM id) to a PNG data URL.
// Shared by the WhatsApp share button and the PDF download button so both
// produce the exact same picture.
//
// Captures a fixed desktop-width CLONE rendered off-screen. Capturing the live
// node on a narrow phone viewport clips the invoice: its table (whitespace-
// nowrap cells + a shrink-0 details column) overflows the element's box, and
// the screenshot cuts off everything past the right edge (the Amount column).
// Forcing a fixed width guarantees the image looks the same on every device —
// the way it renders on desktop.
export const CAPTURE_WIDTH = 720; // ~max-w-2xl content; wide enough for the table

export async function captureElementPng(
  targetId: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const node = document.getElementById(targetId);
  if (!node) throw new Error("Could not find the invoice on the page.");

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:-100000px;top:0;width:" +
    `${CAPTURE_WIDTH}px;background:#ffffff;pointer-events:none;z-index:-1;`;
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const height = clone.offsetHeight;
    // scale 2 → crisp on phone screens; force white so nothing prints grey.
    const dataUrl = await domToPng(clone, {
      scale: 2,
      width: CAPTURE_WIDTH,
      backgroundColor: "#ffffff",
    });
    return { dataUrl, width: CAPTURE_WIDTH, height };
  } finally {
    wrapper.remove();
  }
}

/** Trigger a browser download of a File/Blob. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
