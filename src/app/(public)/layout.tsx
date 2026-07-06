// Minimal layout for public (no-auth) pages such as shared invoice links.
// The root layout (app/layout.tsx) already provides <html>/<body>.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
