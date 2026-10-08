// Company logo used in invoice headers (sales + custom invoices). A plain
// <img> rather than next/image: it is printed and captured to PNG/PDF by
// modern-screenshot, which needs a simple same-origin image to inline.
export function BrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon-192.png"
      alt=""
      aria-hidden
      width={48}
      height={48}
      className="h-12 w-12 shrink-0"
    />
  );
}
