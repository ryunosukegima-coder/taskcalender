import { useQuery } from "@tanstack/react-query";
import * as api from "../api/client";

export function useHistory(days = 7) {
  return useQuery({
    queryKey: ["history", days],
    queryFn: () => api.getHistory(days),
  });
}
