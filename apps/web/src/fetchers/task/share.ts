import { getApiUrl } from "../get-api-url";
import type {
	TaskShareConfig,
	UpdateTaskShareRequest,
} from "@/types/task-share";

async function parseError(response: Response, fallback: string): Promise<string> {
	try {
		const body = await response.json();
		if (body?.message) return String(body.message);
		if (body?.error) return String(body.error);
	} catch {
		// ignore
	}
	return fallback;
}

export async function fetchTaskShare(
	taskId: string,
): Promise<TaskShareConfig> {
	const response = await fetch(getApiUrl(`/task/${taskId}/share`), {
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(
			await parseError(response, "Không tải được cấu hình chia sẻ ticket."),
		);
	}
	return (await response.json()) as TaskShareConfig;
}

export async function updateTaskShare(
	taskId: string,
	payload: UpdateTaskShareRequest,
): Promise<TaskShareConfig> {
	const response = await fetch(getApiUrl(`/task/${taskId}/share`), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		throw new Error(
			await parseError(response, "Cập nhật cấu hình chia sẻ ticket thất bại."),
		);
	}
	return (await response.json()) as TaskShareConfig;
}
