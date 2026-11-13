import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchDevUsers,
  loginAsDevUser,
  type DevIdentity,
} from "@/fetchers/dev/dev-users";
import { cn } from "@/lib/cn";

interface DevUserPickerPageProps {
  redirectTo?: string;
}

function initials(name: string | null, email: string) {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export default function DevUserPickerPage({ redirectTo }: DevUserPickerPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<DevIdentity[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const next = await fetchDevUsers(query);
        if (!cancelled) setUsers(next);
        if (!cancelled) setError("");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t("devAuth:loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t]);

  const enter = async (user: DevIdentity) => {
    if (pendingId) return;
    setPendingId(user.identityId);
    setError("");
    try {
      const result = await loginAsDevUser(user.identityId);
      const target =
        redirectTo && redirectTo.startsWith("/")
          ? redirectTo
          : result.workspaceId
            ? `/dashboard/workspace/${result.workspaceId}`
            : "/dashboard";
      // Full reload để auth store nhận session mới.
      window.location.assign(target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("devAuth:loginError"));
      setPendingId(null);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <PageTitle title={t("devAuth:pageTitle")} />
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-1 border-b p-6">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <UserRound className="size-4" aria-hidden />
            </span>
            <h1 className="font-semibold text-lg">{t("devAuth:title")}</h1>
            <Badge variant="outline" className="ml-auto text-[10px] uppercase">
              dev
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{t("devAuth:subtitle")}</p>
        </div>

        <div className="border-b p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("devAuth:searchPlaceholder")}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground text-sm">
              <Spinner className="size-4" />
              {t("devAuth:loading")}
            </div>
          ) : users.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground text-sm">
              {t("devAuth:empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {users.map((user) => {
                const pending = pendingId === user.identityId;
                const disabled = Boolean(pendingId) && !pending;
                return (
                  <li key={user.identityId}>
                    <button
                      type="button"
                      onClick={() => enter(user)}
                      disabled={disabled || pending}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                        "disabled:opacity-50",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs">
                        {initials(user.name, user.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium text-sm">
                            {user.name || user.email}
                          </span>
                          {user.status && user.status !== "active" ? (
                            <Badge variant="outline" className="text-[10px]">
                              {t("devAuth:inactive")}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block truncate text-muted-foreground text-xs">
                          {user.email}
                        </span>
                        {user.groupName || user.roles.length > 0 ? (
                          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                            {[user.groupName, user.roles.slice(0, 3).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      {pending ? (
                        <Spinner className="size-4 shrink-0" />
                      ) : (
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p role="alert" className="border-t bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
          <p className="text-muted-foreground text-xs">{t("devAuth:footerHint")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/auth/sign-in" })}
          >
            {t("devAuth:signInInstead")}
          </Button>
        </div>
      </div>
    </div>
  );
}
