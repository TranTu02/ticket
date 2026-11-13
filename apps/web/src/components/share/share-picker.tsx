import { Check, ChevronDown, Search, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import type { ActiveGroup, ActiveUser, ShareType } from "@/types/project-share";
import type { TaskShareVisibility } from "@/types/task-share";

type SharePickerProps = {
  mode: ShareType | TaskShareVisibility;
  users: ActiveUser[];
  groups: ActiveGroup[];
  loadingUsers?: boolean;
  loadingGroups?: boolean;
  creatorId: string | null;
  onCreatorIdChange: (id: string | null) => void;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
  selectedGroupIds: string[];
  onSelectedGroupIdsChange: (ids: string[]) => void;
  disabled?: boolean;
  creatorEditable?: boolean;
  showAllTargets?: boolean;
};

export function PersonPicker({
  label,
  placeholder,
  users,
  selectedIds,
  onChange,
  multiple = false,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  users: ActiveUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = users.filter((user) => selectedIds.includes(user.id));
  const filtered = users.filter((user) =>
    `${user.name ?? ""} ${user.email}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const toggle = (id: string) => {
    if (!multiple) {
      onChange(selectedIds.includes(id) ? [] : [id]);
      setOpen(false);
      return;
    }
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {multiple ? (
                <Users className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <UserRound className="size-4 shrink-0 text-muted-foreground" />
              )}
              {selected.length
                ? multiple
                  ? `${selected.length} người được chọn`
                  : selected[0]?.name || selected[0]?.email
                : placeholder}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--anchor-width) min-w-64 p-0"
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc email"
              className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length ? (
              filtered.map((user) => {
                const checked = selectedIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggle(user.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                  >
                    <Avatar className="size-7">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name ?? user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {user.name || user.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.name ? user.email : ""}
                      </span>
                    </span>
                    {checked && <Check className="size-4 text-primary" />}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy người phù hợp
              </p>
            )}
          </div>
          {multiple && selected.length > 0 && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
              >
                Bỏ chọn tất cả
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {multiple && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={user.id}
              className="rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {user.name || user.email}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SharePicker({
  mode,
  users,
  groups,
  loadingUsers = false,
  loadingGroups = false,
  creatorId,
  onCreatorIdChange,
  selectedUserIds,
  onSelectedUserIdsChange,
  selectedGroupIds,
  onSelectedGroupIdsChange,
  disabled = false,
  creatorEditable = true,
  showAllTargets = false,
}: SharePickerProps) {
  const [groupSearch, setGroupSearch] = useState("");
  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds],
  );
  const toggleGroup = (id: string) =>
    onSelectedGroupIdsChange(
      selectedGroupIds.includes(id)
        ? selectedGroupIds.filter((item) => item !== id)
        : [...selectedGroupIds, id],
    );
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 md:grid-cols-2">
        {creatorEditable ? (
          <PersonPicker
            label="Người tạo ticket"
            placeholder="Chọn người tạo"
            users={users}
            selectedIds={creatorId ? [creatorId] : []}
            onChange={(ids) => onCreatorIdChange(ids[0] ?? null)}
            disabled={disabled || loadingUsers}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Người tạo ticket</p>
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {users.find((user) => user.id === creatorId)?.name ||
                users.find((user) => user.id === creatorId)?.email ||
                "Người dùng hiện tại"}
            </p>
          </div>
        )}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">
            Người được chia sẻ
          </p>
          <p>
            Chọn riêng những người hoặc nhóm được xem ticket. Người tạo luôn giữ
            quyền truy cập.
          </p>
        </div>
      </div>
      <div
        className={cn(
          "grid gap-4",
          showAllTargets ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {(mode === "user" || showAllTargets) && (
          <PersonPicker
            label="Chia sẻ cho người dùng"
            placeholder={
              loadingUsers ? "Đang tải danh sách…" : "Chọn một hoặc nhiều người"
            }
            users={users}
            selectedIds={selectedUserIds}
            onChange={onSelectedUserIdsChange}
            multiple
            disabled={disabled || loadingUsers}
          />
        )}
        {(mode === "group" || showAllTargets) && (
          <div className="space-y-2">
            <label htmlFor="share-group-search" className="text-sm font-medium">
              Chia sẻ cho nhóm
            </label>
            <div className="flex items-center gap-2 rounded-md border px-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                id="share-group-search"
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Tìm nhóm"
                className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {groups
                .filter((group) =>
                  group.name
                    .toLowerCase()
                    .includes(groupSearch.trim().toLowerCase()),
                )
                .map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    disabled={disabled || loadingGroups}
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent",
                      selectedGroupIds.includes(group.id) && "bg-accent/60",
                    )}
                  >
                    <Users className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{group.name}</span>
                    {group.memberCount !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {group.memberCount}
                      </span>
                    )}
                    {selectedGroupIds.includes(group.id) && (
                      <Check className="size-4 text-primary" />
                    )}
                  </button>
                ))}
              {groups.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {loadingGroups ? "Đang tải nhóm…" : "Không có nhóm"}
                </p>
              )}
            </div>
            {selectedGroups.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Đã chọn {selectedGroups.length} nhóm
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SharePicker;
