import db from "../../database";
import { insertProject } from "./insert-project";

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
  userId: string,
  sharing?: {
    shareType?: "all" | "group" | "user";
    groupId?: string | null;
    sharedGroupId?: string | null;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
  },
) {
  return db.transaction((tx) =>
    insertProject(tx, {
      workspaceId,
      name,
      icon,
      slug,
      userId,
      shareType: sharing?.shareType,
      groupId: sharing?.groupId,
      sharedGroupId: sharing?.sharedGroupId,
      sharedGroupIds: sharing?.sharedGroupIds,
      sharedUserIds: sharing?.sharedUserIds,
    }),
  );
}

export default createProject;
