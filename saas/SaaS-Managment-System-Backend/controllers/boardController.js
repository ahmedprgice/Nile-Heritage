const mongoose = require("mongoose");
const Board = require("../models/Board");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { canManageBoards } = require("../utils/permissions");

const ALLOWED_COLUMN_TYPES = ["text", "people", "status", "date", "dropdown", "numbers", "files", "timeline"];
const SALES_COLUMNS = [
  { name: "Revenue", type: "numbers", options: [] },
  { name: "Expenses", type: "numbers", options: [] },
  { name: "Profit", type: "numbers", options: [] },
];

function normalizeColumnType(type) {
  const cleaned = String(type || "").trim().toLowerCase();
  if (cleaned === "person") return "people";
  if (cleaned === "number") return "numbers";
  if (cleaned === "file") return "files";
  return cleaned;
}

function normalizeOptions(options = []) {
  return [...new Set(
    (Array.isArray(options) ? options : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function getColumnOptions(type, options = []) {
  const cleaned = normalizeOptions(options);

  if (cleaned.length) return cleaned;
  if (type === "status") return ["Not Started", "Working on it", "Done"];
  if (type === "dropdown") return ["Option 1", "Option 2", "Option 3"];
  return [];
}

function normalizeFormula(formula) {
  return String(formula || "").trim();
}

function getColumnByName(columns = [], name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;
  return (columns || []).find(
    (column) => String(column?.name || "").trim().toLowerCase() === normalized
  );
}

function validateNumericFormula(formula, columns = []) {
  const rawFormula = normalizeFormula(formula);
  if (!rawFormula) return { valid: true, expression: "" };

  const expressionSource = rawFormula.startsWith("=") ? rawFormula.slice(1) : rawFormula;
  if (!expressionSource.trim()) {
    return { valid: false, message: "Formula cannot be empty." };
  }

  let unknownColumn = "";
  const expression = expressionSource.replace(/\{([^}]+)\}/g, (_match, tokenName) => {
    const refColumn = getColumnByName(columns, tokenName);
    if (!refColumn?._id) {
      unknownColumn = String(tokenName || "").trim();
      return "0";
    }
    return "1";
  });

  if (unknownColumn) {
    return { valid: false, message: `Unknown formula column: ${unknownColumn}` };
  }

  if (/[{}]/.test(expression)) {
    return { valid: false, message: "Formula has unmatched braces. Use {ColumnName}." };
  }

  if (!/^[\d+\-*/().\s]+$/.test(expression)) {
    return {
      valid: false,
      message: "Formula can only use numbers, spaces, parentheses, and + - * / operators.",
    };
  }

  try {
    const evaluated = Function(`"use strict"; return (${expression});`)();
    if (!Number.isFinite(evaluated)) {
      return { valid: false, message: "Formula result must be a valid number." };
    }
  } catch (_error) {
    return { valid: false, message: "Invalid formula syntax." };
  }

  return { valid: true, expression };
}

function evaluateNumericFormula(formula, columns = [], valuesMap = new Map()) {
  const rawFormula = normalizeFormula(formula);
  if (!rawFormula) return null;
  const expressionSource = rawFormula.startsWith("=") ? rawFormula.slice(1) : rawFormula;
  if (!expressionSource.trim()) return null;

  let unresolved = false;
  const expression = expressionSource.replace(/\{([^}]+)\}/g, (_match, tokenName) => {
    const refColumn = getColumnByName(columns, tokenName);
    if (!refColumn?._id) {
      unresolved = true;
      return "0";
    }
    const refValue = valuesMap.get(String(refColumn._id));
    const numeric = toNumericValue(refValue);
    return String(numeric === null ? 0 : numeric);
  });

  if (unresolved) return null;
  if (!/^[\d+\-*/().\s]+$/.test(expression)) return null;

  try {
    const evaluated = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(evaluated) ? evaluated : null;
  } catch (_error) {
    return null;
  }
}

function applyFormulaColumnsToTaskValues(columns = [], valuesMap = new Map()) {
  const formulaColumns = (columns || []).filter(
    (column) => column?.type === "numbers" && normalizeFormula(column?.formula)
  );

  formulaColumns.forEach((column) => {
    const result = evaluateNumericFormula(column.formula, columns, valuesMap);
    valuesMap.set(
      String(column._id),
      result === null ? "" : formatNumberWithCommas(Math.trunc(result))
    );
  });
}

function getDefaultValueForColumn(column) {
  if (!column) return "";

  if (column.type === "status" || column.type === "dropdown") {
    return column.options?.[0] || "";
  }

  if (column.type === "numbers") {
    return "";
  }

  return "";
}

function getValuesObject(task) {
  if (!task?.values) return {};

  const rawValues =
    typeof task.values.toObject === "function"
      ? task.values.toObject()
      : task.values;

  if (rawValues instanceof Map) {
    return Object.fromEntries(rawValues.entries());
  }

  if (typeof rawValues?.entries === "function") {
    return Object.fromEntries(rawValues.entries());
  }

  return { ...rawValues };
}

function ensureBoardShape(board) {
  if (!board) return false;

  let changed = false;
  const normalizedCategory = String(board.category || "").trim().toLowerCase();
  const fallbackItemColumnName =
    normalizedCategory === "tasks" || normalizedCategory.includes("task")
      ? "Task"
      : "Item";
  const currentItemColumnName = String(board.itemColumnName || "").trim();
  if (!currentItemColumnName) {
    board.itemColumnName = fallbackItemColumnName;
    changed = true;
  }

  const maxItemColumnPosition = Array.isArray(board.columns) ? board.columns.length : 0;
  const normalizedItemColumnPosition = Number.isFinite(Number(board.itemColumnPosition))
    ? Math.max(0, Math.min(Number(board.itemColumnPosition), maxItemColumnPosition))
    : 0;
  if (Number(board.itemColumnPosition) !== normalizedItemColumnPosition) {
    board.itemColumnPosition = normalizedItemColumnPosition;
    changed = true;
  }

  if (normalizedCategory === "sales") {
    const normalizedColumns = Array.isArray(board.columns) ? board.columns : [];
    // For sales boards, only seed defaults if the board has no columns.
    // Never force-rename existing columns, so user-edited names persist.
    if (!normalizedColumns.length) {
      board.columns = SALES_COLUMNS.map((column) => ({ ...column }));
      changed = true;
    }
  }

  const columns = board.columns || [];
  const peopleColumn = columns.find((column) => column.type === "people");
  const statusColumn = columns.find((column) => column.type === "status");
  const dateColumn = columns.find((column) => column.type === "date");

  (board.groups || []).forEach((group) => {
    (group.tasks || []).forEach((task) => {
      let nextValues = new Map(Object.entries(getValuesObject(task)));

      if (task.person !== undefined && peopleColumn && !nextValues.has(String(peopleColumn._id))) {
        nextValues.set(
          String(peopleColumn._id),
          task.person === "-" ? "" : String(task.person || "")
        );
        changed = true;
      }

      if (task.status !== undefined && statusColumn && !nextValues.has(String(statusColumn._id))) {
        nextValues.set(String(statusColumn._id), String(task.status || ""));
        changed = true;
      }

      if (task.date !== undefined && dateColumn && !nextValues.has(String(dateColumn._id))) {
        nextValues.set(dateColumn._id.toString(), task.date === "-" ? "" : String(task.date || ""));
        changed = true;
      }

      columns.forEach((column) => {
        const key = String(column._id);
        if (!nextValues.has(key)) {
          nextValues.set(key, getDefaultValueForColumn(column));
          changed = true;
        }
      });

      task.values = nextValues;
    });
  });

  return changed;
}

function sanitizeCellValue(column, rawValue) {
  if (!column) return "";

  if (column.type === "numbers") {
    if (rawValue === "" || rawValue === null || rawValue === undefined) return "";
    const numericValue = toNumericValue(rawValue);
    if (numericValue === null) return "";
    return formatNumberWithCommas(Math.trunc(numericValue));
  }

  const stringValue = String(rawValue ?? "").trim();

  if ((column.type === "status" || column.type === "dropdown") && stringValue) {
    if (!Array.isArray(column.options)) {
      column.options = [];
    }
    if (!column.options.includes(stringValue)) {
      column.options.push(stringValue);
    }
    return stringValue;
  }

  return stringValue;
}

function buildDefaultTaskValues(columns = []) {
  return columns.reduce((acc, column) => {
    acc[String(column._id)] = getDefaultValueForColumn(column);
    return acc;
  }, {});
}

function isSalesBoard(board) {
  const category = String(board?.category || "").trim().toLowerCase();
  return category === "sales" || category.includes("sale");
}

function normalizeColumnName(name) {
  return String(name || "").trim().toLowerCase();
}

function findColumnByNormalizedNames(columns = [], names = []) {
  const allowed = new Set((Array.isArray(names) ? names : [names]).map(normalizeColumnName));
  return (columns || []).find((column) => allowed.has(normalizeColumnName(column?.name)));
}

function toNumericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumberWithCommas(value) {
  if (!Number.isFinite(value)) return "";
  return Math.trunc(value).toLocaleString("en-US");
}

function ensureStatusColumn(columns = []) {
  const list = Array.isArray(columns) ? columns : [];
  const existing = list.find((column) => normalizeColumnType(column?.type) === "status");
  if (existing) return list;
  return [
    ...list,
    {
      name: "Status",
      type: "status",
      options: ["Not Started", "Working on it", "Done"],
    },
  ];
}

function normalizeColumnsPayload(payload = [], existingColumns = []) {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const existingById = new Map(
    (existingColumns || []).map((column) => [String(column._id), column])
  );

  return payload
    .map((column) => {
      const id = column?._id || column?.id;
      const name = String(column?.name || "").trim();
      const type = normalizeColumnType(column?.type);
      if (!name || !ALLOWED_COLUMN_TYPES.includes(type)) return null;
      const options = getColumnOptions(type, column?.options || []);
      const formula = normalizeFormula(column?.formula);
      const existing = id ? existingById.get(String(id)) : null;
      return {
        _id: existing?._id || (mongoose.Types.ObjectId.isValid(id) ? id : undefined),
        name,
        type,
        options,
        formula: formula || normalizeFormula(existing?.formula),
      };
    })
    .filter(Boolean);
}

function normalizeGroupsPayload(groups = [], columns = []) {
  if (!Array.isArray(groups)) return [];
  const columnIds = columns.map((column) => String(column._id));
  const columnMap = new Map(columns.map((column) => [String(column._id), column]));

  return groups
    .map((group) => {
      const title = String(group?.title || "").trim() || "New Group";
      const tasks = Array.isArray(group?.tasks) ? group.tasks : [];
      const normalizedTasks = tasks.map((task) => {
        const name = String(task?.name || "").trim() || "Untitled item";
        const valuesInput = task?.values || {};
        const nextValues = {};
        columnIds.forEach((columnId) => {
          nextValues[columnId] = getDefaultValueForColumn(columnMap.get(columnId));
        });
        Object.entries(valuesInput).forEach(([columnId, rawValue]) => {
          if (!columnMap.has(String(columnId))) return;
          const column = columnMap.get(String(columnId));
          nextValues[String(column._id)] = sanitizeCellValue(column, rawValue);
        });
        return { name, values: nextValues };
      });
      return {
        title,
        tasks: normalizedTasks.length
          ? normalizedTasks
          : [
              {
                name: "New Item",
                values: buildDefaultTaskValues(columns),
              },
            ],
      };
    })
    .filter(Boolean);
}

const userWorkspaceTokens = (user) =>
  [
    user?._id ? String(user._id) : "",
    user?.email ? String(user.email).toLowerCase() : "",
    user?.name ? String(user.name) : "",
  ].filter(Boolean);

const normalizeBoardMembers = async (members, companyId, allowedUserIds = null) => {
  if (!Array.isArray(members) || !companyId) return [];

  const cleaned = [...new Set(members.map((member) => String(member || "").trim()).filter(Boolean))];
  if (!cleaned.length) return [];

  const objectIds = cleaned.filter((member) => mongoose.Types.ObjectId.isValid(member));
  const emails = cleaned
    .filter((member) => !mongoose.Types.ObjectId.isValid(member) && member.includes("@"))
    .map((member) => member.toLowerCase());
  const names = cleaned.filter(
    (member) => !mongoose.Types.ObjectId.isValid(member) && !member.includes("@")
  );

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });
  if (!orConditions.length) return [];

  const users = await User.find({
    companyId,
    $or: orConditions,
  })
    .select("_id")
    .lean();

  const normalizedUserIds = [...new Set(users.map((user) => String(user._id)).filter(Boolean))];
  if (!allowedUserIds) return normalizedUserIds;

  const allowedSet = new Set(
    (Array.isArray(allowedUserIds) ? allowedUserIds : [...allowedUserIds])
      .map((id) => String(id || ""))
      .filter(Boolean)
  );
  return normalizedUserIds.filter((id) => allowedSet.has(String(id)));
};

const resolveWorkspaceMemberUserIds = async (workspace, companyId) => {
  const allowed = new Set();
  if (!workspace || !companyId) return allowed;

  if (workspace.owner && mongoose.Types.ObjectId.isValid(String(workspace.owner))) {
    allowed.add(String(workspace.owner));
  }

  const rawMembers = [...new Set((workspace.members || []).map((member) => String(member || "").trim()).filter(Boolean))];
  if (!rawMembers.length) return allowed;

  const objectIds = rawMembers.filter((member) => mongoose.Types.ObjectId.isValid(member));
  const emails = rawMembers
    .filter((member) => !mongoose.Types.ObjectId.isValid(member) && member.includes("@"))
    .map((member) => member.toLowerCase());
  const names = rawMembers.filter(
    (member) => !mongoose.Types.ObjectId.isValid(member) && !member.includes("@")
  );

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });
  if (!orConditions.length) return allowed;

  const users = await User.find({
    companyId,
    $or: orConditions,
  })
    .select("_id")
    .lean();

  users.forEach((user) => {
    if (user?._id) allowed.add(String(user._id));
  });

  return allowed;
};

const canAccessBoard = (board, user) => {
  if (!board || !user) return false;
  if (board.privacy !== "private") return true;
  const userId = String(user._id || "");
  if (!userId) return false;
  const members = (board.members || []).map((member) => String(member));
  if (members.includes(userId)) return true;
  return String(board.createdBy || "") === userId;
};

const notifyBoardMembers = async ({ memberIds = [], companyId, boardName, actorId }) => {
  if (!companyId || !memberIds.length) return;
  const recipients = memberIds
    .map((id) => String(id))
    .filter((id) => id && id !== String(actorId || ""));
  if (!recipients.length) return;

  await Notification.insertMany(
    recipients.map((userId) => ({
      userId,
      companyId,
      text: `You were added to board: ${boardName}`,
      type: "info",
      isRead: false,
    }))
  );
};

function workspaceAccessScope(req) {
  return {
    companyId: req.user.companyId,
    $or: [
      { owner: req.user._id },
      { members: { $in: userWorkspaceTokens(req.user) } },
    ],
  };
}

async function findWorkspaceInCompany(workspaceId, reqOrCompanyId) {
  if (typeof reqOrCompanyId === "string") {
    return Workspace.findOne({ _id: workspaceId, companyId: reqOrCompanyId });
  }

  return Workspace.findOne({ _id: workspaceId, ...workspaceAccessScope(reqOrCompanyId) });
}

async function findBoardInCompany(boardId, reqOrCompanyId) {
  if (typeof reqOrCompanyId === "string") {
    return Board.findOne({ _id: boardId, companyId: reqOrCompanyId });
  }

  const board = await Board.findOne({
    _id: boardId,
    companyId: reqOrCompanyId.user.companyId,
  });
  if (!board) return null;

  const workspace = await findWorkspaceInCompany(board.workspace, reqOrCompanyId);
  if (!workspace) return null;
  return canAccessBoard(board, reqOrCompanyId.user) ? board : null;
}

exports.createBoard = async (req, res) => {
  try {
    const { name, workspaceId, createdBy, privacy, members, category } = req.body;

    if (!name || !workspaceId) {
      return res.status(400).json({
        message: "name and workspaceId are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace id",
      });
    }

    const workspace = await findWorkspaceInCompany(workspaceId, req);

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    const normalizedPrivacy = privacy === "private" ? "private" : "main";
    const workspaceAllowedUserIds = await resolveWorkspaceMemberUserIds(
      workspace,
      req.user.companyId
    );
    const normalizedMembers = await normalizeBoardMembers(
      normalizedPrivacy === "private" ? members : [],
      req.user.companyId,
      workspaceAllowedUserIds
    );
    const creatorId = createdBy || req.user?._id || null;
    if (normalizedPrivacy === "private" && creatorId) {
      normalizedMembers.push(String(creatorId));
    }
    const uniqueMembers = [...new Set(normalizedMembers.filter(Boolean))];

    const rawCategoryInput =
      category ??
      req.body?.boardCategory ??
      req.body?.boardType ??
      req.body?.manage ??
      req.body?.type ??
      "";

    const rawCategory = String(rawCategoryInput || "").trim().toLowerCase();
    let normalizedCategory = "tasks";
    if (rawCategory.includes("sale")) {
      normalizedCategory = "sales";
    } else if (rawCategory.includes("item")) {
      normalizedCategory = "items";
    } else if (rawCategory.includes("task")) {
      normalizedCategory = "tasks";
    } else if (["sales", "items", "tasks"].includes(rawCategory)) {
      normalizedCategory = rawCategory;
    }

    const baseColumns =
      normalizedCategory === "sales"
        ? SALES_COLUMNS
        : undefined;
    const ensuredColumns = ensureStatusColumn(
      baseColumns ? baseColumns.map((col) => ({ ...col })) : []
    );

    const itemColumnName = normalizedCategory === "tasks" ? "Task" : "Item";

    const board = await Board.create({
      name: name.trim(),
      workspace: workspaceId,
      companyId: req.user.companyId,
      createdBy: creatorId,
      privacy: normalizedPrivacy,
      category: normalizedCategory,
      members: uniqueMembers,
      itemColumnName,
      columns: ensuredColumns,
    });

    if (normalizedCategory === "sales") {
      board.columns = SALES_COLUMNS.map((col) => ({ ...col }));
      if (!board.groups?.length) {
        board.groups = [
          {
            title: "New Group",
            tasks: [
              {
                name: "New Item",
                values: buildDefaultTaskValues(board.columns),
              },
            ],
          },
        ];
      } else {
        board.groups.forEach((group) => {
          group.tasks = group.tasks?.length
            ? group.tasks.map((task) => ({
                ...task.toObject(),
                values: buildDefaultTaskValues(board.columns),
              }))
            : [
                {
                  name: "New Item",
                  values: buildDefaultTaskValues(board.columns),
                },
              ];
        });
      }
      await board.save();
    } else {
      const firstGroup = board.groups?.[0];
      if (firstGroup && !firstGroup.tasks.length) {
        firstGroup.tasks.push({
          name: "New Item",
          values: buildDefaultTaskValues(board.columns),
        });
        await board.save();
      }
    }

    workspace.boards.push(board._id);
    await workspace.save();

    if (normalizedPrivacy === "private") {
      await notifyBoardMembers({
        memberIds: uniqueMembers,
        companyId: req.user.companyId,
        boardName: board.name,
        actorId: creatorId,
      });
    }

    res.status(201).json(board);
  } catch (error) {
    console.error("CREATE board error:", error);
    res.status(500).json({
      message: "Failed to create board",
      error: error.message,
    });
  }
};

exports.getBoardById = async (req, res) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        message: "Invalid board id",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    // Keep read requests fast: normalize response shape without blocking on a write.
    ensureBoardShape(board);
    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch board",
      error: error.message,
    });
  }
};

exports.getBoardsByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        message: "Invalid workspace id",
      });
    }

    const workspace = await findWorkspaceInCompany(workspaceId, req);
    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    const boards = await Board.find({
      workspace: workspaceId,
      companyId: req.user.companyId,
      $or: [
        { privacy: { $ne: "private" } },
        { members: req.user._id },
        { createdBy: req.user._id },
      ],
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch boards",
      error: error.message,
    });
  }
};

exports.updateBoardAccess = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { privacy, members } = req.body;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const normalizedPrivacy = privacy === "private" ? "private" : "main";
    const previousMembers = (board.members || []).map((member) => String(member));
    const workspace = await findWorkspaceInCompany(board.workspace, req);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    const workspaceAllowedUserIds = await resolveWorkspaceMemberUserIds(
      workspace,
      req.user.companyId
    );
    const normalizedMembers = await normalizeBoardMembers(
      normalizedPrivacy === "private" ? members : [],
      req.user.companyId,
      workspaceAllowedUserIds
    );

    const creatorId = String(board.createdBy || req.user?._id || "");
    if (normalizedPrivacy === "private" && creatorId) {
      normalizedMembers.push(creatorId);
    }

    board.privacy = normalizedPrivacy;
    board.members = [...new Set(normalizedMembers.filter(Boolean))];

    await board.save();

    const nextMembers = board.members.map((member) => String(member));
    const newMembers = nextMembers.filter((id) => !previousMembers.includes(id));
    if (newMembers.length) {
      await notifyBoardMembers({
        memberIds: newMembers,
        companyId: req.user.companyId,
        boardName: board.name,
        actorId: req.user?._id,
      });
    }

    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update board access",
      error: error.message,
    });
  }
};

exports.updateBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { name, itemColumnVisible, itemColumnName, itemColumnPosition } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const hasNameUpdate = name !== undefined;
    const hasItemColumnVisibilityUpdate = itemColumnVisible !== undefined;
    const hasItemColumnNameUpdate = itemColumnName !== undefined;
    const hasItemColumnPositionUpdate = itemColumnPosition !== undefined;
    if (!hasNameUpdate && !hasItemColumnVisibilityUpdate && !hasItemColumnNameUpdate && !hasItemColumnPositionUpdate) {
      return res.status(400).json({
        message: "At least one update field is required",
      });
    }

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const hasElevatedBoardAccess = canManageBoards(req.user?.role);
    const isBoardCreator =
      String(board.createdBy || "") === String(req.user?._id || "");
    if (!hasElevatedBoardAccess && !isBoardCreator) {
      return res.status(403).json({
        message: "Only the board creator or manager/admin/owner can update board members.",
      });
    }

    if (hasNameUpdate) {
      const nextName = String(name || "").trim();
      if (!nextName) {
        return res.status(400).json({ message: "Board name is required" });
      }
      board.name = nextName;
    }

    if (hasItemColumnVisibilityUpdate) {
      board.itemColumnVisible = Boolean(itemColumnVisible);
    }

    if (hasItemColumnNameUpdate) {
      const nextItemColumnName = String(itemColumnName || "").trim();
      if (!nextItemColumnName) {
        return res.status(400).json({ message: "First column name is required" });
      }
      board.itemColumnName = nextItemColumnName;
    }

    if (hasItemColumnPositionUpdate) {
      const totalDataColumns = Array.isArray(board.columns) ? board.columns.length : 0;
      const nextPosition = Number(itemColumnPosition);
      if (!Number.isFinite(nextPosition)) {
        return res.status(400).json({ message: "Item column position must be a number" });
      }
      board.itemColumnPosition = Math.max(0, Math.min(Math.trunc(nextPosition), totalDataColumns));
    }

    await board.save();

    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update board",
      error: error.message,
    });
  }
};

exports.deleteBoard = async (req, res) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const deletedBoard = await Board.findOneAndDelete({
      _id: boardId,
      companyId: req.user.companyId,
    });
    if (!deletedBoard) {
      return res.status(404).json({ message: "Board not found" });
    }

    await Workspace.findOneAndUpdate(
      {
        _id: deletedBoard.workspace,
        companyId: req.user.companyId,
      },
      {
        $pull: { boards: deletedBoard._id },
      }
    );

    res.status(200).json({
      message: "Board deleted successfully",
      deletedBoardId: String(deletedBoard._id),
      workspaceId: String(deletedBoard.workspace),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete board",
      error: error.message,
    });
  }
};

exports.addGroup = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Group title is required",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    board.groups.push({
      title: title.trim(),
      tasks: [
        {
          name: "New Item",
          values: buildDefaultTaskValues(board.columns),
        },
      ],
    });

    await board.save();

    res.status(201).json({
      message: "Group added successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add group",
      error: error.message,
    });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { boardId, groupId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Group title is required" });
    }

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const group = board.groups.id(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.title = title.trim();
    await board.save();

    res.status(200).json({
      message: "Group updated successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update group",
      error: error.message,
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { boardId, groupId } = req.params;
    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    board.groups = board.groups.filter((group) => String(group._id) !== String(groupId));
    await board.save();

    res.status(200).json({
      message: "Group deleted successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete group",
      error: error.message,
    });
  }
};

exports.addTask = async (req, res) => {
  try {
    const { boardId, groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(boardId || ""))) {
      return res.status(400).json({
        message: "Invalid board id",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(String(groupId || ""))) {
      return res.status(400).json({
        message: "Invalid group id",
      });
    }

    const rawName =
      req.body?.name ??
      req.body?.title ??
      req.body?.itemName ??
      req.body?.item ??
      "";
    const name = String(rawName || "").trim();

    if (!name) {
      return res.status(400).json({
        message: "Task name is required",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    if (!Array.isArray(board.groups)) {
      board.groups = [];
    }

    const group = board.groups.find(
      (entry) => String(entry?._id || "") === String(groupId)
    );

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (!Array.isArray(group.tasks)) {
      group.tasks = [];
    }

    const nextTask = {
      name,
      values: buildDefaultTaskValues(board.columns),
    };
    group.tasks.push(nextTask);

    // Save only modified paths to avoid legacy unrelated data causing task-create failures.
    // If legacy document shape still blocks save, fall back to direct atomic update.
    try {
      await board.save({ validateModifiedOnly: true });
    } catch (saveError) {
      console.warn("[boards.addTask] save fallback to atomic push", {
        boardId,
        groupId,
        error: saveError?.message,
      });

      const fallbackBoard = await Board.findOneAndUpdate(
        {
          _id: boardId,
          companyId: req.user.companyId,
          "groups._id": groupId,
        },
        {
          $push: {
            "groups.$.tasks": {
              name,
              values: buildDefaultTaskValues(board.columns),
            },
          },
        },
        { returnDocument: 'after' }
      );

      if (!fallbackBoard) {
        return res.status(404).json({
          message: "Group not found",
        });
      }

      return res.status(201).json({
        message: "Task added successfully",
        board: fallbackBoard,
      });
    }

    res.status(201).json({
      message: "Task added successfully",
      board,
    });
  } catch (error) {
    console.error("[boards.addTask] Failed to add task", {
      boardId: req.params?.boardId,
      groupId: req.params?.groupId,
      error: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: "Failed to add task",
      error: error.message,
    });
  }
};

exports.addColumn = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { name, options, formula } = req.body;
    const type = normalizeColumnType(req.body?.type);

    if (!name || !name.trim() || !type) {
      return res.status(400).json({
        message: "Column name and type are required",
      });
    }

    if (!ALLOWED_COLUMN_TYPES.includes(type)) {
      return res.status(400).json({
        message: "Invalid column type",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    if (type === "numbers") {
      const formulaValidation = validateNumericFormula(formula, board.columns || []);
      if (!formulaValidation.valid) {
        return res.status(400).json({ message: formulaValidation.message });
      }
    }

    board.columns.push({
      name: name.trim(),
      type,
      options: getColumnOptions(type, options),
      formula: normalizeFormula(formula),
    });

    const newColumn = board.columns[board.columns.length - 1];

    board.groups.forEach((group) => {
      group.tasks.forEach((task) => {
        const nextValues = new Map(Object.entries(getValuesObject(task)));
        nextValues.set(String(newColumn._id), getDefaultValueForColumn(newColumn));
        applyFormulaColumnsToTaskValues(board.columns, nextValues);
        task.values = nextValues;
      });
    });

    await board.save();
    res.status(201).json({
      message: "Column added successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add column",
      error: error.message,
    });
  }
};

exports.updateColumn = async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const { name, options, formula } = req.body;

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const column = board.columns.id(columnId);
    if (!column) {
      return res.status(404).json({ message: "Column not found" });
    }

    if (name !== undefined) {
      const nextName = String(name || "").trim();
      if (!nextName) {
        return res.status(400).json({ message: "Column name is required" });
      }
      column.name = nextName;
    }

    if (formula !== undefined && column.type === "numbers") {
      const columnsForValidation = (board.columns || []).map((existingColumn) =>
        String(existingColumn?._id) === String(column._id)
          ? { ...existingColumn.toObject?.(), ...existingColumn, name: column.name }
          : existingColumn
      );
      const formulaValidation = validateNumericFormula(formula, columnsForValidation);
      if (!formulaValidation.valid) {
        return res.status(400).json({ message: formulaValidation.message });
      }
    }

    if (options !== undefined) {
      column.options = getColumnOptions(column.type, options);

      if (column.type === "status" || column.type === "dropdown") {
        board.groups.forEach((group) => {
          group.tasks.forEach((task) => {
            const nextValues = new Map(Object.entries(getValuesObject(task)));
            const currentValue = nextValues.get(String(column._id));
            if (currentValue && !column.options.includes(currentValue)) {
              nextValues.set(String(column._id), column.options[0] || "");
              task.values = nextValues;
            }
          });
        });
      }
    }

    if (formula !== undefined) {
      column.formula = normalizeFormula(formula);
      if (column.type === "numbers" && normalizeFormula(column.formula)) {
        board.groups.forEach((group) => {
          group.tasks.forEach((task) => {
            const nextValues = new Map(Object.entries(getValuesObject(task)));
            applyFormulaColumnsToTaskValues(board.columns, nextValues);
            task.values = nextValues;
          });
        });
      }
    }

    await board.save();
    res.status(200).json({
      message: "Column updated successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update column",
      error: error.message,
    });
  }
};

exports.deleteColumn = async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const requestedColumnRef = String(columnId || "").trim();
    const normalizedRequestedRef = requestedColumnRef.toLowerCase();
    const targetColumn =
      board.columns.id(requestedColumnRef) ||
      (board.columns || []).find((column) => {
        const idMatch =
          String(column?._id || "") === requestedColumnRef ||
          String(column?.id || "") === requestedColumnRef;
        if (idMatch) return true;
        const name = String(column?.name || "").trim().toLowerCase();
        return Boolean(name) && name === normalizedRequestedRef;
      });
    if (!targetColumn) {
      return res.status(404).json({ message: "Column not found" });
    }

    const targetColumnId = String(targetColumn?._id || "");
    const targetColumnName = String(targetColumn?.name || "").trim();
    const normalizedTargetColumnName = targetColumnName.toLowerCase();

    board.columns = board.columns.filter((column) => {
      const sameById =
        targetColumnId && String(column?._id || "") === targetColumnId;
      const sameByName =
        !targetColumnId &&
        String(column?.name || "").trim().toLowerCase() === normalizedTargetColumnName;
      return !(sameById || sameByName);
    });

    board.groups.forEach((group) => {
      group.tasks.forEach((task) => {
        const nextValues = new Map(Object.entries(getValuesObject(task)));
        if (targetColumnId) {
          nextValues.delete(targetColumnId);
        }
        if (targetColumnName) {
          nextValues.delete(targetColumnName);
          for (const key of Array.from(nextValues.keys())) {
            if (String(key || "").trim().toLowerCase() === normalizedTargetColumnName) {
              nextValues.delete(key);
            }
          }
        }
        task.values = nextValues;
      });
    });

    await board.save();

    res.status(200).json({
      message: "Column deleted successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete column",
      error: error.message,
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { boardId, groupId, taskId } = req.params;
    const { name, values, person, status, date } = req.body;

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    let valuesToApply = {};
    if (Array.isArray(values)) {
      valuesToApply = values.reduce((acc, entry) => {
        if (!entry) return acc;
        const key = entry.columnId || entry.column || entry.key;
        if (!key) return acc;
        acc[String(key)] = entry.value;
        return acc;
      }, {});
    } else if (values && typeof values === "object") {
      valuesToApply = { ...values };
    }

    const applyTaskChanges = (targetBoard) => {
      const targetGroup = targetBoard.groups.id(groupId);
      if (!targetGroup) {
        return { error: { status: 404, message: "Group not found" } };
      }

      const targetTask = targetGroup.tasks.id(taskId);
      if (!targetTask) {
        return { error: { status: 404, message: "Task not found" } };
      }

      if (name !== undefined) {
        targetTask.name = String(name || "").trim() || "Untitled item";
      }

      const nextValues = new Map(
        Object.entries(getValuesObject(targetTask)).map(([key, value]) => [
          String(key),
          value,
        ])
      );

      const mergedValuesToApply = { ...valuesToApply };
      const peopleColumn = targetBoard.columns.find((column) => column.type === "people");
      const statusColumn = targetBoard.columns.find((column) => column.type === "status");
      const dateColumn = targetBoard.columns.find((column) => column.type === "date");

      if (person !== undefined && peopleColumn) {
        mergedValuesToApply[String(peopleColumn._id)] = person;
      }

      if (status !== undefined && statusColumn) {
        mergedValuesToApply[String(statusColumn._id)] = status;
      }

      if (date !== undefined && dateColumn) {
        mergedValuesToApply[String(dateColumn._id)] = date;
      }

      Object.entries(mergedValuesToApply).forEach(([columnId, rawValue]) => {
        const column = (targetBoard.columns || []).find(
          (col) => String(col._id) === String(columnId),
        );
        if (!column) return;
        nextValues.set(String(column._id), sanitizeCellValue(column, rawValue));
      });

      applyFormulaColumnsToTaskValues(targetBoard.columns, nextValues);

      const nextValuesObject = Object.fromEntries(nextValues);
      if (typeof targetTask.set === "function") {
        targetTask.set("values", nextValuesObject);
      } else {
        targetTask.values = nextValuesObject;
      }
      if (typeof targetTask.markModified === "function") {
        targetTask.markModified("values");
      }
      if (typeof targetBoard.markModified === "function") {
        targetBoard.markModified("groups");
        targetBoard.markModified("columns");
      }

      return { error: null };
    };

    let savedBoard = null;
    let boardToPersist = board;
    const maxVersionRetries = 4;

    for (let attempt = 0; attempt <= maxVersionRetries; attempt += 1) {
      const applyResult = applyTaskChanges(boardToPersist);
      if (applyResult.error) {
        return res.status(applyResult.error.status).json({ message: applyResult.error.message });
      }

      try {
        await boardToPersist.save();
        savedBoard = boardToPersist;
        break;
      } catch (saveError) {
        const isLastAttempt = attempt === maxVersionRetries;
        if (saveError?.name !== "VersionError" || isLastAttempt) {
          if (saveError?.name === "VersionError" && isLastAttempt) {
            return res.status(409).json({
              message: "Task was updated by another request. Please retry.",
            });
          }
          throw saveError;
        }

        const freshBoard = await findBoardInCompany(boardId, req);
        if (!freshBoard) {
          return res.status(404).json({ message: "Board not found" });
        }
        boardToPersist = freshBoard;
      }
    }

    res.status(200).json({
      message: "Task updated successfully",
      board: savedBoard,
    });

  } catch (error) {
    console.error("UPDATE TASK error:", {
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
    });
    res.status(500).json({
      message: "Failed to update task",
      error: error.message,
    });
  }
};

exports.updateBoardData = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { groups, columns, itemColumnName, itemColumnVisible, itemColumnPosition } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    let nextColumns = board.columns;
    const normalizedColumns = normalizeColumnsPayload(columns, board.columns);
    if (normalizedColumns && normalizedColumns.length) {
      board.columns = normalizedColumns;
      nextColumns = board.columns;
    }

    if (Array.isArray(groups)) {
      board.groups = normalizeGroupsPayload(groups, nextColumns);
    }

    if (itemColumnName !== undefined) {
      const nextItemColumnName = String(itemColumnName || "").trim();
      if (!nextItemColumnName) {
        return res.status(400).json({ message: "First column name is required" });
      }
      board.itemColumnName = nextItemColumnName;
    }

    if (itemColumnVisible !== undefined) {
      board.itemColumnVisible = Boolean(itemColumnVisible);
    }

    if (itemColumnPosition !== undefined) {
      const totalDataColumns = Array.isArray(nextColumns) ? nextColumns.length : 0;
      const nextPosition = Number(itemColumnPosition);
      if (!Number.isFinite(nextPosition)) {
        return res.status(400).json({ message: "Item column position must be a number" });
      }
      board.itemColumnPosition = Math.max(0, Math.min(Math.trunc(nextPosition), totalDataColumns));
    }

    await board.save();

    res.status(200).json({
      message: "Board data saved successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save board data",
      error: error.message,
    });
  }
};

const normalizeImportName = (name) => String(name || "").trim().toLowerCase();

exports.importBoardData = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { columns, rows, defaultGroup } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const board = await findBoardInCompany(boardId, req);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const normalizedColumns = normalizeColumnsPayload(columns, []);
    const baseColumns = normalizedColumns && normalizedColumns.length ? normalizedColumns : [];
    board.columns = baseColumns;
    // Keep the item/task name column visible after imports.
    board.itemColumnVisible = true;

    const columnMap = new Map(
      board.columns.map((column) => [normalizeImportName(column.name), column])
    );

    const inputRows = Array.isArray(rows) ? rows : [];
    if (!inputRows.length) {
      await board.save();
      return res.status(200).json({
        message: "No rows to import",
        board,
      });
    }

    const groupsMap = new Map();
    const fallbackGroup = String(defaultGroup || "Imported").trim() || "Imported";
    const getValueByNormalizedKey = (obj, targetKey) => {
      const normalizedTarget = normalizeImportName(targetKey);
      return Object.entries(obj || {}).find(
        ([key]) => normalizeImportName(key) === normalizedTarget
      )?.[1];
    };

    inputRows.forEach((row, index) => {
      const groupTitle =
        String(row?.group || row?.groupTitle || fallbackGroup).trim() || fallbackGroup;

      if (!groupsMap.has(groupTitle)) {
        groupsMap.set(groupTitle, []);
      }

      const valuesInput = row?.values && typeof row.values === "object" ? row.values : {};
      const itemValueFromCells = getValueByNormalizedKey(valuesInput, "item");
      const taskName =
        String(
          row?.name ||
            row?.title ||
            row?.item ||
            row?.label ||
            itemValueFromCells ||
            ""
        ).trim() || `Imported item ${index + 1}`;
      const taskValues = {};
      (board.columns || []).forEach((column) => {
        taskValues[String(column._id)] = "";
      });

      Object.entries(valuesInput).forEach(([key, rawValue]) => {
        const column = columnMap.get(normalizeImportName(key));
        if (!column) return;
        taskValues[String(column._id)] =
          rawValue === null || rawValue === undefined ? "" : rawValue;
      });

      groupsMap.get(groupTitle).push({
        name: taskName,
        values: taskValues,
      });
    });

    board.groups = Array.from(groupsMap.entries()).map(([title, tasks]) => ({
      title,
      tasks,
    }));

    await board.save();

    res.status(200).json({
      message: "Board imported successfully",
      board,
    });
  } catch (error) {
    console.error("IMPORT board error:", error);
    res.status(500).json({
      message: "Failed to import board data",
      error: error.message,
    });
  }
};

exports.moveTask = async (req, res) => {
  try {
    const { boardId, taskId } = req.params;
    const { sourceGroupId, targetGroupId } = req.body;

    if (!sourceGroupId || !targetGroupId) {
      return res.status(400).json({
        message: "sourceGroupId and targetGroupId are required",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    const targetGroup = board.groups.id(targetGroupId);
    const sourceGroup =
      board.groups.id(sourceGroupId) ||
      board.groups.find((group) => group.tasks.id(taskId));

    if (!sourceGroup || !targetGroup) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    if (String(sourceGroup._id) === String(targetGroup._id)) {
      return res.status(200).json({
        message: "Task already in target group",
        board,
      });
    }

    const task = sourceGroup.tasks.id(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const taskData = task.toObject();
    sourceGroup.tasks.pull(taskId);
    targetGroup.tasks.push(taskData);

    await board.save();

    res.status(200).json({
      message: "Task moved successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to move task",
      error: error.message,
    });
  }
};

exports.deleteTasks = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || !taskIds.length) {
      return res.status(400).json({
        message: "taskIds must be a non-empty array",
      });
    }

    const board = await findBoardInCompany(boardId, req);

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    board.groups.forEach((group) => {
      group.tasks = group.tasks.filter(
        (task) => !taskIds.includes(task._id.toString())
      );
    });

    await board.save();

    res.status(200).json({
      message: "Tasks deleted successfully",
      board,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete tasks",
      error: error.message,
    });
  }
};
