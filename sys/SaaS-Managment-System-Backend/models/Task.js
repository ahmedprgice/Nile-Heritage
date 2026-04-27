const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Todo", "In Progress", "Done"],
      default: "Todo",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    assignees: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    dueDate: {
      type: Date,
      default: null,
    },

    // Critical multi-tenant field
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Supports the most common list query: tenant-scoped tasks ordered by newest first.
taskSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
