import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface EditorialCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "flat" | "bordered" | "elevated";
  interactive?: boolean;
}

/**
 * Shared card primitive used by article/entity/topic/resource surfaces.
 * Enforces consistent radius, padding, hover, and border tokens.
 */
export const EditorialCard = forwardRef<HTMLDivElement, EditorialCardProps>(
  ({ variant = "flat", interactive = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card text-card-foreground rounded-md",
        variant === "bordered" && "border border-border",
        variant === "elevated" && "border border-border shadow-sm",
        interactive &&
          "transition-colors hover:border-foreground/30 focus-within:border-foreground/40",
        className,
      )}
      {...props}
    />
  ),
);
EditorialCard.displayName = "EditorialCard";

export const EditorialCardMedia = ({
  ratio = "16/9",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ratio?: "16/9" | "16/10" | "4/3" | "1/1" }) => (
  <div
    className={cn("overflow-hidden bg-muted", className)}
    style={{ aspectRatio: ratio.replace("/", " / ") }}
    {...props}
  />
);

export const EditorialCardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 md:p-5 space-y-2", className)} {...props} />
);
