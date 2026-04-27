const mongoose = require("mongoose");
const Channel = require("../models/Channel");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageRead = require("../models/MessageRead");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const UserPresence = require("../models/UserPresence");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/email");

const MESSAGE_TYPES = ["update", "question", "announcement", "action", "message"];

class ChatError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const safeTrim = (value) => (typeof value === "string" ? value.trim() : "");

const sanitizeHtml = (html) => {
  const normalized = safeTrim(html);
  return normalized
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "");
};

const toSenderSummary = (user) => ({
  id: user?._id ? String(user._id) : null,
  name: safeTrim(user?.name) || null,
  email: safeTrim(user?.email) || null,
  avatarUrl: safeTrim(user?.avatarUrl) || null,
});

const serializeMessage = (message) => ({
  id: String(message._id),
  conversationType: message.conversationType,
  channelId: message.channelId ? String(message.channelId) : null,
  conversationId: message.conversationId ? String(message.conversationId) : null,
  senderId: message.senderId?._id ? String(message.senderId._id) : String(message.senderId),
  sender: message.senderId?._id ? toSenderSummary(message.senderId) : null,
  contentHtml: message.deletedAt ? "" : message.contentHtml,
  contentText: message.deletedAt ? "" : message.contentText,
  messageType: message.messageType,
  editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
  deletedAt: message.deletedAt ? new Date(message.deletedAt).toISOString() : null,
  clientMessageId: message.clientMessageId || null,
  createdAt: new Date(message.createdAt).toISOString(),
  updatedAt: new Date(message.updatedAt).toISOString(),
});

const serializeLastMessage = (message) => {
  if (!message) return null;
  return {
    id: String(message._id),
    senderId: message.senderId?._id ? String(message.senderId._id) : String(message.senderId),
    sender: message.senderId?._id ? toSenderSummary(message.senderId) : null,
    contentText: message.deletedAt ? "" : message.contentText,
    contentHtml: message.deletedAt ? "" : message.contentHtml,
    messageType: message.messageType,
    createdAt: new Date(message.createdAt).toISOString(),
  };
};

const stripHtml = (html) => {
  if (!html) return "";
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractMentions = (text) => {
  if (!text) return { emails: [], handles: [] };
  const emails = new Set();
  const handles = new Set();
  const emailRegex = /@([^\s@]+@[^\s@]+\.[^\s@]+)/g;
  const handleRegex = /@([a-zA-Z0-9._-]{2,})/g;

  let match = null;
  while ((match = emailRegex.exec(text))) {
    emails.add(match[1].toLowerCase());
  }
  while ((match = handleRegex.exec(text))) {
    const value = match[1].toLowerCase();
    if (!value.includes("@")) {
      handles.add(value);
    }
  }

  return {
    emails: [...emails],
    handles: [...handles],
  };
};

const resolveMentionedUsers = async ({ companyId, emails = [], handles = [] }) => {
  if (!companyId) return [];
  if (!emails.length && !handles.length) return [];

  const conditions = [];
  if (emails.length) conditions.push({ email: { $in: emails } });
  if (handles.length) {
    const handleRegexes = handles.map((handle) => new RegExp(`^${handle}$`, "i"));
    conditions.push({ name: { $in: handles } });
    conditions.push({ email: { $in: handles.map((h) => `${h}@`) } });
    conditions.push({ name: { $in: handleRegexes } });
  }

  const users = await User.find({
    companyId,
    $or: conditions,
  }).select("_id name email preferences");

  return users || [];
};

const normalizeMemberIdentifier = (value) => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    if (typeof value.id === "string") return value.id.trim();
    if (typeof value.userId === "string") return value.userId.trim();
    if (typeof value.email === "string") return value.email.trim();
  }
  return "";
};

const resolveUserIds = async (identifiers = [], companyId = null) => {
  const cleaned = identifiers.map(normalizeMemberIdentifier).filter(Boolean);
  if (!cleaned.length) return [];

  const objectIds = cleaned.filter((item) => isObjectId(item));
  const emails = cleaned
    .filter((item) => !isObjectId(item) && item.includes("@"))
    .map((item) => item.toLowerCase());
  const names = cleaned.filter((item) => !isObjectId(item) && !item.includes("@"));

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });

  if (!orConditions.length) return [];

  const userFilter = { $or: orConditions };
  if (companyId) {
    userFilter.companyId = companyId;
  }

  const users = await User.find(userFilter).select("_id").lean();
  return [...new Set(users.map((user) => String(user._id)))];
};

const getUserIdentity = async (userId) => {
  const user = await User.findById(userId).select("email name companyId role").lean();
  if (!user) throw new ChatError("User not found", 401);
  return {
    email: safeTrim(user.email).toLowerCase(),
    name: safeTrim(user.name),
    companyId: safeTrim(user.companyId),
    role: safeTrim(user.role),
  };
};

const getAccessibleWorkspaceIds = async (userId) => {
  const identity = await getUserIdentity(userId);
  if (!identity.companyId) return [];

  const workspaces = await Workspace.find({
    companyId: identity.companyId,
    $or: [
      { owner: userId },
      { members: String(userId) },
      ...(identity.email ? [{ members: identity.email }] : []),
      ...(identity.name ? [{ members: identity.name }] : []),
    ],
  })
    .select("_id")
    .lean();

  return workspaces.map((workspace) => String(workspace._id));
};

const getWorkspaceParticipantUserIds = async (workspaceId) => {
  if (!workspaceId) return [];
  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) return [];

  const participantIds = new Set();
  if (workspace.owner && isObjectId(String(workspace.owner))) {
    participantIds.add(String(workspace.owner));
  }

  const memberIds = await resolveUserIds(workspace.members || [], workspace.companyId);
  memberIds.forEach((id) => participantIds.add(id));
  return [...participantIds];
};

const getLatestMessageMap = async (conversationType, ids = []) => {
  const objectIds = ids.filter((id) => isObjectId(String(id)));
  if (!objectIds.length) return new Map();

  const filter =
    conversationType === "channel"
      ? { conversationType, channelId: { $in: objectIds }, deletedAt: null }
      : { conversationType, conversationId: { $in: objectIds }, deletedAt: null };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate("senderId", "name email avatarUrl")
    .lean();

  const latest = new Map();
  for (const message of messages) {
    const key =
      conversationType === "channel"
        ? String(message.channelId)
        : String(message.conversationId);
    if (!latest.has(key)) latest.set(key, serializeLastMessage(message));
  }

  return latest;
};

const ensureConversationScope = async (userId, payload) => {
  const conversationType = safeTrim(payload?.conversationType);

  if (conversationType !== "channel" && conversationType !== "direct") {
    throw new ChatError("conversationType must be channel or direct", 400);
  }

  if (conversationType === "channel") {
    const identity = await getUserIdentity(userId);
    const channelId = safeTrim(payload?.channelId);
    if (!isObjectId(channelId)) throw new ChatError("Invalid channelId", 400);

    const channel = await Channel.findOne({ _id: channelId, isArchived: false }).lean();
    if (!channel) throw new ChatError("Channel not found or access denied", 403);

    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
    const isPrivateChannel = (channel.visibility || "public") === "private";
    const userInChannelMembers = (channel.members || []).some(
      (memberId) => String(memberId) === String(userId)
    );
    const userCanAccessViaWorkspace =
      !isPrivateChannel &&
      channel.workspaceId &&
      accessibleWorkspaceIds.includes(String(channel.workspaceId));

    const channelWorkspace = channel.workspaceId
      ? await Workspace.findById(channel.workspaceId).select("companyId").lean()
      : null;
    const canAccessPublicChannel =
      channel.visibility !== "private" &&
      channelWorkspace &&
      String(channelWorkspace.companyId) === String(identity.companyId);

    if (!userInChannelMembers && !userCanAccessViaWorkspace && !canAccessPublicChannel) {
      throw new ChatError("Channel not found or access denied", 403);
    }

    if (!isPrivateChannel && !userInChannelMembers) {
      await Channel.updateOne({ _id: channel._id }, { $addToSet: { members: userId } });
      channel.members = [...(channel.members || []), userId];
    }

    const participantIds = new Set((channel.members || []).map((id) => String(id)));
    if (!isPrivateChannel && channel.workspaceId) {
      const workspaceParticipants = await getWorkspaceParticipantUserIds(channel.workspaceId);
      workspaceParticipants.forEach((id) => participantIds.add(id));
    }

    return {
      conversationType,
      channelId,
      conversationId: null,
      room: `channel:${channelId}`,
      channelVisibility: channel.visibility || "public",
      allowedSenders: (channel.allowedSenders || []).map((id) => String(id)),
      participantUserIds: [...participantIds],
    };
  }

  const conversationId = safeTrim(payload?.conversationId);
  if (!isObjectId(conversationId)) throw new ChatError("Invalid conversationId", 400);
  const identity = await getUserIdentity(userId);

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "direct",
    companyId: identity.companyId,
    members: userId,
  }).lean();

  if (!conversation) throw new ChatError("Conversation not found or access denied", 403);

  return {
    conversationType,
    channelId: null,
    conversationId,
    room: `direct:${conversationId}`,
    participantUserIds: (conversation.members || []).map((id) => String(id)),
  };
};

const listChannelsForUser = async (userId) => {
  const identity = await getUserIdentity(userId);
  const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
  const companyWorkspaces = await Workspace.find({
    companyId: identity.companyId,
  })
    .select("_id")
    .lean();
  const companyWorkspaceIds = companyWorkspaces.map((workspace) => String(workspace._id));

  if (!accessibleWorkspaceIds.length && !companyWorkspaceIds.length) return [];

  const rawChannels = await Channel.find({
    isArchived: false,
    $or: [
      {
        workspaceId: { $in: accessibleWorkspaceIds },
        $or: [{ visibility: { $exists: false } }, { visibility: "public" }],
      },
      {
        workspaceId: { $in: accessibleWorkspaceIds },
        visibility: "private",
        members: userId,
      },
      { visibility: "public", workspaceId: { $in: companyWorkspaceIds } },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const groups = new Map();
  for (const channel of rawChannels) {
    const key = `${channel.workspaceId ? String(channel.workspaceId) : "global"}:${safeTrim(
      channel.name
    ).toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(channel);
  }

  const canonicalChannels = [];
  for (const grouped of groups.values()) {
    const sorted = [...grouped].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const canonical = sorted[0];
    const mergedMembers = new Set(
      grouped.flatMap((channel) => (channel.members || []).map((id) => String(id)))
    );

    if (mergedMembers.size !== (canonical.members || []).length) {
      await Channel.updateOne(
        { _id: canonical._id },
        { $set: { members: [...mergedMembers] } }
      );
      canonical.members = [...mergedMembers];
    }

    canonicalChannels.push(canonical);
  }

  canonicalChannels.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const latestMessageMap = await getLatestMessageMap(
    "channel",
    canonicalChannels.map((channel) => String(channel._id))
  );

  return canonicalChannels.map((channel) => {
    const lastMessage = latestMessageMap.get(String(channel._id)) || null;
    return {
      id: String(channel._id),
      name: channel.name,
      workspaceId: channel.workspaceId ? String(channel.workspaceId) : null,
      createdBy: channel.createdBy ? String(channel.createdBy) : null,
      members: (channel.members || []).map((id) => String(id)),
      visibility: channel.visibility || "public",
      allowedSenders: (channel.allowedSenders || []).map((id) => String(id)),
      isArchived: !!channel.isArchived,
      lastMessage,
      lastActivityAt: lastMessage?.createdAt || new Date(channel.updatedAt).toISOString(),
      createdAt: new Date(channel.createdAt).toISOString(),
      updatedAt: new Date(channel.updatedAt).toISOString(),
    };
  });
};

const createChannel = async (userId, payload) => {
  const name = safeTrim(payload?.name);
  let workspaceId = safeTrim(payload?.workspaceId) || null;
  const membersInput = Array.isArray(payload?.members) ? payload.members : [];
  const visibility =
    safeTrim(payload?.visibility).toLowerCase() === "private" ? "private" : "public";
  const allowedSendersInput = Array.isArray(payload?.allowedSenders)
    ? payload.allowedSenders
    : [];
  const identity = await getUserIdentity(userId);

  if (!name) throw new ChatError("Channel name is required", 400);
  if (workspaceId && !isObjectId(workspaceId)) throw new ChatError("Invalid workspaceId", 400);

  const memberIds = new Set([String(userId)]);

  const explicitMemberIds = await resolveUserIds(membersInput, identity.companyId);
  explicitMemberIds.forEach((id) => memberIds.add(id));

  if (!workspaceId) {
    const fallbackWorkspace = await Workspace.findOne({
      companyId: identity.companyId,
      $or: [
        { owner: userId },
        { members: String(userId) },
        ...(identity.email ? [{ members: identity.email }] : []),
        ...(identity.name ? [{ members: identity.name }] : []),
      ],
    })
      .sort({ isActive: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    if (!fallbackWorkspace) {
      throw new ChatError(
        "workspaceId is required because no accessible workspace was found",
        400
      );
    }

    workspaceId = String(fallbackWorkspace._id);
  }

  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) throw new ChatError("Workspace not found", 400);
  if (workspace.companyId !== identity.companyId) {
    throw new ChatError("Workspace not found", 400);
  }
  const requester = await User.findById(userId).select("email").lean();
  const requesterEmail = safeTrim(requester?.email).toLowerCase();

  const requesterCanAccessWorkspace =
    String(workspace.owner) === String(userId) ||
    (workspace.members || []).includes(String(userId)) ||
    (requesterEmail && (workspace.members || []).includes(requesterEmail));

  if (!requesterCanAccessWorkspace) {
    throw new ChatError("You are not allowed to create channels in this workspace", 403);
  }

  if (visibility !== "private") {
    if (workspace.owner) memberIds.add(String(workspace.owner));
    const workspaceMemberIds = await resolveUserIds(workspace.members || [], workspace.companyId);
    workspaceMemberIds.forEach((id) => memberIds.add(id));
  }

  const allowedSenderIds = await resolveUserIds(allowedSendersInput, identity.companyId);
  const allowedSenderSet = new Set([String(userId), ...allowedSenderIds]);
  const validAllowedSenders = [...allowedSenderSet].filter((id) => memberIds.has(id));

  const usersCount = await User.countDocuments({
    _id: { $in: [...memberIds] },
    companyId: workspace.companyId,
  });
  if (usersCount !== memberIds.size) {
    throw new ChatError("One or more channel members do not exist", 400);
  }

  const existingChannel = await Channel.findOne({ workspaceId, name }).lean();
  if (existingChannel) {
    const mergedMembers = new Set([
      ...(existingChannel.members || []).map((id) => String(id)),
      ...memberIds,
    ]);

    if (mergedMembers.size !== (existingChannel.members || []).length) {
      await Channel.updateOne(
        { _id: existingChannel._id },
        { $set: { members: [...mergedMembers] } }
      );
      existingChannel.members = [...mergedMembers];
    }

    return {
      id: String(existingChannel._id),
      name: existingChannel.name,
      workspaceId: existingChannel.workspaceId ? String(existingChannel.workspaceId) : null,
      createdBy: existingChannel.createdBy ? String(existingChannel.createdBy) : null,
      members: (existingChannel.members || []).map((id) => String(id)),
      visibility: existingChannel.visibility || "public",
      allowedSenders: (existingChannel.allowedSenders || []).map((id) => String(id)),
      isArchived: !!existingChannel.isArchived,
      createdAt: new Date(existingChannel.createdAt).toISOString(),
      updatedAt: new Date(existingChannel.updatedAt).toISOString(),
    };
  }

  try {
    const channel = await Channel.create({
      name,
      workspaceId,
      createdBy: userId,
      members: [...memberIds],
      visibility,
      allowedSenders: visibility === "private" ? validAllowedSenders : [],
      isArchived: false,
    });

    return {
      id: String(channel._id),
      name: channel.name,
      workspaceId: channel.workspaceId ? String(channel.workspaceId) : null,
      createdBy: String(channel.createdBy),
      members: channel.members.map((id) => String(id)),
      visibility: channel.visibility || "public",
      allowedSenders: (channel.allowedSenders || []).map((id) => String(id)),
      isArchived: !!channel.isArchived,
      createdAt: new Date(channel.createdAt).toISOString(),
      updatedAt: new Date(channel.updatedAt).toISOString(),
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new ChatError("Channel name already exists in this workspace", 400);
    }
    throw error;
  }
};

const listDirectConversationsForUser = async (userId) => {
  const identity = await getUserIdentity(userId);
  const conversations = await Conversation.find({
    type: "direct",
    members: userId,
    companyId: identity.companyId,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const otherUserIds = [...new Set(
    conversations
      .flatMap((conv) => conv.members || [])
      .map((id) => String(id))
      .filter((id) => id !== String(userId))
  )];

  const users = await User.find({
    _id: { $in: otherUserIds },
    companyId: identity.companyId,
  })
    .select("name email avatarUrl")
    .lean();

  const userMap = new Map(users.map((user) => [String(user._id), toSenderSummary(user)]));

  const latestMessageMap = await getLatestMessageMap(
    "direct",
    conversations.map((conversation) => String(conversation._id))
  );

  return conversations.map((conversation) => {
    const otherMemberId = (conversation.members || []).find(
      (memberId) => String(memberId) !== String(userId)
    );
    const lastMessage = latestMessageMap.get(String(conversation._id)) || null;

    return {
      id: String(conversation._id),
      type: conversation.type,
      members: (conversation.members || []).map((id) => String(id)),
      otherMember: otherMemberId ? userMap.get(String(otherMemberId)) || null : null,
      lastMessage,
      lastActivityAt: lastMessage?.createdAt || new Date(conversation.updatedAt).toISOString(),
      createdAt: new Date(conversation.createdAt).toISOString(),
      updatedAt: new Date(conversation.updatedAt).toISOString(),
    };
  });
};

const archiveChannel = async (userId, channelId) => {
  if (!isObjectId(channelId)) throw new ChatError("Invalid channelId", 400);
  const identity = await getUserIdentity(userId);

  const channel = await Channel.findOne({ _id: channelId, isArchived: false }).lean();
  if (!channel) throw new ChatError("Channel not found", 404);

  const workspace = await Workspace.findById(channel.workspaceId).lean();
  if (!workspace || String(workspace.companyId) !== String(identity.companyId)) {
    throw new ChatError("Channel not found", 404);
  }

  const isOwnerOrAdmin = ["owner", "admin"].includes(identity.role?.toLowerCase());
  const isChannelCreator = String(channel.createdBy) === String(userId);
  if (!isOwnerOrAdmin && !isChannelCreator) {
    throw new ChatError("Only owners or admins can delete channels", 403);
  }

  const updated = await Channel.findOneAndUpdate(
    { _id: channelId },
    { $set: { isArchived: true } },
    { new: true }
  ).lean();

  return {
    id: String(updated._id),
    name: updated.name,
    workspaceId: updated.workspaceId ? String(updated.workspaceId) : null,
    createdBy: updated.createdBy ? String(updated.createdBy) : null,
    members: (updated.members || []).map((id) => String(id)),
    visibility: updated.visibility || "public",
    allowedSenders: (updated.allowedSenders || []).map((id) => String(id)),
    isArchived: !!updated.isArchived,
    createdAt: new Date(updated.createdAt).toISOString(),
    updatedAt: new Date(updated.updatedAt).toISOString(),
  };
};

const addMembersToChannel = async (userId, payload) => {
  const channelId = safeTrim(payload?.channelId);
  if (!isObjectId(channelId)) throw new ChatError("Invalid channelId", 400);

  const identity = await getUserIdentity(userId);
  const channel = await Channel.findOne({ _id: channelId, isArchived: false }).lean();
  if (!channel) throw new ChatError("Channel not found", 404);

  const workspace = await Workspace.findById(channel.workspaceId).lean();
  if (!workspace || String(workspace.companyId) !== String(identity.companyId)) {
    throw new ChatError("Channel not found", 404);
  }

  const isOwnerOrAdmin = ["owner", "admin"].includes(identity.role?.toLowerCase());
  const isChannelCreator = String(channel.createdBy) === String(userId);
  if (!isOwnerOrAdmin && !isChannelCreator) {
    throw new ChatError("Only owners or admins can manage channel members", 403);
  }

  const incoming = Array.isArray(payload?.members) ? payload.members : [];
  const memberIds = await resolveUserIds(incoming, identity.companyId);
  if (!memberIds.length) {
    throw new ChatError("No valid members provided", 400);
  }

  const nextMembers = new Set([...(channel.members || []).map((id) => String(id))]);
  memberIds.forEach((id) => nextMembers.add(String(id)));

  let nextAllowedSenders = channel.allowedSenders || [];
  if (channel.visibility === "private") {
    const allowSend = payload?.allowSend !== false;
    if (allowSend) {
      const allowedSet = new Set(nextAllowedSenders.map((id) => String(id)));
      memberIds.forEach((id) => allowedSet.add(String(id)));
      nextAllowedSenders = [...allowedSet];
    }
  }

  const updated = await Channel.findOneAndUpdate(
    { _id: channelId },
    {
      $set: { allowedSenders: nextAllowedSenders },
      $addToSet: { members: { $each: [...nextMembers] } },
    },
    { new: true }
  ).lean();

  return {
    id: String(updated._id),
    name: updated.name,
    workspaceId: updated.workspaceId ? String(updated.workspaceId) : null,
    createdBy: updated.createdBy ? String(updated.createdBy) : null,
    members: (updated.members || []).map((id) => String(id)),
    visibility: updated.visibility || "public",
    allowedSenders: (updated.allowedSenders || []).map((id) => String(id)),
    isArchived: !!updated.isArchived,
    createdAt: new Date(updated.createdAt).toISOString(),
    updatedAt: new Date(updated.updatedAt).toISOString(),
  };
};

const listDirectCandidates = async (userId, query) => {
  const search = safeTrim(query?.q);
  const identity = await getUserIdentity(userId);
  const filter = {
    _id: { $ne: userId },
    companyId: identity.companyId,
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filter)
    .select("name email avatarUrl")
    .sort({ name: 1, email: 1 })
    .limit(50)
    .lean();

  return users.map((user) => toSenderSummary(user));
};

const getMessages = async (userId, query) => {
  const limitRaw = parseInt(query?.limit, 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
  const cursor = safeTrim(query?.cursor);

  const scope = await ensureConversationScope(userId, query);

  const filter = {
    conversationType: scope.conversationType,
    deletedAt: null,
  };

  if (scope.conversationType === "channel") filter.channelId = scope.channelId;
  if (scope.conversationType === "direct") filter.conversationId = scope.conversationId;

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new ChatError("Invalid cursor", 400);
    }
    filter.createdAt = { $lt: cursorDate };
  }

  const docs = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate("senderId", "name email avatarUrl")
    .lean();

  const hasMore = docs.length > limit;
  const sliced = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore
    ? new Date(sliced[sliced.length - 1].createdAt).toISOString()
    : null;

  return {
    items: sliced.map(serializeMessage),
    nextCursor,
  };
};

const sendMessage = async (user, payload) => {
  const contentHtml = sanitizeHtml(payload?.contentHtml);
  const contentText = safeTrim(payload?.contentText) || null;
  const messageType = safeTrim(payload?.messageType) || "message";
  const clientMessageId = safeTrim(payload?.clientMessageId) || null;

  if (!contentHtml) throw new ChatError("Message content is required", 400);
  if (contentHtml.length > 10000) throw new ChatError("Message content too large", 400);
  if (contentText && contentText.length > 4000) throw new ChatError("Message text too large", 400);
  if (!MESSAGE_TYPES.includes(messageType)) throw new ChatError("Invalid messageType", 400);

  const scope = await ensureConversationScope(user._id, payload);
  if (
    scope.conversationType === "channel" &&
    scope.channelVisibility === "private" &&
    Array.isArray(scope.allowedSenders) &&
    scope.allowedSenders.length > 0 &&
    !scope.allowedSenders.some((id) => String(id) === String(user._id))
  ) {
    throw new ChatError("You cannot send messages in this private channel", 403);
  }

  if (clientMessageId) {
    const existing = await Message.findOne({ senderId: user._id, clientMessageId })
      .populate("senderId", "name email avatarUrl")
      .lean();

    if (existing) {
      return {
        room: scope.room,
        participantUserIds: scope.participantUserIds || [],
        message: serializeMessage(existing),
      };
    }
  }

  try {
    const created = await Message.create({
      conversationType: scope.conversationType,
      channelId: scope.channelId,
      conversationId: scope.conversationId,
      senderId: user._id,
      contentHtml,
      contentText,
      messageType,
      clientMessageId,
    });

    const hydrated = await Message.findById(created._id)
      .populate("senderId", "name email avatarUrl")
      .lean();

    if (scope.conversationType === "channel") {
      await Channel.updateOne({ _id: scope.channelId }, { $set: { updatedAt: new Date() } });
    } else {
      await Conversation.updateOne({ _id: scope.conversationId }, { $set: { updatedAt: new Date() } });
    }

    const senderName = safeTrim(user?.name) || safeTrim(user?.email) || "Someone";
    const senderId = String(user?._id || "");
    const recipientIds = (scope.participantUserIds || []).filter(
      (id) => String(id) !== senderId
    );
    if (recipientIds.length) {
      let notificationText = `${senderName} sent you a message`;
      if (scope.conversationType === "channel") {
        const channel = await Channel.findById(scope.channelId).select("name").lean();
        const channelName = channel?.name ? `#${channel.name}` : "a channel";
        notificationText = `${senderName} sent a message in ${channelName}`;
      }

      await Notification.insertMany(
        recipientIds.map((recipientId) => ({
          userId: recipientId,
          companyId: user.companyId,
          text: notificationText,
          type: "info",
          isRead: false,
        }))
      );
    }

    if (scope.conversationType === "channel") {
      const mentionSource =
        contentText || stripHtml(contentHtml);
      const mentions = extractMentions(mentionSource);
      const mentionedUsers = await resolveMentionedUsers({
        companyId: user.companyId,
        emails: mentions.emails,
        handles: mentions.handles,
      });

      const uniqueMentioned = new Map();
      mentionedUsers.forEach((mentioned) => {
        if (!mentioned?._id) return;
        uniqueMentioned.set(String(mentioned._id), mentioned);
      });

      uniqueMentioned.delete(senderId);

      if (uniqueMentioned.size) {
        const channel = await Channel.findById(scope.channelId).select("name").lean();
        const channelName = channel?.name || "channel";

        await Notification.insertMany(
          [...uniqueMentioned.values()].map((mentioned) => ({
            userId: mentioned._id,
            companyId: user.companyId,
            text: `${senderName} mentioned you in #${channelName}`,
            type: "info",
            isRead: false,
          }))
        );

        const emailRecipients = [...uniqueMentioned.values()]
          .filter((mentioned) => mentioned?.preferences?.emailNotifications !== false)
          .filter((mentioned) => mentioned.email);

        if (emailRecipients.length) {
          // Avoid blocking realtime message ack on email delivery latency.
          setImmediate(() => {
            Promise.allSettled(
              emailRecipients.map((mentioned) =>
                sendEmail({
                  to: mentioned.email,
                  subject: `Mentioned in #${channelName}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                      <h2>NEXORA Mention</h2>
                      <p>Hello ${mentioned.name || "there"},</p>
                      <p>${senderName} mentioned you in <strong>#${channelName}</strong>.</p>
                      <p>Open Nexora to reply.</p>
                    </div>
                  `,
                })
              )
            ).catch((emailError) => {
              console.error("Mention email dispatch error:", emailError);
            });
          });
        }
      }
    }

    return {
      room: scope.room,
      participantUserIds: scope.participantUserIds || [],
      message: serializeMessage(hydrated),
    };
  } catch (error) {
    if (error?.code === 11000 && clientMessageId) {
      const existing = await Message.findOne({ senderId: user._id, clientMessageId })
        .populate("senderId", "name email avatarUrl")
        .lean();

      if (existing) {
        return {
          room: scope.room,
          participantUserIds: scope.participantUserIds || [],
          message: serializeMessage(existing),
        };
      }
    }

    throw error;
  }
};

const updateRead = async (userId, payload) => {
  const scope = await ensureConversationScope(userId, payload);
  const lastReadMessageId = safeTrim(payload?.lastReadMessageId) || null;

  if (lastReadMessageId && !isObjectId(lastReadMessageId)) {
    throw new ChatError("Invalid lastReadMessageId", 400);
  }

  if (lastReadMessageId) {
    const messageFilter = {
      _id: lastReadMessageId,
      conversationType: scope.conversationType,
    };

    if (scope.conversationType === "channel") messageFilter.channelId = scope.channelId;
    if (scope.conversationType === "direct") messageFilter.conversationId = scope.conversationId;

    const exists = await Message.exists(messageFilter);
    if (!exists) {
      throw new ChatError("lastReadMessageId not found in conversation", 400);
    }
  }

  const lastReadAt = payload?.lastReadAt ? new Date(payload.lastReadAt) : new Date();
  if (Number.isNaN(lastReadAt.getTime())) {
    throw new ChatError("Invalid lastReadAt", 400);
  }

  const filter = {
    userId,
    conversationType: scope.conversationType,
    channelId: scope.channelId,
    conversationId: scope.conversationId,
  };

  const saved = await MessageRead.findOneAndUpdate(
    filter,
    {
      $set: {
        userId,
        conversationType: scope.conversationType,
        channelId: scope.channelId,
        conversationId: scope.conversationId,
        lastReadMessageId: lastReadMessageId || null,
        lastReadAt,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return {
    room: scope.room,
    participantUserIds: scope.participantUserIds || [],
    read: {
      userId: String(saved.userId),
      conversationType: saved.conversationType,
      channelId: saved.channelId ? String(saved.channelId) : null,
      conversationId: saved.conversationId ? String(saved.conversationId) : null,
      lastReadMessageId: saved.lastReadMessageId ? String(saved.lastReadMessageId) : null,
      lastReadAt: new Date(saved.lastReadAt).toISOString(),
      updatedAt: new Date(saved.updatedAt).toISOString(),
    },
  };
};

const getUnreadCounts = async (userId) => {
  const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
  const identity = await getUserIdentity(userId);
  const channels = await Channel.find({
    isArchived: false,
    workspaceId: { $in: accessibleWorkspaceIds },
  })
    .select("_id")
    .lean();
  const directs = await Conversation.find({
    type: "direct",
    members: userId,
    companyId: identity.companyId,
  })
    .select("_id")
    .lean();

  const readStates = await MessageRead.find({
    userId,
    $or: [
      { conversationType: "channel", channelId: { $in: channels.map((c) => c._id) } },
      { conversationType: "direct", conversationId: { $in: directs.map((c) => c._id) } },
    ],
  }).lean();

  const readMap = new Map();
  for (const read of readStates) {
    const key = read.conversationType === "channel"
      ? `channel:${String(read.channelId)}`
      : `direct:${String(read.conversationId)}`;
    readMap.set(key, read.lastReadAt ? new Date(read.lastReadAt) : null);
  }

  const channelsCounts = {};
  for (const channel of channels) {
    const lastReadAt = readMap.get(`channel:${String(channel._id)}`);
    const filter = {
      conversationType: "channel",
      channelId: channel._id,
      senderId: { $ne: userId },
      deletedAt: null,
    };
    if (lastReadAt) filter.createdAt = { $gt: lastReadAt };
    channelsCounts[String(channel._id)] = await Message.countDocuments(filter);
  }

  const directsCounts = {};
  for (const conversation of directs) {
    const lastReadAt = readMap.get(`direct:${String(conversation._id)}`);
    const filter = {
      conversationType: "direct",
      conversationId: conversation._id,
      senderId: { $ne: userId },
      deletedAt: null,
    };
    if (lastReadAt) filter.createdAt = { $gt: lastReadAt };
    directsCounts[String(conversation._id)] = await Message.countDocuments(filter);
  }

  return {
    channels: channelsCounts,
    directs: directsCounts,
  };
};

const startDirectConversation = async (userId, payload) => {
  const targetUserIdInput =
    safeTrim(payload?.targetUserId) ||
    safeTrim(payload?.targetId) ||
    safeTrim(payload?.userId);
  const targetEmail = safeTrim(payload?.email).toLowerCase();

  let targetUser = null;
  if (targetUserIdInput) {
    if (!isObjectId(targetUserIdInput)) throw new ChatError("Invalid targetUserId", 400);
    targetUser = await User.findById(targetUserIdInput)
      .select("name email avatarUrl companyId")
      .lean();
  } else if (targetEmail) {
    targetUser = await User.findOne({ email: targetEmail })
      .select("name email avatarUrl companyId")
      .lean();
  } else {
    throw new ChatError("targetUserId (or targetId/email) is required", 400);
  }

  if (!targetUser) throw new ChatError("Target user not found", 400);
  const identity = await getUserIdentity(userId);
  if (!identity.companyId || targetUser.companyId !== identity.companyId) {
    throw new ChatError("Target user not found", 400);
  }

  const targetUserId = String(targetUser._id);
  if (String(userId) === targetUserId) {
    throw new ChatError("Cannot start a direct conversation with yourself", 400);
  }

  let conversation = await Conversation.findOne({
    type: "direct",
    companyId: identity.companyId,
    members: { $all: [userId, targetUserId], $size: 2 },
  }).lean();

  if (!conversation) {
    const created = await Conversation.create({
      companyId: identity.companyId,
      type: "direct",
      members: [userId, targetUserId],
    });
    conversation = created.toObject();
  }

  return {
    id: String(conversation._id),
    type: conversation.type,
    members: conversation.members.map((id) => String(id)),
    createdAt: new Date(conversation.createdAt).toISOString(),
    updatedAt: new Date(conversation.updatedAt).toISOString(),
  };
};

const getSocketRoomsForUser = async (user) => {
  const userId = user._id;
  const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
  const channels = await Channel.find({
    isArchived: false,
    workspaceId: { $in: accessibleWorkspaceIds },
  })
    .select("_id")
    .lean();
  const directs = await Conversation.find({
    type: "direct",
    members: userId,
    companyId: safeTrim(user.companyId),
  })
    .select("_id")
    .lean();

  return {
    userRoom: `user:${String(userId)}`,
    channelRooms: channels.map((channel) => `channel:${String(channel._id)}`),
    directRooms: directs.map((conversation) => `direct:${String(conversation._id)}`),
  };
};

const setPresence = async (userId, status) => {
  const now = new Date();

  await UserPresence.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        status,
        lastSeenAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    userId: String(userId),
    status,
    lastSeenAt: now.toISOString(),
  };
};

module.exports = {
  ChatError,
  archiveChannel,
  createChannel,
  addMembersToChannel,
  ensureConversationScope,
  getMessages,
  getSocketRoomsForUser,
  getUnreadCounts,
  listChannelsForUser,
  listDirectCandidates,
  listDirectConversationsForUser,
  sendMessage,
  setPresence,
  startDirectConversation,
  updateRead,
};
