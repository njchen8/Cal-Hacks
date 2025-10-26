'use client';

import dynamic from 'next/dynamic';

const BlueberryFarmScene = dynamic(() => import('./BlueberryFarmScene'), {
  ssr: false,
  loading: () => (
    <div 
      className="blueberry-farm-container" 
      style={{ 
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: '#ffffff'
      }}
    />
  ),
});

export default function BlueberryFarm() {
  return <BlueberryFarmScene />;
}
