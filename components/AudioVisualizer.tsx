import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  volume: number; // 0.0 to 1.0 approx
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ volume, isActive }) => {
  const barsRef = useRef<HTMLDivElement[]>([]);

  // Simple pure-CSS style animation driven by props
  const safeVolume = Math.min(Math.max(volume * 5, 0.1), 1.5); // Amplify small signals
  
  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-3 rounded-full bg-gradient-to-t from-brand-500 to-accent-500 transition-all duration-75 ease-out ${isActive ? 'opacity-100' : 'opacity-30'}`}
          style={{
            height: isActive ? `${20 + (safeVolume * 40 * (i % 2 === 0 ? 0.8 : 1.2))}px` : '8px',
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;
