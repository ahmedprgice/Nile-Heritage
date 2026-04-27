const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const { createTrialSubscription } = require("../utils/subscription");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const getBaseUrl = () =>
  process.env.CLIENT_URL || process.env.FRONTEND_URL;

const generateInviteToken = () => crypto.randomBytes(32).toString("hex");

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(200).json({
        message: "If that email exists, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 15;
    await user.save();

    const resetUrl = `${getBaseUrl()}/auth/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>NEXORA Password Reset</h2>
          <p>Hello ${user.name || "User"},</p>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>This link expires in 15 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      message: "Password reset successful. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
};

exports.createInvitation = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!req.user?.companyId || !req.user?.companyName) {
      return res.status(400).json({ message: "Company context is missing." });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Invite email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole =
      typeof role === "string" && role.trim() ? role.trim() : "Member";

    if (!["Admin", "Manager", "Member"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role for invitation." });
    }

    if (!["Owner", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins can invite members." });
    }

    const existingCompanyUser = await User.findOne({
      email: normalizedEmail,
      companyId: req.user.companyId,
    });

    if (existingCompanyUser) {
      return res.status(400).json({
        message: "This user is already a member of your company.",
      });
    }

    const existingPendingInvite = await Invitation.findOne({
      email: normalizedEmail,
      companyId: req.user.companyId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingPendingInvite) {
      return res.status(400).json({
        message: "A pending invitation already exists for this email.",
      });
    }

    const token = generateInviteToken();
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await Invitation.create({
      email: normalizedEmail,
      role: normalizedRole,
      companyId: req.user.companyId,
      companyName: req.user.companyName,
      invitedBy: req.user._id,
      token: hashedToken,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const inviteLink = `${getBaseUrl()}/auth/accept-invite?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: `You're invited to join ${req.user.companyName} on NEXORA`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>NEXORA Invitation</h2>
          <p>You have been invited to join <strong>${req.user.companyName}</strong> as <strong>${normalizedRole}</strong>.</p>
          <p>
            <a href="${inviteLink}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;">
              Accept Invitation
            </a>
          </p>
          <p>This invitation expires in 7 days.</p>
        </div>
      `,
    });

    console.log("INVITE LINK RETURNED:", inviteLink);

    return res.status(201).json({
      message: "Invitation sent successfully.",
      inviteLink,
      invitation: {
        id: String(invitation._id),
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        companyName: invitation.companyName,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Create invitation error:", error);
    return res.status(500).json({
      message: "Failed to create invitation.",
      error: error.message,
    });
  }
};

exports.getInvitationByToken = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await Invitation.findOne({
      token: hashedToken,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation is invalid or expired." });
    }

    return res.status(200).json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        companyName: invitation.companyName,
        companyId: invitation.companyId,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    return res.status(500).json({ message: "Failed to load invitation." });
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required." });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required." });
    }

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await Invitation.findOne({
      token: hashedToken,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(400).json({ message: "Invitation is invalid or expired." });
    }

    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this invited email already exists.",
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: invitation.email,
      password,
      role: invitation.role,
      companyId: invitation.companyId,
      companyName: invitation.companyName,
      subscription: createTrialSubscription(),
    });

    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    return res.status(201).json({
      message: "Invitation accepted successfully. You can now sign in.",
      user: {
        id: String(newUser._id),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        companyId: newUser.companyId,
        companyName: newUser.companyName,
      },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return res.status(500).json({ message: "Failed to accept invitation." });
  }
};

exports.getCompanyMembers = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ message: "Company context is missing." });
    }

    const members = await User.find({ companyId: req.user.companyId })
      .select("_id name email role avatarUrl companyId companyName createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      members: members.map((member) => ({
        id: String(member._id),
        name: member.name || "",
        email: member.email || "",
        role: member.role || "Member",
        avatarUrl: member.avatarUrl || null,
        companyId: member.companyId,
        companyName: member.companyName,
        createdAt: member.createdAt,
      })),
      total: members.length,
    });
  } catch (error) {
    console.error("Get company members error:", error);
    return res.status(500).json({ message: "Failed to load company members." });
  }
};

exports.getCompanyInvitations = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ message: "Company context is missing." });
    }

    const invitations = await Invitation.find({ companyId: req.user.companyId })
      .sort({ createdAt: -1 })
      .populate("invitedBy", "name email");

    return res.status(200).json({
      invitations: invitations.map((invite) => ({
        id: String(invite._id),
        email: invite.email,
        role: invite.role,
        status: invite.status,
        companyId: invite.companyId,
        companyName: invite.companyName,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt || null,
        invitedBy: invite.invitedBy
          ? {
              id: String(invite.invitedBy._id),
              name: invite.invitedBy.name || "",
              email: invite.invitedBy.email || "",
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Get company invitations error:", error);
    return res.status(500).json({ message: "Failed to load invitations." });
  }
};

exports.revokeInvitation = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ message: "Company context is missing." });
    }

    if (!["Owner", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admins can revoke invitations." });
    }

    const invitation = await Invitation.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    invitation.status = "revoked";
    await invitation.save();

    return res.status(200).json({ message: "Invitation revoked successfully." });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    return res.status(500).json({ message: "Failed to revoke invitation." });
  }
};
