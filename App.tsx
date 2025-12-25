import React from 'react';
import Scene from './components/Scene';
import UI from './components/UI';
import HandTracker from './components/HandTracker';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-black">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene />
      </div>

      {/* Hand Tracking Logic Layer (Invisible/Overlay) */}
      <HandTracker />

      {/* UI Overlay Layer */}
      <UI />
    </div>
  );
};

export default App;