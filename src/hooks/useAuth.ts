import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export const AUTH_ME_KEY = ["auth", "me"] as const;

export function useAuthUser() {
  return useQuery({ queryKey: AUTH_ME_KEY, queryFn: api.getMe });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (user) => queryClient.setQueryData(AUTH_ME_KEY, user),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.signup,
    onSuccess: (user) => queryClient.setQueryData(AUTH_ME_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_ME_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    },
  });
}
