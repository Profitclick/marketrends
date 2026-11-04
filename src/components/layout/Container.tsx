import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "main" | "article" | "header" | "footer" | "nav";
  size?: "sm" | "md" | "lg" | "full";
}

const sizes = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-[1200px]",
  full: "max-w-none",
};

/**
 * Standard page container. Enforces the 1200px editorial width and
 * consistent horizontal padding across every route.
 */
export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ as: Tag = "div", size = "lg", className, ...props }, ref) => (
    <Tag
      ref={ref as never}
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizes[size], className)}
      {...props}
    />
  ),
);
Container.displayName = "Container";
