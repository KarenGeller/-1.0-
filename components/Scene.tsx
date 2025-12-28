import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import ChristmasTree from './ChristmasTree';

const Scene: React.FC = () => {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false }} // Post-processing handles antialiasing often, or used for performance
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        {/* Camera Setup - Moved back to z=18 to fit the full height of the tree comfortably */}
        <PerspectiveCamera makeDefault position={[0, 2, 18]} fov={50} />
        <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 3} />

        {/* Environment */}
        <color attach="background" args={['#050505']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        {/* Lighting */}
        {/* Warm light simulating fireplace or indoor lighting */}
        <pointLight position={[10, 10, 10]} intensity={1} color="#ff9900" />
        {/* Cool rim light simulating moonlight or window */}
        <pointLight position={[-10, 5, -10]} intensity={0.5} color="#4455ff" />
        <ambientLight intensity={0.2} />

        {/* Objects */}
        <ChristmasTree />

        {/* Post Processing */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={0.2} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.4}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
};

export default Scene;