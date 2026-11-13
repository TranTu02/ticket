import Search from "@/components/search";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function WorkspaceSwitcher() {
  const { data: workspace } = useActiveWorkspace();
  const workspaceName = workspace?.name || "IRDOP";

  return (
    <div className="flex items-center justify-between w-full gap-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="group h-8 w-full rounded-md px-2 text-sidebar-foreground hover:bg-transparent cursor-default select-none"
            size="default"
          >
            <div className="flex items-center min-w-0 w-full">
              <span className="truncate text-sm font-semibold text-foreground">
                {workspaceName}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div className="flex items-center gap-0.5">
        <Search />
        <div className="h-8 w-8 shrink-0">
          <UserAvatar />
        </div>
      </div>
    </div>
  );
}
