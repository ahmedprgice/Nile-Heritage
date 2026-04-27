const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["direct"],
      default: "direct",
      required: true,
    },
    members: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: "Direct conversations must include exactly 2 members",
      },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ members: 1 });
conversationSchema.index({ companyId: 1, members: 1 });

module.exports =
  mongoose.models?.Conversation || mongoose.model("Conversation", conversationSchema);
