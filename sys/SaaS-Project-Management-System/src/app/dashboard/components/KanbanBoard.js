"use client";

import { useRef, useState } from "react";
import { Plus, MoreVertical, MessageCircle, Paperclip } from "lucide-react";

export default function KanbanBoard() {
  const nextTaskId = useRef(6);

  const [columns, setColumns] = useState([
    {
      id: "backlog",
      title: "Backlog",
      color: "bg-gray-400",
      tasks: [
        {
          id: 1,
          title: "Research competitor analysis",
          priority: "medium",
          date: "Mar 15",
          comments: 3,
          attachments: 1
        }
      ]
    },
    {
      id: "todo",
      title: "To Do",
      color: "bg-indigo-500",
      tasks: [
        {
          id: 2,
          title: "Design new landing page",
          priority: "high",
          date: "Mar 10",
          comments: 5,
          attachments: 3
        }
      ]
    },
    {
      id: "progress",
      title: "In Progress",
      color: "bg-orange-500",
      tasks: [
        {
          id: 3,
          title: "Implement authentication",
          priority: "high",
          date: "Mar 8",
          comments: 8,
          attachments: 1
        }
      ]
    },
    {
      id: "review",
      title: "Review",
      color: "bg-purple-500",
      tasks: [
        {
          id: 4,
          title: "Review PR #234",
          priority: "high",
          date: "Mar 7",
          comments: 6,
          attachments: 0
        }
      ]
    },
    {
      id: "done",
      title: "Done",
      color: "bg-emerald-500",
      tasks: [
        {
          id: 5,
          title: "Setup project structure",
          priority: "high",
          date: "Mar 1",
          comments: 12,
          attachments: 5
        }
      ]
    }
  ]);

  const addTask = (columnId) => {

    const title = prompt("Task title");
    if (!title) return;

    const newTask = {
      id: nextTaskId.current,
      title,
      priority: "medium",
      date: "-",
      comments: 0,
      attachments: 0
    };

    nextTaskId.current += 1;

    setColumns((currentColumns) => currentColumns.map(col =>
      col.id === columnId
        ? { ...col, tasks: [...col.tasks, newTask] }
        : col
    ));
  };

  const priorityColor = (priority) => {

    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-400";

      case "medium":
        return "bg-yellow-500/20 text-yellow-400";

      case "low":
        return "bg-gray-500/20 text-gray-400";

      default:
        return "bg-gray-500/20 text-gray-400";
    }

  };

  return (

    <div className="flex gap-6 overflow-x-auto pb-4">

      {columns.map(column => (

        <div
          key={column.id}
          className="w-72 flex-shrink-0"
        >

          {/* COLUMN HEADER */}

          <div className="flex items-center justify-between mb-3">

            <div className="flex items-center gap-2">

              <div className={`w-2 h-2 rounded-full ${column.color}`}></div>

              <h3 className="font-semibold text-gray-200">
                {column.title}
              </h3>

              <span className="text-xs text-gray-400 bg-[#1e293b] px-2 py-0.5 rounded">
                {column.tasks.length}
              </span>

            </div>

            <button
              onClick={() => addTask(column.id)}
              className="text-gray-400 hover:text-indigo-400"
            >
              <Plus size={16}/>
            </button>

          </div>

          {/* TASK CARDS */}

          <div className="space-y-3">

            {column.tasks.map(task => (

              <div
                key={task.id}
                className="bg-[#111827] border border-gray-800 rounded-xl p-4 hover:border-indigo-500 transition"
              >

                {/* TITLE */}

                <div className="flex justify-between mb-3">

                  <p className="text-sm text-gray-200 font-medium">
                    {task.title}
                  </p>

                  <MoreVertical
                    size={16}
                    className="text-gray-400 cursor-pointer"
                  />

                </div>

                {/* META */}

                <div className="flex items-center justify-between mb-4">

                  <span className={`text-xs px-2 py-1 rounded ${priorityColor(task.priority)}`}>
                    {task.priority}
                  </span>

                  <span className="text-xs text-gray-400">
                    {task.date}
                  </span>

                </div>

                {/* FOOTER */}

                <div className="flex items-center gap-4 text-gray-400 text-xs">

                  <div className="flex items-center gap-1">
                    <MessageCircle size={14}/>
                    {task.comments}
                  </div>

                  <div className="flex items-center gap-1">
                    <Paperclip size={14}/>
                    {task.attachments}
                  </div>

                </div>

              </div>

            ))}

          </div>

        </div>

      ))}

    </div>

  );

}
