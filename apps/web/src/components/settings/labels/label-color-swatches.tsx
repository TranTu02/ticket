import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import labelColors from "@/constants/label-colors";
import { cn } from "@/lib/cn";

// Maps a label color value to the suffix of its existing i18n key
// (common:modals.createTask.labelColors.*), mirroring create-task-modal.tsx.
const LABEL_KEY_BY_VALUE: Record<string, string> = {
  gray: "stone",
  "dark-gray": "slate",
  purple: "lavender",
  teal: "sage",
  green: "forest",
  yellow: "amber",
  orange: "terracotta",
  pink: "rose",
  red: "crimson",
  blue: "ocean",
  sky: "sky",
  cyan: "lagoon",
  fuchsia: "orchid",
};

type LabelColorSwatchesProps = {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
};

export function LabelColorSwatches({
  value,
  onChange,
  labelledBy,
}: LabelColorSwatchesProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap items-center gap-2.5"
    >
      {labelColors.map((color) => {
        const selected = color.value === value;
        const label = t(
          `common:modals.createTask.labelColors.${LABEL_KEY_BY_VALUE[color.value] ?? color.value}`,
          { defaultValue: color.label },
        );

        return (
          <button
            key={color.value}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            title={label}
            onClick={() => onChange(color.value)}
            className={cn(
              "flex size-6 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
              selected &&
                "ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover",
            )}
            style={{ backgroundColor: color.color }}
          >
            {selected ? (
              <CheckIcon
                aria-hidden="true"
                className="size-3"
                strokeWidth={3}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
