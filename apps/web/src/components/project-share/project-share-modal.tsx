import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectSharePanel } from "./project-share-panel";

interface ProjectShareModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
}

export function ProjectShareModal({
  open,
  onClose,
  projectId,
  projectName,
}: ProjectShareModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Chia sẻ dự án</DialogTitle>
          <DialogDescription>
            {projectName
              ? `Thiết lập quyền truy cập cho dự án "${projectName}".`
              : "Thiết lập quyền truy cập và phân quyền xem dự án."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="p-6 pt-0">
          <ProjectSharePanel
            projectId={projectId}
            hideHeader
            onSaved={onClose}
          />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

export default ProjectShareModal;
