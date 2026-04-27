"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const API_URL = API_BASE_URL;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [flash, setFlash] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFlash(null);

    if (password.length < 6) {
      setFlash({
        type: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFlash({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(
        `${API_URL}/api/auth/reset-password/${params.token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        },
      );

      const data = await res.json();

      if (res.ok) {
        setFlash({
          type: "success",
          message: data?.message || "Password reset successful.",
        });

        setTimeout(() => {
          router.push("/auth");
        }, 1200);
      } else {
        setFlash({
          type: "error",
          message: data?.message || "Failed to reset password.",
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
          Enter your new password below.
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

        <form onSubmit={handleResetPassword} className="space-y-5">
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none"
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
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
                Updating password...
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
