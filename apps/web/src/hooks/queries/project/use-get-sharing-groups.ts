import { useQuery } from "@tanstack/react-query";
import { fetchSharingGroups } from "@/fetchers/project/sharing";

export function useGetSharingGroups(enabled = true) {
  return useQuery({
    queryKey: ["project-sharing", "groups"],
    queryFn: fetchSharingGroups,
    enabled,
    staleTime: 60 * 1000,
  });
}

export default useGetSharingGroups;
