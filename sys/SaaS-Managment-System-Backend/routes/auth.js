const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const requireAuth = require("../middleware/requireAuth");
const jwt = require("jsonwebtoken");
const userController = require("../controllers/userController");
const {
  createTrialSubscription,
  evaluateSubscription,
  serializeSubscription,
} = require("../utils/subscription");
const {
  getJwtSecret,
  getAppUrl,
  hashInvitationToken,
} = require("../utils/security");
const { sendEmail } = require("../utils/email");
require("dotenv").config();
const toNullableString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toNullableNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const buildUserResponse = (user) => ({
  id: user?._id ? String(user._id) : null,
  name: toNullableString(user?.name),
  email: toNullableString(user?.email),
  role: toNullableString(user?.role),
  avatarUrl: toNullableString(user?.avatarUrl),
  companyId: toNullableString(user?.companyId),
  companyName: toNullableString(user?.companyName),
  subscription: serializeSubscription(user?.subscription),
  preferences: {
    emailNotifications:
      typeof user?.preferences?.emailNotifications === "boolean"
        ? user.preferences.emailNotifications
        : true,
  },
});

const buildProfileResponse = (user) => ({
  name: toNullableString(user?.name),
  email: toNullableString(user?.email),
  role: toNullableString(user?.role),
  avatarUrl: toNullableString(user?.avatarUrl),
  companyId: toNullableString(user?.companyId),
  companyName: toNullableString(user?.companyName),
  subscription: serializeSubscription(user?.subscription),
  preferences: {
    emailNotifications:
      typeof user?.preferences?.emailNotifications === "boolean"
        ? user.preferences.emailNotifications
        : true,
  },
  passwordLastChanged: user?.passwordLastChanged
    ? new Date(user.passwordLastChanged).toISOString()
    : null,
  stats: {
    activeProjects: toNullableNumber(user?.activeProjects),
    completedTasks: toNullableNumber(user?.completedTasks),
    teamMembers: Array.isArray(user?.teamMembers)
      ? user.teamMembers.length
      : toNullableNumber(user?.teamMembers),
  },
});

const buildMePayload = (user) => ({
  user: buildUserResponse(user),
  profile: buildProfileResponse(user),
});

const createToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: "1d",
  });

const isInviteManager = (role) => ["Owner", "Admin"].includes(role);

const buildInvitationResponse = (invitation) => ({
  id: invitation?._id ? String(invitation._id) : null,
  email: toNullableString(invitation?.email),
  role: toNullableString(invitation?.role),
  companyId: toNullableString(invitation?.companyId),
  companyName: toNullableString(invitation?.companyName),
  status: toNullableString(invitation?.status),
  invitedBy: invitation?.invitedBy ? String(invitation.invitedBy) : null,
  expiresAt: invitation?.expiresAt
    ? new Date(invitation.expiresAt).toISOString()
    : null,
  acceptedAt: invitation?.acceptedAt
    ? new Date(invitation.acceptedAt).toISOString()
    : null,
  createdAt: invitation?.createdAt
    ? new Date(invitation.createdAt).toISOString()
    : null,
});

const issueInviteUrl = (token) => `${getAppUrl()}/auth/accept-invite?token=${token}`;

const buildInvitationEmail = ({
  inviteLink,
  companyName,
  invitedRole,
  inviterName,
}) => {
  const safeCompanyName = String(companyName || "your company");
  const safeRole = String(invitedRole || "Member");
  const safeInviterName = String(inviterName || "A team admin");

  return {
    subject: `You're invited to join ${safeCompanyName} on NEXORA`,
    text: [
      `You have been invited by ${safeInviterName} to join ${safeCompanyName} as ${safeRole}.`,
      "",
      `Accept invitation: ${inviteLink}`,
      "",
      "This invitation expires in 7 days.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">NEXORA Invitation</h2>
        <p style="margin: 0 0 10px;">
          <strong>${safeInviterName}</strong> invited you to join
          <strong>${safeCompanyName}</strong> as <strong>${safeRole}</strong>.
        </p>
        <p style="margin: 0 0 16px;">
          Click below to accept your invitation:
        </p>
        <p style="margin: 0 0 16px;">
          <a
            href="${inviteLink}"
            style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
          >
            Accept Invitation
          </a>
        </p>
        <p style="margin: 0; color: #475569; font-size: 13px;">
          This invitation expires in 7 days.
        </p>
      </div>
    `,
  };
};

const inferCompanyNameFromEmail = (email) => {
  const domain = String(email || "").split("@")[1] || "";
  const label = domain.split(".")[0] || "Company";
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return `${pretty} Workspace`;
};

const authAttemptStore = new Map();
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT = 30;

const getRequestIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
};

const authRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = `${req.path}:${getRequestIp(req)}`;
  const attempts = (authAttemptStore.get(key) || []).filter(
    (timestamp) => now - timestamp < AUTH_RATE_WINDOW_MS
  );

  if (attempts.length >= AUTH_RATE_LIMIT) {
    return res.status(429).json({
      message: "Too many authentication attempts. Please try again later.",
    });
  }

  attempts.push(now);
  authAttemptStore.set(key, attempts);
  return next();
};

const verifyGoogleCredential = async (credential) => {
  const idToken = String(credential || "").trim();
  if (!idToken) {
    throw new Error("Google credential is required");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let data;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: controller.signal }
    );

    data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error_description || "Invalid Google token");
    }
  } finally {
    clearTimeout(timer);
  }

  const configuredClientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (configuredClientId && String(data?.aud || "") !== String(configuredClientId)) {
    throw new Error("Google token audience mismatch");
  }

  if (String(data?.email_verified || "") !== "true") {
    throw new Error("Google account email is not verified");
  }

  const email = String(data?.email || "").toLowerCase().trim();
  if (!email) {
    throw new Error("Google account email is missing");
  }

  return {
    googleId: String(data?.sub || "").trim() || null,
    email,
    name: String(data?.name || "").trim(),
    picture: String(data?.picture || "").trim() || null,
  };
};

// SIGNUP - creates a new company owner
router.post("/signup", authRateLimit, async (req, res) => {
  const { email, password, name, companyName } = req.body;

  try {
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!companyName || !String(companyName).trim()) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedName = String(name).trim();
    const normalizedCompanyName = String(companyName).trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const generatedCompanyId = crypto.randomUUID();

    const newUser = await User.create({
      email: normalizedEmail,
      password,
      name: normalizedName,
      companyId: generatedCompanyId,
      companyName: normalizedCompanyName,
      role: "Owner",
      // New accounts get full access during the trial period.
      subscription: createTrialSubscription(),
    });

    const token = createToken(newUser._id);

    res.status(201).json({
      message: "User created",
      token,
      user: buildUserResponse(newUser),
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGIN
router.post("/login", authRateLimit, async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Keep subscription state fresh on login so expired trials/subscriptions lock promptly.
    user.subscription = evaluateSubscription(user.subscription);
    await user.save();

    const token = createToken(user._id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CREATE INVITATION
router.post("/invitations", requireAuth, async (req, res) => {
  const { email, role } = req.body;

  try {
    if (!isInviteManager(req.user.role)) {
      return res.status(403).json({
        message: "Only owners and admins can invite members",
      });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Invite email is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const invitedRole =
      typeof role === "string" && role.trim() ? role.trim() : "Member";

    if (!["Admin", "Manager", "Member"].includes(invitedRole)) {
      return res.status(400).json({
        message: "Role must be Admin, Manager, or Member",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
      companyId: req.user.companyId,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "This user is already a member of your company",
      });
    }

    await Invitation.updateMany(
      {
        email: normalizedEmail,
        companyId: req.user.companyId,
        status: "pending",
      },
      {
        $set: { status: "revoked" },
      }
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await Invitation.create({
      email: normalizedEmail,
      companyId: req.user.companyId,
      companyName: req.user.companyName,
      role: invitedRole,
      invitedBy: req.user._id,
      token: hashedToken,
      status: "pending",
      expiresAt,
    });

    const inviteLink = issueInviteUrl(rawToken);
    const invitationEmail = buildInvitationEmail({
      inviteLink,
      companyName: req.user.companyName,
      invitedRole,
      inviterName: req.user.name,
    });

    // Do not block the API response on SMTP latency.
    setImmediate(() => {
      sendEmail({
        to: normalizedEmail,
        subject: invitationEmail.subject,
        text: invitationEmail.text,
        html: invitationEmail.html,
      }).catch((emailError) => {
        console.error("Invitation email error:", emailError);
      });
    });

    return res.status(201).json({
      message: "Invitation created and sent successfully",
      invitation: buildInvitationResponse(invitation),
      inviteLink,
    });
  } catch (err) {
    console.error("Create invitation error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LIST COMPANY MEMBERS
router.get("/company-members", requireAuth, async (req, res) => {
  try {
    const members = await User.find({ companyId: req.user.companyId })
      .select("_id name email role avatarUrl companyId companyName createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      members: members.map(buildUserResponse),
      total: members.length,
    });
  } catch (err) {
    console.error("Company members error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GOOGLE AUTH (sign in / sign up)
router.post("/google", authRateLimit, async (req, res) => {
  const { credential, mode, companyName, name } = req.body || {};

  try {
    const googleProfile = await verifyGoogleCredential(credential);

    let user = await User.findOne({ email: googleProfile.email });
    let isNewUser = false;

    if (!user) {
      const normalizedName =
        String(name || "").trim() ||
        googleProfile.name ||
        googleProfile.email.split("@")[0] ||
        "Nexora User";
      const normalizedCompanyName =
        String(companyName || "").trim() || inferCompanyNameFromEmail(googleProfile.email);

      user = await User.create({
        email: googleProfile.email,
        password: crypto.randomBytes(24).toString("hex"),
        name: normalizedName,
        companyId: crypto.randomUUID(),
        companyName: normalizedCompanyName,
        role: "Owner",
        authProvider: "google",
        googleId: googleProfile.googleId,
        avatarUrl: googleProfile.picture,
        subscription: createTrialSubscription(),
      });
      isNewUser = true;
    } else {
      if (googleProfile.googleId && !user.googleId) {
        user.googleId = googleProfile.googleId;
      }
      if (googleProfile.picture && !user.avatarUrl) {
        user.avatarUrl = googleProfile.picture;
      }
      if (googleProfile.name && !String(user.name || "").trim()) {
        user.name = googleProfile.name;
      }
      if (!user.authProvider || user.authProvider === "local") {
        user.authProvider = "google";
      }
      user.subscription = evaluateSubscription(user.subscription);
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (mode === "signup" && user && !isNewUser) {
      // Signup path via Google should still allow existing users to continue without hard failure.
      // We return success with their existing account to keep UX smooth.
    }

    const token = createToken(user._id);

    return res.status(200).json({
      message: "Google authentication successful",
      token,
      user: buildUserResponse(user),
      isNewUser,
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(400).json({
      message: err?.message || "Google authentication failed",
    });
  }
});

// UPDATE COMPANY MEMBER ROLE (Owner only)
router.patch("/company-members/:id/role", requireAuth, async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ message: "Company context is missing." });
    }

    if (req.user.role !== "Owner") {
      return res.status(403).json({ message: "Only the owner can change roles." });
    }

    const { role } = req.body || {};
    const nextRole = typeof role === "string" ? role.trim() : "";
    const allowedRoles = ["Admin", "Manager", "Member"];
    if (!allowedRoles.includes(nextRole)) {
      return res.status(400).json({ message: "Role must be Admin, Manager, or Member." });
    }

    const target = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }

    if (target.role === "Superuser") {
      return res.status(403).json({ message: "Superuser role cannot be modified here." });
    }

    target.role = nextRole;
    await target.save();

    return res.status(200).json({
      message: "Role updated successfully.",
      user: {
        id: String(target._id),
        name: target.name || "",
        email: target.email || "",
        role: target.role || "Member",
      },
    });
  } catch (err) {
    console.error("Update member role error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LIST COMPANY INVITATIONS
router.get("/invitations", requireAuth, async (req, res) => {
  try {
    if (!isInviteManager(req.user.role)) {
      return res.status(403).json({
        message: "Only owners and admins can view invitations",
      });
    }

    const invitations = await Invitation.find({
      companyId: req.user.companyId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      invitations: invitations.map(buildInvitationResponse),
    });
  } catch (err) {
    console.error("List invitations error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET INVITATION BY TOKEN
router.get("/invitations/:token", async (req, res) => {
  try {
    const rawToken = String(req.params.token || "").trim();
    if (!rawToken) {
      return res.status(400).json({ message: "Invitation token is required" });
    }

    const hashedToken = hashInvitationToken(rawToken);
    const invitation = await Invitation.findOne({
      $or: [{ token: hashedToken }, { token: rawToken }],
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.token === rawToken) {
      invitation.token = hashedToken;
      await invitation.save();
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation is no longer active" });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();

      return res.status(400).json({ message: "Invitation has expired" });
    }

    return res.status(200).json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        companyName: invitation.companyName,
        companyId: invitation.companyId,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    console.error("Get invitation error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ACCEPT INVITATION
router.post("/invitations/accept", authRateLimit, async (req, res) => {
  const { token, name, password } = req.body;

  try {
    if (!token || !String(token).trim()) {
      return res.status(400).json({ message: "Invitation token is required" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedToken = String(token).trim();
    const hashedToken = hashInvitationToken(normalizedToken);
    const invitation = await Invitation.findOne({
      $or: [{ token: hashedToken }, { token: normalizedToken }],
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.token === normalizedToken) {
      invitation.token = hashedToken;
      await invitation.save();
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation is no longer active" });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(400).json({ message: "Invitation has expired" });
    }

    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists",
      });
    }

    const newUser = await User.create({
      email: invitation.email,
      password,
      name: String(name).trim(),
      companyId: invitation.companyId,
      companyName: invitation.companyName,
      role: invitation.role || "Member",
      subscription: createTrialSubscription(),
    });

    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = newUser._id;
    await invitation.save();

    const authToken = createToken(newUser._id);

    return res.status(201).json({
      message: "Invitation accepted successfully",
      token: authToken,
      user: buildUserResponse(newUser),
    });
  } catch (err) {
    console.error("Accept invitation error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// REVOKE INVITATION
router.patch("/invitations/:id/revoke", requireAuth, async (req, res) => {
  try {
    if (!isInviteManager(req.user.role)) {
      return res.status(403).json({
        message: "Only owners and admins can revoke invitations",
      });
    }

    const invitation = await Invitation.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        message: "Only pending invitations can be revoked",
      });
    }

    invitation.status = "revoked";
    await invitation.save();

    return res.status(200).json({
      message: "Invitation revoked successfully",
      invitation: buildInvitationResponse(invitation),
    });
  } catch (err) {
    console.error("Revoke invitation error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CURRENT USER
router.get("/me", requireAuth, async (req, res) => {
  try {
    const freshUser = await User.findById(req.user._id).select("-password");
    if (!freshUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentSnapshot = JSON.stringify(
      serializeSubscription(freshUser.subscription)
    );
    const nextSubscription = evaluateSubscription(freshUser.subscription);
    const nextSnapshot = JSON.stringify(serializeSubscription(nextSubscription));

    if (currentSnapshot !== nextSnapshot) {
      freshUser.subscription = nextSubscription;
      await freshUser.save();
    }

    res.status(200).json(buildMePayload(freshUser));
  } catch (err) {
    console.error("Current user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// CHANGE PASSWORD
router.patch("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    const userWithPassword = await User.findById(req.user._id);
    if (!userWithPassword) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await userWithPassword.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    userWithPassword.password = newPassword;
    await userWithPassword.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE PREFERENCES
router.patch("/preferences", requireAuth, async (req, res) => {
  try {
    const { emailNotifications } = req.body || {};

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (emailNotifications !== undefined) {
      if (typeof emailNotifications !== "boolean") {
        return res
          .status(400)
          .json({ message: "emailNotifications must be a boolean" });
      }
      user.preferences = user.preferences || {};
      user.preferences.emailNotifications = emailNotifications;
    }

    await user.save();

    return res.status(200).json({
      message: "Preferences updated successfully",
      ...buildMePayload(user),
    });
  } catch (err) {
    console.error("Update preferences error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE PROFILE
router.patch("/update-profile", requireAuth, async (req, res) => {
  try {
    const allowedFields = ["name", "role", "avatarUrl", "email"];
    const updates = req.body || {};
    const updateKeys = Object.keys(updates);
    const unknownFields = updateKeys.filter(
      (key) => !allowedFields.includes(key)
    );

    if (unknownFields.length) {
      return res.status(400).json({
        message: `Unknown fields: ${unknownFields.join(", ")}`,
      });
    }

    if (!updateKeys.length) {
      return res.status(400).json({ message: "No profile fields provided" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if ("name" in updates) {
      user.name = typeof updates.name === "string" ? updates.name.trim() : "";
    }

    if ("role" in updates) {
      if (typeof updates.role !== "string" || !updates.role.trim()) {
        return res.status(400).json({
          message: "Role must be a non-empty string",
        });
      }
      const normalizedRole = updates.role.trim();
      const allowedRoles = ["Owner", "Admin", "Manager", "Member", "Superuser"];
      if (!allowedRoles.includes(normalizedRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const requesterRole = String(req.user?.role || "");
      const canChangeRoles = ["Owner", "Admin", "Superuser"].includes(requesterRole);
      if (!canChangeRoles) {
        return res.status(403).json({
          message: "Only owners, admins, or system users can change roles",
        });
      }
      if (normalizedRole === "Superuser" && !["Owner", "Superuser"].includes(requesterRole)) {
        return res.status(403).json({
          message: "Only owners or superusers can assign the Superuser role",
        });
      }
      user.role = normalizedRole;
    }

    if ("avatarUrl" in updates) {
      if (updates.avatarUrl === null || updates.avatarUrl === "") {
        user.avatarUrl = null;
      } else if (typeof updates.avatarUrl === "string") {
        user.avatarUrl = updates.avatarUrl.trim();
      } else {
        return res.status(400).json({
          message: "Avatar URL must be a string or null",
        });
      }
    }

    if ("email" in updates) {
      return res.status(400).json({
        message: "Email update is not supported yet",
      });
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      ...buildMePayload(user),
    });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGOUT
router.post("/logout", requireAuth, async (req, res) => {
  try {
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/forgot-password", authRateLimit, userController.forgotPassword);
router.post("/reset-password/:token", authRateLimit, userController.resetPassword);

module.exports = router;
