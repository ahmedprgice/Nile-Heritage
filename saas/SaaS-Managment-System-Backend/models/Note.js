const mongoose = require("mongoose");

const NOTE_TYPES = ["other", "meeting", "decision", "process", "risk", "idea"];
const NOTE_STATUSES = ["draft", "review", "published", "action"];
const NOTE_PRIORITIES = ["low", "medium", "high"];
const NOTE_VISIBILITY = ["public", "private"];

const noteActionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    done: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    body: {
      type: String,
      default: "",
      maxlength: 20000,
    },
    type: {
      type: String,
      enum: NOTE_TYPES,
      default: "meeting",
      index: true,
    },
    status: {
      type: String,
      enum: NOTE_STATUSES,
      default: "draft",
      index: true,
    },
    priority: {
      type: String,
      enum: NOTE_PRIORITIES,
      default: "medium",
      index: true,
    },
    owner: {
      type: String,
      default: "Team",
      trim: true,
      maxlength: 120,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    actions: {
      type: [noteActionSchema],
      default: [],
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
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
      index: true,
    },
    visibility: {
      type: String,
      enum: NOTE_VISIBILITY,
      default: "public",
      index: true,
    },
    allowedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

noteSchema.index({ companyId: 1, updatedAt: -1 });
noteSchema.index({ companyId: 1, status: 1, updatedAt: -1 });
noteSchema.index({ companyId: 1, type: 1 });
noteSchema.index({ companyId: 1, workspaceId: 1, updatedAt: -1 });

module.exports = mongoose.models.Note || mongoose.model("Note", noteSchema);
module.exports.NOTE_TYPES = NOTE_TYPES;
module.exports.NOTE_STATUSES = NOTE_STATUSES;
module.exports.NOTE_PRIORITIES = NOTE_PRIORITIES;
module.exports.NOTE_VISIBILITY = NOTE_VISIBILITY;
