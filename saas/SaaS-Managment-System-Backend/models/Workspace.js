/* ================= WORKSPACE MODEL ================= */
const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    color: {
      type: String,
      default: "#7c3aed",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      default: "",
      trim: true,
    },
    members: {
      type: [String],
      default: [],
    },
    boards: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Board",
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

workspaceSchema.index({ companyId: 1, updatedAt: -1 });
workspaceSchema.index({ companyId: 1, isActive: 1 });
workspaceSchema.index({ companyId: 1, owner: 1, createdAt: -1 });
workspaceSchema.index({ companyId: 1, members: 1, createdAt: -1 });

module.exports = mongoose.model("Workspace", workspaceSchema);
