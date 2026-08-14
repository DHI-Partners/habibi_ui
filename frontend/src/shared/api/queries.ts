import { useQuery } from "@tanstack/react-query";

import { call } from "./client";

export interface Module {
  key: string;
  label: string;
}

export interface Me {
  user: string;
  full_name: string;
  roles: string[];
  modules: Module[];
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => call<Me>("habibi_ui.api.v1.session.me"),
  });
}
