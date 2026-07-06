import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Janjua Biomass ERP
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in to continue</p>
        </div>
        <LoginForm callbackUrl={callbackUrl ?? "/"} />
      </div>
    </main>
  );
}
