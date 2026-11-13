import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { TaskSharePanel } from "./task-share-panel";

const mocks = vi.hoisted(() => ({
  canUpdateTasks: vi.fn(),
  updateShare: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: mocks.canUpdateTasks,
    isCheckingPermissions: false,
  }),
}));

vi.mock("@/hooks/queries/task/use-get-task-share", () => ({
  useGetTaskShare: () => ({
    data: {
      taskId: "task-1",
      creatorId: "creator-1",
      shareType: "all",
      sharedGroupIds: [],
      sharedUserIds: [],
    },
    isLoading: false,
  }),
  default: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/hooks/queries/project/use-get-sharing-users", () => ({
  useGetSharingUsers: () => ({
    data: [
      { id: "user-1", name: "Nguyễn Văn A", email: "a@example.com" },
      { id: "user-2", name: "Trần Thị B", email: "b@example.com" },
    ],
    isLoading: false,
  }),
  default: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/queries/project/use-get-sharing-groups", () => ({
  useGetSharingGroups: () => ({
    data: [{ id: "group-1", name: "Nhóm Kỹ thuật", memberCount: 4 }],
    isLoading: false,
  }),
  default: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-share", () => ({
  useUpdateTaskShare: () => ({
    mutateAsync: mocks.updateShare,
    isPending: false,
  }),
  default: () => ({ mutateAsync: mocks.updateShare, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

// The real picker belongs to another slice; this stub exposes the props the
// panel wires into it so the panel's own behaviour can be asserted.
vi.mock("@/components/share/share-picker", () => ({
  SharePicker: (props: {
    mode: string;
    creatorId: string | null;
    selectedUserIds: string[];
    selectedGroupIds: string[];
    onCreatorIdChange: (id: string | null) => void;
    onSelectedUserIdsChange: (ids: string[]) => void;
    onSelectedGroupIdsChange: (ids: string[]) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="share-picker" data-mode={props.mode}>
      <pre data-testid="picker-state">
        {JSON.stringify({
          creatorId: props.creatorId,
          selectedUserIds: props.selectedUserIds,
          selectedGroupIds: props.selectedGroupIds,
          disabled: props.disabled,
        })}
      </pre>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onCreatorIdChange("user-2")}
      >
        stub:pick-creator
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onSelectedUserIdsChange(["user-1"])}
      >
        stub:pick-user
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onSelectedGroupIdsChange(["group-1"])}
      >
        stub:pick-group
      </button>
    </div>
  ),
}));

function pickerState() {
  return JSON.parse(screen.getByTestId("picker-state").textContent ?? "{}") as {
    creatorId: string | null;
    selectedUserIds: string[];
    selectedGroupIds: string[];
    disabled?: boolean;
  };
}

function renderPanel(overrides: { onSaved?: () => void } = {}) {
  const onSaved = overrides.onSaved ?? vi.fn();
  render(
    <TaskSharePanel taskId="task-1" taskTitle="Ticket A" onSaved={onSaved} />,
  );
  return { onSaved };
}

beforeEach(() => {
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.updateShare.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskSharePanel", () => {
  it("renders the access header and seeds the creator from the loaded share", () => {
    renderPanel();

    expect(
      screen.getByText("Quyền truy cập & Chia sẻ ticket"),
    ).toBeInTheDocument();
    expect(pickerState().creatorId).toBe("creator-1");
    expect(pickerState().disabled).toBe(false);
  });

  it("saves the creator together with the selected people in user mode", async () => {
    const { onSaved } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Theo Người dùng/i }));
    fireEvent.click(screen.getByRole("button", { name: "stub:pick-creator" }));
    fireEvent.click(screen.getByRole("button", { name: "stub:pick-user" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Lưu quyền truy cập/i }),
    );

    await waitFor(() => expect(mocks.updateShare).toHaveBeenCalledTimes(1));
    expect(mocks.updateShare).toHaveBeenCalledWith({
      creatorId: "user-2",
      shareType: "user",
      groupId: null,
      sharedGroupId: null,
      sharedGroupIds: [],
      sharedUserIds: ["user-1"],
    });
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("saves the selected group in group mode", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Theo Nhóm/i }));
    fireEvent.click(screen.getByRole("button", { name: "stub:pick-group" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Lưu quyền truy cập/i }),
    );

    await waitFor(() => expect(mocks.updateShare).toHaveBeenCalledTimes(1));
    expect(mocks.updateShare).toHaveBeenCalledWith({
      creatorId: "creator-1",
      shareType: "group",
      groupId: "group-1",
      sharedGroupId: "group-1",
      sharedGroupIds: ["group-1"],
      sharedUserIds: [],
    });
  });

  it("blocks saving in group mode when no group is selected", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Theo Nhóm/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Lưu quyền truy cập/i }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Vui lòng chọn một nhóm để chia sẻ.",
      ),
    );
    expect(mocks.updateShare).not.toHaveBeenCalled();
  });

  it("blocks saving in user mode when nobody is selected", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Theo Người dùng/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Lưu quyền truy cập/i }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Vui lòng chọn ít nhất một nhân sự để chia sẻ.",
      ),
    );
    expect(mocks.updateShare).not.toHaveBeenCalled();
  });

  it("renders read-only and disables the picker without update permission", () => {
    mocks.canUpdateTasks.mockReturnValue(false);
    renderPanel();

    expect(
      screen.getByText(/Bạn chỉ có quyền xem cấu hình chia sẻ/i),
    ).toBeInTheDocument();
    expect(pickerState().disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: /Lưu quyền truy cập/i }),
    ).toBeDisabled();
  });
});
