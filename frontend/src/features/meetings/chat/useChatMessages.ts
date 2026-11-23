import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/shared/api/client";

export interface ChatMessage {
  id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: string;
}

export function useChatMessages(meetingId: string) {
  const queryClient = useQueryClient();
  const key = ["chat", meetingId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiGet<ChatMessage[]>(`/meetings/${meetingId}/messages`),
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: (body: string) => apiPost<ChatMessage>(`/meetings/${meetingId}/messages`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    isSending: mutation.isPending,
    error: query.error ?? mutation.error,
    sendMessage: (text: string) => mutation.mutateAsync(text),
  };
}
