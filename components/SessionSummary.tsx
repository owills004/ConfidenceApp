
import React, { useState } from 'react';
import { SessionReport, UserStats, Scenario } from '../types';

interface SessionSummaryProps {
  report: SessionReport;
  earnedXP: number;
  stats: UserStats;
  onClose: () => void;
  isHistoryView?: boolean;
  audioBlob?: Blob;
  suggestions?: Scenario[];
  onSelectScenario?: (scenario: Scenario) => void;
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ 
  report, 
  earnedXP, 
  stats, 
  onClose, 
  isHistoryView = false, 
  audioBlob,
  suggestions = [],
  onSelectScenario
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'grammar' | 'tips' | 'transcript'>('overview');

  const ANALYSIS_REGEX = /\[\[E:(\w+)\]\](?:\[\[I:(\w+)\]\])?/;

  const getCleanText = (text: string) => {
    return text.replace(ANALYSIS_REGEX, '').trim();
  };

  const handleDownloadAudio = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FluentFlow_Session_${new Date().toISOString().slice(0, 10)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`${isHistoryView ? 'bg-slate-800' : 'bg-brand-600'} p-6 text-center text-white relative overflow-hidden shrink-0 transition-colors`}>
          <div className="absolute top-0 left-0 w-full h-full opacity-20">
             <i className="fa-solid fa-star absolute top-4 left-4 text-4xl animate-pulse"></i>
             <i className="fa-solid fa-trophy absolute bottom-4 right-4 text-6xl"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">{isHistoryView ? 'Session Report' : 'Session Complete!'}</h2>
            <div className="mt-2 inline-block bg-white/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30">
              <span className="font-bold text-3xl">+{earnedXP}</span> <span className="text-sm uppercase tracking-wide opacity-90">XP Earned</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[80px] py-3 text-sm font-bold ${activeTab === 'overview' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500'}`}>Overview</button>
            <button onClick={() => setActiveTab('grammar')} className={`flex-1 min-w-[80px] py-3 text-sm font-bold ${activeTab === 'grammar' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500'}`}>Grammar</button>
            <button onClick={() => setActiveTab('tips')} className={`flex-1 min-w-[80px] py-3 text-sm font-bold ${activeTab === 'tips' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500'}`}>Tips</button>
            <button onClick={() => setActiveTab('transcript')} className={`flex-1 min-w-[80px] py-3 text-sm font-bold ${activeTab === 'transcript' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500'}`}>Transcript</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Fluency</div>
                        <div className="text-xl font-bold text-brand-600">{report.fluencyScore ?? '-'}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Fillers</div>
                        <div className={`text-xl font-bold ${report.fillerWordCount > 5 ? 'text-orange-500' : 'text-green-600'}`}>
                            {report.fillerWordCount}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Awkward Pauses</div>
                        <div className={`text-xl font-bold ${report.awkwardPauseCount > 3 ? 'text-red-500' : 'text-blue-600'}`}>
                            {report.awkwardPauseCount}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Pace (WPM)</div>
                        <div className="text-xl font-bold text-slate-700">{report.paceWPM ?? '-'}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase">Dominant Tone</div>
                        <div className="text-lg font-bold text-slate-900">{report.dominantEmotion}</div>
                    </div>
                    <div className={`text-2xl ${report.dominantEmotion === 'Confident' ? 'text-green-500' : 'text-orange-400'}`}>
                        <i className={`fa-solid ${report.dominantEmotion === 'Confident' ? 'fa-face-smile-beam' : 'fa-face-meh'}`}></i>
                    </div>
                </div>

                {audioBlob && (
                  <button 
                    onClick={handleDownloadAudio}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                  >
                    <i className="fa-solid fa-cloud-arrow-down"></i>
                    Download Full Recording (.WAV)
                  </button>
                )}

                {/* Recommendations */}
                {suggestions.length > 0 && (
                    <div className="mt-8">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <i className="fa-solid fa-wand-magic-sparkles text-brand-500"></i>
                           Recommended Next Steps
                        </h4>
                        <div className="space-y-3">
                            {suggestions.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => onSelectScenario?.(s)}
                                    className="w-full flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-all text-left group"
                                >
                                    <div className={`w-10 h-10 rounded-lg ${s.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                                        <i className={`fa-solid ${s.icon} text-sm`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="text-sm font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{s.title}</h5>
                                        <p className="text-[11px] text-slate-500 truncate">{s.description}</p>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-brand-400 text-xs"></i>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
              </div>
          )}
          
          {activeTab === 'grammar' && (
              <div className="space-y-4">
                  {report.grammarCorrections && report.grammarCorrections.length > 0 ? (
                      report.grammarCorrections.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <div className="mb-3 pb-3 border-b border-slate-200/50">
                                  <div className="flex items-center gap-2 text-xs font-bold text-red-500 mb-1">
                                      <i className="fa-solid fa-xmark"></i> Original
                                  </div>
                                  <p className="text-slate-700 line-through decoration-red-300 opacity-70 italic font-serif">"{item.original}"</p>
                              </div>
                              <div className="mb-3">
                                  <div className="flex items-center gap-2 text-xs font-bold text-green-600 mb-1">
                                      <i className="fa-solid fa-check"></i> Improved
                                  </div>
                                  <p className="text-slate-900 font-medium">"{item.correction}"</p>
                              </div>
                              <div className="flex items-start gap-2 bg-blue-50/50 p-2 rounded-lg">
                                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5 border border-blue-200">
                                      Rule
                                  </span>
                                  <p className="text-xs text-slate-600 leading-relaxed font-medium pt-0.5">{item.explanation}</p>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-8 text-slate-500">
                          <i className="fa-solid fa-check-double text-green-500 text-3xl mb-2"></i>
                          <p>No major grammatical errors detected!</p>
                      </div>
                  )}
              </div>
          )}
          {activeTab === 'tips' && (
              <div className="space-y-4">
                  {report.confidenceTips && report.confidenceTips.length > 0 ? (
                      report.confidenceTips.map((tip, idx) => (
                          <div key={idx} className="flex gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                              <div className="shrink-0 w-8 h-8 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center font-bold">
                                  {idx + 1}
                              </div>
                              <div>
                                  <h4 className="font-bold text-purple-900 text-sm mb-1">Confidence Tip</h4>
                                  <p className="text-sm text-purple-800/80 leading-relaxed">{tip}</p>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-8 text-slate-400">
                          <p>No specific tips available for this session.</p>
                      </div>
                  )}
              </div>
          )}
          {activeTab === 'transcript' && (
             <div className="space-y-4">
               {report.transcript && report.transcript.length > 0 ? (
                 report.transcript.map((t, idx) => {
                     const cleanText = getCleanText(t.text);
                     if (!cleanText) return null;
                     return (
                        <div key={idx} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                                t.role === 'user' 
                                ? 'bg-slate-900 text-white rounded-br-none' 
                                : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-none'
                            }`}>
                                {cleanText}
                            </div>
                        </div>
                     );
                 })
               ) : (
                 <div className="text-center py-8 text-slate-400">
                     <p>No transcript available.</p>
                 </div>
               )}
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button onClick={onClose} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg">Continue to Dashboard</button>
        </div>
      </div>
    </div>
  );
};

export default SessionSummary;
