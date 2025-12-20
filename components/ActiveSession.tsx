
import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { Scenario, TranscriptItem, ConnectionStatus, AvatarConfig, SessionReport, SessionSettings } from '../types';
import { LiveClient } from '../services/liveClient';
import { generateSessionAnalysis } from '../services/feedbackEngine';
import AudioVisualizer from './AudioVisualizer';
import Avatar from './Avatar';
import { getVoiceMetadata, FILLER_WORDS } from '../constants';

interface ActiveSessionProps {
  scenario: Scenario;
  avatarConfig: AvatarConfig;
  sessionSettings: SessionSettings;
  initialTranscript?: TranscriptItem[];
  onEndSession: (report: SessionReport, isSaved?: boolean, audioBlob?: Blob) => void;
}

const FILLER_WORD_REGEX = new RegExp(`\\b(${FILLER_WORDS.join('|')})\\b`, 'gi');
const ANALYSIS_REGEX = /\[\[E:(\w+)\]\](?:\[\[I:(\w+)\]\])?/;

const FLUENCY_TIPS = {
  fillers: [
    "Try to embrace silence instead of saying 'um'.",
    "Slow down slightly to give your brain time to catch up.",
    "Focus on finishing your sentence before thinking of the next one.",
    "Take a quick breath when you feel a filler word coming.",
    "It's okay to pause silently; it makes you sound more authoritative."
  ],
  pauses: [
    "If you're stuck, try: 'That's a great question, let me think...'",
    "Try summarizing your last point while you collect your thoughts.",
    "Use this moment to take a deep, grounding breath.",
    "Don't rush! A 3-second pause often feels longer to you than the listener.",
    "If you lost your train of thought, it's okay to ask for a moment."
  ]
};

const getAdaptedSystemInstruction = (scenario: Scenario, settings: SessionSettings, previousTranscript?: TranscriptItem[]) => {
  let instruction = scenario.systemInstruction;
  instruction += `\n\nLANGUAGE PROTOCOL: Speak in ${settings.language} exclusively.`;
  
  // PATIENCE PROTOCOL: This helps the model not jump in too early
  instruction += `\n\nTURN-TAKING PROTOCOL:
  The user is practicing confidence. Be extremely patient. 
  DO NOT interrupt the user if they pause for 2-3 seconds mid-sentence. 
  Only respond when you are certain they have finished their thought or if they ask you a direct question. 
  Allow the silence to be a coaching moment.`;

  if (settings.difficulty === 'beginner') instruction += `\n\nADAPTATION: Speak slowly. Use simple vocabulary.`;
  if (settings.speed === 'slow') instruction += `\n\nPACE: Speak significantly slower.`;

  instruction += `\n\nREAL-TIME ANALYSIS: For every response, start with: [[E:EmotionName]][[I:IntentName]]
  Valid Emotions: Confident, Nervous, Hesitant, Excited, Neutral.
  Valid Intents: Inquiry, Persuasion, Socializing, Clarification.`;

  if (previousTranscript && previousTranscript.length > 0) {
    const historyText = previousTranscript.slice(-10).map(t => `${t.role}: "${t.text}"`).join('\n');
    instruction += `\n\nRESUME CONTEXT:\n${historyText}`;
  }
  return instruction;
};

const getCleanText = (text: string) => text.replace(ANALYSIS_REGEX, '').replace(/Tip:\s*(.*?)(\.|$)/i, '').trim();

const LiveAvatar = React.memo(({ config, isSpeaking, volumeRef }: { config: AvatarConfig, isSpeaking: boolean, volumeRef: React.MutableRefObject<{input: number, output: number}> }) => {
    const [vol, setVol] = useState(0);
    const requestRef = useRef<number>(0);
    useEffect(() => {
        const loop = () => {
            setVol(volumeRef.current.output);
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);
    return <Avatar config={config} volume={vol} isSpeaking={isSpeaking} />;
});

const LiveVisualizer = React.memo(({ volumeRef, isActive, patienceProgress }: { volumeRef: React.MutableRefObject<{input: number, output: number}>, isActive: boolean, patienceProgress: number }) => {
    const [vol, setVol] = useState(0);
    const requestRef = useRef<number>(0);
    useEffect(() => {
        const loop = () => {
            setVol(volumeRef.current.input);
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);
    
    return (
        <div className="relative flex items-center justify-center">
            {/* Patience Meter Ring */}
            <svg className="absolute w-24 h-24 -rotate-90 pointer-events-none">
                <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-slate-100"
                />
                <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * patienceProgress)}
                    className="text-brand-500 transition-all duration-300 ease-linear opacity-40"
                    strokeLinecap="round"
                />
            </svg>
            <AudioVisualizer volume={vol} isActive={isActive} />
        </div>
    );
});

const ActiveSession: React.FC<ActiveSessionProps> = ({ scenario, avatarConfig, sessionSettings, initialTranscript, onEndSession }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(initialTranscript || []);
  const volumeRef = useRef({ input: 0, output: 0 });
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [coachingTip, setCoachingTip] = useState<{ text: string, type: 'fluency' | 'pronunciation' | 'hesitation' } | null>(null);
  const coachingTipTimeoutRef = useRef<number | null>(null);
  
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [awkwardPauseCount, setAwkwardPauseCount] = useState<number>(0);
  const [hesitationScore, setHesitationScore] = useState<number>(0);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const [patienceProgress, setPatienceProgress] = useState(0);

  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
  const [currentIntent, setCurrentIntent] = useState<string>('Socializing');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const emotionCounts = useRef<Record<string, number>>({});
  const intentCounts = useRef<Record<string, number>>({});
  
  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottom = useRef(true); 
  const mountedRef = useRef(true);

  const triggerTip = useCallback((text: string, type: 'fluency' | 'pronunciation' | 'hesitation', duration: number = 6000) => {
    setCoachingTip({ text, type });
    if (coachingTipTimeoutRef.current) clearTimeout(coachingTipTimeoutRef.current);
    coachingTipTimeoutRef.current = window.setTimeout(() => setCoachingTip(null), duration);
  }, []);

  // Sophisticated Silence and Turn-Ending Analysis
  useEffect(() => {
    const VOLUME_MIN_THRESHOLD = 0.05;
    const checkActivity = () => {
      if (status !== ConnectionStatus.CONNECTED) return;
      const now = Date.now();
      const isInputActive = volumeRef.current.input > VOLUME_MIN_THRESHOLD;
      
      // If user or AI is talking, they are active
      if (isInputActive || isSpeaking) {
        lastActiveTimeRef.current = now;
        setPatienceProgress(0);
        return;
      }

      const silenceDuration = now - lastActiveTimeRef.current;
      
      // Calculate contextual threshold
      // If last user transcript ends with punctuation, we wait less (they are likely done)
      // If it ends with a word/comma, we wait more (they are likely thinking)
      const lastUserTranscript = [...transcripts].reverse().find(t => t.role === 'user')?.text || '';
      const isSentenceFinished = /[.!?]\s*$/.test(lastUserTranscript);
      
      const threshold = isSentenceFinished ? 2500 : 4500; // Natural break vs Thinking stall
      
      // Update visual patience progress
      const progress = Math.min(silenceDuration / threshold, 1);
      setPatienceProgress(progress);

      if (silenceDuration > threshold) {
        if (!coachingTip || coachingTip.type !== 'hesitation') {
            const tipText = isSentenceFinished 
                ? "Nice summary. Use this pause to prepare for the next question."
                : FLUENCY_TIPS.pauses[Math.floor(Math.random() * FLUENCY_TIPS.pauses.length)];
            
            triggerTip(tipText, 'hesitation', 8000);
            
            if (!isSentenceFinished) {
                setAwkwardPauseCount(p => p + 1);
                setHesitationScore(h => h + 5);
            }
            lastActiveTimeRef.current = now; 
        }
      }
    };
    
    const interval = setInterval(checkActivity, 100);
    return () => clearInterval(interval);
  }, [status, isSpeaking, coachingTip, triggerTip, transcripts]);

  const handleTranscript = useCallback((text: string, isUser: boolean) => {
    if (!mountedRef.current) return;
    if (isUser) {
        lastActiveTimeRef.current = Date.now();
        const matches = text.match(FILLER_WORD_REGEX);
        if (matches) {
            setFillerCount(f => f + matches.length);
            setHesitationScore(h => h + matches.length * 2);
            if (Math.random() > 0.6) triggerTip(FILLER_WORDS[Math.floor(Math.random() * FILLER_WORDS.length)] + "? Focus on clear phrasing.", 'fluency');
        }
    }
    setTranscripts(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === (isUser ? 'user' : 'model')) {
            return [...prev.slice(0, -1), { ...last, text: last.text + text }];
        }
        return [...prev, { id: Date.now().toString(), role: isUser ? 'user' : 'model', text, timestamp: Date.now() }];
    });
    if (!isUser) {
        setIsSpeaking(true);
        if ((window as any).speakTimeout) clearTimeout((window as any).speakTimeout);
        (window as any).speakTimeout = setTimeout(() => setIsSpeaking(false), 800);
    }
  }, [triggerTip]);

  const handleAnalysis = useCallback((emotion: string, intent: string) => {
    if (!mountedRef.current) return;
    setCurrentEmotion(emotion);
    setCurrentIntent(intent);
    emotionCounts.current[emotion] = (emotionCounts.current[emotion] || 0) + 1;
    intentCounts.current[intent] = (intentCounts.current[intent] || 0) + 1;
  }, []);

  const downloadWav = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
        const blob = clientRef.current?.getSessionRecording();
        if (!blob) throw new Error("No recording available");
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FluentFlow_Capture_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsDownloading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      clientRef.current = new LiveClient(
        process.env.API_KEY || '',
        handleTranscript,
        (inV, outV) => { 
            const boostedInput = Math.min(Math.pow(inV, 0.45) * 1.5, 1.0);
            volumeRef.current = { input: boostedInput, output: outV }; 
        },
        (meta) => {},
        handleAnalysis,
        () => { if (mountedRef.current) setStatus(ConnectionStatus.DISCONNECTED); },
        (err) => { 
            if (mountedRef.current) {
                setError(err.message); 
                setStatus(ConnectionStatus.ERROR);
            }
        }
      );
      await clientRef.current.connect(getAdaptedSystemInstruction(scenario, sessionSettings, initialTranscript), sessionSettings.voiceName);
      if (mountedRef.current) setStatus(ConnectionStatus.CONNECTED);
    };
    init();
    return () => { mountedRef.current = false; clientRef.current?.disconnect(); };
  }, []);

  useLayoutEffect(() => {
    if (scrollRef.current && isUserAtBottom.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isUserAtBottom.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
      {isAnalyzing && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
           <div className="w-16 h-16 border-4 border-brand-400 border-t-transparent rounded-full animate-spin mb-4"></div>
           <h3 className="text-xl font-bold">Generating Report</h3>
           <p className="text-brand-100 text-sm">Synthesizing session metrics...</p>
        </div>
      )}

      {/* Header */}
      <div className={`p-4 border-b border-slate-100 flex items-center justify-between bg-white z-20 shrink-0`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${scenario.color} text-white flex items-center justify-center`}>
                <i className={`fa-solid ${scenario.icon}`}></i>
            </div>
            <div>
                <h3 className="font-bold text-slate-900 leading-tight">{scenario.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    {status === ConnectionStatus.CONNECTED ? <span className="text-green-600">Live</span> : status}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={downloadWav} 
                disabled={isDownloading || status !== ConnectionStatus.CONNECTED}
                className="bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 border border-slate-200 flex items-center gap-2 transition-all disabled:opacity-50"
                title="Download Practice Recording"
            >
                {isDownloading ? (
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                    <i className="fa-solid fa-download"></i>
                )}
                <span className="hidden sm:inline">Export Audio</span>
            </button>
            <button 
                onClick={() => onEndSession({ durationSeconds: (Date.now() - startTime)/1000, fillerWordCount: fillerCount, awkwardPauseCount, fillerWordsPerMinute: fillerCount/((Date.now()-startTime)/60000), transcript: transcripts, dominantEmotion: currentEmotion }, true, clientRef.current?.getSessionRecording() || undefined)} 
                className="bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 border border-slate-200 transition-colors"
            >
                Save
            </button>
            <button 
                onClick={() => { setIsAnalyzing(true); onEndSession({ durationSeconds: (Date.now() - startTime)/1000, fillerWordCount: fillerCount, awkwardPauseCount, fillerWordsPerMinute: fillerCount/((Date.now()-startTime)/60000), transcript: transcripts, dominantEmotion: currentEmotion }, false, clientRef.current?.getSessionRecording() || undefined); }} 
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
            >
                Finish Session
            </button>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative flex flex-col min-h-0 bg-slate-50/30">
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 md:w-80 md:h-80 relative flex flex-col items-center justify-center">
                {/* Meta Badges */}
                <div className="absolute -top-8 w-full flex justify-center gap-2 animate-fade-in-up z-30">
                    <div className="bg-white/90 backdrop-blur px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-bold shadow-sm flex items-center gap-1 transition-all">
                        <i className="fa-solid fa-face-smile text-brand-500"></i> {currentEmotion}
                    </div>
                    <div className="bg-white/90 backdrop-blur px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-bold shadow-sm flex items-center gap-1 transition-all">
                        <i className="fa-solid fa-bullseye text-blue-500"></i> {currentIntent}
                    </div>
                </div>
                {isSpeaking && (
                    <>
                        <div className="absolute inset-0 bg-brand-200 rounded-full animate-ping opacity-10"></div>
                        <div className="absolute -inset-4 border-2 border-brand-100 rounded-full animate-pulse opacity-20"></div>
                    </>
                )}
                <LiveAvatar config={avatarConfig} volumeRef={volumeRef} isSpeaking={isSpeaking} />
            </div>
         </div>

         <div 
            ref={scrollRef} 
            onScroll={handleScroll}
            className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)' }}
         >
            {transcripts.map((t, idx) => (
                <div key={idx} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${t.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                        {getCleanText(t.text)}
                    </div>
                </div>
            ))}
            <div className="h-4"></div>
         </div>

         {/* Subtle Footer Tooltip Area */}
         <div className="h-24 bg-white/80 backdrop-blur-md border-t border-slate-100 flex flex-col items-center justify-center shrink-0">
            <LiveVisualizer volumeRef={volumeRef} isActive={status === ConnectionStatus.CONNECTED} patienceProgress={patienceProgress} />
            <div className="h-8 flex items-center justify-center w-full">
                {coachingTip ? (
                    <div className="animate-fade-in-up flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 shadow-sm transition-all hover:scale-105">
                        <i className={`fa-solid text-brand-600 text-[10px] ${coachingTip.type === 'hesitation' ? 'fa-hourglass' : 'fa-lightbulb'}`}></i>
                        <span className="text-xs font-bold text-slate-700">{coachingTip.text}</span>
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-fade-in">
                        {status === ConnectionStatus.CONNECTED ? (patienceProgress > 0.5 ? 'AI is waiting for you to finish...' : 'Listening...') : 'Initializing AI Coach...'}
                    </p>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ActiveSession;
