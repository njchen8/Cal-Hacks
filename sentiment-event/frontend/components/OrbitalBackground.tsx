'use client';

import { useMemo } from "react";

type OrbitalConfig = {
  size: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
};

const ORBIT_COUNT = 14;

export default function OrbitalBackground() {
  const orbits = useMemo<OrbitalConfig[]>(() => {
    return Array.from({ length: ORBIT_COUNT }).map(() => ({
      size: Math.round(Math.random() * 160 + 90),
      top: Math.random() * 100,
      left: Math.random() * 100,
      duration: Math.random() * 18 + 18,
      delay: Math.random() * -18,
    }));
  }, []);

  return (
    <div className="orbital-background" aria-hidden="true">
      {orbits.map((orbit, index) => (
        <span
          key={index}
          className="orbital-bubble"
          style={{
            width: orbit.size,
            height: orbit.size,
            top: `${orbit.top}%`,
            left: `${orbit.left}%`,
            animationDuration: `${orbit.duration}s`,
            animationDelay: `${orbit.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
