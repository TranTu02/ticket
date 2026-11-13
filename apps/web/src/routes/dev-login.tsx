import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod/v4";
import DevUserPickerPage from "@/components/dev/dev-user-picker-page";

const devLoginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/dev-login")({
  component: DevLoginPage,
  validateSearch: devLoginSearchSchema,
});

function DevLoginPage() {
  const search = useSearch({ from: "/dev-login" });
  return <DevUserPickerPage redirectTo={search.redirect} />;
}
