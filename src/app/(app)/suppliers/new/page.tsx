import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { CreateSupplierForm } from "../supplier-forms";

export default async function AddSupplierPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Add Supplier
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Register a new supplier. Balances, payments and history live in the{" "}
          <Link
            href="/suppliers"
            className="text-green-700 underline dark:text-green-400"
          >
            Supplier Ledger
          </Link>
          .
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <CreateSupplierForm />
      </section>
    </div>
  );
}
