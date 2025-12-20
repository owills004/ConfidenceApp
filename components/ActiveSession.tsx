
import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { Scenario, TranscriptItem, ConnectionStatus, AvatarConfig, SessionReport, SessionSettings } from '../types';
import { LiveClient } from '../services/liveClient';
import { generateSessionAnalysis } from '../services/feedbackEngine';
import AudioVisualizer from './AudioVisualizer';
import Avatar from './Avatar';
import PronunciationFeedback from './PronunciationFeedback';
import { getVoiceMetadata, FILLER_WORDS } from '../constants';

interface ActiveSessionProps {
  scenario: Scenario;
  avatarConfig: AvatarConfig;
  sessionSettings: SessionSettings;
  initialTranscript?: TranscriptItem[];
  onEndSession: (report: SessionReport, isSaved?: boolean, audioBlob?: Blob) => void;
}

// Regex to find common filler words
const FILLER_WORD_REGEX = new RegExp(`\\b(${FILLER_WORDS.join('|')})\\b`, 'gi');

// Regex to extract emotion and intent tags
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
  let instruction = "";
  
  // 1. Core Persona
  instruction += scenario.systemInstruction;

  // 2. Language Enforcement (Strict)
  instruction += `\n\nLANGUAGE PROTOCOL:
  The user has selected to converse in ${settings.language}.
  You MUST speak, think, and respond in ${settings.language} exclusively.
  Even if the user speaks another language, kindly guide them back to ${settings.language}.
  Ensure your pronunciation and intonation match a native speaker of ${settings.language}.`;

  // 3. Difficulty Adaptation
  if (settings.difficulty === 'beginner') {
    instruction += `\n\nADAPTATION INSTRUCTION: The user is a BEGINNER. Speak slowly. Use simple vocabulary.`;
  } else if (settings.difficulty === 'advanced') {
    instruction += `\n\nADAPTATION INSTRUCTION: The user is ADVANCED. Speak fast. Use sophisticated vocabulary.`;
  }

  // 4. Speed Adaptation (Model Hint)
  if (settings.speed === 'slow') {
    instruction += `\n\nSPEECH PACE: Speak significantly slower.`;
  } else if (settings.speed === 'fast') {
    instruction += `\n\nSPEECH PACE: Speak quickly and energetically.`;
  }

  // 5. Group Conversation Simulation (Language Tutor only)
  if (scenario.id === 'language_tutor' && settings.groupSize && settings.groupSize > 1) {
      const totalCoaches = settings.groupSize;
      instruction += `\n\nGROUP SIMULATION MODE:
      You are simulating a conversation with ${totalCoaches} distinct AI coaches/participants.
      
      ROLE 1: The Main Tutor (Helpful, patient, corrects grammar).
      ROLE 2: The Peer (Casual, friendly, speaks naturally, maybe makes small mistakes).
      ${totalCoaches > 2 ? 'ROLE 3: The Skeptic (Questioning, asks for clarification, provides a different viewpoint).' : ''}
      
      INSTRUCTIONS:
      1. You must act out ALL these roles in a single conversation stream.
      2. Switch between personas naturally to create a group dynamic.
      3. Use different speaking styles/tones for each role (e.g., Tutor is formal, Peer is slangy).
      4. Explicitly tag the speaker in your text response if possible, e.g., "[Tutor]: Hello!", "[Peer]: Hey there!".
      5. Engage the user in a multi-party dialogue. Ask them who they agree with.
      `;
  }

  // 6. Analysis Layer
  instruction += `\n\nREAL-TIME ANALYSIS LAYER:
  You are an emotional intelligence expert. 
  For every response, you MUST start with hidden tags identifying the user's likely emotion and communicative intent based on their last input.
  
  Format: [[E:EmotionName]][[I:IntentName]]
  
  Valid Emotions: Confident, Nervous, Hesitant, Excited, Neutral, Frustrated.
  Valid Intents: Inquiry, Persuasion, Socializing, Defense, Agreement, Clarification.
  
  Pronunciation:
  If you detect a mispronounced word, add: "Tip: [Word] - [Actionable Correction]" at the end.`;

  // 7. Context Restoration (History)
  if (previousTranscript && previousTranscript.length > 0) {
    const recentHistory = previousTranscript.slice(-50);
    const historyText = recentHistory.map(t => `${t.role === 'user' ? 'User' : 'Model'}: "${t.text}"`).join('\n');
    instruction += `\n\nCONTEXT RESTORATION: Resume this conversation:\n---\n${historyText}\n---`;
  }

  // 8. System Context (Time/Date/Capabilities)
  const now = new Date();
  instruction += `\n\nSYSTEM CONTEXT:
  Current Date and Time: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}.
  You have access to Google Search. Use it to check for real-time information (weather, news, events) if the user asks.`;

  return instruction;
};

const getCleanText = (text: string) => {
  text = text.replace(ANALYSIS_REGEX, '').trim();
  // Strip Tip if it exists to clean up transcript
  return text.replace(/Tip:\s*(.*?)(\.|$)/i, '').trim();
};

// --- Optimized Sub-Components for High Frequency Updates ---

const LiveAvatar = React.memo(({ config, isSpeaking, volumeRef }: { config: AvatarConfig, isSpeaking: boolean, volumeRef: React.MutableRefObject<{input: number, output: number}> }) => {
    const [vol, setVol] = useState(0);
    const requestRef = useRef<number>(0);
    
    useEffect(() => {
        const loop = () => {
            const newVol = volumeRef.current.output;
            setVol(prev => {
                if (Math.abs(prev - newVol) < 0.01 && newVol < 0.01) return prev;
                return newVol;
            });
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    return <Avatar config={config} volume={vol} isSpeaking={isSpeaking} />;
});

const LiveVisualizer = React.memo(({ volumeRef, isActive }: { volumeRef: React.MutableRefObject<{input: number, output: number}>, isActive: boolean }) => {
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

    return <AudioVisualizer volume={vol} isActive={isActive} />;
});

const TranscriptMessage = React.memo(({ item, scenarioColor, isInitialResumeMarker }: { item: TranscriptItem, scenarioColor: string, isInitialResumeMarker?: boolean }) => {
    const cleanText = getCleanText(item.text);
    if (!cleanText) return null; 

    const isUser = item.role === 'user';

    return (
        <div className="animate-fade-in-up">
            {isInitialResumeMarker && (
                <div className="flex items-center gap-2 my-4 justify-center animate-fade-in">
                    <div className="h-px bg-slate-200 w-12"></div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Session Resumed</span>
                    <div className="h-px bg-slate-200 w-12"></div>
                </div>
            )}
            <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                    <div className={`w-1.5 h-1.5 rounded-full ${scenarioColor} mb-4 shrink-0 opacity-80`}></div>
                )}

                <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm relative overflow-hidden ${
                    isUser 
                    ? 'bg-slate-900 text-white rounded-br-none' 
                    : `border border-slate-200 text-slate-800 rounded-bl-none ${scenarioColor} bg-opacity-5`
                }`}>
                    {!isUser && (
                        <div className={`absolute top-0 left-0 w-1 h-full opacity-30 ${scenarioColor}`}></div>
                    )}
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 opacity-20 ${isUser ? 'bg-white' : scenarioColor}`}></div>
                    
                    {cleanText}

                    {item.sources && item.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-black/5 flex flex-wrap gap-2">
                            {item.sources.map((s, i) => (
                                <a 
                                key={i} 
                                href={s.uri} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center gap-1.5 bg-white/60 hover:bg-white border border-black/5 rounded-md px-2 py-1 text-[10px] text-slate-600 transition-colors no-underline group"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-brand-500 opacity-60 group-hover:opacity-100"></i>
                                    <span className="truncate max-w-[120px] font-medium">{s.title}</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {isUser && (
                    <div className={`w-1.5 h-1.5 rounded-full bg-slate-400 mb-4 shrink-0 opacity-60`}></div>
                )}
            </div>
        </div>
    );
}, (prev, next) => prev.item.text === next.item.text && prev.item.sources === next.item.sources);

// -----------------------------------------------------------

const ActiveSession: React.FC<ActiveSessionProps> = ({ scenario, avatarConfig, sessionSettings, initialTranscript, onEndSession }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(initialTranscript || []);
  const [initialCount] = useState(initialTranscript?.length || 0);
  
  const volumeRef = useRef({ input: 0, output: 0 });
  
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  // Tips State
  const [coachingTip, setCoachingTip] = useState<{ text: string, type: 'fluency' | 'pronunciation' | 'hesitation' } | null>(null);
  const coachingTipTimeoutRef = useRef<number | null>(null);
  
  // Real-time Fluency Stats
  const [fillerCount, setFillerCount] = useState<number>(0);
  const [awkwardPauseCount, setAwkwardPauseCount] = useState<number>(0);
  
  // Refined Hesitation Tracking
  const lastActiveTimeRef = useRef<number>(Date.now());
  const [hesitationScore, setHesitationScore] = useState<number>(0);

  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
  const [currentIntent, setCurrentIntent] = useState<string>('Socializing');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const emotionCounts = useRef<Record<string, number>>({});
  const intentCounts = useRef<Record<string, number>>({});
  
  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserAtBottom = useRef(true); 
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const mountedRef = useRef(true);

  // Helper to trigger coaching tips
  const triggerTip = useCallback((text: string, type: 'fluency' | 'pronunciation' | 'hesitation', duration: number = 6000) => {
    setCoachingTip({ text, type });
    if (coachingTipTimeoutRef.current) clearTimeout(coachingTipTimeoutRef.current);
    coachingTipTimeoutRef.current = window.setTimeout(() => setCoachingTip(null), duration);
  }, []);

  // Robust Silence and Hesitation Analysis
  useEffect(() => {
    const PAUSE_THRESHOLD = 3000; 
    const VOLUME_MIN_THRESHOLD = 0.05; 
    
    const checkActivity = () => {
      if (status !== ConnectionStatus.CONNECTED) return;

      const now = Date.now();
      const isInputActive = volumeRef.current.input > VOLUME_MIN_THRESHOLD;
      const isOutputActive = isSpeaking;

      if (isInputActive || isOutputActive) {
        lastActiveTimeRef.current = now;
        return;
      }

      const silenceDuration = now - lastActiveTimeRef.current;
      
      if (silenceDuration > PAUSE_THRESHOLD) {
        if (!coachingTip || (coachingTip.type !== 'hesitation' && coachingTip.type !== 'fluency')) {
            const randomPauseTip = FLUENCY_TIPS.pauses[Math.floor(Math.random() * FLUENCY_TIPS.pauses.length)];
            triggerTip(randomPauseTip, 'hesitation', 8000);
            setAwkwardPauseCount(prev => prev + 1);
            setHesitationScore(prev => prev + 5); 
            lastActiveTimeRef.current = now; 
        }
      }
    };

    const interval = setInterval(checkActivity, 100); 
    return () => clearInterval(interval);
  }, [status, isSpeaking, coachingTip, triggerTip]);

  const displayedAvatarConfig = useMemo(() => {
    const voiceMeta = getVoiceMetadata(sessionSettings.voiceName);
    const targetGender = (voiceMeta.gender || 'Male').toLowerCase() as 'male' | 'female';
    const adjustedConfig = { ...avatarConfig };

    if (adjustedConfig.gender !== targetGender) {
        adjustedConfig.gender = targetGender;
        if (targetGender === 'male') {
            if (['long', 'bun'].includes(adjustedConfig.hairStyle)) {
                adjustedConfig.hairStyle = 'short';
            }
        } else {
             if (adjustedConfig.hairStyle === 'bald') {
                 adjustedConfig.hairStyle = 'short';
             }
        }
    }
    return adjustedConfig;
  }, [avatarConfig, sessionSettings.voiceName]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isUserAtBottom.current = distanceToBottom < 100;
  };

  const toggleAutoScroll = () => {
      setAutoScrollEnabled(prev => {
          const next = !prev;
          if (next && scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              isUserAtBottom.current = true;
          }
          return next;
      });
  };

  useLayoutEffect(() => {
    if (scrollRef.current && autoScrollEnabled && isUserAtBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, autoScrollEnabled]);

  const handleTranscript = useCallback((text: string, isUser: boolean, isFinal: boolean) => {
    if (!mountedRef.current) return;

    if (isUser) {
        setIsUserSpeaking(true);
        lastActiveTimeRef.current = Date.now();
        if ((window as any).userSpeakTimeout) clearTimeout((window as any).userSpeakTimeout);
        (window as any).userSpeakTimeout = setTimeout(() => setIsUserSpeaking(false), 800);

        const matches = text.match(FILLER_WORD_REGEX);
        if (matches) {
            setFillerCount(prev => {
                const newCount = prev + matches.length;
                setHesitationScore(h => h + (matches.length * 2));
                if (newCount % 3 === 0) {
                    const randomFillerTip = FLUENCY_TIPS.fillers[Math.floor(Math.random() * FLUENCY_TIPS.fillers.length)];
                    triggerTip(randomFillerTip, 'fluency');
                }
                return newCount;
            });
        }
    }

    setTranscripts(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === (isUser ? 'user' : 'model')) {
            const updatedLast = { ...last, text: last.text + text };
            return [...prev.slice(0, -1), updatedLast];
        }
        return [...prev, { 
            id: Date.now().toString() + Math.random().toString().slice(2,6),
            role: isUser ? 'user' : 'model', 
            text, 
            timestamp: Date.now() 
        }];
    });

    if (!isUser) {
        setIsSpeaking(true);
        if ((window as any).speakingTimeout) clearTimeout((window as any).speakingTimeout);
        (window as any).speakingTimeout = setTimeout(() => setIsSpeaking(false), 500); 
    }
  }, [triggerTip]);

  const handleGrounding = useCallback((metadata: any) => {
    if (!mountedRef.current) return;
    if (metadata?.groundingChunks) {
        const newSources = metadata.groundingChunks.map((chunk: any) => chunk.web).filter((web: any) => web);
        if (newSources.length > 0) {
            setTranscripts(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                     const existing = last.sources || [];
                     const existingUris = new Set(existing.map(s => s.uri));
                     const uniqueNew = newSources.filter((s: any) => !existingUris.has(s.uri));
                     if (uniqueNew.length === 0) return prev;
                     return [...prev.slice(0, -1), { ...last, sources: [...existing, ...uniqueNew] }];
                }
                return prev;
            });
        }
    }
  }, []);

  const handleAnalysis = useCallback((emotion: string, intent: string) => {
    if (!mountedRef.current) return;
    setCurrentEmotion(emotion);
    setCurrentIntent(intent);
    emotionCounts.current[emotion] = (emotionCounts.current[emotion] || 0) + 1;
    intentCounts.current[intent] = (intentCounts.current[intent] || 0) + 1;
  }, []);

  useEffect(() => {
    const lastModelItem = transcripts.filter(t => t.role === 'model').pop();
    if (lastModelItem) {
        const tipMatch = lastModelItem.text.match(/Tip:\s*(.*?)(\.|$)/i);
        if (tipMatch) {
            triggerTip(tipMatch[1].trim(), 'pronunciation', 10000);
        }
    }
  }, [transcripts, triggerTip]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const adaptedInstruction = getAdaptedSystemInstruction(scenario, sessionSettings, initialTranscript);
        clientRef.current = new LiveClient(
            process.env.API_KEY || '',
            handleTranscript,
            (inVol, outVol) => { 
              if (mountedRef.current) {
                if (inVol < 0.001) {
                    volumeRef.current = { input: 0, output: outVol };
                    return;
                }
                const boostedInput = Math.min(Math.pow(inVol, 0.35), 1.0);
                volumeRef.current = { input: boostedInput, output: outVol };
              } 
            },
            handleGrounding,
            handleAnalysis,
            () => { if (mountedRef.current) setStatus(ConnectionStatus.DISCONNECTED); },
            (err) => { 
                console.error(err);
                if (mountedRef.current) {
                    setError("Microphone access denied or connection failed."); 
                    setStatus(ConnectionStatus.ERROR);
                }
            }
        );
        const voice = sessionSettings.voiceName || scenario.voiceName;
        await clientRef.current.connect(adaptedInstruction, voice);
        if (mountedRef.current) setStatus(ConnectionStatus.CONNECTED);
      } catch (e) {
        if (mountedRef.current) {
            setError("Failed to initialize AI session.");
            setStatus(ConnectionStatus.ERROR);
        }
      }
    };
    initSession();
    return () => {
      mountedRef.current = false;
      clientRef.current?.disconnect();
      if (coachingTipTimeoutRef.current) clearTimeout(coachingTipTimeoutRef.current);
    };
  }, [scenario, handleTranscript, sessionSettings, initialTranscript, handleGrounding, handleAnalysis]);

  const saveSession = async () => {
    const audioBlob = clientRef.current?.getSessionRecording();
    if (clientRef.current) await clientRef.current.disconnect();
    setStatus(ConnectionStatus.DISCONNECTED);
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const report: SessionReport = {
        durationSeconds,
        fillerWordCount: fillerCount, 
        awkwardPauseCount,
        fillerWordsPerMinute: durationSeconds > 0 ? (fillerCount / (durationSeconds / 60)) : 0,
        transcript: transcripts,
        dominantEmotion: currentEmotion,
        dominantIntent: currentIntent,
        paceWPM: 0,
    };
    onEndSession(report, true, audioBlob || undefined);
  };

  const endSession = async () => {
    if (isAnalyzing) return;
    const audioBlob = clientRef.current?.getSessionRecording();
    if (clientRef.current) await clientRef.current.disconnect();
    setIsAnalyzing(true);
    setStatus(ConnectionStatus.DISCONNECTED);
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const userText = transcripts.filter(t => t.role === 'user').map(t => t.text).join(' ');
    const wordCount = userText.trim().split(/\s+/).length;
    const paceWPM = durationSeconds > 0 ? Math.round(wordCount / (durationSeconds / 60)) : 0;
    let dominantEmo = 'Neutral';
    let maxEmoCount = 0;
    Object.entries(emotionCounts.current).forEach(([emo, count]) => {
        const c = count as number;
        if (c > maxEmoCount) {
            maxEmoCount = c;
            dominantEmo = emo;
        }
    });
    let dominantIntent = 'Socializing';
    let maxIntentCount = 0;
    Object.entries(intentCounts.current).forEach(([int, count]) => {
        const c = count as number;
        if (c > maxIntentCount) {
            maxIntentCount = c;
            dominantIntent = int;
        }
    });
    const analysis = await generateSessionAnalysis(transcripts, scenario.title, process.env.API_KEY || '');
    const report: SessionReport = {
        durationSeconds,
        fillerWordCount: fillerCount,
        awkwardPauseCount,
        fillerWordsPerMinute: durationSeconds > 0 ? (fillerCount / (durationSeconds / 60)) : 0,
        transcript: transcripts,
        dominantEmotion: dominantEmo,
        dominantIntent: dominantIntent,
        paceWPM,
        ...analysis
    };
    onEndSession(report, false, audioBlob || undefined);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
      
      {isAnalyzing && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
           <div className="w-16 h-16 border-4 border-brand-400 border-t-transparent rounded-full animate-spin mb-4"></div>
           <h3 className="text-xl font-bold">Generating Report</h3>
           <p className="text-brand-100 text-sm">Analyzing grammar, fluency, and tone...</p>
        </div>
      )}

      <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${scenario.color} bg-opacity-10 shrink-0 z-20 relative bg-white`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${scenario.color} text-white flex items-center justify-center`}>
                <i className={`fa-solid ${scenario.icon}`}></i>
            </div>
            <div>
                <h3 className="font-bold text-slate-900 leading-tight">{scenario.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        {status === ConnectionStatus.CONNECTED ? 'Live' : status}
                    </span>
                    <span>•</span>
                    <span className="capitalize font-bold text-brand-600">{sessionSettings.language}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {status === ConnectionStatus.CONNECTED && (
                <div className="flex items-center gap-1.5 mr-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100 animate-pulse shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-red-600"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Recording</span>
                </div>
            )}

            <div className="hidden sm:flex items-center gap-2 mr-4 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold" title="Total hesitant actions (fillers + pauses)">
                    <span className="text-slate-400">HESITATION:</span>
                    <span className={`${hesitationScore > 15 ? 'text-red-500' : hesitationScore > 5 ? 'text-orange-500' : 'text-brand-600'} transition-all`}>{hesitationScore}</span>
                </div>
                <div className="w-px h-3 bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="text-slate-400">FILLERS:</span>
                    <span className={`${fillerCount > 5 ? 'text-orange-500' : 'text-brand-600'}`}>{fillerCount}</span>
                </div>
            </div>

            <button
                onClick={saveSession}
                disabled={isAnalyzing}
                className="bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 border border-slate-200 flex items-center gap-2"
            >
                <i className="fa-solid fa-floppy-disk"></i>
                Save
            </button>
            <button 
                onClick={endSession}
                disabled={isAnalyzing}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
                <i className="fa-solid fa-flag-checkered"></i>
                Finish
            </button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0">
         
         <div className="absolute inset-0 z-0 flex items-center justify-center p-8 opacity-20 md:opacity-100 pointer-events-none overflow-hidden">
            <div className="w-64 h-64 md:w-80 md:h-80 relative flex flex-col items-center justify-center">
               
               {/* Analysis Badges Floating Near Avatar */}
               <div className="absolute -top-6 w-full flex justify-center gap-2 animate-fade-in-up">
                    <div className={`backdrop-blur-md border shadow-sm px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-all transform hover:scale-110 ${
                        currentEmotion === 'Confident' || currentEmotion === 'Excited' ? 'bg-green-50/90 border-green-200 text-green-700' :
                        currentEmotion === 'Hesitant' || currentEmotion === 'Nervous' ? 'bg-orange-50/90 border-orange-200 text-orange-700' :
                        'bg-slate-50/90 border-slate-200 text-slate-600'
                    }`}>
                        <i className={`fa-solid text-[10px] ${
                            currentEmotion === 'Confident' ? 'fa-bolt' : 
                            currentEmotion === 'Hesitant' ? 'fa-circle-pause' : 
                            currentEmotion === 'Excited' ? 'fa-face-laugh-beam' : 'fa-face-meh'
                        }`}></i>
                        <span className="text-[10px] font-bold uppercase tracking-tight">{currentEmotion}</span>
                    </div>

                    <div className="backdrop-blur-md bg-blue-50/90 border border-blue-200 text-blue-700 shadow-sm px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-all transform hover:scale-110">
                        <i className="fa-solid fa-bullseye text-[10px]"></i>
                        <span className="text-[10px] font-bold uppercase tracking-tight">{currentIntent}</span>
                    </div>
               </div>

               {isSpeaking && (
                 <>
                   <div className="absolute inset-0 border-4 border-brand-200 rounded-full animate-ping opacity-20"></div>
                   <div className="absolute -inset-4 border-4 border-brand-100 rounded-full animate-pulse opacity-30"></div>
                 </>
               )}
               <LiveAvatar config={displayedAvatarConfig} volumeRef={volumeRef} isSpeaking={isSpeaking} />
            </div>
         </div>
         
         <div 
           ref={scrollRef}
           onScroll={handleScroll}
           className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4"
           style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%)' }}
         >
            <div className="h-4"></div> 
            {transcripts.map((t, idx) => (
                <TranscriptMessage 
                    key={t.id} 
                    item={t} 
                    scenarioColor={scenario.color}
                    isInitialResumeMarker={idx === initialCount && initialCount > 0} 
                />
            ))}
         </div>

         <div className="absolute bottom-28 right-6 z-30">
            <button
                onClick={toggleAutoScroll}
                className={`w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-all ${
                    autoScrollEnabled ? 'bg-white text-brand-600 border-brand-200' : 'bg-slate-800 text-white border-slate-700'
                }`}
            >
                <i className={`fa-solid ${autoScrollEnabled ? 'fa-lock' : 'fa-lock-open'}`}></i>
            </button>
         </div>

         <div className="h-24 bg-white/80 backdrop-blur-md border-t border-slate-100 flex flex-col items-center justify-center relative z-20 shrink-0 px-4">
            <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-1">
                {error ? (
                    <div className="text-red-500 font-medium text-sm flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        {error}
                    </div>
                ) : (
                    <>
                        <LiveVisualizer volumeRef={volumeRef} isActive={status === ConnectionStatus.CONNECTED} />
                        
                        <div className="h-10 flex items-center justify-center w-full overflow-hidden relative">
                            {coachingTip && status === ConnectionStatus.CONNECTED ? (
                                <div className={`animate-fade-in-up flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-sm transition-all group hover:scale-105 cursor-default bg-white ${
                                        coachingTip.type === 'hesitation' ? 'border-orange-200' : 'border-brand-100'
                                     }`}
                                     title={coachingTip.text}>
                                    <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                        coachingTip.type === 'fluency' ? 'bg-brand-600 text-white' : 
                                        coachingTip.type === 'hesitation' ? 'bg-orange-500 text-white' : 
                                        'bg-yellow-500 text-white'
                                    }`}>
                                        <i className={`fa-solid ${
                                            coachingTip.type === 'fluency' ? 'fa-bolt-lightning' : 
                                            coachingTip.type === 'hesitation' ? 'fa-hourglass-start' : 
                                            'fa-ear-listen'
                                        }`}></i>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[280px]">
                                        {coachingTip.text}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 font-medium animate-fade-in">
                                    {status === ConnectionStatus.CONNECTED ? 'Listening...' : 'Connecting...'}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ActiveSession;
