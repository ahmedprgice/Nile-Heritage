const express = require("express");
const User = require("../models/User");
const SubscriptionRequest = require("../models/SubscriptionRequest");
const Notification = require("../models/Notification");
const {
  addDays,
  createTrialSubscription,
  evaluateSubscription,
  serializeSubscription,
} = require("../utils/subscription");

const router = express.Router();

const PAYMENT_METHODS = ["Bank Transfer - Maybank"];

const PAYMENT_INSTRUCTIONS = [
  {
    method: "Bank Transfer - Maybank",
    details: "Transfer the selected subscription amount to this demo account, then submit the bank reference number for admin approval.",
    bankName: "Maybank",
    accountName: "Nexora Demo Sdn. Bhd.",
    accountNumber: "5140 1234 5678",
    note: "Demo bank account for testing only. Replace with your real bank details before production.",
  },
];

const isSubscriptionAdmin = (role) =>
  String(role || "").toLowerCase() === "superuser";

const canManageCompanyBilling = (role) =>
  ["owner", "admin"].includes(String(role || "").toLowerCase());

const isSystemUser = (req) => isSubscriptionAdmin(req.user?.role);

const serializeRequest = (request) => ({
  id: String(request._id),
  user: request.user
    ? {
        id: String(request.user._id || request.user),
        name: request.user.name || "",
        email: request.user.email || "",
      }
    : null,
  companyId: request.companyId,
  companyName: request.companyName,
  plan: request.plan,
  paymentMethod: request.paymentMethod,
  referenceNumber: request.referenceNumber,
  proofUrl: request.proofUrl || "",
  notes: request.notes || "",
  status: request.status,
  adminNote: request.adminNote || "",
  reviewedAt: request.reviewedAt,
  createdAt: request.createdAt,
});

const isSimulationRequest = (request) => {
  const reference = String(request?.referenceNumber || "");
  const notes = String(request?.notes || "").toLowerCase();
  return reference.startsWith("SIM-") || notes.includes("simulation payment");
};

const groupRequestsByCompany = (requests = []) => {
  const map = new Map();
  requests.forEach((request) => {
    const companyId = String(request.companyId || "");
    if (!companyId) return;
    if (!map.has(companyId)) {
      map.set(companyId, []);
    }
    map.get(companyId).push(request);
  });

  const pickRepresentative = (items = []) => {
    if (!items.length) return null;
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const pending = sorted.find((item) => item.status === "pending");
    return pending || sorted[0];
  };

  return Array.from(map.values())
    .map(pickRepresentative)
    .filter(Boolean);
};

const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name || "",
  email: user.email || "",
  role: user.role || "Member",
  companyId: user.companyId,
  companyName: user.companyName,
  subscription: serializeSubscription(evaluateSubscription(user.subscription)),
});

const serializeCompany = (companyId, companyName, sampleSubscription, userCount) => ({
  companyId,
  companyName: companyName || "Company",
  userCount,
  subscription: serializeSubscription(evaluateSubscription(sampleSubscription)),
});

const buildCompanySummaries = (users = []) => {
  const map = new Map();
  users.forEach((user) => {
    if (!user?.companyId) return;
    const normalizedRole = String(user?.role || "").toLowerCase();
    const normalizedCompanyId = String(user?.companyId || "").toLowerCase();
    if (normalizedRole === "superuser" || normalizedCompanyId === "superuser") return;
    const key = String(user.companyId);
    if (!map.has(key)) {
      map.set(key, {
        companyId: key,
        companyName: user.companyName || "Company",
        sampleSubscription: user.subscription || {},
        userCount: 0,
      });
    }
    const entry = map.get(key);
    entry.userCount += 1;
  });

  return Array.from(map.values()).map((entry) =>
    serializeCompany(
      entry.companyId,
      entry.companyName,
      entry.sampleSubscription,
      entry.userCount
    )
  );
};
const getSubscriptionDates = ({ durationDays, customEndDate }) => {
  const startDate = new Date();
  const parsedCustomEndDate = customEndDate ? new Date(customEndDate) : null;
  const endDate =
    parsedCustomEndDate && !Number.isNaN(parsedCustomEndDate.getTime())
      ? parsedCustomEndDate
      : addDays(startDate, Number(durationDays || 30));

  if (endDate <= startDate) {
    throw new Error("Subscription end date must be in the future");
  }

  return { startDate, endDate };
};
const isLifetimePlan = (plan) => String(plan || "").trim() === "Lifetime";
const getDefaultDurationByPlan = (plan) => {
  const normalizedPlan = String(plan || "").trim();
  if (normalizedPlan === "Monthly") return 30;
  if (normalizedPlan === "Yearly") return 365;
  return 30;
};
const getSubscriptionDatesByPlan = ({ plan, durationDays, customEndDate }) => {
  if (isLifetimePlan(plan)) {
    return { startDate: new Date(), endDate: null };
  }
  const normalizedPlan = String(plan || "").trim();
  const effectiveDuration =
    customEndDate || !["Monthly", "Yearly"].includes(normalizedPlan)
      ? durationDays
      : getDefaultDurationByPlan(normalizedPlan);
  return getSubscriptionDates({
    durationDays: effectiveDuration,
    customEndDate,
  });
};

const updateCompanyUsers = async (companyId, update) => {
  if (!companyId) return;
  await User.updateMany({ companyId }, update);
};

const notifyCompanyAdmins = async ({ companyId, text, type = "success" }) => {
  if (!companyId || !text) return;
  const admins = await User.find({
    companyId,
    role: { $in: ["Owner", "Admin", "owner", "admin"] },
  }).select("_id companyId");

  if (!admins.length) return;
  const notifications = admins.map((user) => ({
    userId: user._id,
    companyId: String(companyId),
    text,
    type,
  }));
  await Notification.insertMany(notifications);
};


const buildCompanyResponse = async (companyId) => {
  const updatedUsers = await User.find({ companyId })
    .select("companyId companyName subscription")
    .sort({ createdAt: -1 });
  const companies = buildCompanySummaries(updatedUsers);
  return companies.find((item) => item.companyId === companyId) || null;
};

router.get("/me", async (req, res) => {
  try {
    if (!canManageCompanyBilling(req.user?.role)) {
      return res.status(403).json({ message: "Only owners or admins can access billing." });
    }
    const user = await User.findById(req.user._id).select("subscription");
    user.subscription = evaluateSubscription(user?.subscription);
    await user.save();
    const latestRequest = await SubscriptionRequest.findOne({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("user", "name email");

    res.status(200).json({
      subscription: serializeSubscription(evaluateSubscription(user?.subscription)),
      latestRequest: latestRequest ? serializeRequest(latestRequest) : null,
      paymentInstructions: PAYMENT_INSTRUCTIONS,
      paymentMethods: PAYMENT_METHODS,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load subscription",
      error: error.message,
    });
  }
});

router.post("/trial", async (req, res) => {
  try {
    if (!canManageCompanyBilling(req.user?.role)) {
      return res.status(403).json({ message: "Only owners or admins can manage billing." });
    }
    if (!req.user?.companyId) {
      return res.status(400).json({ message: "Company is required" });
    }

    const companyUsers = await User.find({ companyId: req.user.companyId })
      .select("subscription");

    const hasPaid = companyUsers.some((user) => {
      const evaluated = evaluateSubscription(user.subscription);
      return evaluated.accountStatus === "active" && evaluated.paymentStatus === "paid";
    });

    if (hasPaid) {
      return res.status(400).json({
        message: "This company already has an active subscription.",
      });
    }

    const trialAlreadyUsed = companyUsers.some((user) => {
      if (user.subscription?.trialUsed) return true;
      if (user.subscription?.trialStartDate) return true;
      return false;
    });

    if (trialAlreadyUsed) {
      return res.status(400).json({
        message: "This company has already used the free trial.",
      });
    }

    const trial = createTrialSubscription(new Date());

    await User.updateMany(
      { companyId: req.user.companyId },
      {
        "subscription.status": trial.status,
        "subscription.accountStatus": trial.accountStatus,
        "subscription.paymentStatus": trial.paymentStatus,
        "subscription.plan": trial.plan,
        "subscription.trialUsed": true,
        "subscription.trialStartDate": trial.trialStartDate,
        "subscription.trialEndDate": trial.trialEndDate,
        "subscription.subscriptionStartDate": null,
        "subscription.subscriptionEndDate": null,
        "subscription.activatedAt": null,
        "subscription.expiresAt": null,
        "subscription.paymentMethod": "",
        "subscription.lastReference": "",
        "subscription.suspendedAt": null,
      }
    );

    const updatedUser = await User.findById(req.user._id).select("subscription");

    res.status(200).json({
      message: "Free trial activated for your company.",
      subscription: serializeSubscription(evaluateSubscription(updatedUser?.subscription)),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to activate free trial",
      error: error.message,
    });
  }
});

router.post("/requests", async (req, res) => {
  try {
    if (!canManageCompanyBilling(req.user?.role)) {
      return res.status(403).json({ message: "Only owners or admins can manage billing." });
    }
    const { plan, paymentMethod, referenceNumber, proofUrl, notes } = req.body;

    if (!["Monthly", "Yearly", "Lifetime"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be Monthly, Yearly, or Lifetime" });
    }

    if (!paymentMethod || !String(paymentMethod).trim()) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    if (!referenceNumber || !String(referenceNumber).trim()) {
      return res.status(400).json({ message: "Reference number is required" });
    }

    const companyId = String(req.user.companyId || "");
    if (!companyId) {
      return res.status(400).json({ message: "Company is required" });
    }

    const payload = {
      user: req.user._id,
      companyId,
      companyName: req.user.companyName,
      plan,
      paymentMethod: String(paymentMethod).trim(),
      referenceNumber: String(referenceNumber).trim(),
      proofUrl: String(proofUrl || "").trim(),
      notes: String(notes || "").trim(),
    };

    let request = await SubscriptionRequest.findOne({
      companyId,
      status: "pending",
    });

    if (request) {
      request.user = payload.user;
      request.companyName = payload.companyName;
      request.plan = payload.plan;
      request.paymentMethod = payload.paymentMethod;
      request.referenceNumber = payload.referenceNumber;
      request.proofUrl = payload.proofUrl;
      request.notes = payload.notes;
      request.createdAt = new Date();
      await request.save();
    } else {
      request = await SubscriptionRequest.create(payload);
    }

    await User.findByIdAndUpdate(req.user._id, {
      "subscription.paymentStatus": "pending",
      "subscription.plan": plan,
      "subscription.paymentMethod": String(paymentMethod).trim(),
      "subscription.lastReference": String(referenceNumber).trim(),
    });

    const populated = await request.populate("user", "name email");

    res.status(201).json({
      message: "Subscription request submitted",
      request: serializeRequest(populated),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to submit subscription request",
      error: error.message,
    });
  }
});

router.get("/requests", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can view subscription requests" });
    }

    const requests = await SubscriptionRequest.find(
      isSystemUser(req) ? {} : { companyId: req.user.companyId }
    )
      .sort({ createdAt: -1 })
      .populate("user", "name email");

    const filtered = requests.filter((request) => !isSimulationRequest(request));
    const grouped = groupRequestsByCompany(filtered);

    res.status(200).json({
      requests: grouped.map(serializeRequest),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load subscription requests",
      error: error.message,
    });
  }
});

router.get("/companies", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can view subscription companies" });
    }

    const users = await User.find({
      role: { $nin: ["Superuser", "superuser"] },
      companyId: { $ne: "superuser" },
    })
      .select("companyId companyName subscription role")
      .sort({ createdAt: -1 });

    const companies = buildCompanySummaries(users);

    res.status(200).json({ companies });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load subscription companies",
      error: error.message,
    });
  }
});

router.get("/users", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can view subscription users" });
    }

    const { status } = req.query;
    const users = await User.find({
      role: { $nin: ["Superuser", "superuser"] },
      companyId: { $ne: "superuser" },
    })
      .select("companyId companyName subscription role")
      .sort({ createdAt: -1 });

    const companies = buildCompanySummaries(users);

    res.status(200).json({
      companies: status
        ? companies.filter((company) => company.subscription.accountStatus === status)
        : companies,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load subscription users",
      error: error.message,
    });
  }
});

router.patch("/companies/:companyId/activate", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can activate subscriptions" });
    }

    const { plan = "Monthly", durationDays = 30, customEndDate, paymentMethod = "Manual", referenceNumber = "" } = req.body;
    if (!["Monthly", "Yearly", "Lifetime"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be Monthly, Yearly, or Lifetime" });
    }

    const companyId = String(req.params.companyId || "");
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const { startDate, endDate } = getSubscriptionDatesByPlan({ plan, durationDays, customEndDate });

    const userUpdate = {
      "subscription.status": "active",
      "subscription.accountStatus": "active",
      "subscription.paymentStatus": "paid",
      "subscription.plan": plan,
      "subscription.subscriptionStartDate": startDate,
      "subscription.subscriptionEndDate": endDate,
      "subscription.activatedAt": startDate,
      "subscription.expiresAt": endDate,
      "subscription.paymentMethod": paymentMethod,
      "subscription.lastReference": String(referenceNumber || "").trim(),
      "subscription.suspendedAt": null,
    };

    await User.updateMany({ companyId }, userUpdate);

    const company = await buildCompanyResponse(companyId);

    res.status(200).json({
      message: "Company subscription activated",
      company,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to activate subscription",
      error: error.message,
    });
  }
});

router.patch("/companies/:companyId/manage", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can manage subscriptions" });
    }

    const companyId = String(req.params.companyId || "");
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const action = String(req.body?.action || "").toLowerCase();
    const plan = String(req.body?.plan || "Monthly");
    const durationDays = Number(req.body?.durationDays || 30);
    const customEndDate = req.body?.customEndDate || null;

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    if (!["Monthly", "Yearly", "Lifetime", "Free"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be Monthly, Yearly, Lifetime, or Free" });
    }

    if (["activate", "renew"].includes(action) && plan === "Free") {
      return res.status(400).json({ message: "Activate/Renew requires a paid plan" });
    }

    if (["activate", "renew"].includes(action)) {
      const { startDate, endDate } = getSubscriptionDatesByPlan({ plan, durationDays, customEndDate });
      await updateCompanyUsers(companyId, {
        "subscription.status": "active",
        "subscription.accountStatus": "active",
        "subscription.paymentStatus": "paid",
        "subscription.plan": plan,
        "subscription.subscriptionStartDate": startDate,
        "subscription.subscriptionEndDate": endDate,
        "subscription.activatedAt": startDate,
        "subscription.expiresAt": endDate,
        "subscription.paymentMethod": "Manual admin update",
        "subscription.lastReference": "",
        "subscription.suspendedAt": null,
      });

      await notifyCompanyAdmins({
        companyId,
        text: `Subscription activated for your company (${plan} plan).`,
        type: "success",
      });
    }

    if (action === "start-trial") {
      const trial = createTrialSubscription(new Date());
      const { endDate } = getSubscriptionDates({
        durationDays,
        customEndDate: customEndDate || trial.trialEndDate,
      });
      await updateCompanyUsers(companyId, {
        "subscription.status": "trial",
        "subscription.accountStatus": "trial",
        "subscription.paymentStatus": "unpaid",
        "subscription.plan": "Free",
        "subscription.trialUsed": true,
        "subscription.trialStartDate": new Date(),
        "subscription.trialEndDate": endDate,
        "subscription.subscriptionStartDate": null,
        "subscription.subscriptionEndDate": null,
        "subscription.activatedAt": null,
        "subscription.expiresAt": endDate,
        "subscription.paymentMethod": "",
        "subscription.lastReference": "",
        "subscription.suspendedAt": null,
      });

      await notifyCompanyAdmins({
        companyId,
        text: "A free trial has been activated for your company.",
        type: "info",
      });
    }

    if (action === "end-trial") {
      const now = new Date();
      await updateCompanyUsers(companyId, {
        "subscription.status": "expired",
        "subscription.accountStatus": "expired",
        "subscription.paymentStatus": "unpaid",
        "subscription.plan": "Free",
        "subscription.trialEndDate": now,
        "subscription.expiresAt": now,
      });
    }

    if (action === "suspend") {
      const now = new Date();
      await updateCompanyUsers(companyId, {
        "subscription.status": "suspended",
        "subscription.accountStatus": "suspended",
        "subscription.paymentStatus": "unpaid",
        "subscription.suspendedAt": now,
      });
    }

    if (action === "resume") {
      await updateCompanyUsers(companyId, {
        "subscription.status": "active",
        "subscription.accountStatus": "active",
        "subscription.paymentStatus": "paid",
        "subscription.suspendedAt": null,
      });

      await notifyCompanyAdmins({
        companyId,
        text: "Your subscription has been resumed.",
        type: "success",
      });
    }

    const company = await buildCompanyResponse(companyId);

    return res.status(200).json({
      message: "Subscription updated",
      company,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to manage subscription",
      error: error.message,
    });
  }
});
router.patch("/users/:id/activate", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can activate subscriptions" });
    }

    const { plan = "Monthly", durationDays = 30, customEndDate, paymentMethod = "Manual", referenceNumber = "" } = req.body;
    if (!["Monthly", "Yearly", "Lifetime"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be Monthly, Yearly, or Lifetime" });
    }

    const user = await User.findOne({ _id: req.params.id }).select("name email role companyId companyName subscription");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { startDate, endDate } = getSubscriptionDatesByPlan({ plan, durationDays, customEndDate });

    const userUpdate = {
      "subscription.status": "active",
      "subscription.accountStatus": "active",
      "subscription.paymentStatus": "paid",
      "subscription.plan": plan,
      "subscription.subscriptionStartDate": startDate,
      "subscription.subscriptionEndDate": endDate,
      "subscription.activatedAt": startDate,
      "subscription.expiresAt": endDate,
      "subscription.paymentMethod": paymentMethod,
      "subscription.lastReference": String(referenceNumber || "").trim(),
      "subscription.suspendedAt": null,
    };

    await User.updateMany({ companyId: user.companyId }, userUpdate);

    res.status(200).json({
      message: "Company subscription activated",
      companyId: user.companyId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to activate subscription",
      error: error.message,
    });
  }
});

router.patch("/requests/:id/review", async (req, res) => {
  try {
    if (!isSubscriptionAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only the superuser can review subscriptions" });
    }

    const { status, adminNote, durationDays, customEndDate } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const request = await SubscriptionRequest.findOne(
      isSystemUser(req)
        ? { _id: req.params.id }
        : { _id: req.params.id, companyId: req.user.companyId }
    );

    if (!request) {
      return res.status(404).json({ message: "Subscription request not found" });
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.adminNote = String(adminNote || "").trim();
    await request.save();

    let userUpdate;
    if (status === "approved") {
      const { startDate, endDate } = getSubscriptionDatesByPlan({
        plan: request.plan,
        durationDays: durationDays || (request.plan === "Yearly" ? 365 : 30),
        customEndDate,
      });

      userUpdate = {
        "subscription.status": "active",
        "subscription.accountStatus": "active",
        "subscription.paymentStatus": "paid",
        "subscription.plan": request.plan,
        "subscription.subscriptionStartDate": startDate,
        "subscription.subscriptionEndDate": endDate,
        "subscription.activatedAt": startDate,
        "subscription.expiresAt": endDate,
        "subscription.paymentMethod": request.paymentMethod,
        "subscription.lastReference": request.referenceNumber,
        "subscription.suspendedAt": null,
      };

      await notifyCompanyAdmins({
        companyId: request.companyId,
        text: `Subscription approved (${request.plan} plan). Your company now has access.`,
        type: "success",
      });

    } else {
      const existingUser = await User.findOne({ companyId: request.companyId }).select("subscription");
      const existingEvaluated = evaluateSubscription(existingUser?.subscription);
      const evaluated =
        existingEvaluated.accountStatus === "active"
          ? existingEvaluated
          : evaluateSubscription({
              ...serializeSubscription(existingUser?.subscription),
              paymentStatus: "rejected",
            });
      userUpdate = {
        "subscription.status": evaluated.status,
        "subscription.accountStatus": evaluated.accountStatus,
        "subscription.paymentStatus":
          existingEvaluated.accountStatus === "active" ? "paid" : "rejected",
        "subscription.plan": evaluated.plan,
      };
    }

    await User.updateMany({ companyId: request.companyId }, userUpdate);

    const populated = await request.populate("user", "name email");

    res.status(200).json({
      message: `Subscription ${status}`,
      request: serializeRequest(populated),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to review subscription request",
      error: error.message,
    });
  }
});

module.exports = router;
