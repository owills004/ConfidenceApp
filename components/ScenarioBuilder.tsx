
import React, { useState } from 'react';
import { Scenario } from '../types';
import { SCENARIO_COLORS, SCENARIO_ICONS, VOICE_OPTIONS } from '../constants';

interface ScenarioBuilderProps {
  onSave: (scenario: Scenario) => void;
  onCancel: () => void;
}

const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(SCENARIO_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(SCENARIO_COLORS[0]);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0]);

  const handleSave = () => {
    if (!title.trim() || !description.trim() || !systemInstruction.trim()) {
      alert("Please fill in all fields");
      return;
    }

    const newScenario: Scenario = {
      id: `custom_${Date.now()}`,
      title,
      description,
      icon: selectedIcon,
      color: selectedColor,
      voiceName: selectedVoice,
      systemInstruction: systemInstruction,
      isCustom: true
    };

    onSave(newScenario);
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button 
            onClick={onCancel}
            className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Create Custom Scenario</h2>
          <p className="text-slate-500">Design a unique practice session tailored to your needs.</p>
        </div>
        <button 
            onClick={handleSave}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all flex items-center gap-2"
        >
            <i className="fa-solid fa-save"></i>
            Save Scenario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Input Fields */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-1">Scenario Title</label>
               <input 
                 type="text" 
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all"
                 placeholder="e.g., Salary Negotiation"
               />
             </div>
             
             <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
               <textarea 
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all h-20 resize-none"
                 placeholder="What is the goal of this session?"
               />
             </div>

             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">
                 System Instructions (AI Persona)
               </label>
               <p className="text-xs text-slate-500 mb-2">
                 Describe how the AI should behave. Be specific about the role, tone, and starting line.
               </p>
               <textarea 
                 value={systemInstruction}
                 onChange={(e) => setSystemInstruction(e.target.value)}
                 className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all h-40 font-mono text-sm"
                 placeholder={`You are a stubborn landlord. 
I am a tenant trying to negotiate my rent.
Start by saying: "Look, rent prices are going up everywhere."`}
               />
             </div>
          </div>
        </div>

        {/* Right Column: Style & Config */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-3">AI Voice</label>
            <div className="grid grid-cols-2 gap-2">
              {VOICE_OPTIONS.map(voice => (
                <button
                  key={voice}
                  onClick={() => setSelectedVoice(voice)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${selectedVoice === voice ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-slate-100 text-slate-600 hover:border-brand-200'}`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-3">Theme Color</label>
            <div className="grid grid-cols-5 gap-3">
              {SCENARIO_COLORS.map(color => (
                 <button
                   key={color}
                   onClick={() => setSelectedColor(color)}
                   className={`w-8 h-8 rounded-full ${color} transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                 />
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-3">Icon</label>
            <div className="grid grid-cols-5 gap-3">
              {SCENARIO_ICONS.map(icon => (
                 <button
                   key={icon}
                   onClick={() => setSelectedIcon(icon)}
                   className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedIcon === icon ? 'bg-slate-800 text-white scale-110' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                 >
                   <i className={`fa-solid ${icon}`}></i>
                 </button>
              ))}
            </div>
          </div>
          
          {/* Preview Card Mini */}
          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Preview</div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-16 h-16 -mr-6 -mt-6 rounded-full opacity-10 ${selectedColor}`}></div>
                <div className={`w-8 h-8 rounded-lg ${selectedColor} text-white flex items-center justify-center mb-2`}>
                   <i className={`fa-solid ${selectedIcon} text-xs`}></i>
                </div>
                <h4 className="font-bold text-sm text-slate-900 truncate">{title || 'Untitled'}</h4>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ScenarioBuilder;
