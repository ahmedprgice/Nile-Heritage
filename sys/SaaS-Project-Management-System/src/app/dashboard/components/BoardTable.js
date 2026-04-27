"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
  CalendarDays,
  UserRound,
  CircleDashed,
  Rows3,
  Hash,
  ChevronsUpDown,
  Settings2,
  X,
  MoreHorizontal,
  Paperclip,
  GanttChartSquare,
  GripVertical,
  Loader2,
} from "lucide-react";

const COLUMN_TYPES = [
  { type: "status", label: "Status", icon: CircleDashed },
  { type: "dropdown", label: "Dropdown", icon: ChevronsUpDown },
  { type: "text", label: "Text", icon: Rows3 },
  { type: "date", label: "Date", icon: CalendarDays },
  { type: "people", label: "People", icon: UserRound },
  { type: "numbers", label: "Numbers", icon: Hash },
  { type: "files", label: "Files", icon: Paperclip },
  { type: "timeline", label: "Timeline", icon: GanttChartSquare },
];
const ITEM_COLUMN_ID = "__item__";

function getColumnIcon(type) {
  return COLUMN_TYPES.find((item) => item.type === type)?.icon || Rows3;
}

function statusClasses(value) {
  switch (value) {
    case "Done":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "Working":
    case "Working on it":
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    case "Not Started":
    case "Pending":
    default:
      return "border-slate-600 bg-slate-700 text-slate-100";
  }
}

function getColumnValue(task, columnId) {
  const values = task?.values;
  if (!values) return "";
  const key = String(columnId || "");
  if (values instanceof Map) return values.get(key) ?? "";
  if (typeof values?.get === "function") return values.get(key) ?? "";
  if (values?.[key] !== undefined) return values[key];
  if (values?.[columnId] !== undefined) return values[columnId];
  const normalizedKey = key.trim().toLowerCase();
  const matchedKey = Object.keys(values).find(
    (valueKey) => String(valueKey || "").trim().toLowerCase() === normalizedKey,
  );
  return matchedKey ? values[matchedKey] : "";
}

function getPeopleLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.email || value.role || "";
}

function isFilesColumn(column) {
  return column?.type === "files" || (column?.type === "text" && /^files?$/i.test(column?.name || ""));
}

function isTimelineColumn(column) {
  return column?.type === "timeline" || (column?.type === "text" && /^timeline$/i.test(column?.name || ""));
}

function isProfitColumn(column) {
  return /^profit$/i.test(String(column?.name || "").trim());
}

function parseTimelineValue(value) {
  const [start = "", end = ""] = String(value || "").split(" - ");
  return { start, end };
}

function formatTimelineValue(start, end) {
  if (!start && !end) return "";
  return `${start || ""} - ${end || ""}`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimelineLabel(start, end) {
  if (!start && !end) return "-";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function formatNumberCellValue(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const normalized = raw.replace(/,/g, "");
  if (!/^-?\d+$/.test(normalized)) return raw;
  return Number.parseInt(normalized, 10).toLocaleString("en-US");
}

function parseNumberCellValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMonthDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarStart = new Date(firstDay);
  const mondayBasedDayIndex = (firstDay.getDay() + 6) % 7;
  calendarStart.setDate(firstDay.getDate() - mondayBasedDayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
}

export default function BoardTable({
  board,
  isLoading = false,
  emptyState = null,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddTask,
  onAddColumn,
  onUpdateColumn,
  onReorderColumns,
  onDeleteColumn,
  onUpdateTask,
  onMoveTask,
  onDeleteTasks,
  onArchiveTasks,
  onTrashTasks,
  itemColumnVisible = true,
  onToggleItemColumnVisibility,
  onUpdateItemColumnName,
}) {
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState("status");
  const [newColumnOptions, setNewColumnOptions] = useState("Not Started, Working on it, Done");
  const [newColumnFormula, setNewColumnFormula] = useState("");
  const [newColumnUseFormula, setNewColumnUseFormula] = useState(false);
  const [columnModalError, setColumnModalError] = useState("");
  const [creatingColumn, setCreatingColumn] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState([]);
  const [draftTaskNames, setDraftTaskNames] = useState({});
  const [itemDrafts, setItemDrafts] = useState({});
  const [cellDrafts, setCellDrafts] = useState({});
  const [columnNameDrafts, setColumnNameDrafts] = useState({});
  const [itemColumnNameDraft, setItemColumnNameDraft] = useState("");
  const [openColumnMenu, setOpenColumnMenu] = useState(null);
  const [openLabelDropdown, setOpenLabelDropdown] = useState(null);
  const [labelEditor, setLabelEditor] = useState(null);
  const [openTimelinePicker, setOpenTimelinePicker] = useState(null);
  const [timelineCalendarMonth, setTimelineCalendarMonth] = useState(() => new Date());
  const [columnWidths, setColumnWidths] = useState({});
  const [columnOrder, setColumnOrder] = useState([]);
  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [columnDropIndex, setColumnDropIndex] = useState(null);
  const [groupHeaderElevated, setGroupHeaderElevated] = useState({});
  const [filePreviews, setFilePreviews] = useState({});
  const [filePreviewModal, setFilePreviewModal] = useState(null);
  const resizeStateRef = useRef(null);
  const filePreviewsRef = useRef({});
  const taskSaveTimersRef = useRef({});
  const cellDraftsRef = useRef({});
  const columnNameSaveTimersRef = useRef({});
  const columnNameDraftsRef = useRef({});

  const columns = useMemo(() => board?.columns || [], [board]);
  const isItemColumnVisible = itemColumnVisible !== false;
  const defaultColumnOrder = useMemo(() => {
    const dataColumnIds = columns.map((column) => String(column._id));
    if (!isItemColumnVisible) return dataColumnIds;

    const normalizedPosition = Number.isFinite(Number(board?.itemColumnPosition))
      ? Math.max(0, Math.min(Number(board?.itemColumnPosition), dataColumnIds.length))
      : 0;

    return [
      ...dataColumnIds.slice(0, normalizedPosition),
      ITEM_COLUMN_ID,
      ...dataColumnIds.slice(normalizedPosition),
    ];
  }, [board?.itemColumnPosition, columns, isItemColumnVisible]);
  const isSalesBoard = useMemo(() => {
    const category = String(board?.category || "").trim().toLowerCase();
    return category === "sales" || category.includes("sale");
  }, [board]);
  const itemColumnLabel = useMemo(() => {
    const explicitName = String(board?.itemColumnName || "").trim();
    if (explicitName) return explicitName;
    const category = String(board?.category || "").trim().toLowerCase();
    if (category === "tasks" || category.includes("task")) return "Task";
    return "Item";
  }, [board]);
  const groups = useMemo(() => board?.groups || [], [board]);
  const taskLookup = useMemo(() => {
    const lookup = new Map();
    groups.forEach((group) => {
      (group.tasks || []).forEach((task) => {
        if (task?._id) lookup.set(String(task._id), task);
      });
    });
    return lookup;
  }, [groups]);
  const peopleOptionsByColumn = useMemo(() => {
    const peopleColumns = columns.filter((column) => column.type === "people");

    return peopleColumns.reduce((optionsMap, column) => {
      const columnKey = String(column._id || "");
      const values = groups.flatMap((group) =>
        (group.tasks || [])
          .map((task) => getPeopleLabel(getColumnValue(task, columnKey) || "").trim())
          .filter(Boolean),
      );

      optionsMap[columnKey] = [...new Set(values)].sort((a, b) =>
        a.localeCompare(b),
      );
      return optionsMap;
    }, {});
  }, [columns, groups]);

  useEffect(() => {
    setColumnOrder((prev) => {
      const incoming = defaultColumnOrder;
      if (!incoming.length) return [];
      if (!prev.length) return incoming;

      const preserved = prev.filter((columnId) => incoming.includes(columnId));
      const missing = incoming.filter((columnId) => !preserved.includes(columnId));
      const next = [...preserved, ...missing];

      return next.join("|") === prev.join("|") ? prev : next;
    });
  }, [defaultColumnOrder]);

  useEffect(() => {
    const activeGroupIds = new Set(groups.map((group) => String(group?._id || "")));
    setGroupHeaderElevated((prev) => {
      const next = {};
      let changed = false;
      Object.entries(prev).forEach(([groupId, elevated]) => {
        if (!activeGroupIds.has(groupId)) {
          changed = true;
          return;
        }
        next[groupId] = elevated;
      });
      return changed ? next : prev;
    });
  }, [groups]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = Math.max(
        resizeState.minWidth,
        resizeState.startWidth + (event.clientX - resizeState.startX),
      );

      setColumnWidths((prev) => ({
        ...prev,
        [resizeState.columnId]: nextWidth,
      }));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!openLabelDropdown) return undefined;

    const closeDropdown = () => setOpenLabelDropdown(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeDropdown();
    };

    window.addEventListener("click", closeDropdown);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeDropdown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openLabelDropdown]);

  useEffect(() => {
    if (!openTimelinePicker) return undefined;

    const closePicker = () => setOpenTimelinePicker(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closePicker();
    };

    window.addEventListener("click", closePicker);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closePicker);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openTimelinePicker]);

  useEffect(() => {
    filePreviewsRef.current = filePreviews;
  }, [filePreviews]);

  useEffect(() => {
    cellDraftsRef.current = cellDrafts;
  }, [cellDrafts]);

  useEffect(() => {
    columnNameDraftsRef.current = columnNameDrafts;
  }, [columnNameDrafts]);

  useEffect(() => {
    setItemColumnNameDraft(itemColumnLabel);
  }, [itemColumnLabel]);

  useEffect(() => {
    if (!board) return;

    setCellDrafts((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([taskId, taskDrafts]) => {
        const task = taskLookup.get(String(taskId));
        if (!task) return;

        const nextTaskDrafts = { ...taskDrafts };
        Object.entries(taskDrafts).forEach(([columnId, draftValue]) => {
          const currentValue = getColumnValue(task, columnId);
          if (String(currentValue ?? "") === String(draftValue ?? "")) {
            delete nextTaskDrafts[columnId];
            changed = true;
          }
        });

        if (Object.keys(nextTaskDrafts).length) {
          next[taskId] = nextTaskDrafts;
        } else {
          delete next[taskId];
        }
      });

      return changed ? next : prev;
    });

    setItemDrafts((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([taskId, draftValue]) => {
        const task = taskLookup.get(String(taskId));
        if (!task) return;
        if (String(task.name || "") === String(draftValue || "")) {
          delete next[taskId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setColumnNameDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      const existingColumnIds = new Set((columns || []).map((column) => String(column._id)));

      Object.keys(prev).forEach((columnId) => {
        if (!existingColumnIds.has(String(columnId))) {
          delete next[columnId];
          changed = true;
        }
      });

      (columns || []).forEach((column) => {
        const key = String(column._id);
        if (!Object.prototype.hasOwnProperty.call(prev, key)) return;
        if (String(prev[key] || "").trim() === String(column.name || "").trim()) {
          delete next[key];
          changed = true;
        }
      });

      if (changed) {
        columnNameDraftsRef.current = next;
      }
      return changed ? next : prev;
    });
  }, [board, taskLookup]);

  useEffect(() => {
    return () => {
      Object.values(filePreviewsRef.current).forEach((preview) => {
        if (preview?.url) URL.revokeObjectURL(preview.url);
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(taskSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(columnNameSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const flushAllDrafts = () => {
    const drafts = cellDraftsRef.current || {};
    if (!Object.keys(drafts).length) return;

    (groups || []).forEach((group) => {
      (group.tasks || []).forEach((task) => {
        const taskId = String(task._id);
        if (!drafts[taskId]) return;
        onUpdateTask?.(group._id, taskId, { values: { ...drafts[taskId] } });
      });
    });
  };

  const getColumnWidth = (columnId) => columnWidths[columnId] || 150;

  const getFilePreviewKey = (taskId, columnId) => `${taskId}-${columnId}`;

  const handleFileChange = async (groupId, task, column, file) => {
    if (!file) return;

    const previewKey = getFilePreviewKey(task._id, column._id);
    const previewUrl = URL.createObjectURL(file);

    setFilePreviews((prev) => {
      if (prev[previewKey]?.url) URL.revokeObjectURL(prev[previewKey].url);
      return {
        ...prev,
        [previewKey]: {
          name: file.name,
          type: file.type,
          url: previewUrl,
        },
      };
    });

    const columnKey = String(column._id || "");
    await onUpdateTask?.(groupId, task._id, {
      values: { [columnKey]: file.name },
    });
  };

  const startColumnResize = (event, columnId) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: getColumnWidth(columnId),
      minWidth: 140,
    };
  };

  const toggleTask = (taskId) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const toggleGroup = (groupId) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const createGroup = async () => {
    const title = newGroupTitle.trim();
    if (!title) return;

    try {
      await onAddGroup?.(title);
      setNewGroupTitle("");
      setShowGroupModal(false);
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const createColumn = async () => {
    if (creatingColumn) return;
    const name = newColumnName.trim();
    if (!name) return;
    setColumnModalError("");

    const validateFormulaDraft = () => {
      if (newColumnType !== "numbers" || !newColumnUseFormula) return "";
      const rawFormula = String(newColumnFormula || "").trim();
      if (!rawFormula) return "";
      const expressionSource = rawFormula.startsWith("=") ? rawFormula.slice(1) : rawFormula;
      if (!expressionSource.trim()) return "Formula cannot be empty.";

      const availableNames = new Set(
        (columns || []).map((column) => String(column?.name || "").trim().toLowerCase()).filter(Boolean),
      );

      let unknownColumn = "";
      const expression = expressionSource.replace(/\{([^}]+)\}/g, (_match, tokenName) => {
        const normalized = String(tokenName || "").trim().toLowerCase();
        if (!normalized || !availableNames.has(normalized)) {
          unknownColumn = String(tokenName || "").trim();
          return "0";
        }
        return "1";
      });

      if (unknownColumn) return `Unknown formula column: ${unknownColumn}`;
      if (/[{}]/.test(expression)) return "Formula has unmatched braces. Use {ColumnName}.";
      if (!/^[\d+\-*/().\s]+$/.test(expression)) {
        return "Formula can only use numbers, spaces, parentheses, and + - * / operators.";
      }

      try {
        const evaluated = Function(`"use strict"; return (${expression});`)();
        if (!Number.isFinite(evaluated)) return "Formula result must be a valid number.";
      } catch (_error) {
        return "Invalid formula syntax.";
      }

      return "";
    };

    const formulaError = validateFormulaDraft();
    if (formulaError) {
      setColumnModalError(formulaError);
      return;
    }

    const payload = {
      name,
      type: newColumnType,
      formula:
        newColumnType === "numbers" && newColumnUseFormula
          ? String(newColumnFormula || "").trim()
          : "",
      options:
        newColumnType === "status" || newColumnType === "dropdown"
          ? newColumnOptions
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
    };

    try {
      setCreatingColumn(true);
      await onAddColumn?.(payload);
      setNewColumnName("");
      setNewColumnType("status");
      setNewColumnOptions("Not Started, Working on it, Done");
      setNewColumnFormula("");
      setNewColumnUseFormula(false);
      setColumnModalError("");
      setShowColumnModal(false);
    } catch (error) {
      setColumnModalError(error?.response?.data?.message || "Failed to add column");
      console.error("Failed to add column:", error);
    } finally {
      setCreatingColumn(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedTasks.length) return;

    try {
      await onDeleteTasks?.(selectedTasks);
      setSelectedTasks([]);
    } catch (error) {
      console.error("Failed to delete tasks:", error);
    }
  };

  const handleArchiveSelected = async () => {
    if (!selectedTasks.length) return;
    try {
      await onArchiveTasks?.(selectedTasks);
      setSelectedTasks([]);
    } catch (error) {
      console.error("Failed to archive tasks:", error);
    }
  };

  const handleTrashSelected = async () => {
    if (!selectedTasks.length) return;
    try {
      await onTrashTasks?.(selectedTasks);
      setSelectedTasks([]);
    } catch (error) {
      console.error("Failed to move tasks to trash:", error);
    }
  };

  const handleTaskDrop = async (targetGroupId) => {
    if (!draggedTask) return;

    const taskToMove = draggedTask;
    setDraggedTask(null);
    setDragOverGroupId(null);

    if (taskToMove.groupId === targetGroupId) return;

    await onMoveTask?.({
      taskId: taskToMove.taskId,
      sourceGroupId: taskToMove.groupId,
      targetGroupId,
    });
  };

  const handleAddTaskRow = async (groupId) => {
    const draft = draftTaskNames[groupId]?.trim();
    const nextName = draft || "New Item";

    try {
      await onAddTask?.(groupId, nextName);
      setDraftTaskNames((prev) => ({ ...prev, [groupId]: "" }));
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const updateGroupTitle = async (groupId, value) => {
    const title = value.trim();
    if (!title) return;
    await onUpdateGroup?.(groupId, { title });
  };

  const updateColumnName = async (columnId, value, currentName = "") => {
    const name = value.trim();
    if (!name) return;
    if (name === String(currentName || "").trim()) return;
    await onUpdateColumn?.(columnId, { name });
  };

  const getColumnNameDraftValue = (columnId, fallback = "") => {
    const key = String(columnId || "");
    if (Object.prototype.hasOwnProperty.call(columnNameDrafts, key)) {
      return columnNameDrafts[key];
    }
    return fallback;
  };

  const setColumnNameDraftValue = (columnId, value) => {
    const key = String(columnId || "");
    setColumnNameDrafts((prev) => {
      const next = { ...prev, [key]: value };
      columnNameDraftsRef.current = next;
      return next;
    });
  };

  const clearColumnNameDraftValue = (columnId) => {
    const key = String(columnId || "");
    setColumnNameDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      columnNameDraftsRef.current = next;
      return next;
    });
  };

  const flushItemColumnNameDraft = () => {
    const nextName = String(itemColumnNameDraft || "").trim();
    const currentName = String(itemColumnLabel || "").trim();
    if (!nextName) {
      setItemColumnNameDraft(currentName);
      return;
    }
    if (nextName === currentName) return;
    onUpdateItemColumnName?.(nextName);
  };

  function flushColumnNameDraft(columnId, currentName = "") {
    const key = String(columnId || "");
    if (columnNameSaveTimersRef.current[key]) {
      clearTimeout(columnNameSaveTimersRef.current[key]);
      delete columnNameSaveTimersRef.current[key];
    }

    const rawDraft = columnNameDraftsRef.current[key];
    if (rawDraft === undefined) return;

    const nextName = String(rawDraft || "").trim();
    const baseName = String(currentName || "").trim();

    if (!nextName) {
      clearColumnNameDraftValue(key);
      return;
    }

    if (nextName === baseName) {
      clearColumnNameDraftValue(key);
      return;
    }

    updateColumnName(key, nextName, baseName).catch((error) => {
      console.error("Failed to rename column:", error);
    });
  }

  const scheduleColumnNameSave = (columnId, currentName = "", delay = 500) => {
    const key = String(columnId || "");
    if (columnNameSaveTimersRef.current[key]) {
      clearTimeout(columnNameSaveTimersRef.current[key]);
    }
    columnNameSaveTimersRef.current[key] = setTimeout(() => {
      flushColumnNameDraft(key, currentName);
    }, Math.max(0, delay));
  };

  const flushAllColumnNameDrafts = () => {
    (columns || []).forEach((column) => {
      flushColumnNameDraft(column._id, column.name);
    });
  };

  const reorderColumnIds = (order, sourceId, rawTargetIndex) => {
    const list = [...order];
    const fromIndex = list.indexOf(String(sourceId));
    if (fromIndex === -1) return list;

    const [movedId] = list.splice(fromIndex, 1);
    let nextIndex = Number.isFinite(rawTargetIndex) ? rawTargetIndex : list.length;
    nextIndex = Math.max(0, Math.min(nextIndex, list.length));
    if (fromIndex < nextIndex) {
      nextIndex -= 1;
    }
    list.splice(nextIndex, 0, movedId);
    return list;
  };

  const persistColumnOrder = async (nextOrder) => {
    if (!onReorderColumns) return;
    const itemColumnPosition = nextOrder.indexOf(ITEM_COLUMN_ID);
    const orderedPayload = nextOrder
      .filter((columnId) => String(columnId) !== ITEM_COLUMN_ID)
      .map((columnId) => columns.find((column) => String(column._id) === String(columnId)))
      .filter(Boolean)
      .map((column) => ({
        _id: column._id,
        name: column.name,
        type: column.type,
        options: Array.isArray(column.options) ? column.options : [],
        formula: String(column.formula || ""),
      }));

    await onReorderColumns({
      columns: orderedPayload,
      itemColumnPosition:
        itemColumnPosition >= 0
          ? itemColumnPosition
          : Number(board?.itemColumnPosition) || 0,
    });
  };

  const finishColumnDrag = async (targetIndex) => {
    if (!draggedColumnId) return;

    const activeOrder = columnOrder.length ? columnOrder : defaultColumnOrder;
    const nextOrder = reorderColumnIds(activeOrder, draggedColumnId, targetIndex);
    const hasChanged = nextOrder.join("|") !== activeOrder.join("|");
    setDraggedColumnId(null);
    setColumnDropIndex(null);

    if (!hasChanged) return;

    setColumnOrder(nextOrder);
    try {
      await persistColumnOrder(nextOrder);
    } catch (error) {
      console.error("Failed to reorder columns:", error);
      setColumnOrder(defaultColumnOrder);
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushAllDrafts();
        flushAllColumnNameDrafts();
      }
    };

    const handleBeforeUnload = () => {
      flushAllDrafts();
      flushAllColumnNameDrafts();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      flushAllDrafts();
      flushAllColumnNameDrafts();
    };
  }, [columns, groups]);
  const revenueColumnId = useMemo(() => {
    const revenueColumn = (columns || []).find((column) =>
      /^revenue$/i.test(String(column?.name || "").trim()),
    );
    return revenueColumn?._id ? String(revenueColumn._id) : "";
  }, [columns]);
  const expensesColumnId = useMemo(() => {
    const expensesColumn = (columns || []).find((column) =>
      /^expenses?$/i.test(String(column?.name || "").trim()),
    );
    return expensesColumn?._id ? String(expensesColumn._id) : "";
  }, [columns]);

  const updateColumnOptions = (column) => {
    setLabelEditor({
      columnId: column._id,
      columnName: column.name,
      labels: column.options?.length ? [...column.options] : ["Default Label"],
    });
  };

  const updateLabelEditorValue = (index, value) => {
    setLabelEditor((prev) => {
      if (!prev) return prev;
      const labels = [...prev.labels];
      labels[index] = value;
      return { ...prev, labels };
    });
  };

  const addEditorLabel = () => {
    setLabelEditor((prev) => {
      if (!prev) return prev;
      return { ...prev, labels: [...prev.labels, "New label"] };
    });
  };

  const removeEditorLabel = (index) => {
    setLabelEditor((prev) => {
      if (!prev) return prev;
      const labels = prev.labels.filter((_, labelIndex) => labelIndex !== index);
      return { ...prev, labels: labels.length ? labels : ["Default Label"] };
    });
  };

  const applyLabelEditor = async () => {
    if (!labelEditor) return;

    const options = [
      ...new Set(labelEditor.labels.map((item) => item.trim()).filter(Boolean)),
    ];

    if (!options.length) return;

    await onUpdateColumn?.(labelEditor.columnId, { options });
    setLabelEditor(null);
  };

  const getCellDraftValue = (taskId, columnId, fallback = "") => {
    const taskKey = String(taskId || "");
    const columnKey = String(columnId || "");
    const taskDrafts = cellDrafts[taskKey];
    if (!taskDrafts) return fallback;
    if (Object.prototype.hasOwnProperty.call(taskDrafts, columnKey)) {
      return taskDrafts[columnKey];
    }
    return fallback;
  };

  const columnIdByName = useMemo(() => {
    const map = new Map();
    (columns || []).forEach((column) => {
      const normalizedName = String(column?.name || "").trim().toLowerCase();
      const columnId = String(column?._id || "").trim();
      if (!normalizedName || !columnId) return;
      map.set(normalizedName, columnId);
    });
    return map;
  }, [columns]);

  const getTaskValueIncludingDrafts = (task, columnId) =>
    getCellDraftValue(task?._id, columnId, getColumnValue(task, columnId));

  const evaluateFormulaForTask = (task, formula) => {
    const rawFormula = String(formula || "").trim();
    if (!rawFormula) return "";
    const expressionSource = rawFormula.startsWith("=") ? rawFormula.slice(1) : rawFormula;
    if (!expressionSource.trim()) return "";

    const expression = expressionSource.replace(/\{([^}]+)\}/g, (_match, tokenName) => {
      const normalizedName = String(tokenName || "").trim().toLowerCase();
      const refColumnId = columnIdByName.get(normalizedName);
      if (!refColumnId) return "0";
      const rawValue = getTaskValueIncludingDrafts(task, refColumnId);
      const numericValue = parseNumberCellValue(rawValue);
      return String(numericValue === null ? 0 : numericValue);
    });

    if (/[{}]/.test(expression)) return "";
    if (!/^[\d+\-*/().\s]+$/.test(expression)) return "";

    try {
      const result = Function(`"use strict"; return (${expression});`)();
      if (!Number.isFinite(result)) return "";
      return Math.trunc(result).toLocaleString("en-US");
    } catch (_error) {
      return "";
    }
  };

  const setCellDraftValue = (taskId, columnId, value) => {
    const taskKey = String(taskId || "");
    const columnKey = String(columnId || "");
    setCellDrafts((prev) => {
      const next = {
        ...prev,
        [taskKey]: {
          ...(prev[taskKey] || {}),
          [columnKey]: value,
        },
      };
      cellDraftsRef.current = next;
      return next;
    });
  };

  const clearCellDraftValue = (taskId, columnId) => {
    const taskKey = String(taskId || "");
    const columnKey = String(columnId || "");
    setCellDrafts((prev) => {
      const nextTaskDrafts = { ...(prev[taskKey] || {}) };
      delete nextTaskDrafts[columnKey];
      const next = { ...prev };
      if (Object.keys(nextTaskDrafts).length) {
        next[taskKey] = nextTaskDrafts;
      } else {
        delete next[taskKey];
      }
      cellDraftsRef.current = next;
      return next;
    });
  };

  const getTaskValuesObject = (task) => {
    if (!task?.values) return {};
    if (task.values instanceof Map) {
      return Object.fromEntries(task.values.entries());
    }
    if (typeof task.values?.entries === "function") {
      return Object.fromEntries(task.values.entries());
    }
    return { ...task.values };
  };

  const scheduleTaskSave = (groupId, task, delay = 500) => {
    if (!task?._id) return;
    const taskId = String(task._id);
    if (taskSaveTimersRef.current[taskId]) {
      clearTimeout(taskSaveTimersRef.current[taskId]);
    }
    taskSaveTimersRef.current[taskId] = setTimeout(() => {
      const draftValues = cellDraftsRef.current?.[taskId] || {};
      if (!Object.keys(draftValues).length) {
        delete taskSaveTimersRef.current[taskId];
        return;
      }
      onUpdateTask?.(groupId, taskId, { values: { ...draftValues } });
      delete taskSaveTimersRef.current[taskId];
    }, Math.max(0, delay));
  };

  const flushTaskDrafts = (groupId, task) => {
    if (!task?._id) return;
    const taskId = String(task._id);
    if (taskSaveTimersRef.current[taskId]) {
      clearTimeout(taskSaveTimersRef.current[taskId]);
      delete taskSaveTimersRef.current[taskId];
    }
    const draftValues = cellDraftsRef.current?.[taskId] || {};
    if (!Object.keys(draftValues).length) return;
    onUpdateTask?.(groupId, taskId, { values: { ...draftValues } });
  };

  const getItemDraftValue = (taskId, fallback = "") => {
    const taskKey = String(taskId || "");
    if (Object.prototype.hasOwnProperty.call(itemDrafts, taskKey)) {
      return itemDrafts[taskKey];
    }
    return fallback;
  };

  const setItemDraftValue = (taskId, value) => {
    const taskKey = String(taskId || "");
    setItemDrafts((prev) => ({
      ...prev,
      [taskKey]: value,
    }));
  };

  const clearItemDraftValue = (taskId) => {
    const taskKey = String(taskId || "");
    setItemDrafts((prev) => {
      const next = { ...prev };
      delete next[taskKey];
      return next;
    });
  };

  const renderCell = (task, groupId, column) => {
    const columnKey = String(column._id || "");
    const value = getColumnValue(task, column._id);

    if (isFilesColumn(column)) {
      const previewKey = getFilePreviewKey(task._id, column._id);
      const preview = filePreviews[previewKey];
      const fileName = preview?.name || value;

      return (
        <div className="flex items-center gap-2">
          {fileName ? (
            <button
              type="button"
              onClick={() =>
                setFilePreviewModal({
                  name: fileName,
                  type: preview?.type || "",
                  url: preview?.url || "",
                })
              }
              className="min-w-0 flex-1 truncate rounded-lg border border-gray-700 bg-[#0f172a] px-3 py-2 text-left text-sm text-gray-300 shadow-sm transition hover:border-indigo-400 hover:text-white"
              title={fileName}
            >
              {fileName}
            </button>
          ) : (
            <label className="min-w-0 flex-1 cursor-pointer rounded-lg border border-dashed border-gray-700 bg-[#0f172a] px-3 py-2 text-sm text-gray-300 shadow-sm transition hover:border-indigo-400 hover:text-white">
              Attach file
              <input
                type="file"
                className="sr-only"
                onChange={(e) => handleFileChange(groupId, task, column, e.target.files?.[0])}
              />
            </label>
          )}

          <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-700 bg-[#0f172a] text-indigo-300 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-500/10">
            <Paperclip size={15} />
            <input
              type="file"
              className="sr-only"
              onChange={(e) => handleFileChange(groupId, task, column, e.target.files?.[0])}
            />
          </label>
        </div>
      );
    }

    if (column.type === "status" || column.type === "dropdown") {
      const dropdownId = `${task._id}-${column._id}`;
      const selectedValue = value || column.options?.[0] || "";
      const isOpen = openLabelDropdown?.id === dropdownId;
      const menuStyle = (() => {
        const rect = openLabelDropdown?.rect;
        if (!rect) return undefined;
        const menuWidth = Math.max(rect.width || 0, 220);
        const viewportWidth = typeof window !== "undefined" ? window.innerWidth : rect.left + menuWidth;
        const left = Math.min(rect.left, Math.max(16, viewportWidth - menuWidth - 16));
        return {
          top: rect.bottom + 8,
          left,
          width: menuWidth,
        };
      })();

      return (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              setOpenLabelDropdown((prev) =>
                prev?.id === dropdownId ? null : { id: dropdownId, rect },
              );
            }}
            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium shadow-sm transition hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
              column.type === "status" ? statusClasses(selectedValue) : "border-gray-700 bg-[#0f172a] text-gray-100"
            }`}
          >
            <span className="truncate">{selectedValue || "Select label"}</span>
            <ChevronDown
              size={15}
              className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen ? (
            <div
              className="fixed z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] p-1 text-gray-100 shadow-2xl shadow-black/40"
              style={menuStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {(column.options || []).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setOpenLabelDropdown(null);
                    onUpdateTask?.(groupId, task._id, {
                      values: { [columnKey]: option },
                    });
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedValue === option
                      ? "bg-indigo-500/20 text-white"
                      : "text-gray-300 hover:bg-[#172033] hover:text-white"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {selectedValue === option ? (
                    <span className="ml-2 h-2 w-2 rounded-full bg-indigo-500" />
                  ) : null}
                </button>
              ))}

              <div className="my-1 border-t border-gray-800" />

              <button
                type="button"
                onClick={() => {
                  setOpenLabelDropdown(null);
                  updateColumnOptions(column);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/10 hover:text-white"
              >
                <Settings2 size={14} />
                Edit labels
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (isTimelineColumn(column)) {
      const { start, end } = parseTimelineValue(value);
      const pickerId = `${task._id}-${column._id}`;
      const isOpen = openTimelinePicker?.id === pickerId;
      const calendarDays = getMonthDays(timelineCalendarMonth);
      const monthLabel = timelineCalendarMonth.toLocaleString("en-US", { month: "short" });
      const yearLabel = timelineCalendarMonth.getFullYear();
      const updateTimeline = (nextStart, nextEnd) =>
        onUpdateTask?.(groupId, task._id, {
          values: { [columnKey]: formatTimelineValue(nextStart, nextEnd) },
        });
      const chooseDate = (dateKey) => {
        if (!start || (start && end)) {
          updateTimeline(dateKey, "");
          return;
        }

        if (dateKey < start) {
          updateTimeline(dateKey, start);
          return;
        }

        updateTimeline(start, dateKey);
      };

      const pickerStyle = (() => {
        const rect = openTimelinePicker?.rect;
        if (!rect) return undefined;
        const width = 284;
        const viewportWidth = typeof window !== "undefined" ? window.innerWidth : rect.left + width;
        const left = Math.min(rect.left, Math.max(16, viewportWidth - width - 16));
        const top = rect.bottom + 8;
        return { top, left, width };
      })();

      return (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(event) => {
              setOpenTimelinePicker((prev) => {
                if (prev?.id === pickerId) return null;
                const rect = event?.currentTarget?.getBoundingClientRect?.();
                return rect ? { id: pickerId, rect } : { id: pickerId };
              });
              setTimelineCalendarMonth(start ? new Date(`${start}T00:00:00`) : new Date());
            }}
            className="mx-auto flex h-7 min-w-[108px] max-w-full items-center justify-center rounded-full border border-gray-700 bg-[#1e293b] px-4 text-xs font-semibold text-gray-200 shadow-inner transition hover:border-indigo-400 hover:bg-[#26364f]"
            title={formatTimelineLabel(start, end)}
          >
            <span className="truncate">{formatTimelineLabel(start, end)}</span>
          </button>

          {isOpen ? (
            <div
              className="fixed z-50 rounded-xl border border-gray-700 bg-[#111827] p-3 text-gray-100 shadow-2xl shadow-black/40"
              style={pickerStyle}
            >
              <p className="mb-3 text-sm font-semibold">Set dates</p>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={start}
                  onChange={(e) => updateTimeline(e.target.value, end)}
                  className="min-w-0 rounded border border-indigo-400 bg-[#1e293b] px-2 py-2 text-xs text-gray-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="Start date"
                />
                <input
                  type="date"
                  value={end}
                  onChange={(e) => updateTimeline(start, e.target.value)}
                  className="min-w-0 rounded border border-gray-700 bg-[#1e293b] px-2 py-2 text-xs text-gray-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="End date"
                />
              </div>

              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-5 text-sm">
                  <span>{monthLabel}</span>
                  <span>{yearLabel}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTimelineCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                      )
                    }
                    className="rounded p-1 text-gray-300 hover:bg-[#1e293b]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTimelineCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                      )
                    }
                    className="rounded p-1 text-gray-300 hover:bg-[#1e293b]"
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                  <span key={day} className="py-1 text-gray-400">
                    {day}
                  </span>
                ))}

                {calendarDays.map((date) => {
                  const dateKey = formatDateKey(date);
                  const isCurrentMonth = date.getMonth() === timelineCalendarMonth.getMonth();
                  const isEndpoint = dateKey === start || dateKey === end;
                  const isInRange = start && end && dateKey > start && dateKey < end;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => chooseDate(dateKey)}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                        isEndpoint
                          ? "bg-indigo-500 text-white"
                          : isInRange
                            ? "bg-indigo-500/15 text-indigo-200"
                            : isCurrentMonth
                              ? "text-gray-200 hover:bg-[#1e293b]"
                              : "text-gray-500 hover:bg-[#1e293b]/70"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (column.type === "text") {
      const draftValue = getCellDraftValue(task._id, columnKey, value || "");
      return (
        <input
          value={draftValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCellDraftValue(task._id, columnKey, nextValue);
            scheduleTaskSave(groupId, task);
          }}
          onBlur={(e) => {
            const nextValue = e.target.value.trim();
            if (nextValue !== (value || "")) {
              setCellDraftValue(task._id, columnKey, nextValue);
              flushTaskDrafts(groupId, task);
            }
          }}
          className="mx-auto block w-[92%] rounded-lg border border-transparent bg-transparent px-2 py-2 text-gray-100 outline-none transition focus:border-indigo-400 focus:bg-[#0f172a]"
        />
      );
    }

    if (column.type === "people") {
      const peopleOptions = peopleOptionsByColumn[columnKey] || [];
      const displayValue = getPeopleLabel(value);

      return (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/80 text-xs font-semibold text-white">
            {(String(displayValue || "-")[0] || "-").toUpperCase()}
          </div>
          <select
            value={displayValue || ""}
            onChange={(e) =>
              onUpdateTask?.(groupId, task._id, {
                values: { [columnKey]: e.target.value },
              })
            }
            className="mx-auto block w-[92%] rounded-lg border border-slate-700 bg-[#111f38] px-2.5 py-2 text-center text-sm font-medium text-slate-100 outline-none transition focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Assignee</option>
            {peopleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (column.type === "numbers") {
      const formula = String(column?.formula || "").trim();
      const isFormulaColumn = Boolean(formula);
      const normalizedValue = formatNumberCellValue(value);
      const draftValue = getCellDraftValue(
        task._id,
        columnKey,
        normalizedValue,
      );

      if (isFormulaColumn) {
        const immediateFormulaValue = evaluateFormulaForTask(task, formula);
        return (
          <input
            type="text"
            readOnly
            value={immediateFormulaValue || draftValue}
            title={`Formula: ${formula}`}
            className="mx-auto block w-[92%] cursor-not-allowed border border-transparent bg-transparent px-2 py-1.5 text-center text-slate-300 outline-none"
          />
        );
      }

      return (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9,]*"
          step="1"
          value={draftValue}
          onChange={(e) => {
            const nextValue = e.target.value.replace(/[^0-9,]/g, "");
            setCellDraftValue(task._id, columnKey, nextValue);
            scheduleTaskSave(groupId, task, 150);
          }}
          onBeforeInput={(e) => {
            if (e?.data && /[^0-9,]/.test(e.data)) {
              e.preventDefault();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[^0-9,]/.test(text)) {
              e.preventDefault();
              const cleaned = text.replace(/[^0-9,]/g, "");
              setCellDraftValue(task._id, columnKey, cleaned);
              scheduleTaskSave(groupId, task);
            }
          }}
          onBlur={(e) => {
            const rawValue = String(e.target.value || "").trim();
            const numericDigits = rawValue.replace(/,/g, "");
            const nextValue =
              numericDigits === ""
                ? ""
                : Number.parseInt(numericDigits, 10).toLocaleString("en-US");
            if (String(nextValue ?? "") !== String(value ?? "")) {
              setCellDraftValue(task._id, columnKey, nextValue);
              flushTaskDrafts(groupId, task);
            }
          }}
          className="mx-auto block w-[92%] border border-transparent bg-transparent px-2 py-1.5 text-center text-slate-100 font-medium outline-none transition focus:bg-[#12213b]/35"
        />
      );
    }

    if (column.type === "date") {
      const draftValue = getCellDraftValue(task._id, columnKey, value || "");
      return (
        <input
          type="date"
          value={draftValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCellDraftValue(task._id, columnKey, nextValue);
            scheduleTaskSave(groupId, task);
          }}
          onBlur={(e) => {
            const nextValue = e.target.value;
            if (nextValue !== (value || "")) {
              setCellDraftValue(task._id, columnKey, nextValue);
              flushTaskDrafts(groupId, task);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="mx-auto block w-[92%] rounded-lg border border-slate-700 bg-[#111f38] px-2.5 py-2 text-center text-slate-100 font-medium outline-none transition focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/20"
        />
      );
    }

    return <span className="block text-center text-gray-400">{String(value || "")}</span>;
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-sm text-gray-400">
        Loading board...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6 text-sm text-gray-400">
        No board data.
      </div>
    );
  }

  const resolvedEmptyState = emptyState || {
    title: "This board has no groups yet.",
    actionLabel: "Create your first group",
  };

  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <div className="border border-dashed border-gray-700 bg-[#111827] p-8 text-center">
          <p className="text-sm text-gray-400">{resolvedEmptyState.title}</p>
          {resolvedEmptyState.actionLabel ? (
            <button
              onClick={() => setShowGroupModal(true)}
              className="mt-4 inline-flex items-center gap-2 border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              {resolvedEmptyState.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => {
        const groupTasks = group.tasks || [];
        const isHeaderElevated = Boolean(groupHeaderElevated[group._id]);
        const canDeleteGroup = groups.length > 1;
        const activeColumnOrder = columnOrder.length ? columnOrder : defaultColumnOrder;
        const reorderableColumns = activeColumnOrder
          .map((columnId) => {
            if (columnId === ITEM_COLUMN_ID) {
              return isItemColumnVisible ? { key: ITEM_COLUMN_ID, kind: "item" } : null;
            }
            const column = columns.find((entry) => String(entry._id) === String(columnId));
            if (!column) return null;
            return { key: String(column._id), kind: "data", column };
          })
          .filter(Boolean);
        const numericTotalsByColumn = reorderableColumns.reduce((acc, entry) => {
          if (entry.kind !== "data") return acc;
          const columnId = String(entry.column?._id || "");
          if (!columnId) return acc;

          let hasNumeric = false;
          let hasNonNumeric = false;

          const total = groupTasks.reduce((sum, task) => {
            const formula = String(entry.column?.formula || "").trim();
            const rawValue = getCellDraftValue(
              task?._id,
              columnId,
              formula
                ? evaluateFormulaForTask(task, formula)
                : formatNumberCellValue(getColumnValue(task, columnId)),
            );
            const trimmed = String(rawValue ?? "").trim();
            if (!trimmed) return sum;

            const numericValue = parseNumberCellValue(trimmed);
            if (numericValue === null) {
              hasNonNumeric = true;
              return sum;
            }

            hasNumeric = true;
            return sum + numericValue;
          }, 0);

          const isSummableNumbersColumn =
            entry.column?.type === "numbers" || (hasNumeric && !hasNonNumeric);

          if (!isSummableNumbersColumn) return acc;

          acc[columnId] = total;
          return acc;
        }, {});

        return (
          <div
            key={group._id}
            className={`space-y-2 rounded-xl transition ${
              dragOverGroupId === group._id ? "bg-indigo-500/10 ring-1 ring-indigo-400/60" : ""
            }`}
            onDragOver={(event) => {
              if (!draggedTask) return;
              event.preventDefault();
              setDragOverGroupId(group._id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDragOverGroupId(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleTaskDrop(group._id);
            }}
          >
            <div className="flex items-center gap-3 px-1 py-2 select-none">
              <button
                onClick={() => toggleGroup(group._id)}
                className="rounded-md p-1 text-indigo-300 hover:bg-[#1f2937]"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    collapsedGroups.includes(group._id) ? "-rotate-90" : "rotate-0"
                  }`}
                />
              </button>

              <input
                defaultValue={group.title}
                onBlur={(e) => updateGroupTitle(group._id, e.target.value)}
                className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-indigo-300 outline-none focus:border-indigo-400 focus:bg-[#111827]"
              />

              <span className="rounded-full border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200">
                {groupTasks.length} items
              </span>

              <button
                onClick={() => {
                  if (!canDeleteGroup) return;
                  onDeleteGroup?.(group._id);
                }}
                disabled={!canDeleteGroup}
                className={`ml-auto rounded-lg border border-transparent p-2 text-gray-400 transition ${
                  canDeleteGroup
                    ? "hover:border-gray-700 hover:bg-[#1f2937] hover:text-red-300"
                    : "cursor-not-allowed opacity-40"
                }`}
                aria-label="Delete group"
                title={canDeleteGroup ? "Delete group" : "At least one group is required"}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {!collapsedGroups.includes(group._id) ? (
              <div
                className="max-h-[620px] max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-slate-800/70 bg-[#0d1629] shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
                onScroll={(event) => {
                  const nextElevated = event.currentTarget.scrollTop > 0;
                  setGroupHeaderElevated((prev) => {
                    if (Boolean(prev[group._id]) === nextElevated) return prev;
                    return { ...prev, [group._id]: nextElevated };
                  });
                }}
              >
                <table className="w-full min-w-[680px] text-[14px] lg:min-w-[980px]">
                  <thead>
                    <tr
                      className={`sticky top-0 z-20 border-b bg-[#101b32] transition-shadow duration-200 ${
                        isHeaderElevated
                          ? "border-slate-600/70 shadow-[0_1px_0_rgba(148,163,184,0.22),0_8px_14px_rgba(2,6,23,0.28)]"
                          : "border-slate-800/80 shadow-none"
                      }`}
                    >
                      <th className="w-10 border-r border-slate-800/70 p-2.5" />
                      {reorderableColumns.map((entry, index) => {
                        const isItem = entry.kind === "item";
                        const col = entry.column;
                        const Icon = isItem ? Rows3 : getColumnIcon(col.type);
                        const firstDataColumnId = columns[0]?._id ? String(columns[0]._id) : null;
                        const isProtectedColumn =
                          isItem || (!isItem && firstDataColumnId && String(col?._id) === firstDataColumnId);

                        return (
                          <motion.th
                            key={entry.key}
                            layout
                            transition={{ type: "spring", stiffness: 280, damping: 26 }}
                            onDragOver={(event) => {
                              if (!draggedColumnId) return;
                              event.preventDefault();
                              const rect = event.currentTarget.getBoundingClientRect();
                              const shouldInsertAfter = event.clientX > rect.left + rect.width / 2;
                              setColumnDropIndex(shouldInsertAfter ? index + 1 : index);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const rect = event.currentTarget.getBoundingClientRect();
                              const shouldInsertAfter = event.clientX > rect.left + rect.width / 2;
                              finishColumnDrag(shouldInsertAfter ? index + 1 : index);
                            }}
                            className={`relative border-r border-slate-800/70 p-2.5 text-left font-semibold text-slate-200 transition-shadow duration-200 ${
                              draggedColumnId === entry.key
                                ? "z-20 scale-[1.01] shadow-[0_12px_26px_rgba(79,70,229,0.35)]"
                                : ""
                            }`}
                            style={{
                              width: isItem ? "200px" : `${getColumnWidth(col._id)}px`,
                              minWidth: isItem ? "200px" : `${getColumnWidth(col._id)}px`,
                            }}
                          >
                            {columnDropIndex === index ? (
                              <div className="pointer-events-none absolute -left-px inset-y-2 z-30 w-[2px] rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
                            ) : null}

                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                  setDraggedColumnId(entry.key);
                                  setColumnDropIndex(index);
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", String(entry.key));
                                }}
                                onDragEnd={() => {
                                  setDraggedColumnId(null);
                                  setColumnDropIndex(null);
                                }}
                                className="mt-1 rounded-lg border border-gray-700 bg-[#1e293b] p-1.5 text-indigo-300 transition hover:border-indigo-500 hover:bg-indigo-500/10"
                                aria-label={`Drag to reorder ${isItem ? itemColumnLabel : col.name} column`}
                                title="Drag to reorder"
                              >
                                <Icon size={14} />
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  {isItem ? (
                                    <input
                                      value={itemColumnNameDraft}
                                      onChange={(event) => setItemColumnNameDraft(event.target.value)}
                                      onBlur={flushItemColumnNameDraft}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          event.currentTarget.blur();
                                        }
                                      }}
                                      className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 text-center text-gray-100 outline-none transition focus:border-indigo-400 focus:bg-[#0f172a]"
                                    />
                                  ) : (
                                    <input
                                      value={getColumnNameDraftValue(col._id, col.name)}
                                      onChange={(e) => {
                                        setColumnNameDraftValue(col._id, e.target.value);
                                        scheduleColumnNameSave(col._id, col.name);
                                      }}
                                      onBlur={() => flushColumnNameDraft(col._id, col.name)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          flushColumnNameDraft(col._id, col.name);
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 text-center text-gray-100 outline-none focus:border-indigo-400 focus:bg-[#111827]"
                                    />
                                  )}

                                  <div className="relative">
                                    <button
                                      onClick={() =>
                                        setOpenColumnMenu((prev) => (prev === entry.key ? null : entry.key))
                                      }
                                      className="inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-gray-400 transition hover:border-gray-700 hover:bg-[#1f2937] hover:text-white"
                                      aria-label={`Open ${isItem ? itemColumnLabel : col.name} column actions`}
                                    >
                                      <MoreHorizontal size={14} />
                                    </button>

                                    {openColumnMenu === entry.key ? (
                                      <div className="absolute right-0 top-full z-20 mt-2 min-w-[140px] rounded-xl border border-gray-700 bg-[#0f172a] p-1 text-gray-300 shadow-2xl shadow-black/40">
                                        {!isItem && (col.type === "status" || col.type === "dropdown") ? (
                                          <button
                                            onClick={() => {
                                              setOpenColumnMenu(null);
                                              updateColumnOptions(col);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-300 transition hover:bg-[#1f2937] hover:text-white"
                                          >
                                            <Settings2 size={12} />
                                            Labels
                                          </button>
                                        ) : null}

                                        {isProtectedColumn ? (
                                          <div
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-500"
                                            title="Primary column cannot be removed"
                                          >
                                            <X size={12} />
                                            Protected
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setOpenColumnMenu(null);
                                              onDeleteColumn?.(col._id || col.id || col.name);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-300 transition hover:bg-[#1f2937] hover:text-red-300"
                                          >
                                            <X size={12} />
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {!isItem ? (
                              <button
                                type="button"
                                onMouseDown={(event) => startColumnResize(event, col._id)}
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-indigo-500/20"
                                aria-label={`Resize ${col.name} column`}
                              />
                            ) : null}
                          </motion.th>
                        );
                      })}

                      <th
                        className="relative min-w-[220px] p-2.5 text-left"
                        onDragOver={(event) => {
                          if (!draggedColumnId) return;
                          event.preventDefault();
                          setColumnDropIndex(reorderableColumns.length);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          finishColumnDrag(reorderableColumns.length);
                        }}
                      >
                        {columnDropIndex === reorderableColumns.length ? (
                          <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
                        ) : null}
                        <button
                          onClick={() => setShowColumnModal(true)}
                          className="rounded-md p-1 text-gray-400 hover:bg-[#1f2937] hover:text-indigo-300"
                          aria-label="Add column"
                        >
                          <Plus size={16} />
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupTasks.map((task) => (
                      <tr
                        key={task._id}
                        className={`border-b border-slate-800/75 text-slate-100 transition odd:bg-[#0f1a31]/30 even:bg-[#0c162b]/22 hover:bg-[#15243f]/45 ${
                          selectedTasks.includes(task._id) ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-400/40" : ""
                        } ${
                          draggedTask?.taskId === task._id ? "opacity-50" : ""
                        }`}
                      >
                        <td className="border-r border-slate-800/70 p-2.5 align-middle">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => {
                                setDraggedTask({ taskId: task._id, groupId: group._id });
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", task._id);
                              }}
                              onDragEnd={() => {
                                setDraggedTask(null);
                                setDragOverGroupId(null);
                              }}
                              className="cursor-grab rounded p-1 text-gray-500 transition hover:bg-[#1f2937] hover:text-indigo-300 active:cursor-grabbing"
                              aria-label={`Drag ${task.name || "item"}`}
                            >
                              <GripVertical size={14} />
                            </button>
                            <input
                              type="checkbox"
                              checked={selectedTasks.includes(task._id)}
                              onChange={() => toggleTask(task._id)}
                              className="accent-indigo-500"
                            />
                          </div>
                        </td>

                        {reorderableColumns.map((entry) => {
                          if (entry.kind === "item") {
                            return (
                              <td
                                key={`${task._id}-${ITEM_COLUMN_ID}`}
                                className="border-r border-slate-800/70 p-2.5 align-middle"
                                style={{ width: "200px", minWidth: "200px" }}
                              >
                                <input
                                  value={getItemDraftValue(task._id, task.name || "")}
                                  onChange={(e) => setItemDraftValue(task._id, e.target.value)}
                                  onBlur={(e) => {
                                    const nextValue = e.target.value.trim() || "Untitled item";
                                    if (nextValue !== (task.name || "")) {
                                      onUpdateTask?.(group._id, task._id, { name: nextValue });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="mx-auto block w-[92%] rounded-md border border-transparent bg-transparent px-2.5 py-2 text-center font-medium text-slate-100 outline-none transition focus:border-indigo-400/70 focus:bg-[#12213b]"
                                />
                              </td>
                            );
                          }

                          const col = entry.column;
                          return (
                            <td
                              key={`${task._id}-${col._id}`}
                              className="border-r border-slate-800/70 p-2.5 align-middle"
                              style={{
                                width: `${getColumnWidth(col._id)}px`,
                                minWidth: `${getColumnWidth(col._id)}px`,
                              }}
                            >
                              {renderCell(task, group._id, col)}
                            </td>
                          );
                        })}

                        <td className="p-2.5" />
                      </tr>
                    ))}

                    <tr className="bg-[#0f172a]/50">
                      <td className="border-r border-slate-800/70 p-2.5" />
                      <td colSpan={reorderableColumns.length + 1} className="p-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            value={draftTaskNames[group._id] || ""}
                            onChange={(e) =>
                              setDraftTaskNames((prev) => ({
                                ...prev,
                                [group._id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTaskRow(group._id);
                              }
                            }}
                            placeholder={`+ Add a ${itemColumnLabel.toLowerCase()}`}
                            className="h-9 min-w-0 flex-1 border border-dashed border-slate-600/80 bg-transparent px-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-indigo-400/70 focus:bg-[#12213b] focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </td>
                    </tr>

                    <tr className="board-summary-row border-t border-slate-700/80 bg-[#0d1a33]">
                      <td className="border-r border-slate-800/70 p-2.5 align-middle" />
                      {reorderableColumns.map((entry) => {
                        if (entry.kind === "item") {
                          return (
                            <td
                              key={`summary-${group._id}-${ITEM_COLUMN_ID}`}
                              className="board-summary-title border-r border-slate-800/70 px-2.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-200 align-middle"
                            >
                              Summary
                            </td>
                          );
                        }

                        const columnId = String(entry.column?._id || "");
                        const total = numericTotalsByColumn[columnId];
                        return (
                          <td
                            key={`summary-${group._id}-${columnId}`}
                            className="border-r border-slate-800/70 px-2.5 py-2.5 text-center align-middle"
                          >
                            {Object.prototype.hasOwnProperty.call(numericTotalsByColumn, columnId) ? (
                              <div className="leading-tight">
                                <p className="board-summary-value text-base font-semibold text-white">
                                  {Number(total || 0).toLocaleString("en-US")}
                                </p>
                                <p className="board-summary-label text-[11px] uppercase tracking-wide text-sky-200">sum</p>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="p-2.5 align-middle" />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}

      <button
        onClick={() => setShowGroupModal(true)}
        className="inline-flex items-center gap-2 border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-indigo-500 hover:text-white"
      >
        <Plus size={16} />
        Add New Group
      </button>

      {selectedTasks.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl border border-gray-700 bg-[#0f172a] px-4 py-3 shadow-2xl sm:bottom-8 sm:w-auto sm:flex-nowrap sm:gap-5 sm:px-6">
          <span className="text-sm text-gray-300">
            {selectedTasks.length} selected
          </span>

          <button
            onClick={handleArchiveSelected}
            className="inline-flex items-center gap-2 text-sm text-indigo-200 hover:text-indigo-100"
          >
            <Archive size={14} />
            Archive
          </button>

          <button
            onClick={handleTrashSelected}
            className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-amber-100"
          >
            <Trash2 size={14} />
            Trash
          </button>

          <button
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
          >
            <Trash2 size={14} />
            Delete items
          </button>
        </div>
      ) : null}

      {showGroupModal ? (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowGroupModal(false)}
        >
          <div
            className="modal-card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title mb-1">Create New Group</h2>
            <p className="modal-subtitle mb-4">
              Keep items organized with clear sections.
            </p>

            <input
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createGroup();
              }}
              placeholder="Group name"
              className="modal-input mb-5"
            />

            <div className="modal-actions">
              <button
                onClick={() => setShowGroupModal(false)}
                className="modal-secondary"
              >
                Cancel
              </button>

              <button
                onClick={createGroup}
                className="modal-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {labelEditor ? (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setLabelEditor(null)}
        >
          <div
            className="modal-card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300">
                  Edit labels
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {labelEditor.columnName}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Rename labels or add new options for this column.
                </p>
              </div>

              <button
                onClick={() => setLabelEditor(null)}
                className="rounded-lg border border-gray-700 p-2 text-gray-400 transition hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white"
                aria-label="Close label editor"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {labelEditor.labels.map((label, index) => {
                const colors = [
                  "bg-amber-400",
                  "bg-rose-400",
                  "bg-emerald-400",
                  "bg-sky-400",
                  "bg-violet-400",
                ];

                return (
                  <div
                    key={`${labelEditor.columnId}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-700 bg-[#111827] p-2 transition focus-within:border-indigo-400"
                  >
                    <span className={`h-4 w-4 shrink-0 rounded-full ${colors[index % colors.length]}`} />
                    <input
                      value={label}
                      onChange={(e) => updateLabelEditorValue(index, e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-gray-500"
                      placeholder="Label name"
                    />
                    <button
                      type="button"
                      onClick={() => removeEditorLabel(index)}
                      className="rounded-md p-1 text-gray-500 transition hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Remove ${label || "label"}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addEditorLabel}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 bg-[#111827] px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:border-indigo-400 hover:bg-indigo-500/10 hover:text-white"
            >
              <Plus size={15} />
              New label
            </button>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLabelEditor(null)}
                className="rounded-xl px-4 py-2.5 text-sm text-gray-300 transition hover:bg-[#1e293b] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLabelEditor}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                Apply labels
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filePreviewModal ? (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setFilePreviewModal(null)}
        >
          <div
            className="modal-card flex h-[90vh] w-full max-w-6xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-gray-800 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300">
                  File preview
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold text-white">
                  {filePreviewModal.name}
                </h2>
              </div>

              <button
                onClick={() => setFilePreviewModal(null)}
                className="rounded-lg border border-gray-700 p-2 text-gray-400 transition hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white"
                aria-label="Close file preview"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {filePreviewModal.url ? (
                <>
                  {filePreviewModal.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreviewModal.url}
                      alt={filePreviewModal.name}
                      className="mx-auto h-full max-h-[74vh] max-w-full rounded-xl border border-gray-800 object-contain"
                    />
                  ) : null}

                  {filePreviewModal.type === "application/pdf" ? (
                    <iframe
                      src={filePreviewModal.url}
                      title={filePreviewModal.name}
                      className="h-full min-h-[72vh] w-full rounded-xl border border-gray-800 bg-white"
                    />
                  ) : null}

                  {filePreviewModal.type.startsWith("video/") ? (
                    <video
                      src={filePreviewModal.url}
                      controls
                      className="mx-auto max-h-[74vh] max-w-full rounded-xl border border-gray-800"
                    />
                  ) : null}

                  {filePreviewModal.type.startsWith("audio/") ? (
                    <div className="rounded-xl border border-gray-800 bg-[#111827] p-6">
                      <audio src={filePreviewModal.url} controls className="w-full" />
                    </div>
                  ) : null}

                  {!filePreviewModal.type.startsWith("image/") &&
                  filePreviewModal.type !== "application/pdf" &&
                  !filePreviewModal.type.startsWith("video/") &&
                  !filePreviewModal.type.startsWith("audio/") ? (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-[#111827] p-8 text-center text-sm text-gray-300">
                      This file type cannot be previewed inline, but it is attached as{" "}
                      <span className="font-medium text-white">{filePreviewModal.name}</span>.
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 bg-[#111827] p-8 text-center">
                  <Paperclip className="mx-auto mb-3 text-indigo-300" size={28} />
                  <p className="font-medium text-white">{filePreviewModal.name}</p>
                  <p className="mt-2 text-sm text-gray-400">
                    Preview is unavailable because this board currently stores only the file name.
                    Attach the file again to preview it in this session.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showColumnModal ? (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setColumnModalError("");
            setShowColumnModal(false);
          }}
        >
          <div
            className="modal-card w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">
                  Board setup
                </p>
                <h2 className="text-xl font-semibold text-white">Add Column</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Choose a column type and customize how this board captures work.
                </p>
              </div>

              <button
                onClick={() => {
                  setColumnModalError("");
                  setShowColumnModal(false);
                }}
                className="rounded-lg border border-gray-700 p-2 text-gray-400 transition hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white"
                aria-label="Close add column modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COLUMN_TYPES.map((item) => {
                const Icon = item.icon;
                const active = newColumnType === item.type;

                return (
                  <button
                    key={item.type}
                    onClick={() => {
                      setNewColumnType(item.type);
                      setNewColumnName(item.label);
                      setColumnModalError("");
                      if (item.type === "status") {
                        setNewColumnOptions("Not Started, Working on it, Done");
                      } else if (item.type === "dropdown") {
                        setNewColumnOptions("Option 1, Option 2, Option 3");
                      } else {
                        setNewColumnOptions("");
                      }
                      if (item.type === "numbers") {
                        setNewColumnUseFormula(false);
                        setNewColumnFormula("={Revenue}*0.8");
                      } else {
                        setNewColumnUseFormula(false);
                        setNewColumnFormula("");
                      }
                    }}
                    className={`group flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-indigo-400 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.35)]"
                        : "border-gray-700 bg-[#111827] text-gray-300 hover:border-indigo-500 hover:bg-[#172033] hover:text-white"
                    }`}
                  >
                    <div
                      className={`rounded-lg border p-2.5 transition ${
                        active
                          ? "border-indigo-300 bg-indigo-500/20 text-indigo-100"
                          : "border-gray-700 bg-black/20 text-indigo-300 group-hover:border-indigo-500"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-4 rounded-2xl border border-gray-800 bg-[#111827]/80 p-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Column name
              </label>
              <input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder={
                  newColumnType === "files"
                    ? "Files"
                    : newColumnType === "timeline"
                      ? "Timeline"
                      : newColumnType === "numbers"
                        ? "Numbers"
                        : newColumnType === "people"
                          ? "People"
                          : newColumnType === "date"
                            ? "Date"
                            : newColumnType === "text"
                              ? "Text"
                              : "Priority"
                }
                className="modal-input"
              />
            </div>

            {(newColumnType === "status" || newColumnType === "dropdown") ? (
              <div className="rounded-2xl border border-gray-800 bg-[#111827]/80 p-4">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Labels
                </label>
                <input
                  value={newColumnOptions}
                  onChange={(e) => setNewColumnOptions(e.target.value)}
                  placeholder="Option 1, Option 2"
                  className="modal-input"
                />
              </div>
            ) : null}

            {newColumnType === "numbers" ? (
              <div className="mt-4 rounded-2xl border border-gray-800 bg-[#111827]/80 p-4">
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-300">
                  <input
                    type="checkbox"
                    checked={newColumnUseFormula}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewColumnUseFormula(checked);
                      setColumnModalError("");
                    }}
                    className="h-4 w-4 rounded border-gray-600 bg-[#0b1220] text-indigo-500 focus:ring-indigo-400"
                  />
                  Use formula
                </label>

                {newColumnUseFormula ? (
                  <>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Formula
                    </label>
                    <input
                      value={newColumnFormula}
                      onChange={(e) => setNewColumnFormula(e.target.value)}
                      placeholder="={Revenue}*0.8"
                      className="modal-input"
                    />
                    <p className="mt-2 text-xs text-gray-400">
                      Example: <span className="text-gray-300">={"{Revenue}*0.8"}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">
                    Leave unchecked to create a regular numbers column.
                  </p>
                )}
              </div>
            ) : null}

            {columnModalError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {columnModalError}
              </div>
            ) : null}

            <div className="modal-actions">
              <button
                onClick={() => {
                  setColumnModalError("");
                  setShowColumnModal(false);
                }}
                disabled={creatingColumn}
                className="modal-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={createColumn}
                disabled={creatingColumn}
                className="modal-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creatingColumn ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </span>
                ) : (
                  "Add Column"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
