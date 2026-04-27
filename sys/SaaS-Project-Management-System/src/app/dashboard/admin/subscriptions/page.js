"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import api from "@/lib/http";

const FIXED_PLAN_DURATIONS = {
  Monthly: 30,
  Yearly: 365,
};

const isPaidPlanAction = (action) => ["activate", "renew"].includes(action);
const isFixedDurationPlan = (plan) => Object.prototype.hasOwnProperty.call(FIXED_PLAN_DURATIONS, plan);

export default function AdminSubscriptionsPage({ currentUser = {} }) {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("");
  const [companyActions, setCompanyActions] = useState({});
  const [savingCompanyId, setSavingCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [companiesError, setCompaniesError] = useState("");
  const [resolvedRole, setResolvedRole] = useState(
    String(currentUser?.role || "").toLowerCase()
  );
  const isSuperuser = resolvedRole === "superuser";

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError("");
      setCompaniesError("");
      const requestsRes = await api.get("/api/subscriptions/requests");
      const rawRequests = requestsRes.data.requests || [];
      const deduped = [];
      const byCompany = new Map();
      rawRequests.forEach((item) => {
        const companyId = String(item.companyId || "");
        if (!companyId) return;
        const reference = String(item.referenceNumber || "");
        const notes = String(item.notes || "").toLowerCase();
        if (reference.startsWith("SIM-") || notes.includes("simulation payment")) return;
        if (!byCompany.has(companyId)) {
          byCompany.set(companyId, item);
          return;
        }
        const existing = byCompany.get(companyId);
        if (existing.status !== "pending" && item.status === "pending") {
          byCompany.set(companyId, item);
          return;
        }
        const existingTime = new Date(existing.createdAt || 0).getTime();
        const nextTime = new Date(item.createdAt || 0).getTime();
        if (nextTime > existingTime) {
          byCompany.set(companyId, item);
        }
      });
      byCompany.forEach((value) => deduped.push(value));
      setRequests(deduped);

      try {
        const companiesRes = await api.get("/api/subscriptions/companies");
        setCompanies(companiesRes.data.companies || []);
      } catch {
        try {
          const legacyRes = await api.get("/api/subscriptions/users");
          setCompanies(legacyRes.data.companies || []);
        } catch (companiesErr) {
          setCompaniesError(
            companiesErr.response?.data?.message || "Failed to load companies"
          );
          setCompanies([]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load subscription requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const local = localStorage.getItem("user");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        const role = String(parsed?.role || "").toLowerCase();
        if (role) {
          setResolvedRole(role);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    const fetchRole = async () => {
      try {
        const res = await api.get("/api/auth/me");
        const role = String(
          res?.data?.profile?.role || res?.data?.user?.role || ""
        ).toLowerCase();
        if (role) setResolvedRole(role);
      } catch {
        // ignore auth errors
      }
    };
    if (!resolvedRole) fetchRole();
  }, [resolvedRole]);

  useEffect(() => {
    if (!resolvedRole) return;
    if (!isSuperuser) {
      router.replace("/dashboard");
      return;
    }
    loadRequests();
  }, [isSuperuser, resolvedRole, router]);

  const reviewRequest = async (requestId, status) => {
    try {
      setReviewingId(requestId);
      setError("");
      await api.patch(`/api/subscriptions/requests/${requestId}/review`, {
        status,
      });
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review request");
    } finally {
      setReviewingId("");
    }
  };

  const visibleCompanies = companies.filter((company) => {
    const companyId = String(company?.companyId || "").toLowerCase();
    const companyName = String(company?.companyName || "").toLowerCase();
    return companyId !== "superuser" && companyName !== "superuser";
  });

  const filteredCompanies = companyStatusFilter
    ? visibleCompanies.filter(
        (company) => company.subscription?.accountStatus === companyStatusFilter
      )
    : visibleCompanies;

  const statusStyle = {
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    rejected: "border-red-500/30 bg-red-500/10 text-red-200",
  };

  const groupedRequests = useMemo(() => {
    const groups = {
      pending: [],
      approved: [],
      rejected: [],
    };
    requests.forEach((request) => {
      const key = String(request.status || "").toLowerCase();
      if (groups[key]) {
        groups[key].push(request);
      }
    });
    return groups;
  }, [requests]);

  const getCompanyAction = (company) => {
    const id = company.companyId;
    const saved = companyActions[id];
    if (saved) return saved;
    const accountStatus = company.subscription?.accountStatus || "trial";
    const currentPlan = company.subscription?.plan || "Monthly";
    const defaultAction =
      accountStatus === "active"
        ? "renew"
        : accountStatus === "suspended"
          ? "resume"
          : accountStatus === "expired"
            ? "activate"
            : "activate";
    const normalizedPlan =
      ["activate", "renew"].includes(defaultAction) && currentPlan === "Free"
        ? "Monthly"
        : currentPlan;
    const defaultDuration =
      isPaidPlanAction(defaultAction) && isFixedDurationPlan(normalizedPlan)
        ? FIXED_PLAN_DURATIONS[normalizedPlan]
        : 30;
    return {
      action: defaultAction,
      plan: normalizedPlan,
      durationDays: defaultDuration,
      customEndDate: "",
    };
  };

  const updateCompanyAction = (company, patch) => {
    const companyId = company.companyId;
    const nextAction = patch.action || getCompanyAction(company).action;
    const nextPlan =
      patch.plan ||
      (["activate", "renew"].includes(nextAction) &&
      getCompanyAction(company).plan === "Free"
        ? "Monthly"
        : getCompanyAction(company).plan);
    const shouldLockDuration = isPaidPlanAction(nextAction) && isFixedDurationPlan(nextPlan);
    setCompanyActions((prev) => ({
      ...prev,
      [companyId]: {
        ...getCompanyAction(company),
        ...prev[companyId],
        ...patch,
        plan: nextPlan,
        durationDays: shouldLockDuration
          ? FIXED_PLAN_DURATIONS[nextPlan]
          : patch.durationDays ??
            prev[companyId]?.durationDays ??
            getCompanyAction(company).durationDays,
        customEndDate:
          isPaidPlanAction(nextAction) && nextPlan === "Lifetime"
            ? ""
            : patch.customEndDate ??
              prev[companyId]?.customEndDate ??
              getCompanyAction(company).customEndDate,
      },
    }));
  };

  const applyCompanyAction = async (company) => {
    const companyId = company.companyId;
    const actionState = getCompanyAction(company);
    const shouldAutoDuration =
      isPaidPlanAction(actionState.action) && isFixedDurationPlan(actionState.plan);
    const durationDays = shouldAutoDuration
      ? FIXED_PLAN_DURATIONS[actionState.plan]
      : actionState.plan === "Lifetime"
        ? undefined
        : Number(actionState.durationDays) || undefined;
    const customEndDate =
      isPaidPlanAction(actionState.action) && actionState.plan === "Lifetime"
        ? undefined
        : actionState.customEndDate || undefined;
    try {
      setSavingCompanyId(companyId);
      setCompaniesError("");
      await api.patch(`/api/subscriptions/companies/${companyId}/manage`, {
        action: actionState.action,
        plan: actionState.plan,
        durationDays,
        customEndDate,
      });
      await loadRequests();
    } catch (err) {
      setCompaniesError(
        err.response?.data?.message || "Failed to update subscription control"
      );
    } finally {
      setSavingCompanyId("");
    }
  };

  if (!resolvedRole) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-gray-400">
        Loading Admin Billing...
      </div>
    );
  }

  if (!isSuperuser) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8 rounded-3xl border border-indigo-500/20 bg-[#111827] p-6 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-300" size={28} />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">
              Admin billing
            </p>
            <h1 className="mt-1 text-3xl font-bold">Manual subscription requests</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-gray-400">
          Review payment references and proof links, then manually activate premium access.
        </p>
        {/* Simulation badge removed */}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "pending", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              statusFilter === tab.key
                ? "bg-indigo-600 text-white"
                : "border border-gray-700 bg-[#0f172a] text-gray-300 hover:border-indigo-500"
            }`}
          >
            {tab.label}{" "}
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
              {groupedRequests[tab.key]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-gray-400">
          Loading subscription requests...
        </div>
      ) : groupedRequests[statusFilter]?.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-8 text-center">
          <Clock3 className="mx-auto mb-3 text-indigo-300" size={32} />
          <p className="font-medium text-white">No {statusFilter} requests</p>
          <p className="mt-2 text-sm text-gray-400">New payment submissions will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {groupedRequests[statusFilter].map((request) => (
            <div key={request.id} className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{request.user?.name || "Unknown user"}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${statusStyle[request.status]}`}>
                      {request.status}
                    </span>
                    {/* Simulation tag removed */}
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{request.user?.email || "No email"}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Company: {request.companyName || "Company"} ({request.companyId})
                  </p>
                  <p className="mt-3 text-sm text-gray-300">
                    {request.plan} plan via {request.paymentMethod}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    Reference: <span className="text-white">{request.referenceNumber}</span>
                  </p>
                  {request.notes ? <p className="mt-2 text-sm text-gray-400">Notes: {request.notes}</p> : null}
                  {request.proofUrl ? (
                    <a
                      href={request.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
                    >
                      Open proof link
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => reviewRequest(request.id, "approved")}
                    disabled={reviewingId === request.id || request.status === "approved"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => reviewRequest(request.id, "rejected")}
                    disabled={reviewingId === request.id || request.status === "rejected"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-3xl border border-gray-800 bg-[#111827] p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">
              Subscription control
            </p>
            <h2 className="mt-1 text-2xl font-bold">Company subscriptions</h2>
            <p className="mt-2 text-sm text-gray-400">
              Activate, renew, suspend, or manage trials for any company.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={companyStatusFilter}
              onChange={(e) => setCompanyStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] px-3 py-2 text-xs text-gray-400">
              Manage at company level
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] px-3 py-2 text-xs text-gray-400">
              Actions apply instantly
            </div>
          </div>
        </div>

        {companiesError ? (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {companiesError}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[980px] space-y-4">
            {filteredCompanies.map((company) => (
              (() => {
                const state = getCompanyAction(company);
                const action = state.action;
                const plan = state.plan;
                const disablePlan = ["suspend", "end-trial", "resume"].includes(action);
                const disableDateInputs = ["suspend", "end-trial", "resume"].includes(action);
                const showDuration = action === "start-trial" || !isPaidPlanAction(action);
                const showAutoDurationHint = isPaidPlanAction(action) && isFixedDurationPlan(plan);
                const isLifetimePaidAction = isPaidPlanAction(action) && plan === "Lifetime";
                return (
              <div
                key={company.companyId}
                className="rounded-2xl border border-gray-800 bg-[#0f172a] p-4 text-sm"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {company.companyName || "Company"}
                    </p>
                    <p className="text-xs text-gray-500">ID: {company.companyId}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-300">
                      <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 capitalize">
                        Status: {company.subscription?.accountStatus || "trial"}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-[#111827] px-2 py-1">
                        Plan: {company.subscription?.plan || "Free"}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-[#111827] px-2 py-1">
                        Members: {company.userCount || 0}
                      </span>
                      <span className="rounded-full border border-gray-700 bg-[#111827] px-2 py-1">
                        Ends:{" "}
                        {company.subscription?.subscriptionEndDate
                          ? new Date(
                              company.subscription.subscriptionEndDate
                            ).toLocaleDateString()
                          : company.subscription?.trialEndDate
                            ? new Date(company.subscription.trialEndDate).toLocaleDateString()
                            : "Not set"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid w-full gap-3 lg:mt-0 lg:max-w-[520px] lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-xs text-gray-400">Action</label>
                      <select
                        value={state.action}
                        onChange={(e) =>
                          updateCompanyAction(company, {
                            action: e.target.value,
                          })
                        }
                        className="rounded-xl border border-gray-700 bg-[#0b1220] px-3 py-2 text-sm"
                      >
                        <option value="activate">Activate</option>
                        <option value="renew">Renew</option>
                        <option value="start-trial">Start trial</option>
                        <option value="end-trial">End trial</option>
                        <option value="suspend">Suspend</option>
                        <option value="resume">Resume</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-xs text-gray-400">Plan</label>
                      <select
                        value={state.plan}
                        onChange={(e) =>
                          updateCompanyAction(company, {
                            plan: e.target.value,
                          })
                        }
                        className="rounded-xl border border-gray-700 bg-[#0b1220] px-3 py-2 text-sm"
                        disabled={disablePlan}
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Yearly">Yearly</option>
                        <option value="Lifetime">Lifetime</option>
                      </select>
                    </div>

                    {showDuration ? (
                      <div className="grid gap-2">
                        <label className="text-xs text-gray-400">Duration</label>
                        <select
                          value={state.durationDays}
                          onChange={(e) =>
                            updateCompanyAction(company, {
                              durationDays: e.target.value,
                            })
                          }
                          className="rounded-xl border border-gray-700 bg-[#0b1220] px-3 py-2 text-sm"
                          disabled={disableDateInputs}
                        >
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                          <option value="180">180 days</option>
                          <option value="365">1 year</option>
                        </select>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <label className="text-xs text-gray-400">Duration</label>
                        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
                          {showAutoDurationHint
                            ? `${plan} is fixed to ${FIXED_PLAN_DURATIONS[plan]} days`
                            : "Not required for this action"}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <label className="text-xs text-gray-400">Custom end date</label>
                      <input
                        type="date"
                        value={state.customEndDate}
                        onChange={(e) =>
                          updateCompanyAction(company, {
                            customEndDate: e.target.value,
                          })
                        }
                        className="rounded-xl border border-gray-700 bg-[#0b1220] px-3 py-2 text-sm"
                        disabled={disableDateInputs || isLifetimePaidAction}
                      />
                      {isLifetimePaidAction ? (
                        <p className="text-[11px] text-gray-500">
                          Lifetime has no end date.
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Optional override. Leave empty to use the automatic duration.
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <button
                        onClick={() => applyCompanyAction(company)}
                        disabled={savingCompanyId === company.companyId}
                        className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {savingCompanyId === company.companyId ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
                );
              })()
            ))}

            {!filteredCompanies.length ? (
              <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-center text-gray-400">
                No companies match this filter.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
