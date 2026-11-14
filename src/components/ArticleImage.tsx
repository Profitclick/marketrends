import { useEffect, useState, type ImgHTMLAttributes } from "react";

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

  return <img {...props} src={activeSrc} alt={alt} onError={handleError} />;
};
