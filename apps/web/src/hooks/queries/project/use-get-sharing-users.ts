import { useQuery } from "@tanstack/react-query";
import { fetchSharingUsers } from "@/fetchers/project/sharing";

export function useGetSharingUsers(enabled = true) {
  return useQuery({
    queryKey: ["project-sharing", "users"],
    queryFn: fetchSharingUsers,
    enabled,
    staleTime: 60 * 1000,
  });
}

export default useGetSharingUsers;
