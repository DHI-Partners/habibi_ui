import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { call } from "../../shared/api/client";
import type { CabinetSection } from "../../shared/types/api";

export type Row = Record<string, unknown> & { name: string };
export type Filter = [string, string, unknown];

export function useCabinetConfig() {
  return useQuery({
    queryKey: ["cabinet", "config"],
    queryFn: () => call<CabinetSection[]>("habibi_ui.api.v1.cabinet.config"),
    staleTime: 5 * 60_000,
  });
}

export function useSectionList(key: string, filters: Filter[], enabled = true) {
  return useQuery({
    queryKey: ["cabinet", "list", key, filters],
    queryFn: () =>
      call<{ rows: Row[]; has_more: boolean }>("habibi_ui.api.v1.cabinet.list", { section: key, filters }),
    enabled,
  });
}

export function useSectionDoc(key: string, name: string | null) {
  return useQuery({
    queryKey: ["cabinet", "doc", key, name],
    queryFn: () => call<Row>("habibi_ui.api.v1.cabinet.get", { section: key, name }),
    enabled: name !== null,
  });
}

export function useSaveSectionDoc(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, values }: { name: string | null; values: Record<string, unknown> }) =>
      call<Row>("habibi_ui.api.v1.cabinet.save", { section: key, name, values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cabinet", "list", key] }),
  });
}
