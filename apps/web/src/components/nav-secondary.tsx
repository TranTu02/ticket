import { useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SidebarMenu className="gap-0.5">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="default"
          className="h-8 text-sm"
          onClick={() =>
            navigate({ to: "/dashboard/settings/account/information" })
          }
        >
          <Settings aria-hidden="true" />
          <span>{t("navigation:userMenu.settings")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
