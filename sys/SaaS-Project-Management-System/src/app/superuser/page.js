"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

export default function SuperuserLogin() {
  const router = useRouter();
  const API_URL = API_BASE_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [flash, setFlash] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (!token || !user) return;
    try {
      const parsed = JSON.parse(user);
      const role = String(parsed?.role || "").toLowerCase();
      if (role === "superuser") {
        router.push("/dashboard/admin-panel");
      }
    } catch {
      // Ignore stored data errors
    }
  }, [router]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setFlash({ type: "error", message: "Email and password are required." });
      return;
    }
    if (password.length < 6) {
      setFlash({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data?.token) {
        setFlash({ type: "error", message: data?.message || "Login failed" });
        return;
      }

      const role = String(data?.user?.role || "").toLowerCase();
      if (role !== "superuser") {
        setFlash({ type: "error", message: "This login is only for Superuser accounts." });
        return;
      }

      localStorage.setItem("token", data.token);
      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      setFlash({ type: "success", message: "Superuser login successful." });
      setTimeout(() => router.push("/dashboard/admin-panel"), 700);
    } catch (err) {
      console.error(err);
      setFlash({ type: "error", message: "Server error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 p-5 sm:p-7 md:p-10 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
          <ShieldCheck className="text-indigo-400 shrink-0" size={24} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">
            Superuser Access
          </h1>
        </div>

        <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
          This login is restricted to the Superuser account.
        </p>

        {flash && (
          <div
            className={`mb-5 rounded-xl px-4 py-3 text-sm border ${
              flash.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {flash.message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <input
            type="email"
            placeholder="System email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
          />

          <input
            type="password"
            placeholder="System password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in as System"}
          </button>
        </form>
      </div>
    </div>
  );
}
