import { useAuth } from "@/features/auth/context";
import { useChatMessages } from "@/features/meetings/chat/useChatMessages";
import { MessageInput } from "@/features/meetings/chat/MessageInput";
import { MessageList } from "@/features/meetings/chat/MessageList";

interface ChatContentProps {
  meetingId: string;
}

export function ChatContent({ meetingId }: ChatContentProps) {
  const { user } = useAuth();
  const { messages, isLoading, isSending, error, sendMessage } =
    useChatMessages(meetingId);

  if (!user) return null;

  return (
    <div className="flex h-full flex-col">
      {isLoading && (
        <p className="flex-1 p-6 text-center text-sm text-slate-500">
          Загружаем сообщения…
        </p>
      )}

      {!isLoading && (
        <MessageList messages={messages} currentUserId={user.id} />
      )}

      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-red-400">
          {error instanceof Error ? error.message : "Ошибка чата"}
        </p>
      )}

      <MessageInput onSend={sendMessage} isSending={isSending} />
    </div>
  );
}
