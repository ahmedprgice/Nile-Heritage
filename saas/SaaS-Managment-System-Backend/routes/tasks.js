const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const requirePermission = require("../middleware/requirePermission");
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");

// Protect all task routes
router.use(requireAuth);

router.get("/", requirePermission("task:edit"), getTasks);
router.get("/:id", requirePermission("task:edit"), getTaskById);
router.post("/", requirePermission("task:edit"), createTask);
router.put("/:id", requirePermission("task:edit"), updateTask);
router.delete("/:id", requirePermission("task:edit"), deleteTask);

module.exports = router;
