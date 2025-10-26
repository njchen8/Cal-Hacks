'use client';

import Link from "next/link";
import ReactionTicker from "@/components/ReactionTicker";
import { useEffect, useState } from "react";

const featureItems = [
  {
    title: "Real-time sentiment tracking",
    description:
      "Monitor how customers feel about your products and launches in real-time. Track positive, negative, and neutral reactions across social platforms.",
  },
  {
    title: "Emotion-driven analytics",
    description:
      "Go beyond simple sentiment scores. Understand the emotions—joy, trust, concern, desire—that drive customer reactions and shape perceptions.",
  },
  {
    title: "Actionable insights",
    description:
      "Transform raw social data into actionable insights. Every insight traces back to real conversations, helping teams make informed decisions quickly.",
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
      <section 
        className="main-hero"
        style={{
          opacity: Math.max(0, Math.min(1, (scrollProgress - 0.5) / 0.3)),
          transform: `translateY(${(1 - Math.max(0, Math.min(1, (scrollProgress - 0.5) / 0.3))) * 100}px)`,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <div className="hero-copy">
          <h1 className="hero-title fade-up">BluBerri — Sentiment Analysis Reimagined</h1>
          <p className="fade-up delay-1">
            Transform raw social data into actionable insights. BluBerri analyzes customer sentiment across platforms, 
            helping you understand emotions, reactions, and trends around your products and launches.
          </p>
          <div className="hero-actions fade-up delay-2">
            <Link href="/analyze" className="button-primary">
              Start Analysis
            </Link>
            <Link href="/about" className="button-secondary">
              Learn More
            </Link>
          </div>
          <div className="fade-up delay-3">
            <ReactionTicker />
          </div>
        </div>
      </section>

      <section
        style={{
          opacity: Math.max(0, Math.min(1, (scrollProgress - 0.7) / 0.25)),
          transform: `translateY(${(1 - Math.max(0, Math.min(1, (scrollProgress - 0.7) / 0.25))) * 100}px)`,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <h2 className="section-heading">Powerful sentiment intelligence</h2>
        <p className="section-subtitle">
          BluBerri helps product teams, marketers, and analysts understand customer reactions at scale. 
          Our platform combines social listening with emotion analysis to reveal what truly matters to your audience.
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
