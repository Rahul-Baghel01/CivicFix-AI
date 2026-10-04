import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};
export function useAuth(options?: UseAuthOptions) {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const signOut = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      await utils.invalidate();
    },
  });
  useEffect(() => {
    if (options?.redirectOnUnauthenticated && !me.isLoading && !me.data) {
      if (
        options.redirectPath &&
        window.location.pathname !== options.redirectPath
      )
        window.location.assign(options.redirectPath);
      else startLogin();
    }
  }, [
    options?.redirectOnUnauthenticated,
    options?.redirectPath,
    me.isLoading,
    me.data,
  ]);
  return {
    user: me.data ?? null,
    loading: me.isLoading || signOut.isPending,
    error: me.error ?? signOut.error,
    isAuthenticated: Boolean(me.data),
    refresh: () => me.refetch(),
    logout: () => signOut.mutateAsync(),
  };
}
