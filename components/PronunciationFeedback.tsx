import React from 'react';

interface PronunciationFeedbackProps {
  tip: string | null;
}

const PronunciationFeedback: React.FC<PronunciationFeedbackProps> = ({ tip }) => {
  if (!tip) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:bottom-auto md:top-4 md:w-64 z-20 animate-fade-in-up">
      <div className="bg-white/95 backdrop-blur-md border-l-4 border-yellow-400 rounded-r-xl shadow-xl p-4 transform transition-all hover:scale-105">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-100 text-yellow-600 rounded-full p-2 w-8 h-8 flex items-center justify-center shrink-0 animate-pulse-slow">
            <i className="fa-solid fa-ear-listen text-sm"></i>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pronunciation Coach</h4>
            <p className="text-sm font-medium text-slate-800 leading-snug">
              {tip}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PronunciationFeedback;