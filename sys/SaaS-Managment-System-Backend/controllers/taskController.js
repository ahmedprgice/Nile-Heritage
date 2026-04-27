/*taskController.js*/
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEmail } = require("../utils/email");

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const parseDueDate = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "INVALID_DATE";
  }

  return parsed;
};

const buildTaskPayload = (body, { isCreate = false } = {}) => {
  const payload = {};

  if (isCreate || body.title !== undefined) {
    payload.title = String(body.title || "").trim();
  }

  if (body.description !== undefined) {
    payload.description = String(body.description || "").trim();
  }

  if (body.status !== undefined) {
    payload.status = body.status;
  }

  if (body.priority !== undefined) {
    payload.priority = body.priority;
  }

  if (body.assignees !== undefined) {
    payload.assignees = normalizeStringArray(body.assignees);
  }

  if (body.tags !== undefined) {
    payload.tags = normalizeStringArray(body.tags);
  }

  if (body.dueDate !== undefined) {
    payload.dueDate = parseDueDate(body.dueDate);
  }

  return payload;
};

const createAssignmentNotifications = async ({
  assignees = [],
  companyId,
  taskTitle,
  actor,
}) => {
  if (!Array.isArray(assignees) || assignees.length === 0 || !companyId) {
    return;
  }

  const uniqueAssignees = [
    ...new Set(assignees.map((name) => String(name).trim()).filter(Boolean)),
  ];

  if (!uniqueAssignees.length) return;

  const objectIds = uniqueAssignees.filter((item) => mongoose.Types.ObjectId.isValid(item));
  const emails = uniqueAssignees
    .filter((item) => !mongoose.Types.ObjectId.isValid(item) && item.includes("@"))
    .map((item) => item.toLowerCase());
  const names = uniqueAssignees.filter(
    (item) => !mongoose.Types.ObjectId.isValid(item) && !item.includes("@")
  );

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });

  if (!orConditions.length) return;

  const users = await User.find({
    companyId,
    $or: orConditions,
  }).select("_id companyId name email preferences");

  if (!users.length) return;

  const notificationText = `You were assigned to task: ${taskTitle}`;
  const notifications = users.map((user) => ({
    userId: user._id,
    companyId,
    text: notificationText,
    type: "info",
    isRead: false,
  }));
  await Notification.insertMany(notifications);

  const senderName =
    actor?.name || actor?.email || "Someone";

  const emailRecipients = users
    .filter((user) => user?.preferences?.emailNotifications !== false)
    .filter((user) => user.email);

  if (emailRecipients.length) {
    // Keep request latency low by sending emails in background.
    setImmediate(() => {
      Promise.allSettled(
        emailRecipients.map((user) =>
          sendEmail({
            to: user.email,
            subject: `Task assigned: ${taskTitle}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>NEXORA Task Assignment</h2>
                <p>Hello ${user.name || "there"},</p>
                <p>${senderName} assigned you a task:</p>
                <p><strong>${taskTitle}</strong></p>
                <p>Please sign in to view the task details.</p>
              </div>
            `,
          })
        )
      ).catch((error) => {
        console.error("Task assignment email dispatch error:", error);
      });
    });
  }
};

const createNotificationsForNewAssignees = async ({
  oldAssignees = [],
  newAssignees = [],
  companyId,
  taskTitle,
  actor,
}) => {
  const oldSet = new Set(
    normalizeStringArray(oldAssignees).map((name) => String(name).trim())
  );

  const onlyNewAssignees = normalizeStringArray(newAssignees).filter(
    (name) => !oldSet.has(String(name).trim())
  );

  await createAssignmentNotifications({
    assignees: onlyNewAssignees,
    companyId,
    taskTitle,
    actor,
  });
};

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ companyId: req.user.companyId }).sort({
      createdAt: -1,
    }).lean();

    return res.json(tasks);
  } catch (error) {
    console.error("GET tasks error:", error);
    return res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

const getTaskById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    }).lean();

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json(task);
  } catch (error) {
    console.error("GET task by id error:", error);
    return res.status(500).json({ message: "Failed to fetch task" });
  }
};

const createTask = async (req, res) => {
  try {
    const payload = buildTaskPayload(req.body, { isCreate: true });

    if (!payload.title) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (payload.dueDate === "INVALID_DATE") {
      return res.status(400).json({ message: "Invalid due date" });
    }

    const task = await Task.create({
      ...payload,
      companyId: req.user.companyId,
      companyName: req.user.companyName || "",
      createdBy: req.user._id,
    });

    await createAssignmentNotifications({
      assignees: task.assignees || [],
      companyId: req.user.companyId,
      taskTitle: task.title,
      actor: req.user,
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("POST task error:", error);
    return res.status(500).json({
      message: "Failed to create task",
      error: error.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const updates = buildTaskPayload(req.body);

    if (updates.title !== undefined && !updates.title) {
      return res.status(400).json({ message: "Title cannot be empty" });
    }

    if (updates.dueDate === "INVALID_DATE") {
      return res.status(400).json({ message: "Invalid due date" });
    }

    const existingTask = await Task.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .select("assignees")
      .lean();

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updatedTask = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        companyId: req.user.companyId,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    await createNotificationsForNewAssignees({
      oldAssignees: existingTask.assignees || [],
      newAssignees: updatedTask.assignees || [],
      companyId: req.user.companyId,
      taskTitle: updatedTask.title,
      actor: req.user,
    });

    return res.json(updatedTask);
  } catch (error) {
    console.error("PUT task error:", error);
    return res.status(500).json({
      message: "Failed to update task",
      error: error.message,
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const deletedTask = await Task.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("DELETE task error:", error);
    return res.status(500).json({ message: "Failed to delete task" });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
