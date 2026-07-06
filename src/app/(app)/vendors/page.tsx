import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { CreateVendorForm, EditVendorForm } from "./vendor-forms";

export default async function VendorsPage() {
  await requireUser();
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Vendors
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Manage vendor records.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add Vendor
        </h2>
        <CreateVendorForm />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {vendors.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No vendors yet.
                  </td>
                </tr>
              )}
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {v.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {v.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 text-xs">
                    {v.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <details className="relative">
                      <summary className="list-none cursor-pointer rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800">
                        Edit
                      </summary>
                      <div className="absolute left-0 top-8 z-10 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        <EditVendorForm
                          existing={{
                            id: v.id,
                            name: v.name,
                            phone: v.phone,
                            notes: v.notes,
                          }}
                        />
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
