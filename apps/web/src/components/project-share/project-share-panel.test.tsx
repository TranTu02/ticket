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
import { ProjectSharePanel } from "./project-share-panel";
import type {
  ActiveGroup,
  ActiveUser,
  ProjectShareConfig,
} from "@/types/project-share";

const mockUpdateProjectShare = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

const mockGroups: ActiveGroup[] = [
  { id: "grp-1", name: "Engineering Team", memberCount: 15 },
  { id: "grp-2", name: "Design Team", memberCount: 5 },
];

const mockUsers: ActiveUser[] = [
  {
    id: "usr-1",
    name: "Alice Adams",
    email: "alice@example.com",
    groupName: "Engineering Team",
  },
  {
    id: "usr-2",
    name: "Bob Brown",
    email: "bob@example.com",
    groupName: "Design Team",
  },
];

let mockCurrentShare: ProjectShareConfig = {
  projectId: "proj-1",
  shareType: "all",
  groupId: null,
  sharedGroupIds: [],
  sharedUserIds: [],
};

vi.mock("@/hooks/queries/project/use-get-project-share", () => ({
  default: () => ({
    data: mockCurrentShare,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/queries/project/use-get-sharing-groups", () => ({
  default: () => ({
    data: mockGroups,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/queries/project/use-get-sharing-users", () => ({
  default: () => ({
    data: mockUsers,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/mutations/project/use-update-project-share", () => ({
  default: () => ({
    mutateAsync: mockUpdateProjectShare,
    isPending: false,
  }),
}));

describe("ProjectSharePanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentShare = {
      projectId: "proj-1",
      shareType: "all",
      groupId: null,
      sharedGroupIds: [],
      sharedUserIds: [],
    };
  });

  it("renders 3 share type options and selects 'all' by default", () => {
    render(<ProjectSharePanel projectId="proj-1" />);

    expect(screen.getByText("Tất cả thành viên")).toBeDefined();
    expect(screen.getByText("Theo Nhóm")).toBeDefined();
    expect(screen.getByText("Theo Người dùng")).toBeDefined();
    expect(screen.getByText(/Chế độ mặc định Workspace/i)).toBeDefined();
  });

  it("switches to Group share mode and allows selecting an active group", async () => {
    mockUpdateProjectShare.mockResolvedValue({});

    render(<ProjectSharePanel projectId="proj-1" />);

    fireEvent.click(screen.getByText("Theo Nhóm"));

    expect(screen.getByText("Engineering Team")).toBeDefined();
    expect(screen.getByText("Design Team")).toBeDefined();
    expect(screen.getByText("15 thành viên")).toBeDefined();

    // Select Engineering Team
    fireEvent.click(screen.getByText("Engineering Team"));

    // Click Save
    const saveButton = screen.getByRole("button", {
      name: /Lưu quyền truy cập/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProjectShare).toHaveBeenCalledWith({
        shareType: "group",
        groupId: "grp-1",
        sharedGroupId: "grp-1",
        sharedGroupIds: ["grp-1"],
        sharedUserIds: [],
      });
    });
  });

  it("switches to User share mode, filters and multi-selects users", async () => {
    mockUpdateProjectShare.mockResolvedValue({});

    render(<ProjectSharePanel projectId="proj-1" />);

    fireEvent.click(screen.getByText("Theo Người dùng"));

    expect(screen.getByText("Alice Adams")).toBeDefined();
    expect(screen.getByText("Bob Brown")).toBeDefined();

    // Select Alice Adams
    fireEvent.click(screen.getByText("Alice Adams"));

    // Click Save
    const saveButton = screen.getByRole("button", {
      name: /Lưu quyền truy cập/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProjectShare).toHaveBeenCalledWith({
        shareType: "user",
        groupId: null,
        sharedGroupId: null,
        sharedGroupIds: [],
        sharedUserIds: ["usr-1"],
      });
    });
  });
});
