const mongoose = require("mongoose");

const COLUMN_TYPES = ["text", "people", "status", "date", "dropdown", "numbers", "files", "timeline"];

const columnSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: COLUMN_TYPES,
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    formula: {
      type: String,
      trim: true,
      default: "",
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    values: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: true }
);

function getDefaultValueForColumn(column) {
  if (column?.type === "status" || column?.type === "dropdown") {
    return column.options?.[0] || "";
  }

  return "";
}

function buildDefaultTaskValues(columns = []) {
  return columns.reduce((acc, column) => {
    if (column?._id) {
      acc[String(column._id)] = getDefaultValueForColumn(column);
    }
    return acc;
  }, {});
}

function getTaskValuesObject(task) {
  if (!task?.values) return {};
  if (task.values instanceof Map) {
    return Object.fromEntries(task.values.entries());
  }
  if (typeof task.values?.toObject === "function") {
    return task.values.toObject();
  }
  if (typeof task.values?.entries === "function") {
    return Object.fromEntries(task.values.entries());
  }
  return { ...task.values };
}

const groupSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    tasks: {
      type: [taskSchema],
      default: [],
    },
  },
  { _id: true }
);

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    privacy: {
      type: String,
      enum: ["main", "private"],
      default: "main",
    },
    category: {
      type: String,
      enum: ["tasks", "sales", "items"],
      default: "tasks",
    },
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    itemColumnVisible: {
      type: Boolean,
      default: true,
    },
    itemColumnName: {
      type: String,
      trim: true,
      default: "Item",
    },
    itemColumnPosition: {
      type: Number,
      default: 0,
      min: 0,
    },
    columns: {
      type: [columnSchema],
      default: [
        {
          name: "Status",
          type: "status",
          options: ["Not Started", "Working on it", "Done"],
        },
        {
          name: "People",
          type: "people",
          options: [],
        },
        {
          name: "Date",
          type: "date",
          options: [],
        },
      ],
    },
    groups: {
      type: [groupSchema],
      default: function () {
        return [
          {
            title: "New Group",
            tasks: [
              {
                name: "New Item",
                values: buildDefaultTaskValues(this.columns),
              },
            ],
          },
        ];
      },
    },
  },
  { timestamps: true }
);

boardSchema.pre("save", function syncColumnDataBeforeSave() {
  const columns = Array.isArray(this.columns) ? this.columns : [];
  const groups = Array.isArray(this.groups) ? this.groups : [];

  const valuesByColumn = columns.reduce((acc, column) => {
    acc[String(column._id)] = {};
    return acc;
  }, {});

  groups.forEach((group) => {
    (group.tasks || []).forEach((task) => {
      const taskId = String(task?._id || "");
      if (!taskId) return;
      const values = getTaskValuesObject(task);

      Object.entries(values || {}).forEach(([columnId, value]) => {
        const key = String(columnId || "");
        if (!key || !Object.prototype.hasOwnProperty.call(valuesByColumn, key)) return;
        valuesByColumn[key][taskId] = value;
      });
    });
  });

  columns.forEach((column) => {
    const key = String(column?._id || "");
    column.data = valuesByColumn[key] || {};
  });
});

boardSchema.index({ companyId: 1, workspace: 1, createdAt: -1 });
boardSchema.index({ companyId: 1, privacy: 1, createdBy: 1 });
boardSchema.index({ companyId: 1, members: 1 });

module.exports = mongoose.model("Board", boardSchema);
