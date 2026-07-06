import { requireUser } from "@/lib/auth-helpers";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
        Welcome, {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        You are signed in as{" "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {user.role}
        </span>
        .
      </p>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        Use the navigation to manage production, sales, purchases and expenses.
      </div>
    </div>
  );
}
