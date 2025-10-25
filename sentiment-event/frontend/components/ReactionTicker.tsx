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
    quote: "Launch day sentiment spiked 28% after we shipped the new sleep tracking tiles.",
    product: "DreamBand",
    source: "Product marketing, Berlin",
  },
  {
    quote: "Customers love the cleaner checkout, but pricing chatter in Latin America hints at discount fatigue.",
    product: "LumenPay",
    source: "Growth analytics, São Paulo",
  },
  {
    quote: "Influencers call the berry palette 'refreshing' yet a few early adopters ask for darker accessibility options.",
    product: "Palette OS",
    source: "Community success, Toronto",
  },
  {
    quote: "Support calls dropped 14% once we patched the onboarding tooltip copy—trust is finally rebuilding.",
    product: "Beacon CRM",
    source: "CX ops, Singapore",
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
