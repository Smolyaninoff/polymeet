import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "./api";

const CATEGORIES_KEY = "categories";

export function useCategories() {
  return useQuery({
    queryKey: [CATEGORIES_KEY],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes — categories rarely change
  });
}