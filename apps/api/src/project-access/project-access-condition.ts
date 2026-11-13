import { type SQLWrapper, sql } from "drizzle-orm";

export function projectAccessCondition(
  userId: string | SQLWrapper,
  projectId: string | SQLWrapper,
) {
  return sql<boolean>`(
    EXISTS (
      SELECT 1 FROM "user" AS access_user
      WHERE access_user.id = ${userId}
        AND 'admin' = ANY(string_to_array(access_user.role, ','))
    )
    OR (
      -- Only active identities can access projects
      EXISTS (
        SELECT 1 FROM identity.identities AS cur_ident
        LEFT JOIN "user" AS cur_u ON cur_u.id = ${userId}
        WHERE (cur_ident."identityId" = ${userId} OR lower(cur_ident.email) = lower(cur_u.email))
          AND cur_ident."identityStatus" = 'active'
          AND cur_ident."deletedAt" IS NULL
      )
      AND (
        -- Project shared to GROUP: only active users in that group
        EXISTS (
          SELECT 1 FROM project AS p_grp
          JOIN identity.identities AS grp_ident
            ON (grp_ident."identityId" = ${userId} OR lower(grp_ident.email) = (SELECT lower(u.email) FROM "user" u WHERE u.id = ${userId}))
          WHERE p_grp.id = ${projectId}
            AND p_grp.share_type = 'group'
            AND grp_ident."identityStatus" = 'active'
            AND grp_ident."deletedAt" IS NULL
            AND (
              grp_ident."identityGroupId" = COALESCE(p_grp.shared_group_id, p_grp.group_id)
              OR COALESCE(p_grp.shared_group_id, p_grp.group_id) = ANY(grp_ident."identityGroupIds")
              OR (p_grp.shared_group_ids IS NOT NULL AND grp_ident."identityGroupId" = ANY(p_grp.shared_group_ids))
              OR (p_grp.shared_group_ids IS NOT NULL AND grp_ident."identityGroupIds" && p_grp.shared_group_ids)
              OR EXISTS (
                SELECT 1 FROM public.team_member AS tm
                WHERE tm.user_id = ${userId}
                  AND (
                    tm.team_id = p_grp.group_id
                    OR tm.team_id = p_grp.shared_group_id
                    OR (p_grp.shared_group_ids IS NOT NULL AND tm.team_id = ANY(p_grp.shared_group_ids))
                  )
              )
              OR EXISTS (
                SELECT 1 FROM public.project_group AS pg
                JOIN public.team_member AS tm ON tm.team_id = pg.group_id
                WHERE pg.project_id = p_grp.id
                  AND tm.user_id = ${userId}
              )
              OR EXISTS (
                SELECT 1 FROM identity."identityGroups" AS id_grp
                WHERE (id_grp."identityGroupId" = COALESCE(p_grp.shared_group_id, p_grp.group_id) OR (p_grp.shared_group_ids IS NOT NULL AND id_grp."identityGroupId" = ANY(p_grp.shared_group_ids)))
                  AND id_grp."deletedAt" IS NULL
                  AND grp_ident."identityId" = ANY(id_grp."identityIds")
              )
            )
        )
        -- Project shared to USER: only selected active users
        OR EXISTS (
          SELECT 1 FROM project AS p_usr
          JOIN identity.identities AS usr_ident
            ON (usr_ident."identityId" = ${userId} OR lower(usr_ident.email) = (SELECT lower(u.email) FROM "user" u WHERE u.id = ${userId}))
          WHERE p_usr.id = ${projectId}
            AND p_usr.share_type = 'user'
            AND usr_ident."identityStatus" = 'active'
            AND usr_ident."deletedAt" IS NULL
            AND (
              ${userId} = ANY(COALESCE(p_usr.shared_user_ids, '{}'))
              OR usr_ident."identityId" = ANY(COALESCE(p_usr.shared_user_ids, '{}'))
              OR usr_ident.email = ANY(COALESCE(p_usr.shared_user_ids, '{}'))
              OR EXISTS (
                SELECT 1 FROM workspace_member_project AS wmp
                WHERE wmp.project_id = p_usr.id
                  AND (wmp.user_id = ${userId} OR wmp.user_id = usr_ident."identityId")
              )
            )
        )
        -- Project shared to ALL (workspace-wide default)
        OR (
          EXISTS (
            SELECT 1 FROM project AS p_all
            WHERE p_all.id = ${projectId}
              AND (p_all.share_type IS NULL OR p_all.share_type = 'all' OR p_all.share_type = 'workspace')
          )
          AND NOT EXISTS (
            SELECT 1 FROM project AS access_project
            JOIN workspace_member_access AS access_rule
              ON access_rule.workspace_id = access_project.workspace_id
              AND access_rule.user_id = ${userId}
            WHERE access_project.id = ${projectId}
              AND access_rule.project_access <> 'all'
              AND NOT EXISTS (
                SELECT 1 FROM workspace_member AS access_member
                WHERE access_member.workspace_id = access_project.workspace_id
                  AND access_member.user_id = ${userId}
                  AND 'owner' = ANY(string_to_array(access_member.role, ','))
              )
              AND NOT EXISTS (
                SELECT 1 FROM workspace_member_project AS access_grant
                WHERE access_grant.workspace_id = access_project.workspace_id
                  AND access_grant.user_id = ${userId}
                  AND access_grant.project_id = access_project.id
              )
          )
        )
        -- A ticket share also grants enough project context to open that ticket.
        OR EXISTS (
          SELECT 1 FROM public.task AS shared_task
          WHERE shared_task.project_id = ${projectId}
            AND (
              shared_task.creator_id = ${userId}
              OR shared_task.created_by = ${userId}
              OR shared_task.assignee_id = ${userId}
              OR ${userId} = ANY(COALESCE(shared_task.assignee_ids, '{}'))
              OR ${userId} = ANY(COALESCE(shared_task.shared_user_ids, '{}'))
              OR EXISTS (
                SELECT 1 FROM public.team_member AS shared_tm
                WHERE shared_tm.user_id = ${userId}
                  AND (
                    shared_tm.team_id = shared_task.shared_group_id
                    OR shared_tm.team_id = ANY(COALESCE(shared_task.shared_group_ids, '{}'))
                  )
              )
            )
        )
      )
    )
  )`;
}
