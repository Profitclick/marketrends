interface Props {
  text: string;
}

export const TLDR = ({ text }: Props) => {
  if (!text) return null;
  return (
    <div className="tldr border-l-4 border-primary bg-muted/40 px-4 py-3 my-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">TL;DR</div>
      <p className="text-base leading-relaxed">{text}</p>
    </div>
  );
};

export default TLDR;
