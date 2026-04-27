const DEFAULT_TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

const addDays = (date, days) =>
  new Date(date.getTime() + Number(days || 0) * 24 * 60 * 60 * 1000);

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createTrialSubscription = (startDate = new Date()) => ({
  status: "trial",
  accountStatus: "trial",
  paymentStatus: "unpaid",
  plan: "Free",
  trialUsed: true,
  trialStartDate: startDate,
  trialEndDate: addDays(startDate, DEFAULT_TRIAL_DAYS),
  subscriptionStartDate: null,
  subscriptionEndDate: null,
  activatedAt: null,
  expiresAt: null,
  paymentMethod: "",
  lastReference: "",
  suspendedAt: null,
});

const serializeSubscription = (subscription = {}) => ({
  status:
    subscription.status === "premium"
      ? "active"
      : subscription.status === "free"
        ? "trial"
        : subscription.status || subscription.accountStatus || "trial",
  accountStatus:
    subscription.status === "premium"
      ? "active"
      : subscription.status === "free"
        ? "trial"
        : subscription.accountStatus || subscription.status || "trial",
  paymentStatus:
    subscription.paymentStatus ||
    (subscription.status === "premium"
      ? "paid"
      : subscription.status === "pending"
        ? "pending"
        : "unpaid"),
  plan: subscription.plan || "Free",
  trialUsed: Boolean(subscription.trialUsed) || Boolean(subscription.trialStartDate),
  trialStartDate: subscription.trialStartDate || null,
  trialEndDate: subscription.trialEndDate || null,
  subscriptionStartDate: subscription.subscriptionStartDate || subscription.activatedAt || null,
  subscriptionEndDate: subscription.subscriptionEndDate || subscription.expiresAt || null,
  activatedAt: subscription.activatedAt || subscription.subscriptionStartDate || null,
  expiresAt: subscription.expiresAt || subscription.subscriptionEndDate || null,
  paymentMethod: subscription.paymentMethod || "",
  lastReference: subscription.lastReference || "",
  suspendedAt: subscription.suspendedAt || null,
});

const evaluateSubscription = (subscription = {}, now = new Date()) => {
  const defaults = createTrialSubscription(now);
  const normalized = serializeSubscription({
    ...defaults,
    ...subscription,
    trialStartDate: subscription.trialStartDate || defaults.trialStartDate,
    trialEndDate: subscription.trialEndDate || defaults.trialEndDate,
  });

  const explicitSuspended =
    normalized.accountStatus === "suspended" || normalized.status === "suspended";
  if (explicitSuspended) {
    return {
      ...normalized,
      status: "suspended",
      accountStatus: "suspended",
      hasAccess: false,
      accessReason: "suspended",
    };
  }

  const subscriptionEndDate = toDate(normalized.subscriptionEndDate || normalized.expiresAt);
  const subscriptionStartDate = toDate(
    normalized.subscriptionStartDate || normalized.activatedAt || now,
  );
  const paidActive =
    normalized.paymentStatus === "paid" &&
    subscriptionStartDate &&
    (!subscriptionEndDate || subscriptionEndDate >= now);

  if (paidActive) {
    return {
      ...normalized,
      status: "active",
      accountStatus: "active",
      plan: normalized.plan === "Free" ? "Monthly" : normalized.plan,
      subscriptionStartDate,
      subscriptionEndDate,
      activatedAt: subscriptionStartDate,
      expiresAt: subscriptionEndDate,
      hasAccess: true,
      accessReason: "active_subscription",
    };
  }

  const trialEndDate = toDate(normalized.trialEndDate);
  const trialStartDate = toDate(normalized.trialStartDate || now);
  const trialActive =
    normalized.paymentStatus !== "paid" &&
    trialStartDate &&
    trialEndDate &&
    trialEndDate >= now;

  if (trialActive) {
    return {
      ...normalized,
      status: "trial",
      accountStatus: "trial",
      trialStartDate,
      trialEndDate,
      hasAccess: true,
      accessReason: "trial",
    };
  }

  return {
    ...normalized,
    status: "expired",
    accountStatus: "expired",
    paymentStatus: normalized.paymentStatus === "pending" ? "pending" : normalized.paymentStatus,
    hasAccess: false,
    accessReason: "expired",
  };
};

const hasSubscriptionChanged = (current = {}, evaluated = {}) => {
  const fields = [
    "status",
    "accountStatus",
    "paymentStatus",
    "plan",
    "trialUsed",
    "trialStartDate",
    "trialEndDate",
    "subscriptionStartDate",
    "subscriptionEndDate",
    "activatedAt",
    "expiresAt",
  ];

  return fields.some((field) => String(current?.[field] || "") !== String(evaluated?.[field] || ""));
};

module.exports = {
  DEFAULT_TRIAL_DAYS,
  addDays,
  createTrialSubscription,
  evaluateSubscription,
  hasSubscriptionChanged,
  serializeSubscription,
};
