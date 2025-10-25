import Link from "next/link";

const featureItems = [
  {
    title: "Policy-grade sentiment",
    description:
      "Blend headline probabilities with emotion signals to understand how communities react to policies before they vote or mobilize.",
  },
  {
    title: "Granular emotion cues",
    description:
      "Track fear, greed, desire, anger, trust, and more to pinpoint what drives the conversation and where narratives are shifting.",
  },
  {
    title: "Source-aware insights",
    description:
      "Scrape social discourse from multiple channels, maintain traceability to original posts, and capture momentum in real time.",
  },
];

export default function HomePage() {
  return (
    <div className="page">
      <section className="main-hero">
        <div className="hero-copy">
          <h1>See how the public feels about your next policy launch.</h1>
          <p>
            Sentiment Event transforms raw social data into decision-ready context. Scrape conversations, uncover
            emotion signals, and gauge if infrastructure, legislation, or campaigns are landing the way you intend.
          </p>
          <div className="hero-actions">
            <Link href="/analyze" className="button-primary">
              Try the analyzer
            </Link>
            <Link href="/about" className="button-secondary">
              Learn about the project
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-heading">Why sentiment intelligence matters</h2>
        <p className="section-subtitle">
          Policy teams, civic innovators, and researchers need signal in the noise. Sentiment Event surfaces the tone of
          public discourse so you can pilot programs, respond to feedback, and communicate with empathy.
        </p>
        <div className="feature-grid">
          {featureItems.map((feature) => (
            <article key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
