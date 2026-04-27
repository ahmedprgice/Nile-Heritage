const express = require("express");
const controller = require("../controllers/noteController");
const requireAuth = require("../middleware/requireAuth");
const requirePermission = require("../middleware/requirePermission");

const router = express.Router();

router.use(requireAuth);

router.get("/", requirePermission("task:edit"), controller.listNotes);
router.post("/", requirePermission("task:edit"), controller.createNote);
router.put("/:id", requirePermission("task:edit"), controller.updateNote);
router.delete("/:id", requirePermission("task:edit"), controller.deleteNote);

module.exports = router;
