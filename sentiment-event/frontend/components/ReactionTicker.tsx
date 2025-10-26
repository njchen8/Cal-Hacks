'use client';

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Reaction = {
  quote: string;
  product: string;
  source: string;
};

const reactions: Reaction[] = [
  {
    quote: "Multi-platform sentiment analysis across Twitter, Reddit, and Facebook in real-time.",
    product: "bluberri",
    source: "Social Media Intelligence",
  },
  {
    quote: "AI-powered emotion detection reveals joy, trust, desire, anger, and concern in every conversation.",
    product: "bluberri",
    source: "Gemini AI Integration",
  },
  {
    quote: "Perfect for students, teachers, researchers analyzing public opinion and social trends.",
    product: "bluberri",
    source: "Educational & Research Tool",
  },
  {
    quote: "Export detailed CSV reports with full sentiment scores and metadata for deeper analysis.",
    product: "bluberri",
    source: "Data Export & Insights",
  },
];

export default function ReactionTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((value) => (value + 1) % reactions.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const activeReaction = reactions[index];

  return (
    <div className="reaction-ticker">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeReaction.quote}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p className="ticker-quote">“{activeReaction.quote}”</p>
          <div className="ticker-meta">
            <span>{activeReaction.product}</span>
            <span>{activeReaction.source}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
