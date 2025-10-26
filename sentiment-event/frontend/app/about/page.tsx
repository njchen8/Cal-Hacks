import Link from "next/link";

const principles = [
  {
    title: "Authentic data sources",
    description:
      "Every insight is rooted in real conversations. We preserve links and metadata so teams can trace each sentiment back to its source and verify findings.",
  },
  {
    title: "Deep emotional analysis",
    description:
      "Surface-level sentiment isn't enough. We analyze the emotions beneath—joy, trust, concern, and anticipation—to reveal the full story of customer reactions.",
  },
  {
    title: "Built for speed",
    description:
      "Fast, intuitive, and actionable. BluBerri delivers clear insights that help teams make decisions without slowing down their workflow.",
  },
];

export default function AboutPage() {
  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading hero-title fade-up">About BluBerri</h1>
          <p className="section-subtitle fade-up delay-1">
            BluBerri was created at Cal Hacks to revolutionize how teams understand customer sentiment. 
            We combine social listening, emotion analysis, and intelligent data processing to transform 
            raw feedback into actionable insights. Whether you're launching products, managing brand reputation, 
            or tracking market trends, BluBerri helps you understand what your customers truly feel.
          </p>
        </header>

        <div className="feature-grid">
          {principles.map((item, index) => (
            <article
              key={item.title}
              className="feature-card fade-up"
              style={{ animationDelay: `${0.12 * index + 0.1}s` }}
            >
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="hero-actions fade-up delay-2">
          <Link href="/analyze" className="button-primary">
            View usage guide & analyzer
          </Link>
        </div>
      </section>
    </div>
  );
}
