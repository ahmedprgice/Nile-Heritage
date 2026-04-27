"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const API_URL = API_BASE_URL;

  const [email, setEmail] = useState("");
  const [flash, setFlash] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFlash(null);

    try {
      setSubmitting(true);

      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setFlash({
          type: "success",
          message: data?.message || "Password reset link sent to your email.",
        });
      } else {
        setFlash({
          type: "error",
          message: data?.message || "Failed to send reset link.",
        });
      }
    } catch (err) {
      console.error(err);
      setFlash({
        type: "error",
        message: "Server error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617]">
      <div className="relative w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 p-10 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="text-indigo-400" size={28} />
          <h1 className="text-3xl font-bold tracking-wide">NEXORA</h1>
        </div>

        <p className="text-center text-gray-400 mb-8">
          Enter your email and we’ll send you a password reset link.
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

        <form onSubmit={handleForgotPassword} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none"
          />

          <button
            disabled={submitting}
            aria-busy={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 font-semibold disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push("/auth")}
            disabled={submitting}
            className="w-full py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
