import  { useState  } from "react";
import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSend: (text: string) => Promise<unknown>;
  isSending?: boolean;
}

export function MessageInput({ onSend, isSending = false }: MessageInputProps) {
  const [text, setText] = useState("");

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    try {
      await onSend(text.trim());
      setText("");
    } catch {
      // Ошибка показывается в чате, текст остаётся в поле.
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-white/10 p-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Написать сообщение..."
        className="flex-1 rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={() => void handleSend()}
        disabled={!text.trim() || isSending}
        className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
      >
        <Send size={16} />
      </button>
    </div>
  );
}