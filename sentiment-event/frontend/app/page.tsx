import Link from "next/link";
import ReactionTicker from "@/components/ReactionTicker";

const featureItems = [
  {
    title: "Product pulse in minutes",
    description:
      "Blend headline sentiment with emotion signals to understand how launches, feature drops, and pricing changes land with customers.",
  },
  {
    title: "Emotion-backed benchmarking",
    description:
      "Compare joy, trust, desire, and concern across releases to spot what drives delight or frustration in your product experience.",
  },
  {
    title: "Global listening, zero noise",
    description:
      "Scrape social conversations from multiple regions, keep traceability to original posts, and track the narrative as it evolves.",
  },
];

export default function HomePage() {
  return (
    <div className="page">
      <section className="main-hero">
        <div className="hero-copy">
          <h1 className="hero-title fade-up">Bluberri shows how the globe feels about every launch moment.</h1>
          <p className="fade-up delay-1">
            Bluberri transforms raw social data into a blueberry-blue command center for product, marketing, and CX teams.
            Track reactions to features, packaging, or campaigns and uncover the emotions stitched through every post.
          </p>
          <div className="hero-actions fade-up delay-2">
            <Link href="/analyze" className="button-primary">
              Try the analyzer
            </Link>
            <Link href="/about" className="button-secondary">
              Learn about the project
            </Link>
          </div>
          <div className="fade-up delay-3">
            <ReactionTicker />
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-heading">Why product sentiment intelligence matters</h2>
        <p className="section-subtitle">
          Product managers, brand strategists, and growth leaders need signal in the noise. Bluberri surfaces how customers actually feel so you can refine roadmaps, launch smarter, and protect brand trust.
        </p>
        <div className="feature-grid">
          {featureItems.map((feature, index) => (
            <article
              key={feature.title}
              className="feature-card fade-up"
              style={{ animationDelay: `${0.12 * index + 0.1}s` }}
            >
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
