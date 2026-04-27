"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function PollModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 5) setOptions([...options, ""]);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const createPoll = () => {
    if (!question.trim() || options.some((o) => !o.trim())) return;

    onCreate({ question, options: options.map((o) => ({ text: o, votes: 0 })) });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: -50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-[#111827] rounded-3xl shadow-2xl w-[500px] p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X size={22} />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-white">Create Poll</h2>

        {/* Question */}
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Poll Question"
          className="w-full mb-4 p-3 rounded-xl bg-[#1e293b] outline-none text-lg"
        />

        {/* Options */}
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => handleOptionChange(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 p-2 rounded-xl bg-[#1e293b] outline-none"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(i)}
                className="text-red-500 font-bold px-2"
              >
                X
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addOption}
          className="text-indigo-500 mb-4 hover:underline"
        >
          + Add Option
        </button>

        {/* Create Button */}
        <div className="flex justify-end">
          <button
            onClick={createPoll}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium text-white"
          >
            Create Poll
          </button>
        </div>
      </motion.div>
    </div>
  );
}
