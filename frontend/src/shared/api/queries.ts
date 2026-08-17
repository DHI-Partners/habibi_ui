import { useQuery } from "@tanstack/react-query";

import type { Me, WorkspacePage, WorkspaceRef } from "../types/api";
import { call } from "./client";

export type { Me, Module, WorkspacePage, WorkspaceRef, Shortcut, Card, CardLink } from "../types/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("habibi_ui.api.v1.session.me"),
  });
}

export function useSidebar() {
  return useQuery({
    queryKey: ["workspaces", "sidebar"],
    queryFn: () => call<WorkspaceRef[]>("habibi_ui.api.v1.workspaces.sidebar"),
  });
}

export function useWorkspacePage(name: string) {
  return useQuery({
    queryKey: ["workspaces", "page", name],
    queryFn: () => call<WorkspacePage>("habibi_ui.api.v1.workspaces.page", { name }),
    enabled: name !== "",
  });
}
