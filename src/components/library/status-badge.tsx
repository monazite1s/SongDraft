/**
 * 共享状态徽标（docs/implementation-todo.md §7 UI 重设计）。
 * 两库（创作库 / 灵感库）通用：克制语义色，圆角 pill，细边框，11px。
 *
 * variant 语义：
 * - success：已完成（ready）
 * - brand：协作中（collaborating）
 * - warning：分析中 / 待确认（analyzing / review）
 * - neutral：草稿 / 已归档（draft / archived）
 */
import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "brand" | "warning" | "neutral";

const VARIANT_CLASS: Record<StatusVariant, string> = {
  success: "border-success/30 bg-success/10 text-success-foreground",
  brand: "border-brand/30 bg-brand-muted text-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** ProjectStatus → StatusVariant 映射（创作库）。 */
export function projectStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "ready":
      return "success";
    case "collaborating":
      return "brand";
    case "analyzing":
    case "review":
      return "warning";
    case "draft":
    case "archived":
    default:
      return "neutral";
  }
}
