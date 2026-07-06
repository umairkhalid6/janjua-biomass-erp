"use client";

// Submit button with a confirm() guard. Server components can't attach
// onClick handlers, so pages render this inside their delete <form>s.
export function DeleteButton({ confirmMessage }: { confirmMessage: string }) {
  return (
    <button
      type="submit"
      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      Delete
    </button>
  );
}
