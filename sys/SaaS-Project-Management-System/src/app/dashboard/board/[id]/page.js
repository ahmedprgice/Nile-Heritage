"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import BoardTable from "@/app/dashboard/components/BoardTable";
import api from "@/lib/http";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Plus,
  Minus,
  Rows3,
  KanbanSquare,
  CalendarDays,
  GanttChartSquare,
  BarChart3,
  CircleAlert,
  X,
  Sparkles,
  Lightbulb,
  ChevronDown,
} from "lucide-react";

const BOARD_VIEWS = [
  { id: "table", label: "Main Table", icon: Rows3 },
  { id: "kanban", label: "Kanban", icon: KanbanSquare },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: GanttChartSquare },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

function getTaskCellText(task, columns) {
  const cellText = (columns || [])
    .map((column) => getTaskValueByColumn(task, column) ?? "")
    .join(" ");

  return `${task?.name || ""} ${cellText}`.toLowerCase();
}

function applyBoardSearch(board, query) {
  if (!board) return null;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return board;

  return {
    ...board,
    groups: (board.groups || [])
      .map((group) => ({
        ...group,
        tasks: (group.tasks || []).filter((task) =>
          getTaskCellText(task, board.columns).includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.tasks.length > 0),
  };
}

function applyBoardFilters(board, filters) {
  if (!board) return null;

  const hasStatusFilter = Boolean(filters.status);
  const hasPeopleFilter = Boolean(filters.people);

  if (!hasStatusFilter && !hasPeopleFilter) return board;

  const statusColumn = (board.columns || []).find(
    (column) => column.type === "status",
  );
  const peopleColumn = (board.columns || []).find(
    (column) => column.type === "people",
  );

  return {
    ...board,
    groups: (board.groups || [])
      .map((group) => ({
        ...group,
        tasks: (group.tasks || []).filter((task) => {
          const statusValue = statusColumn ? String(getTaskValueByColumn(task, statusColumn) || "") : "";
          const peopleValue = peopleColumn ? String(getTaskValueByColumn(task, peopleColumn) || "") : "";

          if (hasStatusFilter && statusValue !== filters.status) return false;
          if (hasPeopleFilter && peopleValue !== filters.people) return false;

          return true;
        }),
      }))
      .filter((group) => group.tasks.length > 0),
  };
}

function countTasksByColumnValue(board, predicate) {
  if (!board) return 0;

  return (board.groups || []).reduce((sum, group) => {
    return (
      sum +
      (group.tasks || []).filter((task) => {
        const statusColumn = (board.columns || []).find(
          (column) => column.type === "status",
        );
        if (!statusColumn) return false;
        return predicate(String(getTaskValueByColumn(task, statusColumn) || ""));
      }).length
    );
  }, 0);
}

function normalizeColumnPayload(payload) {
  if (!payload) return payload;

  return {
    ...payload,
    type:
      payload.type === "person"
        ? "people"
        : payload.type === "number"
          ? "numbers"
          : payload.type === "file"
            ? "files"
            : payload.type === "timeLine"
              ? "timeline"
              : payload.type,
  };
}

function getDefaultValueForColumn(column) {
  if (!column) return "";
  if (column.type === "status" || column.type === "dropdown") {
    return column.options?.[0] || "";
  }
  return "";
}

function buildOptimisticTaskValues(columns = []) {
  return (columns || []).reduce((acc, column) => {
    const key = String(column?._id || "");
    if (!key) return acc;
    acc[key] = getDefaultValueForColumn(column);
    return acc;
  }, {});
}

function createTempId(prefix = "tmp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toPlainObjectMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value?.toObject === "function") return value.toObject();
  if (typeof value?.entries === "function") return Object.fromEntries(value.entries());
  return typeof value === "object" ? { ...value } : {};
}

function hydrateBoardValuesFromColumnData(rawBoard) {
  if (!rawBoard) return rawBoard;

  const board = rawBoard.board || rawBoard;
  if (!board || typeof board !== "object") return board;

  const columns = (board.columns || []).map((column) => ({
    ...column,
    data: toPlainObjectMap(column?.data),
  }));

  const groups = (board.groups || []).map((group) => ({
    ...group,
    tasks: (group.tasks || []).map((task) => {
      const taskId = String(task?._id || "");
      const values = toPlainObjectMap(task?.values);
      const nextValues = { ...values };

      columns.forEach((column) => {
        const columnId = String(column?._id || "");
        if (!columnId || !taskId) return;
        if (Object.prototype.hasOwnProperty.call(nextValues, columnId)) return;
        const fallbackFromColumnData = column.data?.[taskId];
        if (fallbackFromColumnData !== undefined) {
          nextValues[columnId] = fallbackFromColumnData;
          return;
        }

        const columnName = String(column?.name || "").trim();
        if (!columnName) return;
        if (Object.prototype.hasOwnProperty.call(nextValues, columnName)) {
          nextValues[columnId] = nextValues[columnName];
          return;
        }

        const lowerName = columnName.toLowerCase();
        const matchedNameKey = Object.keys(nextValues).find(
          (valueKey) => String(valueKey || "").trim().toLowerCase() === lowerName,
        );
        if (matchedNameKey) {
          nextValues[columnId] = nextValues[matchedNameKey];
        }
      });

      return {
        ...task,
        values: nextValues,
      };
    }),
  }));

  return {
    ...board,
    columns,
    groups,
  };
}

function isFilesColumn(column) {
  return column?.type === "files" || (column?.type === "text" && /^files?$/i.test(column?.name || ""));
}

function isTimelineColumn(column) {
  return column?.type === "timeline" || (column?.type === "text" && /^timeline$/i.test(column?.name || ""));
}

function isDateColumn(column) {
  if (column?.type === "date") return true;
  if (column?.type !== "text") return false;
  const name = String(column?.name || "").trim().toLowerCase();
  return /(^date$|due date|start date|end date|deadline)/i.test(name);
}

function flattenBoardTasks(board) {
  if (!board) return [];

  return (board.groups || []).flatMap((group) =>
    (group.tasks || []).map((task) => ({
      ...task,
      groupId: group._id,
      groupTitle: group.title,
    })),
  );
}

function getBoardViewColumns(board) {
  const columns = board?.columns || [];
  return {
    status: columns.find((column) => column.type === "status"),
    people: columns.find((column) => column.type === "people"),
    date: columns.find(isDateColumn),
    timeline: columns.find(isTimelineColumn),
    files: columns.find(isFilesColumn),
  };
}

function getTaskStatus(task, columns) {
  if (!columns.status) return "Not Started";
  const raw = getTaskValueByColumn(task, columns.status);
  return raw || columns.status.options?.[0] || "Not Started";
}

function getTaskAssignee(task, columns) {
  if (!columns.people) return "";
  return String(getTaskValueByColumn(task, columns.people) || "");
}

function parseTimeline(value) {
  const source = String(value || "").trim();
  if (!source) return { start: "", end: "" };
  const match = source.match(/\s(?:-|to|->|→)\s/i);
  if (!match) return { start: source, end: source };
  const [start = "", end = ""] = source.split(match[0]);
  return { start, end };
}

function normalizeDateInput(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateKey(value);

  const raw = String(value).trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const isoSlashMatch = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (isoSlashMatch) {
    const [, y, m, d] = isoSlashMatch;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const mdyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return formatDateKey(parsed);
  return "";
}

function getTaskSchedule(task, columns) {
  const timelineValue = columns.timeline ? getTaskValueByColumn(task, columns.timeline) : "";
  const parsedTimeline = parseTimeline(timelineValue);
  const dateValue = columns.date ? getTaskValueByColumn(task, columns.date) : "";
  const start = normalizeDateInput(parsedTimeline.start || dateValue || "");
  const end = normalizeDateInput(parsedTimeline.end || parsedTimeline.start || dateValue || "");
  return { start, end };
}

function formatDisplayDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function findColumnByName(board, names) {
  const set = Array.isArray(names) ? names : [names];
  return (board?.columns || []).find((column) =>
    set.some((name) => (column?.name || "").toLowerCase() === name.toLowerCase()),
  );
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function getTaskValueByColumn(task, columnRef) {
  if (!task || !columnRef) return "";
  const values = toPlainObjectMap(task.values);
  const valueKeys = Object.keys(values);

  if (typeof columnRef === "string") {
    const rawKey = String(columnRef || "");
    if (!rawKey) return "";
    if (values?.[rawKey] !== undefined) return values[rawKey];
    const normalizedRawKey = rawKey.trim().toLowerCase();
    const matchedRawKey = valueKeys.find(
      (valueKey) => String(valueKey || "").trim().toLowerCase() === normalizedRawKey,
    );
    return matchedRawKey ? values[matchedRawKey] : "";
  }

  const key = String(columnRef?._id || "");
  if (key && values?.[key] !== undefined) return values[key];
  if (columnRef?._id && values?.[columnRef._id] !== undefined) return values[columnRef._id];
  if (key) {
    const normalizedKey = key.trim().toLowerCase();
    const matchedKey = valueKeys.find(
      (valueKey) => String(valueKey || "").trim().toLowerCase() === normalizedKey,
    );
    if (matchedKey) return values[matchedKey];
  }

  const columnName = String(columnRef?.name || "").trim();
  if (columnName) {
    if (values?.[columnName] !== undefined) return values[columnName];
    const lowerName = columnName.toLowerCase();
    if (values?.[lowerName] !== undefined) return values[lowerName];
    const matchedNameKey = valueKeys.find(
      (valueKey) => String(valueKey || "").trim().toLowerCase() === lowerName,
    );
    if (matchedNameKey) return values[matchedNameKey];
  }

  return "";
}

function escapeCsvValue(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function buildCsvRowsForBoard(board) {
  if (!board) return [];

  const dataColumns = board.columns || [];
  const rawCategory = String(board?.category || "").trim().toLowerCase();
  const fallbackItemName =
    rawCategory === "tasks" || rawCategory.includes("task") ? "Task" : "Item";
  const itemColumnLabel = String(board?.itemColumnName || fallbackItemName).trim() || fallbackItemName;
  const includeItem = board?.itemColumnVisible !== false;
  const itemPosition = Number.isFinite(Number(board?.itemColumnPosition))
    ? Math.max(0, Math.min(Number(board?.itemColumnPosition), dataColumns.length))
    : 0;

  const orderedColumns = includeItem
    ? [
        ...dataColumns.slice(0, itemPosition).map((column) => ({ type: "data", column })),
        { type: "item", name: itemColumnLabel },
        ...dataColumns.slice(itemPosition).map((column) => ({ type: "data", column })),
      ]
    : dataColumns.map((column) => ({ type: "data", column }));

  const header = ["Group", ...orderedColumns.map((entry) => {
    if (entry.type === "item") return itemColumnLabel;
    return String(entry.column?.name || "Column");
  })];

  const rows = [header];

  (board.groups || []).forEach((group) => {
    (group.tasks || []).forEach((task) => {
      const row = [String(group?.title || "Untitled Group")];

      orderedColumns.forEach((entry) => {
        if (entry.type === "item") {
          row.push(String(task?.name || ""));
          return;
        }
        row.push(String(getTaskValueByColumn(task, entry.column) || ""));
      });

      rows.push(row);
    });
  });

  return rows;
}

function resolveAnalyticsItemLabel(task, itemColumn, board) {
  const valueFromColumn = String(getTaskValueByColumn(task, itemColumn) || "").trim();
  if (valueFromColumn) return valueFromColumn;

  const rawCategory = String(board?.category || "").trim().toLowerCase();
  const fallbackName =
    rawCategory === "tasks" || rawCategory.includes("task") ? "Task" : "Item";
  const itemColumnName = String(board?.itemColumnName || fallbackName).trim().toLowerCase();
  if (itemColumnName === "item") {
    return String(task?.name || "").trim();
  }

  return "";
}

function AnalyticsMissingOverlay({ labels = [] }) {
  if (!labels.length) return null;

  const uniqueLabels = [...new Set(labels.filter(Boolean))];
  if (!uniqueLabels.length) return null;

  const labelText = uniqueLabels.join(" and ");
  const suffix = uniqueLabels.length > 1 ? "columns" : "column";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-dashed border-indigo-400/40 bg-[#0b1220]/60 px-4 text-center backdrop-blur-[2px]">
      <p className="text-sm font-medium text-indigo-100">
        Add {labelText} {suffix} to see this chart.
      </p>
    </div>
  );
}

function KpiMeter({ value = 0, total = 1, color = "from-indigo-500 to-cyan-400" }) {
  const safeTotal = total > 0 ? total : 1;
  const width = Math.max(8, Math.min(100, (Math.max(0, value) / safeTotal) * 100));
  return (
    <div className="mt-3 h-2.5 rounded-full bg-[#0f172a]">
      <div
        className={`h-2.5 rounded-full bg-gradient-to-r ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function BoardAnalyticsView({ board }) {
  const [topRevenueNameWidth, setTopRevenueNameWidth] = useState(160);
  const [isChartBuilderOpen, setIsChartBuilderOpen] = useState(false);
  const [isInsightMenuOpen, setIsInsightMenuOpen] = useState(false);
  const [timeWindow, setTimeWindow] = useState("30d");
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [customCharts, setCustomCharts] = useState([]);
  const [chartDraft, setChartDraft] = useState({
    type: "kpi_total",
    columnId: "",
    title: "",
  });
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const updateTheme = () => {
      const bodyClasses = document.body.classList;
      setIsLightTheme(
        bodyClasses.contains("light-theme") || !bodyClasses.contains("dark-theme"),
      );
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const handleTopRevenueResizeStart = useCallback(
    (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = topRevenueNameWidth;

      const handleMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        setTopRevenueNameWidth(Math.max(120, Math.min(420, startWidth + delta)));
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    },
    [topRevenueNameWidth],
  );
  const allTasks = useMemo(() => flattenBoardTasks(board), [board]);
  const primaryDateColumn = useMemo(
    () => (board?.columns || []).find((column) => isDateColumn(column)),
    [board],
  );
  const getTaskDateStamp = useCallback(
    (task) => {
      if (!primaryDateColumn) return null;
      const raw = getTaskValueByColumn(task, primaryDateColumn);
      const normalized = normalizeDateInput(raw);
      if (!normalized) return null;
      const date = new Date(`${normalized}T00:00:00`);
      const time = date.getTime();
      return Number.isFinite(time) ? time : null;
    },
    [primaryDateColumn],
  );
  const tasks = useMemo(() => {
    if (timeWindow === "all" || !primaryDateColumn) return allTasks;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const days = timeWindow === "7d" ? 7 : timeWindow === "90d" ? 90 : 30;
    const start = end - (days - 1) * 24 * 60 * 60 * 1000;
    return allTasks.filter((task) => {
      const stamp = getTaskDateStamp(task);
      return stamp !== null && stamp >= start && stamp <= end;
    });
  }, [allTasks, getTaskDateStamp, primaryDateColumn, timeWindow]);
  const parseMetricValue = useCallback((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = String(value).trim();
    if (!text) return null;
    const cleaned = text.replace(/[^\d.-]/g, "");
    if (!/\d/.test(cleaned)) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);
  const hasNumericValueInColumn = useCallback(
    (column) =>
      allTasks.some((task) => parseMetricValue(getTaskValueByColumn(task, column)) !== null),
    [allTasks, parseMetricValue],
  );
  const metricCandidateColumns = useMemo(
    () =>
      (board?.columns || []).filter(
        (column) =>
          !isFilesColumn(column) &&
          !isTimelineColumn(column) &&
          !isDateColumn(column) &&
          column?.type !== "status" &&
          column?.type !== "people" &&
          column?.type !== "dropdown",
      ),
    [board],
  );
  const numericColumns = useMemo(
    () =>
      metricCandidateColumns.filter(
        (column) => column?.type === "numbers" || hasNumericValueInColumn(column),
      ),
    [hasNumericValueInColumn, metricCandidateColumns],
  );
  const itemLabelColumn = findColumnByName(board, ["item", "name", "title", "deal name", "customer"]);
  const rawCategory = String(board?.category || "").trim().toLowerCase();
  const fallbackItemName =
    rawCategory === "tasks" || rawCategory.includes("task") ? "Task" : "Item";
  const hasItemNameColumn =
    String(board?.itemColumnName || fallbackItemName).trim().toLowerCase() === "item";
  const financialColumns = useMemo(() => {
    const aliases = {
      revenue: [
        "revenue",
        "sales",
        "income",
        "amount",
        "value",
        "gmv",
        "turnover",
      ],
      expenses: [
        "expenses",
        "expense",
        "cost",
        "costs",
        "spend",
        "spending",
        "cogs",
      ],
      profit: [
        "profit",
        "net profit",
        "net",
        "earnings",
        "gross profit",
        "margin",
      ],
    };

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const scoreColumn = (column, terms) => {
      const name = normalize(column?.name);
      if (!name) return -1;
      let score = -1;
      terms.forEach((term, index) => {
        if (name === term) score = Math.max(score, 120 - index);
        else if (name.includes(term)) score = Math.max(score, 80 - index);
      });
      if (score < 0) return score;
      if (column?.type === "numbers") score += 20;
      if (hasNumericValueInColumn(column)) score += 10;
      return score;
    };

    const used = new Set();
    const pick = (type) => {
      const ranked = numericColumns
        .map((column) => ({ column, score: scoreColumn(column, aliases[type]) }))
        .filter((entry) => entry.score >= 0 && !used.has(String(entry.column?._id)))
        .sort((a, b) => b.score - a.score);
      const chosen = ranked[0]?.column || null;
      if (chosen?._id) used.add(String(chosen._id));
      return chosen;
    };

    const revenue = pick("revenue");
    const expenses = pick("expenses");
    const profit = pick("profit");

    return { revenue, expenses, profit };
  }, [hasNumericValueInColumn, numericColumns]);
  const revenueColumn = financialColumns.revenue;
  const expensesColumn = financialColumns.expenses;
  const profitColumn = financialColumns.profit;
  const hasItemColumn = Boolean(itemLabelColumn || hasItemNameColumn);

  const readMetric = useCallback((task, column) => {
    if (!task || !column) return null;
    const raw = getTaskValueByColumn(task, column);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string" && raw.trim() === "") return null;
    return parseMetricValue(raw);
  }, [parseMetricValue]);

  const extractFinancials = useCallback(
    (task) => {
      let revenue = readMetric(task, revenueColumn);
      let expenses = readMetric(task, expensesColumn);
      let profit = readMetric(task, profitColumn);

      if (profit === null && revenue !== null && expenses !== null) {
        profit = revenue - expenses;
      }
      if (expenses === null && revenue !== null && profit !== null) {
        expenses = revenue - profit;
      }
      if (revenue === null && profit !== null && expenses !== null) {
        revenue = profit + expenses;
      }

      return {
        revenue: revenue ?? 0,
        expenses: expenses ?? 0,
        profit: profit ?? 0,
        hasRevenue: revenue !== null,
        hasExpenses: expenses !== null,
        hasProfit: profit !== null,
      };
    },
    [expensesColumn, profitColumn, readMetric, revenueColumn],
  );

  const totals = tasks.reduce(
    (acc, task) => {
      const financials = extractFinancials(task);
      acc.revenue += financials.revenue;
      acc.expenses += financials.expenses;
      acc.profit += financials.profit;
      return acc;
    },
    { revenue: 0, expenses: 0, profit: 0 },
  );
  const previousPeriodTasks = useMemo(() => {
    if (!primaryDateColumn || timeWindow === "all") return [];
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const windowDays = timeWindow === "7d" ? 7 : timeWindow === "90d" ? 90 : 30;
    const currentStart = end - (windowDays - 1) * 24 * 60 * 60 * 1000;
    const previousEnd = currentStart - 1;
    const previousStart = previousEnd - (windowDays - 1) * 24 * 60 * 60 * 1000;

    return allTasks.filter((task) => {
      const stamp = getTaskDateStamp(task);
      return stamp !== null && stamp >= previousStart && stamp <= previousEnd;
    });
  }, [allTasks, getTaskDateStamp, primaryDateColumn, timeWindow]);
  const previousTotals = useMemo(
    () =>
      previousPeriodTasks.reduce(
        (acc, task) => {
          const financials = extractFinancials(task);
          acc.revenue += financials.revenue;
          acc.expenses += financials.expenses;
          acc.profit += financials.profit;
          return acc;
        },
        { revenue: 0, expenses: 0, profit: 0 },
      ),
    [extractFinancials, previousPeriodTasks],
  );
  const formatDeltaPercent = useCallback((current, previous, inverse = false) => {
    if (!Number.isFinite(previous) || previous === 0) return null;
    const raw = ((current - previous) / Math.abs(previous)) * 100;
    const adjusted = inverse ? -raw : raw;
    return Number.isFinite(adjusted) ? adjusted : null;
  }, []);
  const kpiComparisons = useMemo(
    () => ({
      revenue: formatDeltaPercent(totals.revenue, previousTotals.revenue),
      profit: formatDeltaPercent(totals.profit, previousTotals.profit),
      expenses: formatDeltaPercent(totals.expenses, previousTotals.expenses, true),
    }),
    [formatDeltaPercent, previousTotals.expenses, previousTotals.profit, previousTotals.revenue, totals.expenses, totals.profit, totals.revenue],
  );
  const hasComparisonBaseline =
    previousTotals.revenue > 0 || previousTotals.expenses > 0 || previousTotals.profit > 0;
  const periodLabel =
    timeWindow === "7d" ? "Last 7 days" : timeWindow === "90d" ? "Last 90 days" : timeWindow === "30d" ? "Last 30 days" : "All time";

  const aggregatedItems = !hasItemColumn
    ? []
    : Object.values(
        tasks.reduce((acc, task) => {
          const normalizedItemNameSource = resolveAnalyticsItemLabel(task, itemLabelColumn, board);
          const normalizedName = normalizedItemNameSource.trim().replace(/\s+/g, " ").toLowerCase();
          if (!normalizedName) return acc;

          const { revenue, expenses, profit } = extractFinancials(task);

          if (!acc[normalizedName]) {
            acc[normalizedName] = {
              id: normalizedName,
              name: normalizedItemNameSource.trim().replace(/\s+/g, " "),
              revenue: 0,
              expenses: 0,
              profit: 0,
            };
          }

          acc[normalizedName].revenue += revenue;
          acc[normalizedName].expenses += expenses;
          acc[normalizedName].profit += profit;

          return acc;
        }, {}),
      );

  const topRevenue = aggregatedItems
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      value: entry.revenue,
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const aggregatedByRevenue = [...aggregatedItems].sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = topRevenue[0]?.value || 1;

  const byItemBreakdown =
    !hasItemColumn
      ? []
      : topRevenue.length
        ? topRevenue
        : aggregatedByRevenue
            .slice(0, 6)
            .map((entry, index) => ({
              id: entry.id || `item-${index}`,
              name: entry.name,
              value: entry.revenue,
            }))
            .filter((entry) => entry.name);
  const maxBreakdownValue = Math.max(
    1,
    ...byItemBreakdown.map((entry) => entry.value),
  );

  const profitByItem = aggregatedItems
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      value: entry.profit,
    }))
    .filter((entry) => entry.value > 0 && entry.name)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const maxProfitValue = profitByItem[0]?.value || 1;

  const itemFinancials = aggregatedItems.map((entry, index) => {
    const margin = entry.revenue > 0 ? (entry.profit / entry.revenue) * 100 : 0;
    return {
      id: entry.id || `financial-${index}`,
      name: entry.name,
      revenue: entry.revenue,
      expenses: entry.expenses,
      profit: entry.profit,
      margin,
    };
  });

  const marginHeatmapItems = itemFinancials
    .filter((entry) => entry.name)
    .filter((entry) => entry.revenue > 0 || entry.expenses > 0 || entry.profit !== 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 8);

  const waterfallMax = Math.max(
    1,
    totals.revenue,
    totals.expenses,
    Math.abs(totals.profit),
  );
  const financialTotal = Math.max(
    1,
    totals.revenue + totals.expenses + Math.max(totals.profit, 0),
  );

  const canResolveRevenue = Boolean(revenueColumn || (profitColumn && expensesColumn));
  const canResolveExpenses = Boolean(expensesColumn || (revenueColumn && profitColumn));
  const canResolveProfit = Boolean(profitColumn || (revenueColumn && expensesColumn));

  const missing = {
    item: !hasItemColumn,
    revenue: !canResolveRevenue,
    expenses: !canResolveExpenses,
    profit: !canResolveProfit,
  };
  const marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const topRevenueShare = totals.revenue > 0 ? ((topRevenue[0]?.value || 0) / totals.revenue) * 100 : 0;
  const dataCoverage = allTasks.length > 0 ? (tasks.length / allTasks.length) * 100 : 100;
  const smartAlerts = (() => {
    const alerts = [];
    if (missing.revenue) {
      alerts.push({
        id: "missing-revenue",
        tone: "critical",
        title: "Revenue metric is missing",
        description: "Add or map a Revenue column so totals and trends are accurate.",
        action: "Create a numeric Revenue column and map imported values.",
      });
    }
    if (missing.expenses) {
      alerts.push({
        id: "missing-expenses",
        tone: "warning",
        title: "Expenses data is incomplete",
        description: "Profit-quality analytics are limited without expenses.",
        action: "Track expenses per row or connect your cost source.",
      });
    }
    if (totals.profit < 0) {
      alerts.push({
        id: "negative-profit",
        tone: "critical",
        title: "Business is currently unprofitable",
        description: `Profit is ${totals.profit.toLocaleString()} for ${periodLabel}.`,
        action: "Review top expense drivers and reduce low-margin activities this week.",
      });
    }
    if (totals.revenue > 0 && totals.expenses / totals.revenue > 0.75) {
      alerts.push({
        id: "high-cost-ratio",
        tone: "warning",
        title: "Cost ratio is high",
        description: `Expenses are ${((totals.expenses / totals.revenue) * 100).toFixed(1)}% of revenue.`,
        action: "Set a cost ceiling alert and monitor the largest spend rows daily.",
      });
    }
    if (topRevenueShare > 45) {
      alerts.push({
        id: "concentration-risk",
        tone: "warning",
        title: "Revenue concentration risk",
        description: `Top item contributes ${topRevenueShare.toFixed(1)}% of total revenue.`,
        action: "Diversify pipeline and track contribution share by top 5 items.",
      });
    }
    if (timeWindow !== "all" && dataCoverage < 60) {
      alerts.push({
        id: "low-coverage",
        tone: "info",
        title: "Low date coverage for selected period",
        description: `${dataCoverage.toFixed(1)}% of rows have dates inside ${periodLabel.toLowerCase()}.`,
        action: "Ensure date fields are filled so trend analytics remain reliable.",
      });
    }
    return alerts;
  })();
  const executiveSummary = (() => {
    const highlights = [];
    highlights.push(
      `Revenue is ${totals.revenue.toLocaleString()} and profit is ${totals.profit.toLocaleString()} for ${periodLabel.toLowerCase()}.`,
    );
    if (hasComparisonBaseline) {
      const rev = kpiComparisons.revenue;
      const prof = kpiComparisons.profit;
      if (rev !== null) {
        highlights.push(`Revenue ${rev >= 0 ? "increased" : "decreased"} ${Math.abs(rev).toFixed(1)}% versus previous period.`);
      }
      if (prof !== null) {
        highlights.push(`Profit ${prof >= 0 ? "improved" : "declined"} ${Math.abs(prof).toFixed(1)}% versus previous period.`);
      }
    }
    if (topRevenue[0]) {
      highlights.push(`Top revenue driver is ${topRevenue[0].name} at ${topRevenue[0].value.toLocaleString()}.`);
    }
    if (totals.revenue > 0) {
      highlights.push(`Operating margin is ${marginPercent.toFixed(1)}% in the selected window.`);
    }
    if (smartAlerts[0]) {
      highlights.push(`Primary risk: ${smartAlerts[0].title.toLowerCase()}.`);
    } else {
      highlights.push("No critical risks detected from current board data.");
    }
    return highlights.slice(0, 4);
  })();
  const kpiHealth = useMemo(() => {
    const targetRevenue = previousTotals.revenue > 0 ? previousTotals.revenue * 1.1 : totals.revenue;
    const targetProfit = previousTotals.profit > 0 ? previousTotals.profit * 1.1 : totals.profit;
    const targetExpenses = previousTotals.expenses > 0 ? previousTotals.expenses * 0.95 : totals.expenses;

    return {
      revenue: {
        target: targetRevenue,
        variance: totals.revenue - targetRevenue,
        onTrack: totals.revenue >= targetRevenue,
      },
      profit: {
        target: targetProfit,
        variance: totals.profit - targetProfit,
        onTrack: totals.profit >= targetProfit,
      },
      expenses: {
        target: targetExpenses,
        variance: targetExpenses - totals.expenses,
        onTrack: totals.expenses <= targetExpenses,
      },
    };
  }, [previousTotals.expenses, previousTotals.profit, previousTotals.revenue, totals.expenses, totals.profit, totals.revenue]);

  useEffect(() => {
    const boardId = String(board?._id || "");
    let cancelled = false;

    const loadCustomCharts = async () => {
      if (!boardId) {
        if (!cancelled) setCustomCharts([]);
        return;
      }

      try {
        const raw = window.localStorage.getItem(`nexora_custom_analytics_${boardId}`);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!cancelled) {
          setCustomCharts(Array.isArray(parsed) ? parsed : []);
        }
      } catch {
        if (!cancelled) setCustomCharts([]);
      }
    };

    loadCustomCharts();
    return () => {
      cancelled = true;
    };
  }, [board?._id]);

  useEffect(() => {
    const boardId = String(board?._id || "");
    if (!boardId) return;
    try {
      window.localStorage.setItem(
        `nexora_custom_analytics_${boardId}`,
        JSON.stringify(customCharts),
      );
    } catch {
      // Ignore localStorage failures; charts still work during session.
    }
  }, [board?._id, customCharts]);

  const addCustomChart = useCallback(() => {
    const selectedColumn = numericColumns.find(
      (column) => String(column?._id) === String(chartDraft.columnId),
    );
    if (!selectedColumn) return;

    const defaultTitle =
      chartDraft.type === "top_by_item"
        ? `Top ${selectedColumn.name} by Item`
        : `Total ${selectedColumn.name}`;
    const title = String(chartDraft.title || "").trim() || defaultTitle;

    setCustomCharts((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: chartDraft.type,
        columnId: String(selectedColumn._id),
        title,
      },
    ]);

    setChartDraft({
      type: "kpi_total",
      columnId: "",
      title: "",
    });
    setIsChartBuilderOpen(false);
  }, [chartDraft, numericColumns]);

  const removeCustomChart = useCallback((chartId) => {
    setCustomCharts((prev) => prev.filter((chart) => chart.id !== chartId));
  }, []);

  const aggregateByItemForColumn = (columnId) => {
    if ((!itemLabelColumn && !hasItemNameColumn) || !columnId) return [];
    return Object.values(
      tasks.reduce((acc, task) => {
        const rawName = resolveAnalyticsItemLabel(task, itemLabelColumn, board);
        const normalizedName = rawName.trim().replace(/\s+/g, " ").toLowerCase();
        if (!normalizedName) return acc;
        const value = parseMetricValue(getTaskValueByColumn(task, columnId));
        if (!Number.isFinite(value) || value <= 0) return acc;

        if (!acc[normalizedName]) {
          acc[normalizedName] = {
            id: normalizedName,
            name: rawName.trim().replace(/\s+/g, " "),
            value: 0,
          };
        }
        acc[normalizedName].value += value;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const insightTemplates = useMemo(() => {
    const revenue = revenueColumn;
    const profit = profitColumn;
    const expenses = expensesColumn;
    const templates = [];

    if (revenue) {
      templates.push({
        id: "top-revenue",
        label: "Top Revenue Drivers",
        helper: "Top-by-item chart for revenue",
        type: "top_by_item",
        columnId: String(revenue._id),
      });
      templates.push({
        id: "total-revenue",
        label: "Revenue KPI",
        helper: "Single total KPI for revenue",
        type: "kpi_total",
        columnId: String(revenue._id),
      });
    }

    if (profit) {
      templates.push({
        id: "top-profit",
        label: "Top Profit Contributors",
        helper: "Top-by-item chart for profit",
        type: "top_by_item",
        columnId: String(profit._id),
      });
      templates.push({
        id: "total-profit",
        label: "Profit KPI",
        helper: "Single total KPI for profit",
        type: "kpi_total",
        columnId: String(profit._id),
      });
    }

    if (expenses) {
      templates.push({
        id: "expense-watch",
        label: "Expense Watchlist",
        helper: "Top-by-item chart for expenses",
        type: "top_by_item",
        columnId: String(expenses._id),
      });
    }

    return templates;
  }, [expensesColumn, profitColumn, revenueColumn]);

  const applyInsightTemplate = useCallback((template) => {
    if (!template?.columnId) return;
    setChartDraft({
      type: template.type,
      columnId: template.columnId,
      title: template.label,
    });
    setIsInsightMenuOpen(false);
    setIsChartBuilderOpen(true);
  }, []);

  return (
    <section className="space-y-5">
      {isChartBuilderOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
          onClick={() => setIsChartBuilderOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-700/90 bg-[#111827] shadow-[0_22px_50px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-800 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
                  <Sparkles size={15} />
                </span>
                <div>
                  <h4 className="text-base font-semibold text-white">Add Custom Chart</h4>
                  <p className="mt-1 text-sm text-gray-400">Create a new analytics card from board data.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChartBuilderOpen(false)}
                className="rounded-md border border-gray-700 p-1.5 text-gray-400 transition hover:text-white"
                aria-label="Close add chart modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Chart type</label>
                <div className="relative">
                  <select
                    value={chartDraft.type}
                    onChange={(e) => setChartDraft((prev) => ({ ...prev, type: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-gray-700 bg-[#0f172a] px-3 pr-10 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="kpi_total">KPI Total</option>
                    <option value="top_by_item">Top by Item</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Metric column</label>
                <div className="relative">
                  <select
                    value={chartDraft.columnId}
                    onChange={(e) => setChartDraft((prev) => ({ ...prev, columnId: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-gray-700 bg-[#0f172a] px-3 pr-10 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a number column</option>
                    {numericColumns.map((column) => (
                      <option key={column._id} value={column._id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">Title (optional)</label>
                <input
                  type="text"
                  value={chartDraft.title}
                  onChange={(e) => setChartDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Total Pipeline Value"
                  className="w-full rounded-lg border border-gray-700 bg-[#0f172a] px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsChartBuilderOpen(false)}
                className="rounded-lg border border-gray-700 px-3.5 py-2 text-sm font-medium text-gray-300 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addCustomChart}
                disabled={!chartDraft.columnId}
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Chart
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#111827] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Live Business Analytics</p>
          <p className="text-xs text-gray-400">
            Window: {periodLabel} {primaryDateColumn ? `• Based on ${primaryDateColumn.name}` : "• No date column (all rows)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">Time Range</label>
          <select
            value={timeWindow}
            onChange={(event) => setTimeWindow(event.target.value)}
            className="h-9 rounded-lg border border-gray-700 bg-[#0f172a] px-2.5 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-300" />
            <h3 className="text-sm font-semibold text-white">Executive Summary</h3>
          </div>
          <div className="space-y-2">
            {executiveSummary.map((line, index) => (
              <p key={`${line}_${index}`} className="text-sm text-gray-200">
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <div className="mb-3 flex items-center gap-2">
            <CircleAlert size={14} className="text-amber-300" />
            <h3 className="text-sm font-semibold text-white">Smart Alerts & Actions</h3>
          </div>
          <div className="space-y-2">
            {smartAlerts.length ? (
              smartAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-gray-700/80 bg-[#0f172a] p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">{alert.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{alert.description}</p>
                  <p className="mt-1.5 text-xs text-indigo-200">Action: {alert.action}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-300">No active alerts. Your key business metrics look stable.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-white">{totals.revenue.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-400">Top-line sales generated.</p>
          <p className="mt-1 text-xs text-indigo-200">
            {hasComparisonBaseline && kpiComparisons.revenue !== null
              ? `${kpiComparisons.revenue >= 0 ? "▲" : "▼"} ${Math.abs(kpiComparisons.revenue).toFixed(1)}% vs previous period`
              : "No previous period baseline"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Target: {kpiHealth.revenue.target.toLocaleString()} • {kpiHealth.revenue.onTrack ? "On track" : "At risk"}
          </p>
          <KpiMeter value={totals.revenue} total={financialTotal} color="from-cyan-400 to-indigo-500" />
          <AnalyticsMissingOverlay labels={missing.revenue ? ["Revenue"] : []} />
        </div>
        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total Profit</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{totals.profit.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-400">Net gain after expenses.</p>
          <p className="mt-1 text-xs text-emerald-200">
            {hasComparisonBaseline && kpiComparisons.profit !== null
              ? `${kpiComparisons.profit >= 0 ? "▲" : "▼"} ${Math.abs(kpiComparisons.profit).toFixed(1)}% vs previous period`
              : "No previous period baseline"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Target: {kpiHealth.profit.target.toLocaleString()} • {kpiHealth.profit.onTrack ? "On track" : "At risk"}
          </p>
          <KpiMeter value={Math.max(0, totals.profit)} total={financialTotal} color="from-emerald-400 to-lime-400" />
          <AnalyticsMissingOverlay labels={missing.profit ? ["Profit"] : []} />
        </div>
        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{totals.expenses.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-400">Operational and delivery costs.</p>
          <p className="mt-1 text-xs text-amber-200">
            {hasComparisonBaseline && kpiComparisons.expenses !== null
              ? `${kpiComparisons.expenses >= 0 ? "▲" : "▼"} ${Math.abs(kpiComparisons.expenses).toFixed(1)}% efficiency vs previous period`
              : "No previous period baseline"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Target: {kpiHealth.expenses.target.toLocaleString()} • {kpiHealth.expenses.onTrack ? "On track" : "At risk"}
          </p>
          <KpiMeter value={totals.expenses} total={financialTotal} color="from-amber-400 to-orange-500" />
          <AnalyticsMissingOverlay labels={missing.expenses ? ["Expenses"] : []} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-white">Top Revenue Items</h3>
          <div className="mt-4 relative">
            <div
              className="pointer-events-none absolute bottom-0 top-8 w-px bg-gray-700/80"
              style={{ left: `${topRevenueNameWidth + 8}px` }}
            />
            <div className="mb-3 flex items-center gap-2">
              <div
                className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400"
                style={{ width: `${topRevenueNameWidth}px` }}
              >
                Item
              </div>
              <button
                type="button"
                onPointerDown={handleTopRevenueResizeStart}
                className="inline-flex h-6 w-4 shrink-0 cursor-col-resize items-center justify-center rounded-sm border border-gray-700 bg-[#0f172a] text-[9px] leading-none text-gray-300 transition hover:border-gray-500 hover:text-white"
                aria-label="Drag to resize split between item and data"
                title="Drag to resize split between item and data"
              >
                ||
              </button>
              <div className="flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Revenue
              </div>
              <div className="w-20 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Value
              </div>
            </div>
            <div className="space-y-3">
            {topRevenue.length ? (
              topRevenue.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <div
                    className="shrink-0 truncate text-sm text-gray-300"
                    style={{ width: `${topRevenueNameWidth}px` }}
                    title={entry.name}
                  >
                    {entry.name}
                  </div>
                  <div className="w-2 shrink-0" />
                  <div className="relative h-2 flex-1 rounded-full bg-[#0f172a]">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      style={{ width: `${Math.max(6, (entry.value / maxRevenue) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm text-gray-300">{entry.value.toLocaleString()}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">Add revenue values to see analytics.</p>
            )}
            </div>
          </div>
          <AnalyticsMissingOverlay
            labels={[
              ...(missing.item ? ["Item"] : []),
              ...(missing.revenue ? ["Revenue"] : []),
            ]}
          />
        </div>

        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-white">Revenue to Profit Waterfall</h3>
          <p className="mt-1 text-xs text-gray-400">Flow from top-line revenue to bottom-line profit.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Revenue</p>
              <p className="mt-1 text-sm font-semibold text-cyan-300">{totals.revenue.toLocaleString()}</p>
              <div className="mt-2 h-2 rounded-full bg-[#0b1220]">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                  style={{ width: `${Math.max(8, (totals.revenue / waterfallMax) * 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">- Expenses</p>
              <p className="mt-1 text-sm font-semibold text-amber-300">{totals.expenses.toLocaleString()}</p>
              <div className="mt-2 h-2 rounded-full bg-[#0b1220]">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${Math.max(8, (totals.expenses / waterfallMax) * 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">= Profit</p>
              <p className="mt-1 text-sm font-semibold text-emerald-300">{totals.profit.toLocaleString()}</p>
              <div className="mt-2 h-2 rounded-full bg-[#0b1220]">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-lime-400"
                  style={{ width: `${Math.max(8, (Math.abs(totals.profit) / waterfallMax) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <AnalyticsMissingOverlay
            labels={[
              ...(missing.expenses ? ["Expenses"] : []),
              ...(missing.profit ? ["Profit"] : []),
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="relative flex h-full min-h-[430px] flex-col rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-white">Total Profit by Item</h3>
          <p className="mt-1 text-xs text-gray-400">Bar chart of the top items by profit.</p>
          <div className="mt-5 flex-1">
            {profitByItem.length ? (
              <div className="relative h-full min-h-[320px] overflow-x-auto rounded-xl border border-gray-800 bg-gradient-to-b from-[#0f172a] to-[#0b1220]">
                <div className="pointer-events-none absolute inset-0">
                  {[20, 40, 60, 80].map((line) => (
                    <div
                      key={line}
                      className="absolute left-0 right-0 border-t border-dashed border-gray-700/50"
                      style={{ bottom: `${line}%` }}
                    />
                  ))}
                </div>
                <div className="relative h-full min-w-[640px] px-4 pb-3 pt-4">
                  <div className="flex h-full items-end gap-5">
                  {profitByItem.map((entry) => {
                    const height = Math.max(6, (entry.value / maxProfitValue) * 100);
                    return (
                      <div
                        key={entry.id}
                        className="group flex h-full min-w-[90px] flex-1 flex-col items-center justify-end gap-2"
                      >
                        <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                          {entry.value.toLocaleString()}
                        </div>
                        <div className="relative flex h-40 w-12 items-end justify-center">
                          <div
                            className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 via-green-400 to-cyan-300 shadow-[0_0_18px_rgba(16,185,129,0.2)] transition-all duration-200 group-hover:brightness-110"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div
                          className="w-full truncate text-center text-[11px] text-gray-300"
                          title={entry.name}
                        >
                          {entry.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {Math.round((entry.value / maxProfitValue) * 100)}%
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No profit data yet.</p>
            )}
          </div>
          <AnalyticsMissingOverlay
            labels={[
              ...(missing.item ? ["Item"] : []),
              ...(missing.profit ? ["Profit"] : []),
            ]}
          />
        </div>

        <div className="relative rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-white">Margin Heatmap by Item</h3>
          <p className="mt-1 text-xs text-gray-400">Higher margin items glow greener, lower margins trend amber/red.</p>
          <div className="mt-4 space-y-2">
            {marginHeatmapItems.length ? (
              marginHeatmapItems.map((entry) => {
                const intensity = Math.min(90, Math.max(15, Math.abs(entry.margin)));
                const positive = entry.margin >= 0;
                const chipClass = positive
                  ? isLightTheme
                    ? "text-emerald-700 border-emerald-500/40 bg-emerald-100/80"
                    : "text-emerald-200 border-emerald-400/30"
                  : isLightTheme
                    ? "text-rose-700 border-rose-500/40 bg-rose-100/80"
                    : "text-rose-200 border-rose-400/30";
                const cellBg = positive
                  ? isLightTheme
                    ? `linear-gradient(90deg, rgba(16,185,129,0.18) ${intensity}%, rgba(226,232,240,0.92) ${intensity}%)`
                    : `linear-gradient(90deg, rgba(16,185,129,0.18) ${intensity}%, rgba(15,23,42,0.6) ${intensity}%)`
                  : isLightTheme
                    ? `linear-gradient(90deg, rgba(244,63,94,0.16) ${intensity}%, rgba(226,232,240,0.92) ${intensity}%)`
                    : `linear-gradient(90deg, rgba(244,63,94,0.2) ${intensity}%, rgba(15,23,42,0.6) ${intensity}%)`;

                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[1.2fr_auto_auto] items-center gap-3 rounded-lg border px-3 py-2 ${
                      isLightTheme ? "border-slate-300/90" : "border-gray-800"
                    }`}
                    style={{ background: cellBg }}
                  >
                    <span className={`truncate text-sm ${isLightTheme ? "text-slate-800" : "text-gray-200"}`}>{entry.name}</span>
                    <span className={`text-xs ${isLightTheme ? "text-slate-700" : "text-gray-300"}`}>{entry.profit.toLocaleString()} / {entry.revenue.toLocaleString()}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${chipClass}`}>
                      {entry.margin.toFixed(1)}%
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400">Add revenue and profit values to see margin heatmap.</p>
            )}
          </div>
          <AnalyticsMissingOverlay
            labels={[
              ...(missing.item ? ["Item"] : []),
              ...(missing.revenue ? ["Revenue"] : []),
              ...(missing.expenses ? ["Expenses"] : []),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-800/70 pt-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsInsightMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 transition hover:border-indigo-400 hover:text-white"
          >
            <Lightbulb size={15} />
            Insight Templates
          </button>
          {isInsightMenuOpen ? (
            <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(22rem,92vw)] rounded-2xl border border-gray-700/90 bg-[#111827] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.45)]">
              <div className="mb-2 flex items-center gap-2 border-b border-gray-800 pb-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
                  <Lightbulb size={14} />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                  Smart Suggestions
                </p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {insightTemplates.length ? (
                  insightTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyInsightTemplate(template)}
                      className="w-full rounded-xl border border-gray-700 bg-[#0f172a] px-3 py-2.5 text-left transition hover:border-indigo-500 hover:bg-[#111f39]"
                    >
                      <p className="text-sm font-semibold text-white">{template.label}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{template.helper}</p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-xl border border-gray-700 bg-[#0f172a] px-3 py-2.5 text-xs text-gray-400">
                    Add Revenue/Profit/Expenses number columns to unlock insight templates.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setIsChartBuilderOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Sparkles size={15} />
          + Add Chart
        </button>
      </div>

      {customCharts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {customCharts.map((chart) => {
            const column = (board?.columns || []).find(
              (col) => String(col?._id) === String(chart.columnId),
            );
            const columnName = column?.name || "Unknown";

            if (!column) {
              return (
                <div key={chart.id} className="rounded-xl border border-gray-800 bg-[#111827] p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{chart.title}</h4>
                    <button
                      type="button"
                      onClick={() => removeCustomChart(chart.id)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-400">Column no longer exists.</p>
                </div>
              );
            }

            if (chart.type === "kpi_total") {
              const total = tasks.reduce(
                (sum, task) => sum + parseNumber(getTaskValueByColumn(task, column)),
                0,
              );
              return (
                <div key={chart.id} className="rounded-xl border border-gray-800 bg-[#111827] p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{chart.title}</h4>
                    <button
                      type="button"
                      onClick={() => removeCustomChart(chart.id)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Metric: {columnName}</p>
                  <p className="mt-3 text-3xl font-bold text-cyan-300">{total.toLocaleString()}</p>
                </div>
              );
            }

            const topByItem = aggregateByItemForColumn(column._id);
            const maxValue = topByItem[0]?.value || 1;
            return (
              <div key={chart.id} className="rounded-xl border border-gray-800 bg-[#111827] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">{chart.title}</h4>
                  <button
                    type="button"
                    onClick={() => removeCustomChart(chart.id)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">Metric: {columnName}</p>
                <div className="mt-4 space-y-2">
                  {topByItem.length ? (
                    topByItem.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2">
                        <div className="w-32 truncate text-xs text-gray-300" title={entry.name}>
                          {entry.name}
                        </div>
                        <div className="relative h-2 flex-1 rounded-full bg-[#0f172a]">
                          <div
                            className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                            style={{ width: `${Math.max(6, (entry.value / maxValue) * 100)}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-xs text-gray-300">
                          {entry.value.toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No item data available for this metric.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

    </section>
  );
}

function getStatusPillClass(status) {
  if (status === "Done") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  if (status === "Working on it" || status === "Working") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }
  return "border-slate-400/40 bg-slate-500/10 text-slate-200";
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
}

function BoardTaskCard({ task, columns, onClick, isDragging, dragHandleProps }) {
  const status = getTaskStatus(task, columns);
  const assignee = getTaskAssignee(task, columns);
  const { start, end } = getTaskSchedule(task, columns);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
        isDragging
          ? "border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
          : "border-gray-800 bg-[#0f172a] hover:-translate-y-0.5 hover:border-indigo-400/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{task.name || "Untitled item"}</p>
          <p className="mt-1 text-xs text-gray-400">{task.groupTitle || "No group"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${getStatusPillClass(status)}`}>
            {status}
          </span>
          <div
            {...dragHandleProps}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:border-indigo-400 hover:text-indigo-200"
            title="Drag card"
          >
            <span className="text-xs">⋮⋮</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
        {assignee ? (
          <span className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-1 text-indigo-200">
            {assignee}
          </span>
        ) : null}
        {start ? (
          <span className="rounded-full border border-gray-700 bg-[#111827] px-2 py-1 text-gray-300">
            {formatDisplayDate(start)}
            {end && end !== start ? ` - ${formatDisplayDate(end)}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BoardKanbanView({ board, onUpdateTask }) {
  const columns = getBoardViewColumns(board);
  const tasks = flattenBoardTasks(board);
  const statusOptions = columns.status?.options?.length
    ? columns.status.options
    : ["Not Started", "Working on it", "Done"];
  const statuses = statusOptions;
  const [editingTask, setEditingTask] = useState(null);
  const [editName, setEditName] = useState("");
  const [editValues, setEditValues] = useState({});

  const openEditor = (task) => {
    setEditingTask(task);
    setEditName(task?.name || "");
    const nextValues = {};
    (board?.columns || []).forEach((column) => {
      const key = String(column._id);
      nextValues[key] = getTaskValueByColumn(task, column) ?? "";
    });
    setEditValues(nextValues);
  };

  const closeEditor = () => {
    setEditingTask(null);
    setEditName("");
    setEditValues({});
  };

  const saveEditor = async () => {
    if (!editingTask) return;
    const sanitizedValues = {};
    (board?.columns || []).forEach((column) => {
      const key = String(column._id);
      let value = editValues[key];
      if (value === undefined) value = "";
      if (column.type === "numbers") {
        value = value === "" ? "" : String(parseInt(String(value), 10));
      }
      if ((column.type === "status" || column.type === "dropdown") && column.options?.length) {
        if (!column.options.includes(value)) {
          value = column.options[0] || "";
        }
      }
      sanitizedValues[key] = value;
    });
    await onUpdateTask?.(editingTask.groupId, editingTask._id, {
      name: editName,
      values: sanitizedValues,
    });
    closeEditor();
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result || {};
    if (!destination) return;
    if (!draggableId) return;
    const sourceStatus = source?.droppableId?.replace("status:", "") || "";
    const destStatus = destination?.droppableId?.replace("status:", "") || "";
    if (!destStatus) return;
    if (sourceStatus === destStatus && source?.index === destination?.index) return;

    const task = tasks.find((item) => String(item._id) === String(draggableId));
    if (!task) return;
    await onUpdateTask?.(task.groupId, task._id, { status: destStatus });
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 xl:grid-cols-3">
          {statuses.map((status) => {
            const statusTasks = tasks.filter((task) => getTaskStatus(task, columns) === status);
            return (
              <section key={status} className="min-h-[360px] rounded-3xl border border-gray-800 bg-[#111827] p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-white">{status}</h2>
                  <span className="rounded-full border border-gray-700 bg-[#0f172a] px-2.5 py-1 text-xs font-medium text-gray-300">
                    {statusTasks.length}
                  </span>
                </div>

                <Droppable droppableId={`status:${status}`}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3"
                    >
                      {statusTasks.length ? (
                        statusTasks.map((task, index) => (
                          <Draggable key={task._id} draggableId={String(task._id)} index={index}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                              >
                                <BoardTaskCard
                                  task={task}
                                  columns={columns}
                                  onClick={() => openEditor(task)}
                                  isDragging={snapshot.isDragging}
                                  dragHandleProps={dragProvided.dragHandleProps}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-700 bg-[#0f172a] p-6 text-center text-sm text-gray-400">
                          No items in this status.
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            );
          })}
        </div>
      </DragDropContext>

      {editingTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#0f172a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Edit item</h3>
                <p className="text-xs text-gray-400">{editingTask.groupTitle || "No group"}</p>
              </div>
              <button onClick={closeEditor} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm text-gray-300">
                Name
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                />
              </label>

              {(board?.columns || []).map((column) => {
                const columnKey = String(column._id);
                const value = editValues[columnKey] ?? "";
                const baseClass =
                  "mt-2 w-full rounded-xl border border-gray-700 bg-[#111827] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

                if (column.type === "status" || column.type === "dropdown") {
                  const options = column.options?.length ? column.options : ["Not Started", "Working on it", "Done"];
                  return (
                    <label key={columnKey} className="block text-sm text-gray-300">
                      {column.name}
                      <select
                        value={value}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [columnKey]: e.target.value }))
                        }
                        className={baseClass}
                      >
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (column.type === "date") {
                  return (
                    <label key={columnKey} className="block text-sm text-gray-300">
                      {column.name}
                      <input
                        type="date"
                        value={value}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [columnKey]: e.target.value }))
                        }
                        className={baseClass}
                      />
                    </label>
                  );
                }

                if (column.type === "numbers") {
                  return (
                    <label key={columnKey} className="block text-sm text-gray-300">
                      {column.name}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={value}
                        onChange={(e) =>
                          setEditValues((prev) => ({
                            ...prev,
                            [columnKey]: e.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        className={baseClass}
                      />
                    </label>
                  );
                }

                return (
                  <label key={columnKey} className="block text-sm text-gray-300">
                    {column.name}
                    <input
                      value={value}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [columnKey]: e.target.value }))
                      }
                      className={baseClass}
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function BoardCalendarView({ board }) {
  const columns = getBoardViewColumns(board);
  const tasks = flattenBoardTasks(board);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const days = getMonthCalendarDays(monthDate);
  const taskMap = useMemo(() => {
    return tasks.reduce((map, task) => {
      const { start } = getTaskSchedule(task, columns);
      if (!start) return map;
      return {
        ...map,
        [start]: [...(map[start] || []), task],
      };
    }, {});
  }, [columns, tasks]);
  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <section className="rounded-3xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Calendar</h2>
          <p className="text-sm text-gray-400">Items are placed by Date or Timeline start date.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded-xl border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm text-gray-200 hover:border-indigo-500"
          >
            Previous
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-white">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded-xl border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm text-gray-200 hover:border-indigo-500"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-gray-800">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="border-b border-gray-800 bg-[#0f172a] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const key = formatDateKey(day);
          const dayTasks = taskMap[key] || [];
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();

          return (
            <div key={key} className={`min-h-[132px] border-r border-t border-gray-800 p-2 ${isCurrentMonth ? "bg-[#111827]" : "bg-[#0f172a]"}`}>
              <span className={`text-xs font-semibold ${isCurrentMonth ? "text-gray-200" : "text-gray-500"}`}>
                {day.getDate()}
              </span>
              <div className="mt-2 space-y-1.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task._id}
                    className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1.5"
                    title={`${task.name || "Untitled item"}${task.groupTitle ? ` • ${task.groupTitle}` : ""}`}
                  >
                    <p className="truncate text-xs font-semibold text-indigo-100">
                      {task.name || "Untitled item"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getStatusPillClass(getTaskStatus(task, columns))}`}>
                        {getTaskStatus(task, columns)}
                      </span>
                      {getTaskAssignee(task, columns) ? (
                        <span className="truncate rounded-full border border-gray-700 bg-[#111827] px-1.5 py-0.5 text-[10px] text-gray-300">
                          {getTaskAssignee(task, columns)}
                        </span>
                      ) : task.groupTitle ? (
                        <span className="truncate rounded-full border border-gray-700 bg-[#111827] px-1.5 py-0.5 text-[10px] text-gray-400">
                          {task.groupTitle}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {dayTasks.length > 3 ? (
                  <div className="text-xs font-medium text-gray-400">+{dayTasks.length - 3} more</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BoardGanttView({ board }) {
  const columns = getBoardViewColumns(board);
  const tasks = flattenBoardTasks(board);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const timelineDays = useMemo(() => Array.from({ length: 30 }, (_, index) => addDays(today, index)), [today]);
  const scheduledTasks = tasks.map((task) => ({
    task,
    schedule: getTaskSchedule(task, columns),
  }));

  return (
    <section className="rounded-3xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Gantt Timeline</h2>
        <p className="text-sm text-gray-400">Shows the next 30 days using Timeline ranges or Date values.</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[240px_1fr] border-b border-gray-800 pb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Item</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}>
              {timelineDays.map((day) => (
                <div key={formatDateKey(day)} className="text-center text-[10px] font-medium text-gray-400">
                  {day.getDate()}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-800">
            {scheduledTasks.map(({ task, schedule }) => {
              const startDate = schedule.start ? new Date(`${schedule.start}T00:00:00`) : null;
              const endDate = schedule.end ? new Date(`${schedule.end}T00:00:00`) : startDate;
              const validStart = startDate && !Number.isNaN(startDate.getTime());
              const validEnd = endDate && !Number.isNaN(endDate.getTime());
              const startOffset = validStart ? Math.max(0, Math.floor((startDate - today) / 86400000)) : 0;
              const endOffset = validEnd ? Math.min(29, Math.floor((endDate - today) / 86400000)) : startOffset;
              const hasVisibleRange = validStart && validEnd && endOffset >= 0 && startOffset <= 29;
              const left = Math.min(29, startOffset);
              const width = Math.max(1, endOffset - left + 1);

              return (
                <div key={task._id} className="grid grid-cols-[240px_1fr] items-center gap-4 py-3">
                  <div>
                    <p className="truncate text-sm font-semibold text-white">{task.name || "Untitled item"}</p>
                    <p className="text-xs text-gray-400">{task.groupTitle || "No group"}</p>
                  </div>
                  <div
                    className="relative grid h-9 gap-1 rounded-xl bg-[#0f172a] p-1"
                    style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
                  >
                    {timelineDays.map((day) => (
                      <div key={formatDateKey(day)} className="rounded bg-[#111827]" />
                    ))}
                    {hasVisibleRange ? (
                      <div
                        className="absolute top-1 h-7 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 text-xs font-semibold leading-7 text-white shadow-sm"
                        style={{
                          left: `calc(${(left / 30) * 100}% + 0.25rem)`,
                          width: `calc(${(width / 30) * 100}% - 0.25rem)`,
                        }}
                      >
                        <span className="block truncate">{formatDisplayDate(schedule.start)}</span>
                      </div>
                    ) : (
                      <div className="absolute inset-y-1 left-1 flex items-center rounded-full border border-dashed border-gray-700 px-3 text-xs text-gray-400">
                        No schedule
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function BoardPage() {
  const params = useParams();
  const boardId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const MIN_ZOOM = 70;
  const MAX_ZOOM = 150;
  const ZOOM_STEP = 10;

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewNotice, setViewNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeView, setActiveView] = useState("table");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [filters, setFilters] = useState({
    status: "",
    people: "",
  });
  const taskUpdateQueueRef = useRef(new Map());
  const BOARD_UPDATE_QUEUE_KEY = "__board__";

  const enqueueTaskUpdate = useCallback((worker) => {
    const key = BOARD_UPDATE_QUEUE_KEY;
    const queueMap = taskUpdateQueueRef.current;
    const previous = queueMap.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(worker);

    queueMap.set(
      key,
      next.finally(() => {
        if (queueMap.get(key) === next) {
          queueMap.delete(key);
        }
      }),
    );

    return next;
  }, []);

  const loadBoard = useCallback(async () => {
    if (!boardId) {
      setBoard(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/api/boards/${boardId}`);
      setBoard(hydrateBoardValuesFromColumnData(res.data));
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Failed to load board");
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!boardId || typeof window === "undefined") return;
    const savedZoom = window.localStorage.getItem(`nexora:board-zoom:${boardId}`);
    if (!savedZoom) {
      setZoomPercent(100);
      return;
    }

    const parsedZoom = Number.parseInt(savedZoom, 10);
    if (Number.isFinite(parsedZoom)) {
      setZoomPercent(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedZoom)));
      return;
    }

    setZoomPercent(100);
  }, [boardId, MAX_ZOOM, MIN_ZOOM]);

  useEffect(() => {
    if (!boardId || typeof window === "undefined") return;
    window.localStorage.setItem(`nexora:board-zoom:${boardId}`, String(zoomPercent));
  }, [boardId, zoomPercent]);

  const visibleBoard = useMemo(() => {
    const searchedBoard = applyBoardSearch(board, search);
    return applyBoardFilters(searchedBoard, filters);
  }, [board, search, filters]);

  const isSalesBoard = useMemo(() => {
    const category = String(board?.category || "").trim().toLowerCase();
    return category === "sales" || category.includes("sale");
  }, [board]);

  useEffect(() => {
    if (!isSalesBoard && activeView === "analytics") {
      setActiveView("table");
    }
  }, [isSalesBoard, activeView]);

  const handleViewChange = useCallback(
    (viewId) => {
      if (viewId === "analytics" && !isSalesBoard) {
        setViewNotice("Create a sales board to see Analytics.");
        return;
      }
      setViewNotice("");
      setActiveView(viewId);
    },
    [isSalesBoard],
  );

  const statusOptions = useMemo(() => {
    const statusColumn = (board?.columns || []).find(
      (column) => column.type === "status",
    );
    return statusColumn?.options || [];
  }, [board]);

  const peopleOptions = useMemo(() => {
    const peopleColumn = (board?.columns || []).find(
      (column) => column.type === "people",
    );
    if (!peopleColumn) return [];

    const values = (board?.groups || []).flatMap((group) =>
      (group.tasks || [])
        .map((task) => String(getTaskValueByColumn(task, peopleColumn) || ""))
        .filter(Boolean),
    );

    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [board]);

  const activeFilterCount = useMemo(
    () => [filters.status, filters.people].filter(Boolean).length,
    [filters],
  );

  const totalTasks = useMemo(
    () =>
      (board?.groups || []).reduce(
        (sum, group) => sum + (group.tasks?.length || 0),
        0,
      ),
    [board],
  );

  const visibleTaskCount = useMemo(
    () =>
      (visibleBoard?.groups || []).reduce(
        (sum, group) => sum + (group.tasks?.length || 0),
        0,
      ),
    [visibleBoard],
  );

  const hasSearchOrFilters = Boolean(search.trim()) || activeFilterCount > 0;

  const boardEmptyState = useMemo(() => {
    if (hasSearchOrFilters && totalTasks > 0 && visibleTaskCount === 0) {
      return {
        title: "Results not found",
        actionLabel: "",
      };
    }

    return {
      title: "This board has no groups yet.",
      actionLabel: "Create your first group",
    };
  }, [hasSearchOrFilters, totalTasks, visibleTaskCount]);

  const syncBoardFromResponse = useCallback((payload) => {
    if (!payload) return;
    const nextBoard = hydrateBoardValuesFromColumnData(payload);
    setBoard(nextBoard);
  }, []);

  const withBusyAction = useCallback(async (label, action) => {
    try {
      if (label && label !== "Saving changes...") {
        setBusyAction(label);
      }
      await action();
    } catch (actionError) {
      const status = Number(actionError?.response?.status || 0);
      if (status === 404) {
        // Keep UI stable when stale ids/races happen: refresh board data and
        // ask user to retry instead of surfacing a noisy console exception.
        await loadBoard();
        setError("Board data was refreshed. Please try the action again.");
        return;
      }
      setError(actionError.response?.data?.message || "Board update failed");
    } finally {
      if (label && label !== "Saving changes...") {
        setBusyAction("");
      }
    }
  }, [loadBoard]);

  const handleAddGroup = useCallback(
    async (title) => {
      const cleanedTitle = String(title || "").trim() || "New Group";
      const optimisticGroupId = createTempId("tmp-group");
      const optimisticTaskId = createTempId("tmp-task");
      let rollbackBoard = null;

      setBoard((prev) => {
        if (!prev) return prev;
        rollbackBoard = prev;
        return {
          ...prev,
          groups: [
            ...(prev.groups || []),
            {
              _id: optimisticGroupId,
              title: cleanedTitle,
              tasks: [
                {
                  _id: optimisticTaskId,
                  name: "New Item",
                  values: buildOptimisticTaskValues(prev.columns || []),
                },
              ],
            },
          ],
        };
      });

      try {
        const res = await api.post(`/api/boards/${boardId}/groups`, { title: cleanedTitle });
        syncBoardFromResponse(res.data);
      } catch (error) {
        if (rollbackBoard) setBoard(rollbackBoard);
        console.error(error);
        setError(error.response?.data?.message || "Failed to add group");
      }
    },
    [boardId, syncBoardFromResponse],
  );

  const handleUpdateGroup = useCallback(
    async (groupId, payload) => {
      await withBusyAction("Updating group...", async () => {
        const res = await api.put(`/api/boards/${boardId}/groups/${groupId}`, payload);
        syncBoardFromResponse(res.data);
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleDeleteGroup = useCallback(
    async (groupId) => {
      await withBusyAction("Deleting group...", async () => {
        try {
          const res = await api.delete(`/api/boards/${boardId}/groups/${groupId}`);
          syncBoardFromResponse(res.data);
        } catch (error) {
          if (error?.response?.status !== 404) throw error;
          const retry = await api.delete(`/api/boards/${boardId}/group/${groupId}`);
          syncBoardFromResponse(retry.data);
        }
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleAddTask = useCallback(
    async (groupId, name) => {
      const cleanedName = String(name || "").trim() || "New Item";
      const optimisticTaskId = createTempId("tmp-task");
      let rollbackBoard = null;

      setBoard((prev) => {
        if (!prev) return prev;
        rollbackBoard = prev;
        return {
          ...prev,
          groups: (prev.groups || []).map((group) => {
            if (String(group?._id) !== String(groupId)) return group;
            return {
              ...group,
              tasks: [
                ...(group.tasks || []),
                {
                  _id: optimisticTaskId,
                  name: cleanedName,
                  values: buildOptimisticTaskValues(prev.columns || []),
                },
              ],
            };
          }),
        };
      });

      try {
        const res = await api.post(`/api/boards/${boardId}/groups/${groupId}/tasks`, {
          name: cleanedName,
        });
        syncBoardFromResponse(res.data);
      } catch (error) {
        if (rollbackBoard) setBoard(rollbackBoard);
        console.error(error);
        setError(error.response?.data?.message || "Failed to add item");
      }
    },
    [boardId, syncBoardFromResponse],
  );

  const handleAddColumn = useCallback(
    async (payloadOrType, legacyName) => {
      const payload = normalizeColumnPayload(
        typeof payloadOrType === "string"
          ? { type: payloadOrType, name: legacyName || payloadOrType }
          : payloadOrType,
      );

      await withBusyAction("Adding column...", async () => {
        try {
          const res = await api.post(`/api/boards/${boardId}/columns`, payload);
          syncBoardFromResponse(res.data);
        } catch (error) {
          const fallbackPayload = normalizeColumnPayload({
            ...payload,
            type:
              payload?.type === "people"
                ? "person"
                : payload?.type === "numbers"
                  ? "number"
                  : payload?.type === "files"
                    ? "text"
                    : payload?.type === "timeline"
                      ? "text"
                      : payload?.type,
          });

          if (
            error?.response?.status !== 400 ||
            fallbackPayload?.type === payload?.type
          ) {
            throw error;
          }

          const retry = await api.post(`/api/boards/${boardId}/columns`, fallbackPayload);
          syncBoardFromResponse(retry.data);
        }
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleUpdateColumn = useCallback(
    async (columnId, payload) => {
      await withBusyAction("Updating column...", async () => {
        try {
          const res = await api.put(
            `/api/boards/${boardId}/columns/${columnId}`,
            normalizeColumnPayload(payload),
          );
          syncBoardFromResponse(res.data);
        } catch (error) {
          if (error?.response?.status !== 404) throw error;
          const retry = await api.put(
            `/api/boards/${boardId}/column/${columnId}`,
            normalizeColumnPayload(payload),
          );
          syncBoardFromResponse(retry.data);
        }
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleDeleteColumn = useCallback(
    async (columnId) => {
      const firstDataColumnId = board?.columns?.[0]?._id
        ? String(board.columns[0]._id)
        : null;
      if (firstDataColumnId && String(columnId) === firstDataColumnId) {
        setError("The first column is protected and cannot be deleted.");
        return;
      }
      await withBusyAction("Deleting column...", async () => {
        try {
          const res = await api.delete(`/api/boards/${boardId}/columns/${columnId}`);
          syncBoardFromResponse(res.data);
        } catch (error) {
          if (error?.response?.status !== 404) throw error;
          const retry = await api.delete(`/api/boards/${boardId}/column/${columnId}`);
          syncBoardFromResponse(retry.data);
        }
      });
    },
    [board, boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleUpdateTask = useCallback(
    async (groupId, taskId, updates) => {
      await withBusyAction("Saving changes...", async () => {
        const payload =
          updates && typeof updates === "object"
            ? {
                ...updates,
                values:
                  updates.values && typeof updates.values === "object"
                    ? { ...updates.values }
                    : updates.values,
              }
            : updates;

        await enqueueTaskUpdate(async () => {
          try {
            const res = await api.put(
              `/api/boards/${boardId}/groups/${groupId}/tasks/${taskId}`,
              payload,
            );
            syncBoardFromResponse(res.data);
          } catch (requestError) {
            if (requestError?.response?.status !== 409) throw requestError;
            const retry = await api.put(
              `/api/boards/${boardId}/groups/${groupId}/tasks/${taskId}`,
              payload,
            );
            syncBoardFromResponse(retry.data);
          }
        });
      });
    },
    [boardId, enqueueTaskUpdate, syncBoardFromResponse, withBusyAction],
  );

  const handleMoveTask = useCallback(
    async ({ taskId, sourceGroupId, targetGroupId }) => {
      if (!taskId || !sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) {
        return;
      }

      await withBusyAction("Moving item...", async () => {
        const sourceGroup =
          (board?.groups || []).find((group) => group._id === sourceGroupId) ||
          (board?.groups || []).find((group) =>
            (group.tasks || []).some((task) => task._id === taskId),
          );
        const taskToMove = (sourceGroup?.tasks || []).find((task) => task._id === taskId);

        const moveWithExistingApis = async () => {
          if (!taskToMove) throw new Error("Item not found in source group");

          const addRes = await api.post(`/api/boards/${boardId}/groups/${targetGroupId}/tasks`, {
            name: taskToMove.name || "Untitled item",
          });

          const boardAfterAdd = addRes.data?.board || addRes.data;
          const targetGroup = (boardAfterAdd?.groups || []).find(
            (group) => group._id === targetGroupId,
          );
          const createdTask = [...(targetGroup?.tasks || [])]
            .reverse()
            .find((task) => task._id !== taskId && task.name === (taskToMove.name || "Untitled item"));

          if (createdTask?._id) {
            await api.put(
              `/api/boards/${boardId}/groups/${targetGroupId}/tasks/${createdTask._id}`,
              {
                name: taskToMove.name || "Untitled item",
                values: taskToMove.values || {},
              },
            );
          }

          const deleteRes = await api.delete(`/api/boards/${boardId}/tasks`, {
            data: { taskIds: [taskId] },
          });

          return deleteRes;
        };

        let res;

        try {
          res = await api.put(`/api/boards/${boardId}/tasks/${taskId}/move`, {
            sourceGroupId,
            targetGroupId,
          });
        } catch (error) {
          if (error?.response?.status !== 404) throw error;
          try {
            res = await api.put(
              `/api/boards/${boardId}/groups/${sourceGroupId}/tasks/${taskId}/move`,
              { sourceGroupId, targetGroupId },
            );
          } catch (retryError) {
            if (retryError?.response?.status !== 404) throw retryError;
            res = await moveWithExistingApis();
          }
        }

        syncBoardFromResponse(res.data);
      });
    },
    [board, boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleDeleteTasks = useCallback(
    async (taskIds) => {
      await withBusyAction("Deleting items...", async () => {
        const res = await api.delete(`/api/boards/${boardId}/tasks`, {
          data: { taskIds },
        });
        syncBoardFromResponse(res.data);
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleToggleItemColumnVisibility = useCallback(
    async (nextVisible) => {
      await withBusyAction("Updating board...", async () => {
        const res = await api.put(`/api/boards/${boardId}`, {
          itemColumnVisible: Boolean(nextVisible),
        });
        syncBoardFromResponse(res.data);
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleUpdateItemColumnName = useCallback(
    async (nextName) => {
      const cleaned = String(nextName || "").trim();
      if (!cleaned) return;
      await withBusyAction("Renaming first column...", async () => {
        const res = await api.patch(`/api/boards/${boardId}/data`, {
          itemColumnName: cleaned,
        });
        syncBoardFromResponse(res.data);
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleReorderColumns = useCallback(
    async (reorderPayload) => {
      const nextColumns = Array.isArray(reorderPayload)
        ? reorderPayload
        : reorderPayload?.columns;
      const itemColumnPosition = Number.isFinite(Number(reorderPayload?.itemColumnPosition))
        ? Number(reorderPayload.itemColumnPosition)
        : undefined;
      if (!Array.isArray(nextColumns)) return;

      await withBusyAction("Reordering columns...", async () => {
        const res = await api.patch(`/api/boards/${boardId}/data`, {
          columns: nextColumns,
          ...(itemColumnPosition !== undefined ? { itemColumnPosition } : {}),
        });
        syncBoardFromResponse(res.data);
      });
    },
    [boardId, syncBoardFromResponse, withBusyAction],
  );

  const handleQuickAdd = useCallback(async () => {
    if (!board?.groups?.length) {
      await handleAddGroup("New Group");
      return;
    }

    await handleAddTask(board.groups[0]._id, `New Item ${totalTasks + 1}`);
  }, [board, handleAddGroup, handleAddTask, totalTasks]);

  const handleExportCsv = useCallback(() => {
    const boardForExport = visibleBoard || board;
    if (!boardForExport) return;

    const rows = buildCsvRowsForBoard(boardForExport);
    if (!rows.length) return;

    const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const safeBoardName = String(boardForExport?.name || "board")
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "board";
    const date = new Date();
    const dateStamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeBoardName}_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [board, visibleBoard]);

  return (
    <div className="board-page-theme mx-auto flex min-h-full w-full max-w-10xl flex-col">
      <section className="mb-4 rounded-2xl border border-slate-800/70 bg-[#0e1a33]/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white sm:text-xl">
              {loading ? "Loading..." : board?.name || "Untitled Board"}
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-400">
              Build a board with structured groups, inline updates, and live views.
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-800/80 pt-2.5">
        <div className="mb-0.5 flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-x-auto">
            <div className="flex min-w-0 items-end gap-1 pb-0.5">
            {BOARD_VIEWS.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => handleViewChange(view.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/40"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  {view.label}
                </button>
              );
            })}
            </div>
          </div>

          <div className="ml-0 flex w-full flex-col gap-0.5 lg:ml-auto lg:w-auto">
            <div className="board-toolbar-controls flex flex-wrap items-center justify-end gap-1.5">
          <div className="relative w-full sm:w-52">
            <Search
              size={16}
              className="board-toolbar-search-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items, people, values..."
              className="w-full rounded-lg border border-slate-700 bg-[#101d36] py-2 pl-9 pr-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setFilterOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101d36] px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <Filter size={16} />
              Filter
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            {filterOpen ? (
              <div className="board-toolbar-popover absolute right-0 z-30 mt-2 w-72 rounded-xl border border-gray-700 bg-[#111827] p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Filter Board</h3>
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All statuses</option>
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">
                      Assignee
                    </label>
                    <select
                      value={filters.people}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, people: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All assignees</option>
                      {peopleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setFilters({ status: "", people: "" })}
                    className="w-full rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-indigo-500 hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101d36] px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
            <ArrowUpDown size={16} />
            Sort
          </button>

          <button
            onClick={handleExportCsv}
            disabled={loading || !visibleBoard}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101d36] px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            Export CSV
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#101d36] p-1">
            <button
              type="button"
              onClick={() => setZoomPercent((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))}
              disabled={zoomPercent <= MIN_ZOOM}
              title="Zoom out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomPercent(100)}
              title="Reset zoom"
              className="min-w-[3.5rem] rounded-md px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/80 hover:text-white"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={() => setZoomPercent((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))}
              disabled={zoomPercent >= MAX_ZOOM}
              title="Zoom in"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={loading || !!busyAction}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Add Item
          </button>
            </div>
        </div>
      </div>
      </div>
      </section>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <CircleAlert size={16} />
          {error}
        </div>
      ) : null}

      {viewNotice ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
          <CircleAlert size={16} />
          {viewNotice}
        </div>
      ) : null}

      <div className="flex-1 overflow-x-auto pb-10">
        <div className="origin-top-left" style={{ zoom: zoomPercent / 100 }}>
          {activeView === "table" ? (
            <BoardTable
              board={visibleBoard}
              isLoading={loading}
              emptyState={boardEmptyState}
              onAddGroup={handleAddGroup}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddTask={handleAddTask}
              onAddColumn={handleAddColumn}
              onUpdateColumn={handleUpdateColumn}
              onDeleteColumn={handleDeleteColumn}
              onReorderColumns={handleReorderColumns}
              onUpdateTask={handleUpdateTask}
              onMoveTask={handleMoveTask}
              onDeleteTasks={handleDeleteTasks}
              itemColumnVisible={board?.itemColumnVisible !== false}
              onToggleItemColumnVisibility={handleToggleItemColumnVisibility}
              onUpdateItemColumnName={handleUpdateItemColumnName}
            />
          ) : activeView === "kanban" ? (
            <BoardKanbanView board={visibleBoard} onUpdateTask={handleUpdateTask} />
          ) : activeView === "calendar" ? (
            <BoardCalendarView board={visibleBoard} />
          ) : activeView === "analytics" && isSalesBoard ? (
            <BoardAnalyticsView board={board} />
          ) : (
            <BoardGanttView board={visibleBoard} />
          )}
        </div>
      </div>
    </div>
  );
}
