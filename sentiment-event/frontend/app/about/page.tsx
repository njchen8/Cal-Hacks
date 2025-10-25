import Link from "next/link";

const principles = [
  {
    title: "Customer-first evidence",
    description:
      "Every insight ties back to a real post. Keep links and metadata intact so product squads can drill into authentic conversations.",
  },
  {
    title: "Emotion explains impact",
    description:
      "Primary sentiment is just the start. We surface the emotions driving delight, concern, or anticipation around every release.",
  },
  {
    title: "Built for product velocity",
    description:
      "Growth and CX teams deserve tooling they can act on. Bluberri keeps the interface clear so you can iterate without slowing down.",
  },
];

export default function AboutPage() {
  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading hero-title fade-up">About Bluberri</h1>
          <p className="section-subtitle fade-up delay-1">
            Bluberri began at Cal Hacks as a blueberry-blue control room for product sentiment. From hardware drops to SaaS rollouts,
            we translate global discourse into a living mood board that keeps launch teams aligned.
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
