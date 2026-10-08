// Minimal layout for printable invoice — no app shell or nav chrome.
// The root layout (app/layout.tsx) already provides <html>/<body>.
export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
