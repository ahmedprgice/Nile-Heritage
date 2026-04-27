const express = require("express");
const router = express.Router();
const {
  createBoard,
  getBoardById,
  getBoardsByWorkspace,
  updateBoard,
  updateBoardAccess,
  deleteBoard,
  addGroup,
  updateGroup,
  deleteGroup,
  addTask,
  addColumn,
  updateColumn,
  deleteColumn,
  updateTask,
  moveTask,
  deleteTasks,
  updateBoardData,
  importBoardData,
} = require("../controllers/boardController");
const requirePermission = require("../middleware/requirePermission");

router.post("/", requirePermission("board:create"), createBoard);
router.get("/workspace/:workspaceId", getBoardsByWorkspace);
router.get("/:boardId", getBoardById);
router.put("/:boardId", requirePermission("board:update"), updateBoard);
router.patch("/:boardId/data", requirePermission("board:update"), updateBoardData);
router.post("/:boardId/import", requirePermission("board:update"), importBoardData);
router.patch("/:boardId/access", requirePermission("board:access"), updateBoardAccess);
router.delete("/:boardId", requirePermission("board:delete"), deleteBoard);

router.post("/:boardId/groups", requirePermission("board:structure"), addGroup);
router.put("/:boardId/groups/:groupId", requirePermission("board:structure"), updateGroup);
router.delete("/:boardId/groups/:groupId", requirePermission("board:structure"), deleteGroup);
router.put("/:boardId/group/:groupId", requirePermission("board:structure"), updateGroup);
router.delete("/:boardId/group/:groupId", requirePermission("board:structure"), deleteGroup);
router.post("/:boardId/groups/:groupId/tasks", requirePermission("task:edit"), addTask);
// Allow all regular workspace roles (Owner/Admin/Manager/Member) to manage columns.
router.post("/:boardId/columns", requirePermission("task:edit"), addColumn);
router.put("/:boardId/columns/:columnId", requirePermission("task:edit"), updateColumn);
router.delete("/:boardId/columns/:columnId", requirePermission("task:edit"), deleteColumn);
router.put("/:boardId/column/:columnId", requirePermission("task:edit"), updateColumn);
router.delete("/:boardId/column/:columnId", requirePermission("task:edit"), deleteColumn);
router.put("/:boardId/groups/:groupId/tasks/:taskId", requirePermission("task:edit"), updateTask);
router.put("/:boardId/groups/:sourceGroupId/tasks/:taskId/move", requirePermission("task:edit"), moveTask);
router.put("/:boardId/tasks/:taskId/move", requirePermission("task:edit"), moveTask);
router.delete("/:boardId/tasks", requirePermission("task:edit"), deleteTasks);

module.exports = router;
