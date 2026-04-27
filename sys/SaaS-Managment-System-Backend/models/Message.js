const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationType: {
      type: String,
      enum: ["channel", "direct"],
      required: true,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contentHtml: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    contentText: {
      type: String,
      default: null,
      trim: true,
      maxlength: 4000,
    },
    messageType: {
      type: String,
      enum: ["update", "question", "announcement", "action", "message"],
      default: "message",
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    clientMessageId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models?.Message || mongoose.model("Message", messageSchema);
