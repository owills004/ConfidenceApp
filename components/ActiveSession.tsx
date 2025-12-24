
import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Scenario, TranscriptItem, ConnectionStatus, AvatarConfig, SessionReport, SessionSettings } from '../types';
import { LiveClient } from '../services/liveClient';
import AudioVisualizer from './AudioVisualizer';
import Avatar from './Avatar';
import { FILLER_WORDS } from '../constants';

interface ActiveSessionProps {
  scenario: Scenario;
  avatarConfig: AvatarConfig;
  sessionSettings: SessionSettings;
  initialTranscript?: TranscriptItem[];
  onEndSession: (report: SessionReport, isSaved?: boolean, audioBlob?: Blob) => void;
}

const FILLER_WORD_REGEX = new RegExp(`\\b(${FILLER_WORDS.join('|')})\\b`, 'gi');

const ActiveSession: React.FC<ActiveSessionProps> = ({ scenario, avatarConfig, sessionSettings, initialTranscript, onEndSession }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(initialTranscript || []);
  const volumeRef = useRef({ input: 0, output: 0 });
  const [startTime] = useState<number>(Date.now());
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [awkwardPauseCount, setAwkwardPauseCount] = useState<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    if (!mountedRef.current) return;
    
    if (isUser) {
        lastActivityRef.current = Date.now();
        const matches = text.match(FILLER_WORD_REGEX);
        if (matches) setFillerCount(f => f + matches.length);

        setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user') {
                return [...prev.slice(0, -1), { ...last, text: last.text + (text.startsWith(' ') ? text : ' ' + text) }];
            }
            return [...prev, { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() }];
        });
    } else {
        setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model') {
                return [...prev.slice(0, -1), { ...last, text: last.text + text }];
            }
            return [...prev, { id: Date.now().toString(), role: 'model', text, timestamp: Date.now() }];
        });
        setIsSpeaking(true);
        if ((window as any).speakTimeout) clearTimeout((window as any).speakTimeout);
        (window as any).speakTimeout = setTimeout(() => setIsSpeaking(false), 800);
    }
  }, []);

  // Detect Awkward Pauses
  useEffect(() => {
    const NOISE_THRESHOLD = 0.05;
    const PAUSE_THRESHOLD_MS = 3800; // ~4 seconds is considered an awkward pause in conversation

    const interval = setInterval(() => {
      if (status !== ConnectionStatus.CONNECTED || isSpeaking) {
        lastActivityRef.current = Date.now();
        return;
      }

      const isUserTalking = volumeRef.current.input > NOISE_THRESHOLD;
      if (isUserTalking) {
        lastActivityRef.current = Date.now();
      } else {
        const silenceTime = Date.now() - lastActivityRef.current;
        // Check if a pause just crossed the threshold
        if (silenceTime > PAUSE_THRESHOLD_MS && silenceTime < PAUSE_THRESHOLD_MS + 300) {
          setAwkwardPauseCount(c => c + 1);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, isSpeaking]);

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
    
    // Normalized metrics
    const fpm = fillerCount / durationMinutes;
    const apm = awkwardPauseCount / durationMinutes;
    
    // Sophisticated Hesitation Score Calculation
    // We weight pauses more heavily than filler words as they are more disruptive.
    // Indexing against duration ensures fairness across session lengths.
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
    <div className="flex flex-col h-[650px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-20 shrink-0">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${scenario.color} text-white flex items-center justify-center`}>
                <i className={`fa-solid ${scenario.icon}`}></i>
            </div>
            <div>
                <h3 className="font-bold text-slate-900 leading-tight">{scenario.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    {status}
                </div>
            </div>
        </div>
        <button 
            onClick={handleFinish} 
            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
        >
            Exit Session
        </button>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0 bg-slate-50/30">
         <div className="flex items-center justify-center py-12 pointer-events-none">
            <div className="w-48 h-48 sm:w-64 sm:h-64 relative">
                {isSpeaking && <div className="absolute inset-0 bg-brand-200 rounded-full animate-ping opacity-10"></div>}
                <Avatar config={avatarConfig} isSpeaking={isSpeaking} />
            </div>
         </div>

         <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)' }}>
            {transcripts.map((t, idx) => (
                <div key={idx} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        t.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}>
                        {t.text}
                    </div>
                </div>
            ))}
         </div>

         <div className="h-24 bg-white/80 backdrop-blur-md border-t border-slate-100 flex flex-col items-center justify-center shrink-0">
            <AudioVisualizer volume={volumeRef.current.input} isActive={status === ConnectionStatus.CONNECTED} />
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono mt-2">
                {isSpeaking ? 'Coach Speaking' : 'Listening...'}
            </p>
         </div>
      </div>
    </div>
  );
};

export default ActiveSession;
