"use client";

import { useEffect, useRef } from "react";

// Date input that defaults to today when no defaultValue is given.
// Today is filled in after mount so it uses the user's local timezone
// (the server may run in UTC) and never causes a hydration mismatch.
// An explicit defaultValue (e.g. when editing) is left untouched.
// With fallbackMonth ("YYYY-MM"), today only applies when it falls in
// that month; otherwise the 1st of that month is used.
export function DateInput({
  fallbackMonth,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { fallbackMonth?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.value) {
      const today = new Date().toLocaleDateString("en-CA");
      ref.current.value =
        fallbackMonth && !today.startsWith(fallbackMonth)
          ? `${fallbackMonth}-01`
          : today;
    }
  }, [fallbackMonth]);
  return <input ref={ref} type="date" {...props} />;
}
