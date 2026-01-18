
import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Scenario, TranscriptItem, ConnectionStatus, AvatarConfig, SessionReport, SessionSettings } from '../types';
import { LiveClient } from '../services/liveClient';
import AudioVisualizer from './AudioVisualizer';
import Avatar from './Avatar';
import BreathingGuide from './BreathingGuide';
import { FILLER_WORDS } from '../constants';

interface ActiveSessionProps {
  scenario: Scenario;
  avatarConfig: AvatarConfig;
  sessionSettings: SessionSettings;
  initialTranscript?: TranscriptItem[];
  onEndSession: (report: SessionReport, isSaved?: boolean, audioBlob?: Blob) => void;
}

const FILLER_WORD_REGEX = new RegExp(`\\b(${FILLER_WORDS.join('|')})\\b`, 'gi');
const PRONUNCIATION_TIP_REGEX = /Tip:\s*['"]?([^'"]+)['"]?\s*-\s*([^[\n\r]+)/i;

const ActiveSession: React.FC<ActiveSessionProps> = ({ scenario, avatarConfig, sessionSettings, initialTranscript, onEndSession }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(initialTranscript || []);
  const volumeRef = useRef({ input: 0, output: 0 });
  const [startTime] = useState<number>(Date.now());
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [awkwardPauseCount, setAwkwardPauseCount] = useState<number>(0);
  const [pronunciationTips, setPronunciationTips] = useState<{word: string, correction: string}[]>([]);
  const lastActivityRef = useRef<number>(Date.now());

  // Breathing Exercise State
  const [breathPhase, setBreathPhase] = useState<'IN' | 'HOLD' | 'OUT' | 'END'>('END');

  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    if (!mountedRef.current) return;
    
    // Clean text from common tags
    const cleanText = text.replace(/\[\[B:\w+\]\]/g, '').replace(/\[\[E:\w+\]\]/g, '').replace(/\[\[I:\w+\]\]/g, '').trim();
    if (!cleanText) return;

    if (isUser) {
        lastActivityRef.current = Date.now();
        const matches = cleanText.match(FILLER_WORD_REGEX);
        if (matches) setFillerCount(f => f + matches.length);

        setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user') {
                return [...prev.slice(0, -1), { ...last, text: last.text + (cleanText.startsWith(' ') ? cleanText : ' ' + cleanText) }];
            }
            return [...prev, { id: Date.now().toString(), role: 'user', text: cleanText, timestamp: Date.now() }];
        });
    } else {
        // Parse Pronunciation Tip if present in model output
        const tipMatch = cleanText.match(PRONUNCIATION_TIP_REGEX);
        if (tipMatch) {
            const word = tipMatch[1];
            const correction = tipMatch[2];
            setPronunciationTips(prev => {
                // Prevent duplicate consecutive tips for the same word
                if (prev.length > 0 && prev[0].word.toLowerCase() === word.toLowerCase()) return prev;
                return [{ word, correction }, ...prev].slice(0, 5); // Keep last 5
            });
        }

        setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model') {
                return [...prev.slice(0, -1), { ...last, text: last.text + cleanText }];
            }
            return [...prev, { id: Date.now().toString(), role: 'model', text: cleanText, timestamp: Date.now() }];
        });
        setIsSpeaking(true);
        if ((window as any).speakTimeout) clearTimeout((window as any).speakTimeout);
        (window as any).speakTimeout = setTimeout(() => setIsSpeaking(false), 800);
    }
  }, []);

  // Detect Awkward Pauses
  useEffect(() => {
    const NOISE_THRESHOLD = 0.05;
    const PAUSE_THRESHOLD_MS = 3800; 

    const interval = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED || isSpeaking || breathPhase !== 'END') {
        lastActivityRef.current = Date.now();
        return;
      }

      const isUserTalking = volumeRef.current.input > NOISE_THRESHOLD;
      if (isUserTalking) {
        lastActivityRef.current = Date.now();
      } else {
        const silenceTime = Date.now() - lastActivityRef.current;
        if (silenceTime > PAUSE_THRESHOLD_MS && silenceTime < PAUSE_THRESHOLD_MS + 300) {
          setAwkwardPauseCount(c => c + 1);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, isSpeaking, breathPhase]);

  useEffect(() => {
    const init = async () => {
      clientRef.current = new LiveClient(
        process.env.API_KEY || '',
        handleTranscript,
        (inV, outV) => { 
            volumeRef.current = { input: inV, output: outV }; 
        },
        () => {}, // onGrounding
        () => {}, // onAnalysis
        (phase) => {
            if (mountedRef.current) setBreathPhase(phase);
        },
        () => { if (mountedRef.current) setStatus(ConnectionStatus.DISCONNECTED); },
        (err) => { 
            if (mountedRef.current) setStatus(ConnectionStatus.ERROR);
        }
      );
      
      await clientRef.current.connect(scenario.systemInstruction, sessionSettings.voiceName);
      if (mountedRef.current) setStatus(ConnectionStatus.CONNECTED);
    };
    init();
    return () => { 
      mountedRef.current = false; 
      clientRef.current?.disconnect(); 
    };
  }, [scenario.systemInstruction, sessionSettings.voiceName, handleTranscript]);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  const handleFinish = () => {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const durationMinutes = Math.max(durationSeconds / 60, 0.1);
    const fpm = fillerCount / durationMinutes;
    const apm = awkwardPauseCount / durationMinutes;
    const hesitationScore = Math.round((fpm * 1.5) + (apm * 5.5));
    
    onEndSession({ 
      durationSeconds, 
      fillerWordCount: fillerCount, 
      awkwardPauseCount, 
      hesitationScore, 
      fillerWordsPerMinute: Number(fpm.toFixed(1)), 
      transcript: transcripts 
    }, false);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[750px] lg:h-[650px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
      
      {/* Visual Breathing Exercise Overlay */}
      <BreathingGuide phase={breathPhase} />

      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-20 shrink-0">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${scenario.color} text-white flex items-center justify-center`}>
                    <i className={`fa-solid ${scenario.icon}`}></i>
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{scenario.title}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        {breathPhase !== 'END' ? 'Calming Exercise' : status}
                    </div>
                </div>
            </div>
            <button 
                onClick={handleFinish} 
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
            >
                End Session
            </button>
        </div>

        <div className="flex-1 relative flex flex-col min-h-0 bg-slate-50/30">
            <div className="flex items-center justify-center py-8 pointer-events-none">
                <div className="w-40 h-40 sm:w-56 sm:h-56 relative">
                    {isSpeaking && <div className="absolute inset-0 bg-brand-200 rounded-full animate-ping opacity-10"></div>}
                    <Avatar config={avatarConfig} isSpeaking={isSpeaking} />
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)' }}>
                {transcripts.map((t, idx) => {
                    const cleanText = t.text.replace(PRONUNCIATION_TIP_REGEX, '').trim();
                    if (!cleanText) return null;
                    return (
                        <div key={idx} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                t.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                            }`}>
                                {cleanText}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="h-24 bg-white/80 backdrop-blur-md border-t border-slate-100 flex flex-col items-center justify-center shrink-0">
                <AudioVisualizer volume={volumeRef.current.input} isActive={status === ConnectionStatus.CONNECTED} />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono mt-2">
                    {breathPhase !== 'END' ? 'Breathe with your Coach' : isSpeaking ? 'Coach Speaking' : 'Listening...'}
                </p>
            </div>
        </div>
      </div>

      {/* Coaching Insights Sidebar */}
      <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
         <div className="p-4 bg-white border-b border-slate-200">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-brand-500"></i>
                Session Insights
            </h4>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fillers</div>
                    <div className={`text-2xl font-black ${fillerCount > 5 ? 'text-orange-500' : 'text-slate-800'}`}>
                        {fillerCount}
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pauses</div>
                    <div className={`text-2xl font-black ${awkwardPauseCount > 2 ? 'text-red-500' : 'text-slate-800'}`}>
                        {awkwardPauseCount}
                    </div>
                </div>
            </div>

            {/* Pronunciation Tips Section */}
            <div>
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-ear-listen text-brand-400"></i>
                    Pronunciation Tips
                </h5>
                
                <div className="space-y-3">
                    {pronunciationTips.length === 0 ? (
                        <div className="text-center py-8 px-4 bg-white/50 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                            <i className="fa-solid fa-microphone-slash mb-2 opacity-50"></i>
                            <p className="text-[11px] font-medium italic">Speak to receive real-time pronunciation corrections.</p>
                        </div>
                    ) : (
                        pronunciationTips.map((tip, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm animate-fade-in-up border-l-4 border-l-yellow-400">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-black text-slate-900">"{tip.word}"</span>
                                    <i className="fa-solid fa-bolt text-yellow-500 text-[10px]"></i>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                    {tip.correction}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Hint Box */}
            <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100">
                <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <i className="fa-solid fa-lightbulb text-[10px]"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-brand-800 mb-1">Pro Tip</p>
                        <p className="text-[10px] text-brand-700 leading-relaxed">
                            Try to pause silently instead of saying "um" or "uh". It makes you sound more prepared and confident.
                        </p>
                    </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ActiveSession;
