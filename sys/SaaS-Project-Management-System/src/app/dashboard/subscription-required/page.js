"use client";

import Link from "next/link";
import { LockKeyhole, ReceiptText } from "lucide-react";

export default function SubscriptionRequiredPage() {
  const plans = [
    {
      name: "Monthly",
      audience: "Starter / Low commitment",
      priceValue: "RM280",
      priceSuffix: "/mo",
      oldPrice: null,
      note: "Low commitment with full flexibility.",
      description: "Best for trying the system and short-term projects.",
      promoLine: "",
      finePrint: "Billed monthly. Cancel anytime.",
      discountHint: "First month RM224 (20% off).",
      cta: "Start Monthly",
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
      accent: "default",
    },
    {
      name: "Lifetime",
      audience: "Best long-term value",
      priceValue: "RM6,000",
      priceSuffix: "one-time",
      oldPrice: "RM8,000 regular",
      discountPercent: 25,
      discountHint: "You save RM2,000 vs regular lifetime pricing.",
      note: "Pays for itself in around 18 months.",
      description: "Best for serious teams with long-term operations.",
      promoLine: "One payment. Own it forever.",
      finePrint: "No renewals. All future updates included.",
      cta: "Get Lifetime Access",
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
      audience: "Most Popular",
      priceValue: "RM225",
      priceSuffix: "/month",
      oldPrice: "RM280/month",
      billingLine: "RM2,700 billed yearly.",
      discountPercent: 20,
      discountHint: "Save RM660 per year.",
      note: "Lower cost per month with long-term stability.",
      description: "Best for active teams and growing companies.",
      promoLine: "",
      finePrint: "Charged yearly in one payment.",
      cta: "Choose Yearly",
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
      accent: "default",
    },
  ];

  return (
    <div className="subscription-page mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col items-center justify-center gap-8 pb-8">
      <div className="w-full rounded-3xl border border-indigo-500/20 bg-[#111827] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
          <LockKeyhole size={30} />
        </div>
        <h1 className="text-3xl font-bold">Choose a plan to continue</h1>
        <p className="mx-auto mt-3 max-w-2xl text-gray-400">
          Unlock full access for your workspace. Pick a plan below, then submit payment details for manual approval.
        </p>
        <div className="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Full system access
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Manual review workflow
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Upgrade anytime
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-500"
          >
            <ReceiptText size={18} />
            View payment instructions
          </Link>
          <Link
            href="/auth"
            className="rounded-xl border border-gray-700 px-5 py-3 font-medium text-gray-300 transition hover:border-indigo-400 hover:text-white"
          >
            Switch account
          </Link>
        </div>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-3">
        {plans.map((tier) => (
          <div
            key={tier.name}
            className={`subscription-plan-card flex h-full flex-col rounded-3xl p-6 shadow-xl transition ${
              tier.accent === "lifetime"
                ? "subscription-plan-lifetime scale-[1.02] border border-indigo-400/60 bg-gradient-to-b from-indigo-600/20 via-[#0f172a] to-[#0f172a] shadow-indigo-900/40"
                : "border border-gray-800 bg-[#0f172a] shadow-black/20"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="subscription-plan-title text-2xl font-semibold text-white">{tier.name}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-slate-400">{tier.audience}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {tier.spotlightBadge ? (
                  <span className="whitespace-nowrap rounded-full border border-indigo-300/70 bg-indigo-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">
                    {tier.spotlightBadge}
                  </span>
                ) : null}
                {tier.discountPercent ? (
                  <span className="subscription-plan-discount-badge whitespace-nowrap rounded-full border border-emerald-300/60 bg-emerald-300/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                    Save {tier.discountPercent}%
                  </span>
                ) : null}
              </div>
            </div>

            <div className="subscription-plan-price-panel mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
              {tier.oldPrice ? (
                <p className="text-xs text-slate-400 line-through">{tier.oldPrice}</p>
              ) : null}
              <p className="subscription-plan-price mt-1 text-4xl font-bold text-white">
                {tier.priceValue}
                <span className="ml-1 text-xl font-medium text-slate-300">{tier.priceSuffix}</span>
              </p>
              {tier.billingLine ? (
                <p className="mt-1 text-xs font-medium text-slate-300">{tier.billingLine}</p>
              ) : null}
              {tier.promoLine ? (
                <p className="subscription-plan-promo mt-1 text-sm font-medium text-indigo-200">{tier.promoLine}</p>
              ) : null}
              {tier.discountHint ? (
                <p className="subscription-plan-discount-hint mt-1 text-xs font-medium text-emerald-200">{tier.discountHint}</p>
              ) : null}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="subscription-plan-section-title mb-2 text-sm font-semibold text-white">Plan includes</p>
              <ul className="space-y-2 text-sm">
              {tier.features.map((feature) => (
                <li key={feature} className="subscription-plan-feature flex items-start gap-2 text-slate-200">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                  <span className="leading-5">{feature}</span>
                </li>
              ))}
              </ul>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="subscription-plan-section-title mb-2 text-sm font-semibold text-white">Business value</p>
              <ul className="space-y-2 text-sm">
                {tier.valuePoints.map((point) => (
                  <li key={point} className="subscription-plan-value-point flex items-start gap-2 text-slate-300">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-300" />
                    <span className="leading-5">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto pt-5">
              <Link
                href="/dashboard/subscription"
                className={`subscription-plan-button inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tier.accent === "lifetime"
                    ? "subscription-plan-button-lifetime border border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border border-indigo-500/40 text-indigo-200 hover:border-indigo-400 hover:text-white"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full rounded-2xl border border-gray-800 bg-[#0f172a] p-4">
        <h3 className="text-sm font-semibold text-white">2-year cost comparison</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-[#111827] px-4 py-3 text-sm text-slate-300">
            Monthly: <span className="font-semibold text-white">RM6,720</span>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#111827] px-4 py-3 text-sm text-slate-300">
            Yearly: <span className="font-semibold text-white">RM5,400</span>
          </div>
          <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            Lifetime: <span className="font-semibold">RM6,000 one-time</span>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
          <h3 className="text-base font-semibold text-white">Why teams pick Lifetime</h3>
          <p className="mt-2 text-sm text-slate-300">
            Stable long-term cost, future updates included, and no renewals to manage.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
          <h3 className="text-base font-semibold text-white">Smart upgrade path</h3>
          <p className="mt-2 text-sm text-slate-300">
            Start Monthly or Yearly today and move to Lifetime when your usage grows.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#0f172a] p-5">
          <h3 className="text-base font-semibold text-white">Best-fit guidance</h3>
          <p className="mt-2 text-sm text-slate-300">
            Under 6 months: Monthly. 6-12 months: Yearly. Beyond 1 year: Lifetime.
          </p>
        </div>
      </div>
    </div>
  );
}
