"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Settings2, Users, Database } from "lucide-react";
import api from "@/lib/http";

export default function AdminPanel({ currentUser = {} }) {
  const [resolvedRole, setResolvedRole] = useState(() => {
    const initialRole = String(currentUser?.role || "").toLowerCase();
    if (initialRole) return initialRole;

    if (typeof window === "undefined") return "";
    const local = localStorage.getItem("user");
    if (!local) return "";

    try {
      const parsed = JSON.parse(local);
      return String(parsed?.role || "").toLowerCase();
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await api.get("/api/auth/me");
        const role = String(
          res?.data?.profile?.role || res?.data?.user?.role || ""
        ).toLowerCase();
        if (role) setResolvedRole(role);
      } catch {
        // Ignore auth errors here; UI will show access block.
      }
    };

    if (!resolvedRole) fetchRole();
  }, [resolvedRole]);

  const isSuperuser = useMemo(
    () => resolvedRole === "superuser",
    [resolvedRole]
  );

  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          Only the Superuser can access the Admin Panel.
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Platform Controls",
      description: "Manage critical system settings and global policies.",
      icon: Settings2,
    },
    {
      title: "User Oversight",
      description: "Review company access and audit sensitive actions.",
      icon: Users,
    },
    {
      title: "Data Health",
      description: "Monitor system storage, backups, and integrity checks.",
      icon: Database,
    },
  ];


  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8 rounded-3xl border border-indigo-500/20 bg-[#111827] p-6 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-300" size={28} />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">
              Superuser Access
            </p>
            <h1 className="mt-1 text-3xl font-bold">Admin Panel</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-gray-400">
          This area is restricted to the Superuser. Use it to manage
          platform-level controls and audits.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-2xl border border-gray-800 bg-[#111827] p-5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-200">
                <Icon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-gray-400">{card.description}</p>
            </div>
          );
        })}
      </div>

    </div>
  );
}
