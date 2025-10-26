import Link from "next/link";
import ReactionTicker from "@/components/ReactionTicker";

const featureItems = [
  {
    title: "Instant Sentiment Analysis",
    description:
      "Analyze any topic, product, or trend in minutes. Get comprehensive sentiment breakdowns with AI-powered summaries from Twitter, Reddit, and Facebook.",
  },
  {
    title: "Multi-Source Data Collection",
    description:
      "Gather authentic opinions from multiple social media platforms. Access real conversations happening across Twitter, Reddit, and Facebook communities.",
  },
  {
    title: "Emotion Intelligence",
    description:
      "Go beyond positive/negative sentiment. Understand nuanced emotions like joy, trust, desire, anger, and concern in every conversation.",
  },
  {
    title: "Educational & Research Ready",
    description:
      "Perfect for students, teachers, and researchers. Analyze public opinion, study trends, or teach data analysis and sentiment techniques.",
  },
  {
    title: "Product Intelligence",
    description:
      "Track how consumers feel about products, features, or brands. Make data-driven decisions with real-time sentiment insights.",
  },
  {
    title: "Trend Discovery",
    description:
      "Explore emerging topics and understand public discourse. Discover what people are excited, concerned, or talking about right now.",
  },
];

export default function HomePage() {
  return (
    <div className="page">
      <section className="main-hero">
        <div className="hero-copy">
          <h1 className="hero-title fade-up">Understand what people really think</h1>
          <p className="fade-up delay-1">
            blueberri analyzes social media conversations to reveal authentic sentiment and emotions.
            Perfect for students, researchers, educators, businesses, and anyone curious about public opinion.
          </p>
          <div className="hero-actions fade-up delay-2">
            <Link href="/analyze" className="button-primary">
              Start analyzing
            </Link>
            <Link href="/docs" className="button-secondary">
              View documentation
            </Link>
          </div>
        </div>
        <ReactionTicker />
      </section>

      <section>
        <h2 className="section-heading">Features</h2>
        <p className="section-subtitle">
          Analyze anything from product launches to social trends. Get AI-powered insights from real conversations across Twitter, Reddit, and Facebook.
        </p>
        <div className="feature-grid">
          {featureItems.map((feature, index) => (
            <article
              key={feature.title}
              className="feature-card fade-up"
              style={{ animationDelay: `${0.08 * index + 0.1}s` }}
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
