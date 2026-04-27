"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import api from "@/lib/http";

function AcceptInvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [inviteData, setInviteData] = useState(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setInviteError("Invitation token is missing.");
        setLoadingInvite(false);
        return;
      }

      try {
        setLoadingInvite(true);
        setInviteError("");

        const res = await api.get(`/api/auth/invitations/${token}`);
        setInviteData(res?.data?.invitation || null);
      } catch (err) {
        console.error("Load invitation error:", err);
        setInviteError(
          err?.response?.data?.message || "Invitation is invalid or expired."
        );
      } finally {
        setLoadingInvite(false);
      }
    };

    loadInvitation();
  }, [token]);

  const handleAcceptInvite = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setFlash("Name is required.");
      return;
    }

    if (!password || password.length < 6) {
      setFlash("Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setFlash("");

      const res = await api.post("/api/auth/invitations/accept", {
        token,
        name: name.trim(),
        password,
      });

      const data = res?.data || {};

      if (data?.token) {
        localStorage.setItem("token", data.token);
      }

      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      setFlash("Invitation accepted successfully.");

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch (err) {
      console.error("Accept invitation error:", err);
      setFlash(
        err?.response?.data?.message || "Failed to accept invitation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 p-5 sm:p-7 md:p-10 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-white">
            Accept Invitation
          </h1>
        </div>

        {loadingInvite && (
          <p className="text-center text-gray-400">Loading invitation...</p>
        )}

        {!loadingInvite && inviteError && (
          <div className="rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-300">
            {inviteError}
          </div>
        )}

        {!loadingInvite && !inviteError && inviteData && (
          <>
            <p className="text-center text-gray-400 mb-6 text-sm sm:text-base">
              You were invited to join{" "}
              <span className="text-white font-semibold">
                {inviteData.companyName}
              </span>{" "}
              as{" "}
              <span className="text-indigo-400 font-semibold">
                {inviteData.role}
              </span>
            </p>

            <div className="mb-4 rounded-xl bg-[#020617]/60 border border-white/10 px-4 py-3 text-sm text-gray-300">
              <div>
                <span className="text-gray-400">Invited email: </span>
                <span className="text-white">{inviteData.email}</span>
              </div>
            </div>

            {flash && (
              <div className="mb-5 rounded-xl px-4 py-3 text-sm border bg-indigo-500/10 border-indigo-500/30 text-indigo-200">
                {flash}
              </div>
            )}

            <form onSubmit={handleAcceptInvite} className="space-y-4 sm:space-y-5">
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
              />

              <input
                type="password"
                placeholder="Create Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
              />

              <button
                disabled={submitting}
                aria-busy={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 font-semibold disabled:cursor-not-allowed disabled:opacity-60 text-sm sm:text-base inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Joining company...
                  </>
                ) : (
                  "Join Company"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4 py-6 text-gray-300 sm:px-6 sm:py-8">
          Loading invitation...
        </div>
      }
    >
      <AcceptInvitePageContent />
    </Suspense>
  );
}
