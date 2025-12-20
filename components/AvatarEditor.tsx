
import React, { useState } from 'react';
import { AvatarConfig } from '../types';
import Avatar from './Avatar';
import { AVATAR_OPTIONS } from '../constants';

interface AvatarEditorProps {
  initialConfig: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
  onCancel: () => void;
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ initialConfig, onSave, onCancel }) => {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<'base' | 'hair' | 'style'>('base');

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 h-full pb-8">
      {/* Preview Section */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-8 border border-slate-200 min-h-[300px]">
        <div className="w-64 h-64 shadow-2xl rounded-full overflow-hidden bg-white ring-8 ring-white">
          <Avatar config={config} />
        </div>
        <div className="mt-6 text-center text-slate-400 text-sm">
           Live Preview
        </div>
      </div>

      {/* Controls Section */}
      <div className="flex-1 flex flex-col h-[500px]">
        <div className="flex border-b border-slate-200 mb-6 shrink-0">
          <button 
            className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'base' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}
            onClick={() => setActiveTab('base')}
          >
            Body & Face
          </button>
          <button 
             className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'hair' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}
             onClick={() => setActiveTab('hair')}
          >
            Hair & Head
          </button>
          <button 
             className={`px-4 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'style' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}
             onClick={() => setActiveTab('style')}
          >
            Style & Extras
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-8">
          
          {/* TAB: BASE */}
          {activeTab === 'base' && (
            <div className="space-y-6 animate-fade-in">
               <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Presentation</label>
                <div className="flex bg-slate-100 p-1 rounded-lg w-max">
                  {['male', 'female'].map((gender) => (
                    <button
                      key={gender}
                      onClick={() => updateConfig('gender', gender)}
                      className={`px-6 py-2 rounded-md text-sm font-bold capitalize transition-all ${config.gender === gender ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Skin Tone</label>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_OPTIONS.skinColors.map(color => (
                    <button
                      key={color}
                      onClick={() => updateConfig('skinColor', color)}
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${config.skinColor === color ? 'border-brand-600 scale-110 ring-2 ring-brand-100' : 'border-slate-200'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Background Color</label>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_OPTIONS.backgroundColors.map(color => (
                    <button
                      key={color}
                      onClick={() => updateConfig('backgroundColor', color)}
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${config.backgroundColor === color ? 'border-brand-600 scale-110 ring-2 ring-brand-100' : 'border-slate-200'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: HAIR */}
          {activeTab === 'hair' && (
             <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Hair Style</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['bald', 'short', 'spiky', 'curly', 'long', 'bun'].map(style => (
                        <button
                          key={style}
                          onClick={() => updateConfig('hairStyle', style)}
                          className={`py-3 px-2 rounded-xl border text-sm font-medium capitalize transition-all ${config.hairStyle === style ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}
                        >
                          {style}
                        </button>
                    ))}
                  </div>
                </div>

                {config.hairStyle !== 'bald' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Hair Color</label>
                        <div className="flex gap-3 flex-wrap">
                        {AVATAR_OPTIONS.hairColors.map(color => (
                            <button
                            key={color}
                            onClick={() => updateConfig('hairColor', color)}
                            className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${config.hairColor === color ? 'border-brand-600 scale-110 ring-2 ring-brand-100' : 'border-slate-200'}`}
                            style={{ backgroundColor: color }}
                            />
                        ))}
                        </div>
                    </div>
                )}
             </div>
          )}

          {/* TAB: STYLE */}
          {activeTab === 'style' && (
             <div className="space-y-6 animate-fade-in">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Clothing Color</label>
                    <div className="flex gap-3 flex-wrap">
                    {AVATAR_OPTIONS.clothingColors.map(color => (
                        <button
                        key={color}
                        onClick={() => updateConfig('clothingColor', color)}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${config.clothingColor === color ? 'border-brand-600 scale-110 ring-2 ring-brand-100' : 'border-slate-200'}`}
                        style={{ backgroundColor: color }}
                        />
                    ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Accessories</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['none', 'glasses', 'headset'].map(acc => (
                            <button
                            key={acc}
                            onClick={() => updateConfig('accessory', acc)}
                            className={`py-3 px-2 rounded-xl border text-sm font-medium capitalize transition-all ${config.accessory === acc ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}
                            >
                            {acc === 'none' ? 'No Accessory' : acc}
                            </button>
                        ))}
                    </div>
                </div>
             </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="pt-6 mt-2 border-t border-slate-200 flex gap-4 shrink-0">
            <button 
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={() => onSave(config)}
                className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-colors"
            >
                Save Coach
            </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarEditor;
