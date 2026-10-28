import { apiGet } from "@/shared/api/client";
import type { CategoryOut } from "@/shared/api/schema";

export async function fetchCategories(): Promise<CategoryOut[]> {
  return apiGet<CategoryOut[]>("/categories");
}