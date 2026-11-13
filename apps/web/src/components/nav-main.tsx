import { useLocation, useNavigate } from "@tanstack/react-router";
import { Bot, House, Inbox, type LucideIcon, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";

type NavItem = {
  title: string;
  icon: LucideIcon;
  url: string;
  count?: number;
  emphasizeCount?: boolean;
};

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { data: notifications = [] } = useGetNotifications(workspace?.id);

  if (!workspace) return null;

  const homeUrl = `/dashboard/workspace/${workspace.id}`;
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const navItems: NavItem[] = [
    { title: t("navigation:sidebar.home"), icon: House, url: homeUrl },
    {
      title: t("navigation:sidebar.inbox"),
      icon: Inbox,
      url: `${homeUrl}/inbox`,
      count: unreadCount,
      emphasizeCount: true,
    },
    {
      title: t("navigation:sidebar.aiChat"),
      icon: Bot,
      url: `${homeUrl}/chat`,
    },
    {
      title: t("navigation:sidebar.members"),
      icon: Users,
      url: `${homeUrl}/members`,
    },
  ];

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                size="default"
                className="h-8 text-sm"
                onClick={() => navigate({ to: item.url })}
              >
                <item.icon aria-hidden="true" />
                <span>{item.title}</span>
                {item.count ? (
                  <span
                    className={cn(
                      "ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] tabular-nums",
                      item.emphasizeCount
                        ? "bg-foreground font-semibold text-background"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
