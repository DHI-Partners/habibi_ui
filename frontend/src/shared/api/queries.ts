import { useQuery } from "@tanstack/react-query";

import type { Me } from "../types/api";
import { call } from "./client";

export type { Me, Module } from "../types/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("habibi_ui.api.v1.session.me"),
  });
}
