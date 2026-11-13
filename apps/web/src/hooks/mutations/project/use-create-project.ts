import { useMutation } from "@tanstack/react-query";
import createProject, {
  type CreateProjectRequest,
} from "@/fetchers/project/create-project";

function useCreateProject(params: CreateProjectRequest) {
  return useMutation({
    mutationFn: () => createProject(params),
  });
}

export default useCreateProject;
