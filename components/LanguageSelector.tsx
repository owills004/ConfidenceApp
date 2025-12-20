import React from 'react';
import { LANGUAGES } from '../constants';
import { LanguageConfig } from '../types';

interface LanguageSelectorProps {
  onSelect: (language: LanguageConfig) => void;
  onCancel: () => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect, onCancel }) => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button 
            onClick={onCancel}
            className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Choose a Language</h2>
          <p className="text-slate-500">Select the language you want to practice today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => onSelect(lang)}
            className="group relative flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all duration-200 text-left overflow-hidden"
          >
             <div className={`absolute right-0 top-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 ${lang.color} group-hover:scale-150 transition-transform duration-500`}></div>

            <div className={`flex items-center justify-center w-12 h-12 rounded-full ${lang.color} text-white shadow-sm shrink-0`}>
              <i className={`fa-solid ${lang.icon} text-lg`}></i>
            </div>
            
            <div className="relative z-10">
              <h3 className="font-bold text-slate-900 text-lg group-hover:text-brand-700 transition-colors">{lang.name}</h3>
              <p className="text-xs text-slate-500 font-medium">Practice Conversation</p>
            </div>

            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-brand-500">
                <i className="fa-solid fa-chevron-right"></i>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;