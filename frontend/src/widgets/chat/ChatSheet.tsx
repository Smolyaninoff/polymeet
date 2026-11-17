import { X } from "lucide-react";
import { useEffect } from "react";
import { useMeeting } from "@/features/meetings/hooks";
import { ChatContent } from "./ChatContent";

interface ChatSheetProps {
  meetingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSheet({ meetingId, isOpen, onClose }: ChatSheetProps) {
  const meetingQuery = useMeeting(Number(meetingId));

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !meetingId) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Чат встречи"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#0b0f1a] sm:max-w-md"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            {meetingQuery.data?.title ?? "Чат встречи"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть чат"
            className="rounded-md p-1 text-slate-400 transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatContent meetingId={meetingId} />
        </div>
      </section>
    </>
  );
}
