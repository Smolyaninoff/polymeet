import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "./useChatMessages";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: number;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} text={message.body} authorName={message.author_name}
          isMine={message.author_id === currentUserId} sentAt={message.created_at} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
