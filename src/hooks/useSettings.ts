import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export const SETTINGS_KEY = ["settings"] as const;

export function useSettings(enabled = true) {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: api.getSettings, enabled });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
