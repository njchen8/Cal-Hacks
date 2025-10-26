'use client';

import Link from "next/link";
import ReactionTicker from "@/components/ReactionTicker";
import { useEffect, useState } from "react";

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
  {
    title: "Policy Making Impact",
    description:
      "Insights from sentiment analysis can inform policy decisions, helping leaders address public concerns and shape effective strategies.",
  },
  {
    title: "Social Impact & Welfare",
    description:
      "Understanding social sentiment enables organizations to better support community welfare, identify emerging issues, and drive positive change.",
  },
];

export default function HomePage() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = 800;
      const progress = Math.min(scrollY / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="page">
      <header
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          padding: '1rem 0',
        }}
      >
        <h1
          className="hero-title fade-up"
          style={{
        display: 'inline-block',
        fontSize: 'clamp(2.0rem, 4vw, 3rem)',
        lineHeight: 1.05,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        margin: 0,
        padding: '0.25rem 0.6rem',
        border: '2px solid #B7F5C1', // light green border
        borderRadius: '6px',
        backgroundColor: '#B7F5C1', // fill the border
        color: '#042a14', // dark text for contrast
          }}
        >
          bluberri
        </h1>
      </header>
      <section 
        className="main-hero"
        style={{
          opacity: Math.max(0, Math.min(1, (scrollProgress - 0.85) / 0.15)),
          transform: `translateY(${(1 - Math.max(0, Math.min(1, (scrollProgress - 0.85) / 0.15))) * 100}px)`,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <div className="hero-copy">
          <h1 className="hero-title fade-up">Understand what people really think</h1>
          <p className="fade-up delay-1">
            bluberri analyzes social media conversations to reveal authentic sentiment and emotions.
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
