import {
	Dialog,
	DialogDescription,
	DialogHeader,
	DialogPanel,
	DialogPopup,
	DialogTitle,
} from "@/components/ui/dialog";
import { TaskSharePanel } from "./task-share-panel";

interface TaskShareModalProps {
	open: boolean;
	onClose: () => void;
	taskId: string;
	taskTitle?: string;
}

export function TaskShareModal({
	open,
	onClose,
	taskId,
	taskTitle,
}: TaskShareModalProps) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogPopup className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Chia sẻ ticket</DialogTitle>
					<DialogDescription>
						{taskTitle
							? `Thiết lập quyền truy cập cho ticket "${taskTitle}".`
							: "Thiết lập người xem, nhóm được chia sẻ và người tạo ticket."}
					</DialogDescription>
				</DialogHeader>
				<DialogPanel className="p-6 pt-0">
					<TaskSharePanel
						taskId={taskId}
						taskTitle={taskTitle}
						hideHeader
						onSaved={onClose}
					/>
				</DialogPanel>
			</DialogPopup>
		</Dialog>
	);
}

export default TaskShareModal;
