
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
// Improved Regex to capture the word and the detailed correction instruction
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
  const userWordsCountRef = useRef<number>(0);

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
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        userWordsCountRef.current += words.length;

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
                // Prevent duplicate tips for the same word in a row
                if (prev.length > 0 && prev[0].word.toLowerCase() === word.toLowerCase()) return prev;
                return [{ word, correction, id: Date.now().toString() }, ...prev].slice(0, 15); 
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

  // Detect Awkward Pauses with Context Sensitivity
  useEffect(() => {
    const NOISE_THRESHOLD = 0.05;
    const MID_SENTENCE_PAUSE_MS = 2400; 
    const END_SENTENCE_PAUSE_MS = 4500; 
    const RECOVERY_WINDOW = 300; 

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
        const lastUserMsg = [...transcripts].reverse().find(t => t.role === 'user');
        const isEndOfThought = lastUserMsg ? /[.?!]$/.test(lastUserMsg.text.trim()) : true;
        const currentThreshold = isEndOfThought ? END_SENTENCE_PAUSE_MS : MID_SENTENCE_PAUSE_MS;

        if (silenceTime > currentThreshold && silenceTime < currentThreshold + RECOVERY_WINDOW) {
          setAwkwardPauseCount(c => c + 1);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, isSpeaking, breathPhase, transcripts]);

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
    const wpm = userWordsCountRef.current / durationMinutes;
    const fpm = fillerCount / durationMinutes;
    const apm = awkwardPauseCount / durationMinutes;
    const paceModifier = wpm < 100 ? 1.2 : wpm > 160 ? 0.8 : 1.0;
    const hesitationScore = Math.round(((fpm * 2.5) + (apm * 7.5)) * paceModifier);
    
    onEndSession({ 
      durationSeconds, 
      fillerWordCount: fillerCount, 
      awkwardPauseCount, 
      hesitationScore, 
      fillerWordsPerMinute: Number(fpm.toFixed(1)), 
      paceWPM: Math.round(wpm),
      transcript: transcripts,
      dominantEmotion: perception?.emotion,
      dominantIntent: perception?.intent
    }, false, clientRef.current?.getSessionRecording() || undefined);
  };

  const latestTip = pronunciationTips[0];

  return (
    <div className="flex flex-col lg:flex-row h-[750px] lg:h-[650px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
      
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
                    // Hide raw pronunciation tips and tag system text from main chat for a cleaner UI
                    const cleanText = t.text.replace(PRONUNCIATION_TIP_REGEX, '').replace(TAG_CLEAN_REGEX, '').trim();
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
         <div className="p-4 bg-white border-b border-slate-200 shrink-0">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-microphone-lines text-brand-500"></i>
                Fluency Metrics
            </h4>
         </div>
         
         <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Live Metrics Row */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fillers</div>
                    <div className={`text-2xl font-black ${fillerCount > 5 ? 'text-orange-500' : 'text-slate-800'}`}>
                        {fillerCount}
                    </div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hesitations</div>
                    <div className={`text-2xl font-black ${awkwardPauseCount > 2 ? 'text-red-500' : 'text-slate-800'}`}>
                        {awkwardPauseCount}
                    </div>
                </div>
            </div>

            {/* Pronunciation Correction Spotlight */}
            <div className="space-y-3">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-ear-listen text-brand-500"></i>
                    Pronunciation Coach
                </h5>

                {latestTip ? (
                    <div className="animate-fade-in-up">
                        <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-4 rounded-2xl shadow-xl shadow-brand-100 text-white relative overflow-hidden ring-4 ring-white">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <i className="fa-solid fa-bullhorn text-4xl -rotate-12"></i>
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/20">
                                    <div className="text-xl font-black tracking-tight flex items-center gap-2">
                                        <span className="text-brand-200">"</span>
                                        {latestTip.word}
                                        <span className="text-brand-200">"</span>
                                    </div>
                                    <span className="bg-white/20 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Live Fix</span>
                                </div>
                                <div className="text-xs font-semibold leading-relaxed bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                                    <i className="fa-solid fa-circle-info mr-2 text-brand-300"></i>
                                    {latestTip.correction}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 px-4 bg-white/50 border border-dashed border-slate-200 rounded-3xl text-slate-400">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                            <i className="fa-solid fa-microphone-slash text-sm"></i>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">Waiting for Speech</p>
                        <p className="text-[9px] mt-1 opacity-60">I'll highlight mispronounced words here.</p>
                    </div>
                )}
            </div>

            {/* Historical Tips Scroll */}
            {pronunciationTips.length > 1 && (
                <div className="animate-fade-in">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-history"></i>
                        Previous Corrections
                    </h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {pronunciationTips.slice(1).map((tip) => (
                            <div key={tip.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-brand-400 animate-fade-in">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-slate-800">"{tip.word}"</span>
                                    <i className="fa-solid fa-check text-green-500 text-[10px] opacity-40"></i>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight font-medium">
                                    {tip.correction}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Motivational Anchor */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg mt-auto">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-lightbulb text-xs"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-brand-200 mb-1">Coach Strategy</p>
                        <p className="text-[10px] text-slate-300 leading-relaxed italic">
                            Don't worry about being perfect. Focus on the flow first, and we'll sharpen the sounds together.
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
