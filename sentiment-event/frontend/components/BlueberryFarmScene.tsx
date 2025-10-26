'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

function CameraController() {
  const { camera } = useThree();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Calculate scroll progress (0 at top, 1 when scrolled down)
      const scrollY = window.scrollY;
      const maxScroll = 800; // Adjust this value to control how much scrolling triggers full zoom out
      const progress = Math.min(scrollY / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useFrame(() => {
    // Interpolate camera position based on scroll
    // Start: close top-down view directly above crown [0, 2.2, 0]
    // End: closer angled view [0, 2.5, 3]
    const startPos = new THREE.Vector3(0, 2.2, 0);
    const endPos = new THREE.Vector3(0, 2.5, 3);
    
    camera.position.lerpVectors(startPos, endPos, scrollProgress);
    
    // Start looking straight down at crown, end looking at center
    const startTarget = new THREE.Vector3(0, 1.3, 0); // Crown position
    const endTarget = new THREE.Vector3(0, 0, 0); // Center of blueberry
    const currentTarget = new THREE.Vector3();
    currentTarget.lerpVectors(startTarget, endTarget, scrollProgress);
    
    camera.lookAt(currentTarget);
  });

  return null;
}

function BlueberryModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle rotation
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  // Create irregular blueberry shape by modifying sphere vertices
  const irregularScale: [number, number, number] = [1.10, 0.80, 1.05]; // Wider and flatter

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Multiple wireframe layers for depth - from outer to inner */}
      
      {/* Outermost layer - darker blue */}
      <mesh scale={[irregularScale[0] * 1.15, irregularScale[1] * 1.15, irregularScale[2] * 1.15]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial
          color="#3366cc"
          wireframe={true}
          wireframeLinewidth={1}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Outer layer */}
      <mesh scale={[irregularScale[0] * 1.08, irregularScale[1] * 1.08, irregularScale[2] * 1.08]}>
        <sphereGeometry args={[1.5, 20, 20]} />
        <meshBasicMaterial
          color="#4477dd"
          wireframe={true}
          wireframeLinewidth={2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Main outer layer - medium blue */}
      <mesh scale={irregularScale}>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial
          color="#5588ee"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Second layer */}
      <mesh scale={[irregularScale[0] * 0.93, irregularScale[1] * 0.93, irregularScale[2] * 0.93]}>
        <sphereGeometry args={[1.5, 22, 22]} />
        <meshBasicMaterial
          color="#6699ff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Third layer */}
      <mesh scale={[irregularScale[0] * 0.86, irregularScale[1] * 0.86, irregularScale[2] * 0.86]}>
        <sphereGeometry args={[1.5, 20, 20]} />
        <meshBasicMaterial
          color="#88aaff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Fourth layer */}
      <mesh scale={[irregularScale[0] * 0.79, irregularScale[1] * 0.79, irregularScale[2] * 0.79]}>
        <sphereGeometry args={[1.5, 18, 18]} />
        <meshBasicMaterial
          color="#99bbff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Fifth layer - transitioning to lighter */}
      <mesh scale={[irregularScale[0] * 0.72, irregularScale[1] * 0.72, irregularScale[2] * 0.72]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial
          color="#aaccff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Sixth layer - light blue */}
      <mesh scale={[irregularScale[0] * 0.65, irregularScale[1] * 0.65, irregularScale[2] * 0.65]}>
        <sphereGeometry args={[1.5, 14, 14]} />
        <meshBasicMaterial
          color="#bbddff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Seventh layer - lighter blue */}
      <mesh scale={[irregularScale[0] * 0.58, irregularScale[1] * 0.58, irregularScale[2] * 0.58]}>
        <sphereGeometry args={[1.5, 12, 12]} />
        <meshBasicMaterial
          color="#cceeff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Eighth layer - very light blue */}
      <mesh scale={[irregularScale[0] * 0.51, irregularScale[1] * 0.51, irregularScale[2] * 0.51]}>
        <sphereGeometry args={[1.5, 10, 10]} />
        <meshBasicMaterial
          color="#ddf5ff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Ninth layer - almost white */}
      <mesh scale={[irregularScale[0] * 0.44, irregularScale[1] * 0.44, irregularScale[2] * 0.44]}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshBasicMaterial
          color="#eef9ff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Tenth inner layer - near white */}
      <mesh scale={[irregularScale[0] * 0.37, irregularScale[1] * 0.37, irregularScale[2] * 0.37]}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshBasicMaterial
          color="#f5fbff"
          wireframe={true}
          wireframeLinewidth={2}
        />
      </mesh>

      {/* Core center - lightest */}
      <mesh scale={[irregularScale[0] * 0.25, irregularScale[1] * 0.25, irregularScale[2] * 0.25]}>
        <sphereGeometry args={[1.5, 6, 6]} />
        <meshBasicMaterial
          color="#fafcff"
          wireframe={true}
          wireframeLinewidth={3}
        />
      </mesh>

      {/* Crown (calyx) at the top - darkest blue wireframe */}
      <group position={[0, 1.3, 0]}>
        {/* Six pointed star crown petals */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * 0.28;
          const z = Math.sin(angle) * 0.28;
          
          return (
            <group key={i}>
              {/* Main petal outline */}
              <mesh
                position={[x, 0.10, z]}
                rotation={[Math.PI * 0.2, angle, 0]}
              >
                <boxGeometry args={[0.19, 0.32, 0.06]} />
                <meshBasicMaterial
                  color="#001a3a"
                  wireframe={true}
                />
              </mesh>
              
              {/* Petal tip */}
              <mesh
                position={[x * 1.3, 0.19, z * 1.3]}
                rotation={[Math.PI * 0.3, angle, 0]}
              >
                <coneGeometry args={[0.10, 0.19, 4]} />
                <meshBasicMaterial
                  color="#002050"
                  wireframe={true}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Bottom dimple wireframe - darker to match outer layers */}
      <mesh position={[0, -1.3, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.15, 0.2, 6]} />
        <meshBasicMaterial
          color="#5588ee"
          wireframe={true}
        />
      </mesh>

      {/* Highlight points */}
      <mesh position={[-0.8, 0.5, 0.9]}>
        <octahedronGeometry args={[0.15]} />
        <meshBasicMaterial
          color="#ffffff"
          wireframe={true}
        />
      </mesh>
      
      <mesh position={[0.6, 0.7, 0.7]}>
        <octahedronGeometry args={[0.1]} />
        <meshBasicMaterial
          color="#e8f0ff"
          wireframe={true}
        />
      </mesh>
    </group>
  );
}

export default function BlueberryFarmScene() {
  return (
    <div className="blueberry-farm-container">
      <Canvas
        camera={{ position: [0, 2.2, 0], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Camera animation controller */}
        <CameraController />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <spotLight
          position={[5, 5, 5]}
          angle={0.3}
          penumbra={1}
          intensity={1.5}
          castShadow
        />
        <pointLight position={[-5, 3, -5]} intensity={0.5} color="#6b7db8" />
        <pointLight position={[5, -3, 5]} intensity={0.3} color="#5d8fc4" />

        {/* The Blueberry - scaled down */}
        <group scale={0.7}>
          <BlueberryModel />
        </group>

        {/* Camera Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          autoRotate={false}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
