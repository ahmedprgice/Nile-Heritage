"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

export default function AuthPage() {
  const router = useRouter();
  const API_URL = API_BASE_URL;
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const [mode, setMode] = useState("signin"); // signin | signup | verify
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [flash, setFlash] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleSdkReady, setGoogleSdkReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    if (window.google?.accounts?.id) {
      setGoogleSdkReady(true);
      return;
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]');
    if (existingScript) {
      const onReady = () => setGoogleSdkReady(Boolean(window.google?.accounts?.id));
      existingScript.addEventListener("load", onReady);
      return () => existingScript.removeEventListener("load", onReady);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => setGoogleSdkReady(Boolean(window.google?.accounts?.id));
    document.head.appendChild(script);
  }, [GOOGLE_CLIENT_ID]);

  const completeAuth = (data, successMessage) => {
    localStorage.setItem("token", data.token);
    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    setFlash({ type: "success", message: successMessage });
    setTimeout(() => {
      const status =
        data?.user?.subscription?.accountStatus ||
        data?.user?.subscription?.status;
      router.push(
        status === "expired" || status === "suspended"
          ? "/dashboard/subscription-required"
          : "/dashboard",
      );
    }, 900);
  };

  const validatePassword = () => {
    if (password.length < 6) {
      setFlash({
        type: "error",
        message: "Password must be at least 6 characters.",
      });
      return false;
    }
    return true;
  };

  const getPasswordStrength = (value) => {
    let score = 0;
    if (!value) return { score: 0, label: "Too weak", color: "bg-red-500" };
    if (value.length >= 6) score += 1;
    if (value.length >= 10) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    if (score <= 1) return { score, label: "Too weak", color: "bg-red-500" };
    if (score <= 3) {
      return { score, label: "Medium", color: "bg-yellow-500" };
    }
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data?.token) {
        completeAuth(data, "Logged in successfully. Welcome back!");
      } else {
        setFlash({ type: "error", message: data?.message || "Login failed" });
      }
    } catch (err) {
      console.error(err);
      setFlash({ type: "error", message: "Server error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    if (!name.trim()) {
      setFlash({ type: "error", message: "Name is required." });
      return;
    }

    if (!companyName.trim()) {
      setFlash({ type: "error", message: "Company name is required." });
      return;
    }

    if (!agreeTerms) {
      setFlash({
        type: "error",
        message: "You must agree to the terms and conditions.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim(),
          email,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setFlash({
          type: "success",
          message: "Signup successful! Your free trial has started. Please log in.",
        });
        setMode("signin");
        setName("");
        setCompanyName("");
        setEmail("");
        setPassword("");
        setAgreeTerms(false);
      } else {
        setFlash({ type: "error", message: data?.message || "Signup failed" });
      }
    } catch (err) {
      console.error(err);
      setFlash({ type: "error", message: "Server error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const complete = await signUp.attemptEmailAddressVerification({ code });
      if (complete.status === "complete") {
        await setActive({ session: complete.createdSessionId });
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Verification error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleContinue = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setFlash({
        type: "error",
        message: "Google sign-in is not configured yet.",
      });
      return;
    }

    if (mode === "signup" && !agreeTerms) {
      setFlash({
        type: "error",
        message: "You must agree to the terms and conditions.",
      });
      return;
    }

    if (!googleSdkReady || !window.google?.accounts?.id) {
      setFlash({
        type: "error",
        message: "Google sign-in is still loading. Please try again.",
      });
      return;
    }

    setGoogleSubmitting(true);
    let completed = false;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          completed = true;
          const credential = response?.credential;
          if (!credential) {
            setFlash({ type: "error", message: "Google sign-in was cancelled." });
            return;
          }

          const res = await fetch(`${API_URL}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              credential,
              mode,
              name: name.trim(),
              companyName: companyName.trim(),
            }),
          });

          const data = await res.json();
          if (!res.ok || !data?.token) {
            setFlash({
              type: "error",
              message: data?.message || "Google authentication failed",
            });
            return;
          }

          completeAuth(data, "Google authentication successful.");
        } catch (error) {
          console.error("Google sign-in error:", error);
          setFlash({ type: "error", message: "Google authentication failed" });
        } finally {
          setGoogleSubmitting(false);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.prompt((notification) => {
      if (completed) return;
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        setGoogleSubmitting(false);
        setFlash({
          type: "error",
          message: "Google popup blocked or unavailable. Please allow popups and try again.",
        });
      }
    });
  };

  return (
    <div className="auth-page-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 p-5 sm:p-7 md:p-10 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
          <Sparkles className="text-indigo-400 shrink-0" size={24} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">
            NEXORA
          </h1>
        </div>

        <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
          {mode === "signin" && "Welcome back. Sign in to continue."}
          {mode === "signup" && "Create your Nexora account."}
          {mode === "verify" &&
            "Enter the verification code sent to your email."}
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

        {mode === "signin" && (
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="text-xs text-gray-400">
                Password must be at least 6 characters.
              </p>

              <button
                type="button"
                onClick={() => router.push("/auth/forgot-password")}
                className="text-xs text-indigo-400 hover:underline whitespace-nowrap self-start sm:self-auto"
              >
                Forgot password?
              </button>
            </div>

            <button
              disabled={submitting || googleSubmitting}
              aria-busy={submitting || googleSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 font-semibold disabled:cursor-not-allowed disabled:opacity-60 text-sm sm:text-base inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <button
              type="button"
              onClick={handleGoogleContinue}
              disabled={submitting || googleSubmitting}
              className="auth-google-btn w-full py-3 rounded-xl border font-semibold text-sm sm:text-base disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {googleSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                "Continue with Google"
              )}
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
            />

            <input
              type="text"
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#020617]/60 border border-white/10 focus:border-indigo-500 outline-none text-sm sm:text-base"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

            <div className="rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-3 sm:px-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-400">Password Strength</span>
                <span
                  className={`font-medium ${
                    passwordStrength.label === "Strong"
                      ? "text-emerald-400"
                      : passwordStrength.label === "Medium"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {passwordStrength.label}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      passwordStrength.score >= step
                        ? passwordStrength.color
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-2">
                Use 6+ characters with uppercase, numbers, and symbols.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 accent-indigo-500 shrink-0"
              />
              <span>
                I agree to the{" "}
                <Link href="/privacy-policy" className="text-indigo-400 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <button
              disabled={submitting || googleSubmitting}
              aria-busy={submitting || googleSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 font-semibold disabled:cursor-not-allowed disabled:opacity-60 text-sm sm:text-base inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>

            <button
              type="button"
              onClick={handleGoogleContinue}
              disabled={submitting || googleSubmitting}
              className="auth-google-btn w-full py-3 rounded-xl border font-semibold text-sm sm:text-base disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {googleSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                "Continue with Google"
              )}
            </button>
          </form>
        )}

        {mode === "verify" && (
          <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
            <input
              type="text"
              placeholder="Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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
                  Verifying...
                </>
              ) : (
                "Verify Email"
              )}
            </button>
          </form>
        )}

        {mode !== "verify" && (
          <p className="text-center text-gray-400 text-sm mt-4 sm:mt-5">
            {mode === "signin"
              ? "Don’t have an account?"
              : "Already have an account?"}{" "}
            <span
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
