import Link from "next/link";

const principles = [
  {
    title: "Evidence-first",
    description:
      "Every insight ties back to a real conversation. We keep links to posts and metadata intact so analysts can verify context.",
  },
  {
    title: "Multi-dimensional",
    description:
      "Primary sentiment only tells part of the story. We surface leading emotions to explain why perceptions trend positive or negative.",
  },
  {
    title: "Accessible",
    description:
      "Policy and research teams deserve usable tooling. Sentiment Event removes jargon and focuses on actionable narratives.",
  },
];

export default function AboutPage() {
  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading">About Sentiment Event</h1>
          <p className="section-subtitle">
            Sentiment Event began at Cal Hacks to explore how AI can keep the pulse on how communities respond to
            large-scale decisions. From infrastructure upgrades to ballot measures, we translate social discourse into
            actionable mood boards for civic leaders.
          </p>
        </header>

        <div className="feature-grid">
          {principles.map((item) => (
            <article key={item.title} className="feature-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="hero-actions">
          <Link href="/analyze" className="button-primary">
            View usage guide & analyzer
          </Link>
        </div>
      </section>
    </div>
  );
}
