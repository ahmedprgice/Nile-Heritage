/*columnsMenu.js*/
"use client";

import { X } from "lucide-react";

export default function ColumnMenu({ close }) {

  const columns = [
    "Status",
    "Text",
    "People",
    "Dropdown",
    "Date",
    "Numbers",
    "Files",
    "Checkbox",
    "Formula",
    "Priority",
  ];

  return (
    <div className="absolute top-40 left-1/2 bg-[#1e293b] border border-gray-700 rounded-xl w-72 p-4 shadow-xl">

      <div className="flex justify-between items-center mb-4">
        <input
          placeholder="Search or describe your column"
          className="w-full px-3 py-2 rounded bg-[#111827] border border-gray-700"
        />
        <X size={16} className="ml-2 cursor-pointer" onClick={close} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">

        {columns.map((col) => (
          <div
            key={col}
            className="p-2 rounded hover:bg-gray-700 cursor-pointer"
          >
            {col}
          </div>
        ))}

      </div>

    </div>
  );
}