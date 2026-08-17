import { useQuery } from "@tanstack/react-query";

import type { DesktopSection, Me, SidebarGroup, WorkspacePage, WorkspaceRef } from "../types/api";
import { call } from "./client";

export type {
  Me,
  Module,
  DesktopSection,
  DesktopItem,
  SidebarGroup,
  SidebarLink,
  WorkspacePage,
  WorkspaceRef,
  Shortcut,
  Card,
  CardLink,
} from "../types/api";

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

export function useModules() {
  return useQuery({
    queryKey: ["workspaces", "modules"],
    queryFn: () => call<DesktopSection[]>("habibi_ui.api.v1.workspaces.modules"),
  });
}

export function useSidebarGroup(name: string) {
  return useQuery({
    queryKey: ["workspaces", "group", name],
    queryFn: () => call<SidebarGroup>("habibi_ui.api.v1.workspaces.sidebar_group", { name }),
    enabled: name !== "",
  });
}

export function useWorkspacePage(name: string) {
  return useQuery({
    queryKey: ["workspaces", "page", name],
    queryFn: () => call<WorkspacePage>("habibi_ui.api.v1.workspaces.page", { name }),
    enabled: name !== "",
  });
}
