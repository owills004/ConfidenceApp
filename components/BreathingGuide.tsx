
import React from 'react';

interface BreathingGuideProps {
  phase: 'IN' | 'HOLD' | 'OUT' | 'END';
}

const BreathingGuide: React.FC<BreathingGuideProps> = ({ phase }) => {
  if (phase === 'END') return null;

  const getPhaseText = () => {
    switch (phase) {
      case 'IN': return 'Inhale Deeply';
      case 'HOLD': return 'Hold Your Breath';
      case 'OUT': return 'Exhale Slowly';
      default: return '';
    }
  };

  const getSubText = () => {
    switch (phase) {
      case 'IN': return 'Fill your lungs with confidence';
      case 'HOLD': return 'Center your thoughts';
      case 'OUT': return 'Release all tension';
      default: return '';
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in pointer-events-none">
      <div className="flex flex-col items-center">
        
        {/* Pulsing Confidence Sphere */}
        <div className="relative w-64 h-64 flex items-center justify-center">
            
            {/* Expansion Outer Ring */}
            <div className={`absolute inset-0 rounded-full border-2 border-brand-400/30 transition-all duration-[4000ms] ease-linear
                ${phase === 'IN' ? 'scale-150 opacity-100' : phase === 'HOLD' ? 'scale-150 opacity-60' : 'scale-50 opacity-0'}
            `}></div>

            {/* Core Sphere */}
            <div className={`relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-brand-400 to-accent-400 shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all duration-[4000ms] ease-linear flex items-center justify-center
                ${phase === 'IN' ? 'scale-125' : phase === 'HOLD' ? 'scale-125' : 'scale-75'}
            `}>
                <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20"></div>
            </div>
            
            {/* Particle Effects (CSS Only) */}
            {phase === 'IN' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={`absolute w-1 h-1 bg-white rounded-full animate-ping`} style={{ transform: `rotate(${i * 60}deg) translateY(-80px)`, animationDelay: `${i * 200}ms` }}></div>
                    ))}
                </div>
            )}
        </div>

        <div className="mt-12 text-center">
            <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-lg mb-2 transition-all duration-500">
                {getPhaseText()}
            </h2>
            <p className="text-brand-100 font-bold uppercase tracking-widest text-xs drop-shadow-md">
                {getSubText()}
            </p>
        </div>
      </div>
    </div>
  );
};

export default BreathingGuide;
