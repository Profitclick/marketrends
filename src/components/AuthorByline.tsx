import { Author } from "@/utils/authors";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface AuthorBylineProps {
  author: Author;
  date: string;
  readingTime: number;
  category: string;
}

export const AuthorByline = ({ author, date, readingTime, category }: AuthorBylineProps) => {
  return (
    <div className="flex items-center gap-4 py-5 border-y border-border">
      <Avatar className="h-10 w-10">
        <AvatarImage src={author.image} alt={author.name} />
        <AvatarFallback>{author.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{author.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
          <time>{date}</time>
          <span>·</span>
          <span>{readingTime} min lesing</span>
        </div>
      </div>
    </div>
  );
};
