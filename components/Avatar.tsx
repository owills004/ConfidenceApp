
import React, { useRef, useMemo } from 'react';
import { AvatarConfig } from '../types';

interface AvatarProps {
  config: AvatarConfig;
  volume?: number; // 0 to 1, used for mouth animation
  isSpeaking?: boolean; // Used primarily for effects like the halo
  className?: string;
}

const Avatar = React.memo<AvatarProps>(({ config, volume = 0, isSpeaking = false, className = '' }) => {
  // Volume Smoothing Logic with Attack/Decay
  const smoothedVolRef = useRef(0);
  
  // Optimization: Calculate smoothed volume 'v'
  let v = 0;
  if (volume > 0 || smoothedVolRef.current > 0.005) {
      const targetVol = Math.min(Math.pow(volume, 0.5) * 2.0, 1.3);
      const currentVol = smoothedVolRef.current;
      const ATTACK_SPEED = 0.85; 
      const DECAY_SPEED = 0.15;  
      const smoothingFactor = targetVol > currentVol ? ATTACK_SPEED : DECAY_SPEED;
      smoothedVolRef.current = currentVol + (targetVol - currentVol) * smoothingFactor;
      if (smoothedVolRef.current < 0.01) smoothedVolRef.current = 0;
      v = smoothedVolRef.current;
  }

  const isMale = config.gender === 'male';

  // MEMOIZATION 1: Static Background Layers
  const StaticLayers = useMemo(() => (
    <>
        {/* Body/Shoulders */}
        <path 
            d={isMale 
               ? "M40 180 C40 140 160 140 160 180 L160 200 L40 200 Z" 
               : "M50 180 C50 145 150 145 150 180 L150 200 L50 200 Z"}
            fill={config.clothingColor} 
        />

        {/* Neck */}
        <rect x={isMale ? "82" : "85"} y="130" width={isMale ? "36" : "30"} height="25" fill={config.skinColor} />

        {/* Face Base */}
        {isMale ? (
            <path 
              d="M 55 80 L 55 125 Q 55 160 100 160 Q 145 160 145 125 L 145 80 C 145 40 125 30 100 30 C 75 30 55 40 55 80 Z"
              fill={config.skinColor}
            />
        ) : (
            <path 
              d="M 55 85 C 55 145 80 160 100 160 C 120 160 145 145 145 85 C 145 40 125 35 100 35 C 75 35 55 40 55 85 Z"
              fill={config.skinColor}
            />
        )}

        {/* Hair (Back Layers) */}
        {config.hairStyle === 'long' && (
            <path 
              d="M45 80 C25 120 30 190 40 200 L160 200 C170 190 175 120 155 80 C155 50 140 40 100 40 C60 40 45 50 45 80 Z" 
              fill={config.hairColor} 
            />
        )}
        {config.hairStyle === 'bun' && (
            <>
               <circle cx="100" cy="40" r="25" fill={config.hairColor} />
               <path d="M70 70 Q100 25 130 70 Z" fill={config.hairColor} />
            </>
        )}
        {config.hairStyle === 'curly' && (
            <path 
              d="M35 80 C25 100 30 160 45 170 C55 175 145 175 155 170 C170 160 175 100 165 80 C170 50 155 20 125 20 C105 15 95 15 75 20 C45 20 30 50 35 80 Z"
              fill={config.hairColor}
            />
        )}
        {config.hairStyle === 'spiky' && (
           <path 
              d="M45 80 L40 60 L50 70 L55 50 L65 65 L75 30 L90 55 L100 20 L110 55 L125 30 L135 65 L145 50 L150 70 L160 60 L155 80 Z"
              fill={config.hairColor}
           />
        )}

        {/* Eyes */}
        <g fill="#1E293B">
            <circle cx="80" cy="95" r="4" />
            <circle cx="120" cy="95" r="4" />
            {!isMale && (
              <g stroke="#1E293B" strokeWidth="1.5" fill="none">
                 <path d="M 76 93 L 73 90" />
                 <path d="M 84 93 L 87 90" />
                 <path d="M 116 93 L 113 90" />
                 <path d="M 124 93 L 127 90" />
              </g>
            )}
        </g>
    </>
  ), [config.clothingColor, config.skinColor, config.hairStyle, config.hairColor, isMale]);

  // MEMOIZATION 2: Static Foreground Layers
  const ForegroundLayers = useMemo(() => (
    <>
      {/* Hair (Front/Bangs) */}
      {config.hairStyle === 'short' && (
         <path 
           d="M55 80 C55 45 65 30 100 30 C135 30 145 45 145 80 C145 90 135 70 125 60 C115 50 85 50 75 60 C65 70 55 90 55 80 Z" 
           fill={config.hairColor} 
         />
      )}
      {config.hairStyle === 'spiky' && (
         <path 
           d="M50 80 L55 60 L65 70 L70 50 L80 65 L90 40 L100 60 L110 40 L120 65 L130 50 L135 70 L145 60 L150 80 C140 65 120 55 100 55 C80 55 60 65 50 80 Z" 
           fill={config.hairColor} 
         />
      )}
      {config.hairStyle === 'curly' && (
          <path 
             d="M50 85 C50 60 60 40 80 40 C90 35 110 35 120 40 C140 40 150 60 150 85 C145 70 130 60 100 60 C70 60 55 70 50 85 Z"
             fill={config.hairColor}
          />
      )}
      {config.hairStyle === 'long' && (
          <path 
             d="M55 80 C55 50 75 40 100 40 C125 40 145 50 145 80 C145 85 135 60 100 60 C65 60 55 85 55 80 Z" 
             fill={config.hairColor} 
          />
      )}
      {config.hairStyle === 'bun' && (
          <path 
             d="M55 80 C55 50 70 45 100 45 C130 45 145 50 145 80 C140 70 120 60 100 60 C80 60 60 70 55 80 Z" 
             fill={config.hairColor} 
          />
      )}

      {/* Accessories */}
      {config.accessory === 'glasses' && (
        <g stroke="#334155" strokeWidth="2.5" fill="none">
            <circle cx="80" cy="95" r="10" stroke="#334155" fill="rgba(255,255,255,0.2)" />
            <circle cx="120" cy="95" r="10" stroke="#334155" fill="rgba(255,255,255,0.2)" />
            <path d="M90 95 L110 95" strokeWidth="2" />
        </g>
      )}
      {config.accessory === 'headset' && (
        <g>
            <path d="M45 100 C45 40 155 40 155 100" stroke="#1E293B" strokeWidth="4" fill="none" />
            <rect x="35" y="90" width="15" height="25" rx="5" fill="#334155" />
            <rect x="150" y="90" width="15" height="25" rx="5" fill="#334155" />
            <path d="M150 115 L120 130" stroke="#334155" strokeWidth="3" />
            <circle cx="120" cy="130" r="4" fill="#0F172A" />
        </g>
      )}
    </>
  ), [config.hairStyle, config.hairColor, config.accessory]);

  return (
    <div className={`relative ${className} ${isSpeaking ? 'scale-105' : ''} transition-transform duration-200`}>
      <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
        
        {/* Background Circle */}
        <circle cx="100" cy="100" r="95" fill={config.backgroundColor} />
        
        {StaticLayers}
        {ForegroundLayers}

        {/* Mouth Animation */}
        <g transform={`translate(100, 135)`}>
           <path 
             d={`M -15 0 Q 0 ${5 + (v * 25)} 15 0 Z`} 
             fill="#9F4D4D" 
           />
           {/* Teeth */}
           {v > 0.2 && (
             <path d="M -10 2 L 10 2 L 10 5 L -10 5 Z" fill="white" opacity="0.8" />
           )}
        </g>

      </svg>
    </div>
  );
});

export default Avatar;
