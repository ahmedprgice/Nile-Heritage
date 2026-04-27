"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export default function RichTextEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-xl bg-white shadow-sm">
      
      {/* Toolbar */}
      <div className="flex gap-2 p-2 border-b bg-gray-50 rounded-t-xl">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200"
        >
          Bold
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200"
        >
          Italic
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="px-3 py-1 text-sm rounded hover:bg-gray-200"
        >
          • List
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="p-4 min-h-[120px]" />
    </div>
  );
}