const chatService = require("../services/chat.service");

const handleError = (res, error) => {
  if (error instanceof chatService.ChatError) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error("Chat controller error:", error);
  return res.status(500).json({ message: "Server error" });
};

const getChannels = async (req, res) => {
  try {
    const channels = await chatService.listChannelsForUser(req.user._id);
    return res.status(200).json({ channels });
  } catch (error) {
    return handleError(res, error);
  }
};

const createChannel = async (req, res) => {
  try {
    const channel = await chatService.createChannel(req.user._id, req.body || {});
    return res.status(201).json({ channel });
  } catch (error) {
    return handleError(res, error);
  }
};

const addChannelMembers = async (req, res) => {
  try {
    const channel = await chatService.addMembersToChannel(req.user._id, {
      channelId: req.params.id,
      ...req.body,
    });
    return res.status(200).json({ channel });
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteChannel = async (req, res) => {
  try {
    const channel = await chatService.archiveChannel(req.user._id, req.params.id);
    return res.status(200).json({ channel });
  } catch (error) {
    return handleError(res, error);
  }
};

const getDirectConversations = async (req, res) => {
  try {
    const conversations = await chatService.listDirectConversationsForUser(req.user._id);
    return res.status(200).json({ conversations });
  } catch (error) {
    return handleError(res, error);
  }
};

const getDirectCandidates = async (req, res) => {
  try {
    const users = await chatService.listDirectCandidates(req.user._id, req.query);
    return res.status(200).json({ users });
  } catch (error) {
    return handleError(res, error);
  }
};

const getMessages = async (req, res) => {
  try {
    const payload = await chatService.getMessages(req.user._id, req.query);
    return res.status(200).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
};

const postMessage = async (req, res) => {
  try {
    const payload = await chatService.sendMessage(req.user, req.body || {});
    return res.status(201).json({ message: payload.message });
  } catch (error) {
    return handleError(res, error);
  }
};

const startDirectConversation = async (req, res) => {
  try {
    const conversation = await chatService.startDirectConversation(req.user._id, req.body || {});
    return res.status(200).json({ conversation });
  } catch (error) {
    return handleError(res, error);
  }
};

const getUnreadCounts = async (req, res) => {
  try {
    const unread = await chatService.getUnreadCounts(req.user._id);
    return res.status(200).json(unread);
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  createChannel,
  addChannelMembers,
  deleteChannel,
  getDirectCandidates,
  getChannels,
  getDirectConversations,
  getMessages,
  postMessage,
  getUnreadCounts,
  startDirectConversation,
};
