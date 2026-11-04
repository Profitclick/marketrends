import { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface EditorialImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  ratio?: "16/9" | "16/10" | "4/3" | "1/1" | "3/2";
  eager?: boolean;
}

/**
 * Enforces aspect ratio, lazy loading, async decoding, and object-cover
 * cropping. Wrap raw <img> in article surfaces with this to prevent CLS.
 */
export const EditorialImage = ({
  ratio = "16/9",
  eager = false,
  className,
  alt,
  ...props
}: EditorialImageProps) => (
  <div
    className="overflow-hidden bg-muted w-full"
    style={{ aspectRatio: ratio.replace("/", " / ") }}
  >
    <img
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      alt={alt ?? ""}
      className={cn("w-full h-full object-cover", className)}
      {...props}
    />
  </div>
);
