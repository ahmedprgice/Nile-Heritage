/*routes/notifications.js*/
const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

/**
 * GET /api/notifications
 * Return notifications only for the logged-in user in the same company
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
      companyId: req.user.companyId,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(notifications);
  } catch (error) {
    console.error("GET notifications error:", error);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

/**
 * GET /api/notifications/unread
 * Return unread notifications count + list
 */
router.get("/unread", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
      companyId: req.user.companyId,
      isRead: false,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("GET unread notifications error:", error);
    return res.status(500).json({ message: "Failed to fetch unread notifications" });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
        companyId: req.user.companyId,
      },
      {
        isRead: true,
      },
      {
        returnDocument: 'after',
      }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json(notification);
  } catch (error) {
    console.error("PUT notification read error:", error);
    return res.status(500).json({ message: "Failed to update notification" });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the logged-in user
 */
router.put("/read-all", requireAuth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        userId: req.user._id,
        companyId: req.user.companyId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    return res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error("PUT read all notifications error:", error);
    return res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const deletedNotification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
      companyId: req.user.companyId,
    });

    if (!deletedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("DELETE notification error:", error);
    return res.status(500).json({ message: "Failed to delete notification" });
  }
});

module.exports = router;
