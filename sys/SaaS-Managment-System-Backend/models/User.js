const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const DEFAULT_TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    googleId: {
      type: String,
      trim: true,
      default: null,
      sparse: true,
      index: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    // Company isolation fields
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

    // Role system
    role: {
      type: String,
      enum: ["Owner", "Admin", "Manager", "Member", "Superuser"],
      default: "Member",
    },

    // Invitation / membership tracking
    joinedViaInvite: {
      type: Boolean,
      default: false,
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },

    activeProjects: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedTasks: {
      type: Number,
      default: 0,
      min: 0,
    },

    teamMembers: {
      type: [String],
      default: [],
    },

    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
    },

    subscription: {
      status: {
        type: String,
        enum: ["trial", "active", "expired", "suspended", "pending", "free", "premium"],
        default: "trial",
        index: true,
      },
      accountStatus: {
        type: String,
        enum: ["trial", "active", "expired", "suspended"],
        default: "trial",
        index: true,
      },
      paymentStatus: {
        type: String,
        enum: ["unpaid", "pending", "paid", "rejected"],
        default: "unpaid",
        index: true,
      },
      plan: {
        type: String,
        enum: ["Free", "Monthly", "Yearly", "Lifetime"],
        default: "Free",
      },
      trialUsed: {
        type: Boolean,
        default: false,
      },
      trialStartDate: {
        type: Date,
        default: Date.now,
      },
      trialEndDate: {
        type: Date,
        default: () => addDays(new Date(), DEFAULT_TRIAL_DAYS),
        index: true,
      },
      subscriptionStartDate: {
        type: Date,
        default: null,
      },
      subscriptionEndDate: {
        type: Date,
        default: null,
        index: true,
      },
      activatedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      paymentMethod: {
        type: String,
        default: "",
        trim: true,
      },
      lastReference: {
        type: String,
        default: "",
        trim: true,
      },
      suspendedAt: {
        type: Date,
        default: null,
      },
    },

    passwordLastChanged: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Useful compound index for company-scoped lookups
UserSchema.index({ companyId: 1, email: 1 });
UserSchema.index({ companyId: 1, role: 1 });

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordLastChanged = new Date();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
