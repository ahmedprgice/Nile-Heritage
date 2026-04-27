const mongoose = require("mongoose");

const messageReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

messageReadSchema.index(
  { userId: 1, conversationType: 1, channelId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conversationType: "channel",
      channelId: { $type: "objectId" },
    },
  }
);

messageReadSchema.index(
  { userId: 1, conversationType: 1, conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conversationType: "direct",
      conversationId: { $type: "objectId" },
    },
  }
);

module.exports =
  mongoose.models?.MessageRead || mongoose.model("MessageRead", messageReadSchema);
