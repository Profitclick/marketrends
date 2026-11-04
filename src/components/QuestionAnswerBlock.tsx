interface QA {
  q: string;
  a: string;
}

export const QuestionAnswerBlock = ({ items, title = "Spørsmål og svar" }: { items: QA[]; title?: string }) => {
  if (!items?.length) return null;
  return (
    <section className="my-10">
      <h2 className="font-serif text-2xl mb-4">{title}</h2>
      <div className="space-y-4">
        {items.map((qa, i) => (
          <div key={i} className="border-b border-border pb-4">
            <h3 className="font-medium mb-1">{qa.q}</h3>
            <p className="text-muted-foreground">{qa.a}</p>
          </div>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((qa) => ({
              "@type": "Question",
              name: qa.q,
              acceptedAnswer: { "@type": "Answer", text: qa.a },
            })),
          }),
        }}
      />
    </section>
  );
};

export default QuestionAnswerBlock;
