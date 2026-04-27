"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import api from "@/lib/http";

const plans = [
  {
    name: "Monthly",
    priceValue: "RM280",
    priceSuffix: "/mo",
    oldPrice: null,
    cta: "Start Monthly",
    description: "Best for trying the system and short-term projects.",
    promoLine: "",
    note: "Low commitment with full flexibility.",
    finePrint: "Billed monthly. Cancel anytime.",
    discountHint: "First month RM224 (20% off).",
    compare2Year: "RM6,720",
    features: [
      "Full system access",
      "Unlimited users",
      "Core features",
      "Standard updates",
      "Standard support",
    ],
    valuePoints: [
      "Fast setup for small teams",
      "Clean upgrade path to Yearly or Lifetime",
      "Best for short pilots",
    ],
    accent: "slate",
  },
  {
    name: "Lifetime",
    priceValue: "RM6,000",
    priceSuffix: "one-time",
    oldPrice: "RM8,000 regular",
    discountPercent: 25,
    discountHint: "You save RM2,000 vs regular lifetime pricing.",
    cta: "Get Lifetime Access",
    description: "Best for serious teams with long-term operations.",
    promoLine: "One payment. Own it forever.",
    note: "Pays for itself in around 18 months.",
    finePrint: "No renewals. All future updates included.",
    compare2Year: "RM6,000 one-time",
    features: [
      "Full system access",
      "All future updates included",
      "Priority support",
      "Early access to new features",
      "No renewals ever",
    ],
    valuePoints: [
      "Strongest long-term ROI",
      "No yearly price increase risk",
      "Priority treatment on support requests",
    ],
    accent: "lifetime",
  },
  {
    name: "Yearly",
    priceValue: "RM225",
    priceSuffix: "/month",
    oldPrice: "RM280/month",
    billingLine: "RM2,700 billed yearly.",
    discountPercent: 20,
    discountHint: "Save RM660 per year.",
    cta: "Choose Yearly",
    description: "Best for active teams and growing companies.",
    promoLine: "",
    note: "Lower cost per month with long-term stability.",
    finePrint: "Charged yearly in one payment.",
    compare2Year: "RM5,400",
    features: [
      "Full system access",
      "Unlimited users",
      "Core features",
      "Standard updates",
      "Standard support",
    ],
    valuePoints: [
      "Lower annual spend than monthly",
      "Better fit for stable operations",
      "Easier yearly budgeting",
    ],
    accent: "indigo",
  },
];

const defaultPaymentMethods = ["Bank Transfer - Maybank"];

const defaultPaymentInstructions = [
  {
    method: "Bank Transfer - Maybank",
    details: "Transfer the selected subscription amount to this demo account, then submit the bank reference number for admin approval.",
    bankName: "Maybank",
    accountName: "Nexora Demo Sdn. Bhd.",
    accountNumber: "5140 1234 5678",
    note: "Demo bank account for testing only. Replace with your real bank details before production.",
  },
];

const formatDate = (dateValue) => {
  if (!dateValue) return "Not set";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
};

const getPlanPaymentSummary = (planName) => {
  if (planName === "Yearly") {
    return {
      label: "Amount to pay now",
      amount: "RM2,700",
      cadence: "charged yearly",
    };
  }
  if (planName === "Lifetime") {
    return {
      label: "Amount to pay now",
      amount: "RM6,000",
      cadence: "one-time payment",
    };
  }
  return {
    label: "Amount to pay now",
    amount: "RM224",
    cadence: "first month promo (then RM280/month)",
  };
};

export default function SubscriptionPage() {
  const [role, setRole] = useState("");
  const [subscription, setSubscription] = useState(null);
  const [latestRequest, setLatestRequest] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [paymentInstructions, setPaymentInstructions] = useState(defaultPaymentInstructions);
  const [form, setForm] = useState({
    plan: "Lifetime",
    paymentMethod: "Bank Transfer - Maybank",
    referenceNumber: "",
    proofUrl: "",
    notes: "",
  });
  const [proofPreview, setProofPreview] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSubscription = async () => {
    try {
      setLoading(true);
      setError("");
      const me = await api.get("/api/auth/me");
      const resolvedRole = String(
        me?.data?.profile?.role || me?.data?.user?.role || ""
      ).toLowerCase();
      setRole(resolvedRole);
      if (resolvedRole === "superuser") {
        setLoading(false);
        return;
      }
      if (!["owner", "admin"].includes(resolvedRole)) {
        setLoading(false);
        return;
      }
      const res = await api.get("/api/subscriptions/me");
      setSubscription(res.data.subscription);
      setLatestRequest(res.data.latestRequest);
      const methods = res.data.paymentMethods?.length
        ? res.data.paymentMethods
        : defaultPaymentMethods;
      setPaymentMethods(methods);
      setPaymentInstructions(
        res.data.paymentInstructions?.length
          ? res.data.paymentInstructions
          : defaultPaymentInstructions,
      );
      setForm((prev) =>
        methods.includes(prev.paymentMethod)
          ? prev
          : { ...prev, paymentMethod: methods[0] || "DuitNow QR" },
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  useEffect(() => {
    if (!role) return;
    if (!["owner", "admin"].includes(role)) {
      window.location.replace("/dashboard");
    }
  }, [role]);

  const submitRequest = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const res = await api.post("/api/subscriptions/requests", form);
      setLatestRequest(res.data.request);
      setMessage("Payment proof submitted. An admin will review it manually.");
      await loadSubscription();
      setForm((prev) => ({ ...prev, referenceNumber: "", proofUrl: "", notes: "" }));
      setProofPreview("");
      setProofFileName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit payment proof");
    } finally {
      setSubmitting(false);
    }
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const handleProofFile = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, proofUrl: dataUrl }));
      setProofPreview(dataUrl);
      setProofFileName(file.name || "Screenshot");
    } catch (err) {
      setError("Unable to read the screenshot file.");
    }
  };

  const handlePasteProof = async (event) => {
    if (!event?.clipboardData?.items) return;
    const items = Array.from(event.clipboardData.items || []);
    const imageItem = items.find((item) => item.type?.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (file) {
      await handleProofFile(file);
    }
  };

  const startFreeTrial = async () => {
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      const res = await api.post("/api/subscriptions/trial");
      if (res?.data?.subscription) {
        setSubscription(res.data.subscription);
      }
      setMessage(res?.data?.message || "Free trial activated.");
      await loadSubscription();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to activate free trial");
    } finally {
      setSubmitting(false);
    }
  };

  const status = subscription?.accountStatus || subscription?.status || "trial";
  const canStartTrial =
    status === "expired" && subscription && !subscription.trialUsed;
  const normalizedPlan = String(subscription?.plan || "Free");
  const isLifetimePlan = normalizedPlan === "Lifetime";
  const trialEndsLabel = isLifetimePlan
    ? "Not applicable"
    : formatDate(subscription?.trialEndDate);
  const paidEndsLabel = isLifetimePlan
    ? "Never (Lifetime)"
    : formatDate(subscription?.subscriptionEndDate || subscription?.expiresAt);
  const selectedPlanPayment = useMemo(
    () => getPlanPaymentSummary(form.plan),
    [form.plan],
  );

  if (role === "superuser") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
        Superuser accounts do not have access to the subscription page.
      </div>
    );
  }
  if (role && !["owner", "admin"].includes(role)) {
    return null;
  }

  return (
    <div className="subscription-page mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#0b1325] to-[#0a1020] p-6 shadow-2xl shadow-black/30">
        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-300/80">
              Billing Control
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">Manage your subscription</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Choose the best plan for your business and submit payment proof for manual approval.
              Everything here is built for clear control, predictable pricing, and safe access management.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">
              Manual approval required
            </div>

          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current status</p>
            <div className="mt-3 flex items-center gap-2">
              {status === "active" || status === "premium" ? (
                <CheckCircle2 className="text-emerald-300" size={20} />
              ) : status === "pending" ? (
                <Clock3 className="text-amber-300" size={20} />
              ) : (
                <ShieldCheck className="text-slate-400" size={20} />
              )}
              <span className="text-xl font-semibold capitalize text-white">{status}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Plan</span>
                <span className="font-semibold text-white">{normalizedPlan}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Trial ends</span>
                <span className="font-semibold text-white">{trialEndsLabel}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Paid ends</span>
                <span className="font-semibold text-white">{paidEndsLabel}</span>
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = form.plan === plan.name;
          const isLifetime = plan.name === "Lifetime";
          return (
            <article
              key={plan.name}
              className={`subscription-plan-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 text-left transition ${
                isLifetime
                  ? "subscription-plan-lifetime scale-[1.015] border-indigo-300/60 bg-gradient-to-b from-indigo-500/20 via-slate-950/80 to-slate-950/90 shadow-2xl shadow-indigo-500/20"
                  : isSelected
                    ? "subscription-plan-selected border-indigo-400/70 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                    : "border-white/10 bg-slate-950/60 hover:border-indigo-400/40"
              }`}
            >
              <header className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="subscription-plan-title text-2xl font-bold text-white">{plan.name}</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {plan.spotlightBadge ? (
                    <span className="whitespace-nowrap rounded-full border border-indigo-300/70 bg-indigo-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                      {plan.spotlightBadge}
                    </span>
                  ) : null}
                  {plan.discountPercent ? (
                    <span className="subscription-plan-discount-badge whitespace-nowrap rounded-full border border-emerald-300/60 bg-emerald-300/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                      Save {plan.discountPercent}%
                    </span>
                  ) : null}
                </div>
              </header>

              <div className="subscription-plan-price-panel mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
                {plan.oldPrice ? (
                  <p className="text-xs text-slate-400 line-through">{plan.oldPrice}</p>
                ) : (
                  <p className="text-xs text-transparent">.</p>
                )}
                <p className={`subscription-plan-price mt-1 text-4xl font-bold ${isLifetime ? "text-indigo-100" : "text-white"}`}>
                  {plan.priceValue}
                  <span className="ml-1 text-xl font-medium text-slate-300">{plan.priceSuffix}</span>
                </p>
                {plan.billingLine ? (
                  <p className="mt-1 text-xs font-medium text-slate-300">{plan.billingLine}</p>
                ) : null}
                {plan.promoLine ? (
                  <p className="subscription-plan-promo mt-2 text-sm font-semibold text-indigo-200">{plan.promoLine}</p>
                ) : null}
                {plan.discountHint ? (
                  <p className="subscription-plan-discount-hint mt-1 text-xs font-medium text-emerald-200">{plan.discountHint}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, plan: plan.name }))}
                className={`subscription-plan-button mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isLifetime
                    ? "subscription-plan-button-lifetime bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110"
                    : isSelected
                      ? "subscription-plan-button-selected border border-indigo-400/50 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                      : "border border-white/15 bg-white/5 text-slate-100 hover:border-indigo-400/40 hover:bg-indigo-500/10"
                }`}
              >
                {plan.cta}
              </button>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="subscription-plan-section-title mb-2 text-sm font-semibold text-white">Plan includes</p>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={`${plan.name}-${feature}`} className="subscription-plan-feature flex items-start gap-2 text-sm text-slate-200">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="subscription-plan-section-title mb-2 text-sm font-semibold text-white">Business value</p>
                <ul className="space-y-2">
                  {plan.valuePoints.map((point) => (
                    <li key={`${plan.name}-${point}`} className="subscription-plan-value-point flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {isSelected ? (
                <div className="subscription-plan-selected-badge mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Selected for payment request
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/30">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3">
              <Building2 className="text-indigo-200" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                Bank transfer
              </p>
              <h2 className="text-xl font-semibold text-white">Payment details</h2>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-indigo-400/35 bg-indigo-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200/90">
              {selectedPlanPayment.label}
            </p>
            <p className="mt-1 text-3xl font-bold text-white">{selectedPlanPayment.amount}</p>
            <p className="text-xs font-medium text-indigo-100/85">
              {selectedPlanPayment.cadence} for <span className="font-semibold">{form.plan}</span>
            </p>
          </div>

          <div className="space-y-3">
            {paymentInstructions.map((item) => (
              <div
                key={item.method}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-sm"
              >
                <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent px-5 py-4">
                  <p className="text-sm font-semibold text-indigo-200">{item.method}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{item.details}</p>
                </div>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="grid gap-3 text-sm">
                      {item.bankName ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Bank</span>
                          <span className="mt-1 block font-medium text-slate-100">{item.bankName}</span>
                        </div>
                      ) : null}
                      {item.accountName ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">Account name</span>
                          <span className="mt-1 block font-medium text-slate-100">{item.accountName}</span>
                        </div>
                      ) : null}
                      {item.accountNumber ? (
                        <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3">
                          <span className="block text-xs uppercase tracking-[0.16em] text-indigo-200/80">Account number</span>
                          <span className="mt-1 block text-lg font-semibold tracking-wide text-indigo-100">{item.accountNumber}</span>
                        </div>
                      ) : null}
                    </div>

                    {item.note ? (
                        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        {item.note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Use your workspace name or email as the transfer reference if your banking app allows it.
          </div>
        </section>

        <form onSubmit={submitRequest} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/30">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <FileCheck2 className="text-emerald-200" size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Manual review
              </p>
              <h2 className="text-xl font-semibold text-white">Submit transfer details</h2>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/90">
              Confirm payment
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {selectedPlanPayment.amount} <span className="text-sm font-medium text-emerald-100/85">({form.plan})</span>
            </p>
            <p className="text-xs text-emerald-100/85">{selectedPlanPayment.cadence}</p>
          </div>

          <div className="grid gap-4">
            <label className="text-sm font-medium text-slate-200">
              Payment method
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-semibold text-slate-100">
                {form.paymentMethod || paymentMethods[0] || "Bank Transfer - Maybank"}
              </div>
            </label>

            <label className="text-sm font-medium text-slate-200">
              Reference number
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                placeholder="e.g. MAYBANK-REF-123456"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>

            <label className="text-sm font-medium text-slate-200">
              Proof screenshot link
              <input
                value={form.proofUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, proofUrl: e.target.value }))}
                placeholder="Paste Google Drive / image link if available"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-200">
                  Paste or upload proof screenshot
                </p>
                <div
                  onPaste={handlePasteProof}
                  className="flex min-h-[72px] items-center justify-between rounded-xl border border-dashed border-white/20 bg-slate-950/40 px-4 py-3 text-xs text-slate-400"
                >
                  <div>
                    <p className="text-slate-200">Paste from clipboard (Ctrl + V)</p>
                    <p className="text-[11px] text-slate-500">
                      Or upload an image file below (PNG, JPG, WEBP)
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[11px] text-indigo-200">
                    Paste
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleProofFile(e.target.files?.[0])}
                  className="text-xs text-slate-300"
                />
                {proofPreview ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={proofPreview}
                      alt="Proof preview"
                      className="w-full object-cover"
                    />
                    {proofFileName ? (
                      <p className="border-t border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                        {proofFileName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="text-sm font-medium text-slate-200">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Optional: sender name, amount, or extra details"
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
          </div>

          {message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
          {error ? <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

          {canStartTrial ? (
            <div className="mt-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-sm text-indigo-200">
              <p className="font-semibold text-white">Start a free trial</p>
              <p className="mt-1 text-xs text-indigo-200/80">
                Your company can activate one free trial to unlock premium features.
              </p>
              <button
                type="button"
                onClick={startFreeTrial}
                disabled={submitting || loading}
                className="mt-3 w-full rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Activating..." : "Activate free trial"}
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || loading}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-500 px-4 py-3 font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit for manual review"}
          </button>

          {latestRequest ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Latest request:{" "}
              <span className="font-semibold capitalize text-white">{latestRequest.status}</span> for{" "}
              {latestRequest.plan} via {latestRequest.paymentMethod}
            </div>
          ) : null}
        </form>
      </div>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="text-base font-semibold text-white">How billing works</h3>
          <p className="mt-2 text-sm text-slate-300">1. Choose your plan and submit payment proof.</p>
          <p className="mt-1 text-sm text-slate-300">2. Admin reviews reference and screenshot.</p>
          <p className="mt-1 text-sm text-slate-300">3. Access is activated for your workspace.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="text-base font-semibold text-white">Upgrade guidance</h3>
          <p className="mt-2 text-sm text-slate-300">Less than 6 months: Monthly.</p>
          <p className="mt-1 text-sm text-slate-300">6-12 months: Yearly.</p>
          <p className="mt-1 text-sm text-slate-300">More than 1 year: Lifetime for best ROI.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="text-base font-semibold text-white">Need help?</h3>
          <p className="mt-2 text-sm text-slate-300">
            Include clear reference details and a readable proof screenshot to speed up approval.
          </p>
        </div>
      </section>
    </div>
  );
}
