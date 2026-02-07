
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
const TAG_CLEAN_REGEX = /\[\[(E|I|B):[^\]]+\]\]/g;
const PRONUNCIATION_TIP_REGEX = /Tip:\s*['"“]?([^'"“”]+)['"”]?\s*-\s*([^[\n\r\]]+)/i;

const EMOTION_ICONS: Record<string, string> = {
    'Confident': 'fa-shield-halved text-green-500',
    'Hesitant': 'fa-pause text-yellow-500',
    'Nervous': 'fa-heart-pulse text-orange-500',
    'Excited': 'fa-bolt text-yellow-400',
    'Neutral': 'fa-face-meh text-slate-400',
    'Frustrated': 'fa-fire-alt text-red-500'
};

const ActiveSession: React.FC<ActiveSessionProps> = ({ scenario, avatarConfig, sessionSettings, initialTranscript, onEndSession }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(initialTranscript || []);
  const volumeRef = useRef({ input: 0, output: 0 });
  const [startTime] = useState<number>(Date.now());
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [awkwardPauseCount, setAwkwardPauseCount] = useState<number>(0);
  const [pronunciationTips, setPronunciationTips] = useState<{word: string, correction: string, id: string}[]>([]);
  const [perception, setPerception] = useState<{emotion: string, intent: string} | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Breathing Exercise State
  const [breathPhase, setBreathPhase] = useState<'IN' | 'HOLD' | 'OUT' | 'END'>('END');

  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    if (!mountedRef.current) return;
    
    // Clean text from all tags including metadata
    const cleanText = text.replace(TAG_CLEAN_REGEX, '').trim();
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
            const word = tipMatch[1].trim();
            const correction = tipMatch[2].trim();
            setPronunciationTips(prev => {
                if (prev.length > 0 && prev[0].word.toLowerCase() === word.toLowerCase()) return prev;
                return [{ word, correction, id: Date.now().toString() }, ...prev].slice(0, 10); 
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
        (emotion, intent) => {
            if (mountedRef.current) setPerception({ emotion, intent });
        },
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
      transcript: transcripts,
      dominantEmotion: perception?.emotion,
      dominantIntent: perception?.intent
    }, false, clientRef.current?.getSessionRecording() || undefined);
  };

  const latestTip = pronunciationTips[0];

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
            {/* AI Perception Overlay */}
            {perception && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-fade-in-down pointer-events-none">
                    <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white flex items-center gap-3 ring-1 ring-slate-200/50">
                        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                            <i className={`fa-solid ${EMOTION_ICONS[perception.emotion] || 'fa-face-smile text-brand-500'}`}></i>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{perception.emotion}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intent:</span>
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-wide">{perception.intent}</span>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Pronunciation Spotlight */}
            {latestTip && (
                <div className="animate-fade-in-up">
                    <div className="flex items-center justify-between mb-2">
                         <h5 className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                            </span>
                            Live Correction
                         </h5>
                    </div>
                    <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-4 rounded-2xl shadow-lg shadow-brand-100 text-white transform transition-transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-2">
                             <div className="text-lg font-black tracking-tight">"{latestTip.word}"</div>
                             <i className="fa-solid fa-ear-listen opacity-50"></i>
                        </div>
                        <div className="text-xs font-medium leading-relaxed bg-white/10 p-2 rounded-lg border border-white/10">
                            {latestTip.correction}
                        </div>
                    </div>
                </div>
            )}

            {/* Historical Tips Section */}
            <div>
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-history text-slate-400"></i>
                    Recent History
                </h5>
                
                <div className="space-y-3">
                    {pronunciationTips.length <= 1 && pronunciationTips.length === 0 ? (
                        <div className="text-center py-8 px-4 bg-white/50 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                            <i className="fa-solid fa-microphone-slash mb-2 opacity-50"></i>
                            <p className="text-[11px] font-medium italic">Speak to receive real-time pronunciation corrections.</p>
                        </div>
                    ) : (
                        pronunciationTips.slice(1).map((tip) => (
                            <div key={tip.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm animate-fade-in border-l-4 border-l-slate-300">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-slate-800">"{tip.word}"</span>
                                    <i className="fa-solid fa-check text-green-500 text-[10px] opacity-30"></i>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight font-medium">
                                    {tip.correction}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                        <i className="fa-solid fa-lightbulb text-[10px]"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-600 mb-1">Coach's Tip</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            Confidence isn't just about what you say, it's about the steady rhythm of your speech. Try to match the Coach's pace.
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
