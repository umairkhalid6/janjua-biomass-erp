import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { toggleActive } from "./actions";
import { CreateUserForm, ResetPasswordForm } from "./user-forms";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Users
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage who can access the ERP and their role.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add user
        </h2>
        <CreateUserForm />
      </section>

      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {users.map((u) => {
              const isSelf = u.id === me.id;
              return (
                <tr key={u.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-400"
                          : "rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={toggleActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <button
                          type="submit"
                          disabled={isSelf && u.active}
                          title={
                            isSelf && u.active
                              ? "You cannot deactivate your own account"
                              : undefined
                          }
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <ResetPasswordForm id={u.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
