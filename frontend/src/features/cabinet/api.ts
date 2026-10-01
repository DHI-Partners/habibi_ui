import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export type ListPage = { rows: Row[]; has_more: boolean; total: number };
/** Быстрый фильтр раздела («На кухне», «В пути»): closed — заказ уже закрыт, на доске его нет. */
export type Facet = { key: string; label: string; count: number; closed: boolean };
export type ListQuery = { filters: Filter[]; search: string; orderBy: string; facet: string };

export const PAGE_SIZE = 20;

const fetchPage = (key: string, q: ListQuery, start: number) =>
  call<ListPage>("habibi_ui.api.v1.cabinet.list", {
    section: key,
    filters: q.filters,
    search: q.search,
    order_by: q.orderBy,
    facet: q.facet,
    start,
    page_length: PAGE_SIZE,
  });

/** Первая страница без поиска и сортировки — для плиток главной. */
export function useSectionList(key: string, filters: Filter[], enabled = true) {
  return useQuery({
    queryKey: ["cabinet", "list", key, filters],
    queryFn: () => call<ListPage>("habibi_ui.api.v1.cabinet.list", { section: key, filters }),
    enabled,
  });
}

/** Десктоп: постраничный список. Предыдущая страница остаётся на экране, пока грузится следующая. */
export function useSectionPage(key: string, q: ListQuery, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["cabinet", "list", key, "page", q, page],
    queryFn: () => fetchPage(key, q, page * PAGE_SIZE),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Телефон: «Показать ещё» — страницы копятся в одном списке. */
export function useSectionInfinite(key: string, q: ListQuery, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["cabinet", "list", key, "infinite", q],
    queryFn: ({ pageParam }) => fetchPage(key, q, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.has_more ? all.length * PAGE_SIZE : undefined),
    enabled,
  });
}

export function useFacets(key: string, enabled = true) {
  return useQuery({
    queryKey: ["cabinet", "facets", key],
    queryFn: () => call<Facet[]>("habibi_ui.api.v1.cabinet.facets", { section: key }),
    enabled,
    staleTime: 15_000,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cabinet", "facets", key] });
      return queryClient.invalidateQueries({ queryKey: ["cabinet", "list", key] });
    },
  });
}
