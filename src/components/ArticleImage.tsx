import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

interface ArticleImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  src: string;
  fallbackSrc?: string;
}

export const ArticleImage = ({ src, fallbackSrc, alt, fetchPriority, ...props }: ArticleImageProps) => {
  const [activeSrc, setActiveSrc] = useState(src);

  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
    } else if (activeSrc !== "/placeholder.svg") {
      setActiveSrc("/placeholder.svg");
    }
  };

  // React 18 forwards the standards-based attribute only in lowercase.
  const priorityProps = fetchPriority ? { fetchpriority: fetchPriority } : {};
  return <img {...props} {...priorityProps} src={activeSrc} alt={alt} onError={handleError} />;
};
