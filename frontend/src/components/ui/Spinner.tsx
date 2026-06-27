import { cn } from "@/lib/cn";

type SpinnerSize = "sm" | "md" | "lg";

const sizes: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-[3px]",
};

export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-[spin_0.7s_linear_infinite] rounded-full border-ink-200 border-t-brand-600",
        sizes[size],
        className,
      )}
    />
  );
}
