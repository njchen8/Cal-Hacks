'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const BlueberryFarmScene = dynamic(() => import('./BlueberryFarmScene'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      zIndex: -1,
      background: '#ffffff'
    }} />
  )
});

export default function BlueberryFarm() {
  return <BlueberryFarmScene />;
}
