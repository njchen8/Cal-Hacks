import Link from "next/link";

const principles = [
  {
    title: "Multi-Platform Analysis",
    description:
      "Collect and analyze authentic conversations from Twitter, Reddit, and Facebook. Access diverse perspectives from multiple social media communities in one unified analysis.",
  },
  {
    title: "AI-Powered Insights",
    description:
      "Advanced sentiment analysis powered by machine learning models and Google Gemini AI. Get detailed emotion breakdowns including joy, trust, desire, anger, concern, and more.",
  },
  {
    title: "Real-Time Understanding",
    description:
      "Track sentiment as it evolves. Analyze trending topics, product launches, or any subject of interest with up-to-date data from social media platforms.",
  },
  {
    title: "Educational Tool",
    description:
      "Perfect for teaching data science, sentiment analysis, and social media research. Students and educators can explore real-world applications of natural language processing.",
  },
  {
    title: "Research Ready",
    description:
      "Export detailed CSV reports with full sentiment scores and metadata. Built for academic research, market analysis, and data-driven decision making.",
  },
  {
    title: "Open Source",
    description:
      "Built at Cal Hacks with transparency in mind. Review the methodology, understand the algorithms, and explore how sentiment analysis works under the hood.",
  },
];

export default function AboutPage() {
  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading hero-title fade-up">About blueberri</h1>
          <p className="section-subtitle fade-up delay-1">
            blueberri is a sentiment analysis platform that helps you understand what people really think about any topic.
            Built at Cal Hacks, it combines social media data from multiple platforms with AI-powered analysis to reveal
            authentic public sentiment and emotions. Whether you're a student, researcher, educator, or business professional,
            blueberri provides the tools to analyze and understand social media conversations at scale.
          </p>
        </header>

        <h2 className="section-heading fade-up" style={{ marginTop: "3rem", fontSize: "1.8rem" }}>
          What makes blueberri different
        </h2>

        <div className="feature-grid">
          {principles.map((item, index) => (
            <article
              key={item.title}
              className="feature-card fade-up"
              style={{ animationDelay: `${0.08 * index + 0.1}s` }}
            >
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="hero-actions fade-up delay-2" style={{ marginTop: "3rem" }}>
          <Link href="/analyze" className="button-primary">
            Start analyzing
          </Link>
          <Link href="/docs" className="button-secondary">
            View documentation
          </Link>
        </div>
      </section>
    </div>
  );
}
