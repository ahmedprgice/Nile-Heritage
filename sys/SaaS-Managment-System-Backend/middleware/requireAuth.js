const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { evaluateSubscription, hasSubscriptionChanged } = require("../utils/subscription");
const { getJwtSecret } = require("../utils/security");

const canBypassSubscriptionLock = (req) => {
  const path = req.originalUrl || req.url || "";
  return (
    path.startsWith("/api/subscriptions") ||
    path.startsWith("/api/auth/me") ||
    path.startsWith("/api/auth/logout")
  );
};

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findById(decoded.id).select(
      "_id email name role companyId companyName subscription"
    );

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.companyId || !user.companyName) {
      return res.status(403).json({
        message:
          "This account is not linked to a company yet. Please complete company setup.",
      });
    }

    const evaluatedSubscription = evaluateSubscription(user.subscription);

    // Persist automatic trial/subscription expiry transitions as users make requests.
    if (hasSubscriptionChanged(user.subscription, evaluatedSubscription)) {
      user.subscription = evaluatedSubscription;
      await user.save();
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      email: user.email,
      name: user.name || "",
      role: user.role || "Member",
      companyId: user.companyId,
      companyName: user.companyName,
      subscription: evaluatedSubscription,
    };

    if (!evaluatedSubscription.hasAccess && !canBypassSubscriptionLock(req)) {
      return res.status(402).json({
        message: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        subscription: evaluatedSubscription,
      });
    }

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = requireAuth;
