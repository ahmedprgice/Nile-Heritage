const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Invite email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },

    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      trim: true,
      index: true,
    },

    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },

    role: {
      type: String,
      enum: ["Owner", "Admin", "Manager", "Member"],
      default: "Member",
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Invited by user is required"],
      index: true,
    },

    token: {
      type: String,
      required: [true, "Invitation token is required"],
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
      index: true,
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      index: true,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active invites for same email in same company
invitationSchema.index(
  { email: 1, companyId: 1, status: 1 },
  { name: "email_company_status_idx" }
);

module.exports =
  mongoose.models.Invitation ||
  mongoose.model("Invitation", invitationSchema);