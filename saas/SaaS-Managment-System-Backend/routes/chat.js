const express = require("express");
const controller = require("../controllers/chatController");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.get("/channels", controller.getChannels);
router.post("/channels", requirePermission("chat:channel:create"), controller.createChannel);
router.post("/channels/:id/members", controller.addChannelMembers);
router.delete("/channels/:id", controller.deleteChannel);
router.get("/conversations/direct", controller.getDirectConversations);
router.get("/users", controller.getDirectCandidates);
router.get("/messages", controller.getMessages);
router.post("/messages", controller.postMessage);
router.post("/direct/start", controller.startDirectConversation);
router.post("/direct/invite", controller.startDirectConversation);
router.post("/direct/invite-email", controller.startDirectConversation);
router.post("/conversations/direct/start", controller.startDirectConversation);
router.post("/conversations/direct", controller.startDirectConversation);
router.get("/unread-counts", controller.getUnreadCounts);

module.exports = router;
