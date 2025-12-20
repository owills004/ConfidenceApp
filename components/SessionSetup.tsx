
import React, { useState, useEffect } from 'react';
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
    voiceName: scenario.voiceName, // Initialize with scenario default
    language: 'English',
    groupSize: 1
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
  
  const updateGroupSize = (size: number) => {
      setSettings(prev => ({ ...prev, groupSize: size }));
  };

  // Filter voices based on gender selection
  const filteredVoices = Object.entries(VOICE_METADATA).filter(([name, meta]) => {
      if (selectedGender === 'All') return true;
      return meta.gender === selectedGender;
  });

  const isLanguageTutor = scenario.id === 'language_tutor';

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
        
        {/* STEP 1: Language Selection - PRIORITIZED */}
        <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-md ring-1 ring-brand-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">STEP 1</div>
          <label className="block text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-earth-americas text-brand-500"></i>
            Which language will you speak?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             {LANGUAGES.map(lang => (
                 <button
                    key={lang.id}
                    onClick={() => updateLanguage(lang)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        settings.language === (lang.promptName || lang.name)
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md transform scale-105'
                        : 'bg-slate-50 border-slate-200 hover:border-brand-300 hover:shadow-sm text-slate-700'
                    }`}
                 >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${settings.language === (lang.promptName || lang.name) ? 'bg-white text-brand-600' : `${lang.color} text-white`}`}>
                       <i className={`fa-solid ${lang.icon}`}></i>
                    </div>
                    <span className="text-xs font-bold">{lang.name}</span>
                 </button>
             ))}
          </div>
        </div>

        {/* STEP 1.5: Group Size (Language Tutor Only) */}
        {isLanguageTutor && (
            <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-opacity duration-500 ${!settings.language ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-users text-brand-500"></i>
                    Group Size (Coaches)
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(size => (
                        <button
                            key={size}
                            onClick={() => updateGroupSize(size)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                settings.groupSize === size
                                ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500 text-brand-700'
                                : 'bg-white border-slate-200 hover:border-brand-300 text-slate-600'
                            }`}
                        >
                            <div className="flex -space-x-2">
                                {Array.from({length: size}).map((_, i) => (
                                    <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] ${i === 0 ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        <i className="fa-solid fa-user"></i>
                                    </div>
                                ))}
                            </div>
                            <span className="text-xs font-bold">
                                {size === 1 ? '1 Coach' : `${size} Coaches`}
                            </span>
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                    {settings.groupSize === 1 
                        ? "Standard one-on-one tutoring session." 
                        : "Simulate a group conversation with multiple AI personalities."}
                </p>
            </div>
        )}

        {/* STEP 2: Voice & Persona */}
        <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-opacity duration-500 ${!settings.language ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
           <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-microphone text-brand-500"></i>
                Select your Coach's Voice
           </label>
           
           <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-slate-500 pl-2">Filter by Gender:</span>
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
                        <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold ${settings.voiceName === name ? 'text-brand-700' : 'text-slate-800'}`}>
                                {name}
                            </span>
                            {settings.voiceName === name && <i className="fa-solid fa-check text-brand-600 text-xs"></i>}
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                             <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.gender === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                {meta.gender}
                             </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                            {meta.style}
                        </p>
                    </button>
                ))}
           </div>
        </div>

        {/* STEP 3: Config */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-500 ${!settings.language ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {/* Difficulty Selection */}
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
                        ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500' 
                        : 'bg-white border-slate-200 hover:border-brand-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${settings.difficulty === opt.id ? 'text-brand-700' : 'text-slate-700'}`}>
                            {opt.label}
                        </span>
                        {settings.difficulty === opt.id && <i className="fa-solid fa-check-circle text-brand-600"></i>}
                    </div>
                </button>
                ))}
            </div>
            </div>

            {/* Speed Selection */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-gauge-high text-brand-500"></i>
                Speaking Pace
            </label>
            <div className="flex flex-col gap-2">
                {SPEED_OPTIONS.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => updateSpeed(opt.id as SpeedLevel)}
                        className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${
                            settings.speed === opt.id
                            ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500 text-brand-700'
                            : 'bg-white border-slate-200 hover:border-brand-300 text-slate-600'
                        }`}
                    >
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                             <i className={`fa-solid ${opt.icon}`}></i>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">{opt.label}</div>
                            <div className="text-[10px] opacity-70">{opt.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
            </div>
        </div>

        {/* Start Button */}
        <button 
            onClick={() => onStart(settings)}
            disabled={!settings.language}
            className={`w-full py-4 rounded-xl font-bold transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 text-lg transform ${
                settings.language 
                ? 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5' 
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
        >
            <i className="fa-solid fa-play"></i>
            {settings.language ? 'Start Session' : 'Select a Language to Start'}
        </button>
      </div>
    </div>
  );
};

export default SessionSetup;
