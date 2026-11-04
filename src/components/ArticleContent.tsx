import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ArticleContentProps {
  content: string;
  relatedArticles?: { slug: string; title: string; category: string }[];
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const generateId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
};

const TocCollapsible = ({ 
  tableOfContents, 
  onItemClick 
}: { 
  tableOfContents: TocItem[]; 
  onItemClick: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="mb-8 bg-muted/30 rounded-lg border border-border/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Innhold ({tableOfContents.length})
        </h4>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isOpen && (
        <ul className="px-4 pb-4 space-y-2">
          {tableOfContents.map((item, index) => (
            <li 
              key={index} 
              className={`${item.level === 3 ? 'ml-4' : item.level === 2 ? 'ml-2' : ''}`}
            >
              <button
                onClick={() => onItemClick(item.id)}
                className="text-[14px] text-foreground/70 hover:text-primary transition-colors text-left leading-relaxed"
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

export const ArticleContent = ({ content, relatedArticles }: ArticleContentProps) => {
  // Extract headings for table of contents
  const tableOfContents = useMemo(() => {
    const paragraphs = content.split('\n\n');
    const toc: TocItem[] = [];

    paragraphs.forEach((paragraph) => {
      const trimmed = paragraph.trim();
      
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        const text = trimmed.replace(/^#\s*/, '');
        toc.push({ id: generateId(text), text, level: 1 });
      } else if (trimmed.startsWith('## ')) {
        const text = trimmed.replace(/^##\s*/, '');
        toc.push({ id: generateId(text), text, level: 2 });
      } else if (trimmed.startsWith('### ')) {
        const text = trimmed.replace(/^###\s*/, '');
        toc.push({ id: generateId(text), text, level: 3 });
      }
    });

    return toc;
  }, [content]);

  // Parse and render article content with proper journalistic formatting
  const renderContent = () => {
    const paragraphs = content.split('\n\n');
    const elements: JSX.Element[] = [];
    let paragraphCount = 0;

    paragraphs.forEach((paragraph, idx) => {
      const trimmed = paragraph.trim();
      
      if (!trimmed) return;

      // Heading 1
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        const text = trimmed.replace(/^#\s*/, '');
        const id = generateId(text);
        elements.push(
          <h2 key={idx} id={id} className="text-lg md:text-xl font-semibold mt-10 mb-4 text-foreground leading-normal tracking-tight scroll-mt-24">
            {text}
          </h2>
        );
        return;
      }

      // Heading 2
      if (trimmed.startsWith('## ')) {
        const text = trimmed.replace(/^##\s*/, '');
        const id = generateId(text);
        elements.push(
          <h2 key={idx} id={id} className="text-lg md:text-xl font-semibold mt-10 mb-4 text-foreground leading-normal tracking-tight scroll-mt-24">
            {text}
          </h2>
        );
        return;
      }

      // Heading 3
      if (trimmed.startsWith('### ')) {
        const text = trimmed.replace(/^###\s*/, '');
        const id = generateId(text);
        elements.push(
          <h3 key={idx} id={id} className="text-base md:text-lg font-medium mt-8 mb-3 text-foreground leading-normal scroll-mt-24">
            {text}
          </h3>
        );
        return;
      }

      // Bold lead paragraph (ingress)
      if (trimmed.startsWith('**Ingress:**') || trimmed.startsWith('**')) {
        const cleanText = trimmed.replace(/\*\*/g, '');
        elements.push(
          <p key={idx} className="text-[15px] md:text-[16px] text-foreground/80 mb-5 leading-[1.85]">
            {cleanText.replace(/^Ingress:\s*/, '')}
          </p>
        );
        return;
      }

      // Bullet list
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').filter(line => line.startsWith('- ') || line.startsWith('* '));
        elements.push(
          <ul key={idx} className="list-disc ml-5 mb-5 space-y-2">
            {items.map((item, i) => (
              <li key={i} className="text-[15px] md:text-[15px] leading-[1.8] text-foreground/80">
                {item.replace(/^[-*]\s*/, '')}
              </li>
            ))}
          </ul>
        );
        return;
      }

      // Numbered list
      if (/^\d+\./.test(trimmed)) {
        const items = trimmed.split('\n').filter(line => /^\d+\./.test(line));
        elements.push(
          <ol key={idx} className="list-decimal ml-5 mb-5 space-y-2">
            {items.map((item, i) => (
              <li key={i} className="text-[15px] md:text-[15px] leading-[1.8] text-foreground/80">
                {item.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ol>
        );
        return;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        elements.push(
          <blockquote key={idx} className="border-l-3 border-accent pl-5 py-3 my-8 italic text-[15px] md:text-[15px] leading-[1.75] text-muted-foreground bg-muted/5">
            {trimmed.replace(/^>\s*/, '')}
          </blockquote>
        );
        return;
      }

      // Regular paragraph - add drop cap to first paragraph
      paragraphCount++;
      const isFirstParagraph = paragraphCount === 1;
      
      // Insert related article link after 3rd paragraph
      if (paragraphCount === 4 && relatedArticles && relatedArticles.length > 0) {
        const related = relatedArticles[0];
        elements.push(
          <aside key={`related-${idx}`} className="my-6 py-3 border-t border-b border-border/50">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Les også:</span>
            <Link 
              to={`/${related.slug}`} 
              className="block mt-1 text-[15px] font-medium text-primary hover:underline transition-colors"
            >
              {related.title}
            </Link>
          </aside>
        );
      }

      elements.push(
        <p 
          key={idx} 
          className={`text-[15px] md:text-[16px] leading-[1.85] mb-5 text-foreground/80 ${isFirstParagraph ? 'first-letter:text-4xl first-letter:font-semibold first-letter:float-left first-letter:mr-2 first-letter:leading-none first-letter:text-primary' : ''}`}
        >
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });

    return elements;
  };

  // Handle inline formatting (bold, italic, links) - returns JSX
  const renderInlineFormatting = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*|\*(.*?)\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      if (match[1] !== undefined) {
        parts.push(<strong key={key++}>{match[1]}</strong>);
      } else if (match[2] !== undefined) {
        parts.push(<em key={key++}>{match[2]}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  };

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <article className="article-content prose prose-lg max-w-none">
      {/* Table of Contents */}
      {tableOfContents.length > 1 && (
        <TocCollapsible 
          tableOfContents={tableOfContents} 
          onItemClick={handleTocClick} 
        />
      )}
      
      {renderContent()}
    </article>
  );
};
