import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404
        if (error instanceof Error && error.name === "ApiError") {
          const apiError = error as { status?: number };
          if ([401, 403, 404].includes(apiError.status ?? 0)) return false;
        }
        return failureCount < 2;
      },
    },
  },
});