
import React, { useState } from 'react';
import { Scenario, SessionSettings, DifficultyLevel, SpeedLevel, LanguageConfig } from '../types';
import { DIFFICULTY_OPTIONS, SPEED_OPTIONS, DEFAULT_SESSION_SETTINGS, VOICE_METADATA, LANGUAGES } from '../constants';

interface SessionSetupProps {
  scenario: Scenario;
  onStart: (settings: SessionSettings) => void;
  onCancel: () => void;
}

const SessionSetup: React.FC<SessionSetupProps> = ({ scenario, onStart, onCancel }) => {
  const [settings, setSettings] = useState<SessionSettings>({
    ...DEFAULT_SESSION_SETTINGS,
    voiceName: scenario.voiceName,
    language: 'English',
  });

  const [selectedGender, setSelectedGender] = useState<'All' | 'Male' | 'Female'>('All');

  const updateDifficulty = (level: DifficultyLevel) => {
    setSettings(prev => ({ ...prev, difficulty: level }));
  };

  const updateSpeed = (level: SpeedLevel) => {
    setSettings(prev => ({ ...prev, speed: level }));
  };
  
  const updateVoice = (voice: string) => {
    setSettings(prev => ({ ...prev, voiceName: voice }));
  };

  const updateLanguage = (lang: LanguageConfig) => {
      setSettings(prev => ({ ...prev, language: lang.promptName || lang.name }));
  };

  const filteredVoices = Object.entries(VOICE_METADATA).filter(([name, meta]) => {
      if (selectedGender === 'All') return true;
      return meta.gender === selectedGender;
  });

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pb-12">
      <div className="mb-6">
        <button 
          onClick={onCancel}
          className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${scenario.color} flex items-center justify-center text-white shadow-sm`}>
                <i className={`fa-solid ${scenario.icon} text-xl`}></i>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{scenario.title}</h2>
                <p className="text-slate-500">Configure your session preferences.</p>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-md ring-1 ring-brand-100 relative overflow-hidden">
          <label className="block text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-earth-americas text-brand-500"></i>
            Language to Practice
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             {LANGUAGES.map(lang => (
                 <button
                    key={lang.id}
                    onClick={() => updateLanguage(lang)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        settings.language === (lang.promptName || lang.name)
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                        : 'bg-slate-50 border-slate-200 hover:border-brand-300 text-slate-700'
                    }`}
                 >
                    <i className={`fa-solid ${lang.icon}`}></i>
                    <span className="text-xs font-bold">{lang.name}</span>
                 </button>
             ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-microphone text-brand-500"></i>
                Coach's Voice
           </label>
           
           <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-slate-500 pl-2">Gender:</span>
                <div className="flex gap-1">
                    {['All', 'Male', 'Female'].map((g) => (
                        <button
                            key={g}
                            onClick={() => setSelectedGender(g as any)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedGender === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredVoices.map(([name, meta]) => (
                    <button
                        key={name}
                        onClick={() => updateVoice(name)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            settings.voiceName === name
                            ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500'
                            : 'bg-white border-slate-200 hover:border-brand-300'
                        }`}
                    >
                        <span className={`font-bold block ${settings.voiceName === name ? 'text-brand-700' : 'text-slate-800'}`}>
                            {name}
                        </span>
                        <p className="text-[10px] text-slate-500 leading-tight">
                            {meta.style}
                        </p>
                    </button>
                ))}
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-layer-group text-brand-500"></i>
                Difficulty
            </label>
            <div className="space-y-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => updateDifficulty(opt.id as DifficultyLevel)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                    settings.difficulty === opt.id 
                        ? 'bg-brand-50 border-brand-500' 
                        : 'bg-white border-slate-200'
                    }`}
                >
                    <span className={`font-bold text-sm ${settings.difficulty === opt.id ? 'text-brand-700' : 'text-slate-700'}`}>
                        {opt.label}
                    </span>
                </button>
                ))}
            </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-gauge-high text-brand-500"></i>
                Pace
            </label>
            <div className="flex flex-col gap-2">
                {SPEED_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => updateSpeed(opt.id as SpeedLevel)}
                        className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${
                            settings.speed === opt.id
                            ? 'bg-brand-50 border-brand-500 text-brand-700'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                    >
                        <i className={`fa-solid ${opt.icon}`}></i>
                        <span className="text-sm font-bold">{opt.label}</span>
                    </button>
                ))}
            </div>
            </div>
        </div>

        <button 
            onClick={() => onStart(settings)}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold transition-all shadow-xl hover:bg-slate-800 flex items-center justify-center gap-2 text-lg"
        >
            <i className="fa-solid fa-play"></i>
            Start Practice
        </button>
      </div>
    </div>
  );
};

export default SessionSetup;
