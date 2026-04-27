"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

export default function GlobalThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  });

  const hideOnDashboard = useMemo(
    () => String(pathname || "").startsWith("/dashboard"),
    [pathname],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    document.body.classList.toggle("light-theme", theme === "light");
    document.body.classList.toggle("dark-theme", theme === "dark");
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event("theme-change"));
  }, [theme]);

  if (hideOnDashboard) return null;

  return (
    <button
      type="button"
      onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      className={`fixed right-4 top-4 z-[100] rounded-xl border p-2 transition sm:right-6 sm:top-6 ${
        theme === "light"
          ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50"
          : "border-gray-700/80 bg-[#101827] text-gray-300 hover:border-indigo-500/60 hover:bg-[#1e293b]"
      }`}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
