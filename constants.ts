
import { Scenario, UserStats, AvatarConfig, LanguageConfig, SessionSettings, Resource } from './types';

export const FILLER_WORDS = ['um', 'uh', 'ah', 'hmm', 'er', 'like', 'actually', 'basically'];

export const getLanguageSystemInstruction = (language: string) => {
  const isEnglish = language.toLowerCase() === 'english';
  
  return `
You are a helpful ${language} language tutor. 
${isEnglish 
  ? "Speak in clear, articulate English. Focus on helping the user refine their vocabulary and phrasing. If they struggle, explain complex concepts simply." 
  : `Speak primarily in ${language}, but use English if the user is confused.`}

Correct grammar mistakes immediately but gently. 
Encourage the user to speak in full sentences.

CRITICAL: PRONUNCIATION ANALYSIS
Listen closely to the user's pronunciation and accent. If you detect a mispronounced word, incorrect stress, or wrong phoneme:
1. Interrupt politely or wait for them to finish.
2. Explicitly identify the word and the specific sound (phoneme) they got wrong.
3. Provide a physical instruction on how to fix it (e.g., "tongue position," "lip shape," "aspiration").
4. You MUST include a specific tag in your response: "Tip: [Word] - [Actionable Correction]".

Example: "Tip: 'Think' - Place your tongue tip between your teeth and blow air (unvoiced /th/)."
Example: "Tip: 'Record' - Stress the first syllable RE-cord for the noun."

Start by asking "Hello, how are you today?" in ${language}.
`;
};

export const LANGUAGES: LanguageConfig[] = [
  { id: 'en', name: 'English', voiceName: 'Puck', color: 'bg-blue-500', icon: 'fa-flag-usa' },
  { id: 'es', name: 'Spanish', voiceName: 'Puck', color: 'bg-orange-500', icon: 'fa-earth-americas' },
  { id: 'fr', name: 'French', voiceName: 'Charon', color: 'bg-indigo-500', icon: 'fa-wine-glass' },
  { id: 'de', name: 'German', voiceName: 'Fenrir', color: 'bg-amber-600', icon: 'fa-beer-mug-empty' },
  { id: 'nl', name: 'Dutch', voiceName: 'Kore', color: 'bg-orange-400', icon: 'fa-bicycle' },
  { id: 'zh', name: 'Chinese', promptName: 'Chinese (Mandarin)', voiceName: 'Zephyr', color: 'bg-red-500', icon: 'fa-yin-yang' },
  { id: 'ru', name: 'Russian', voiceName: 'Puck', color: 'bg-blue-600', icon: 'fa-snowflake' },
  { id: 'ar', name: 'Arabic', voiceName: 'Fenrir', color: 'bg-emerald-600', icon: 'fa-moon' },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Practice answering tough behavioral questions for a generic tech role.',
    icon: 'fa-briefcase',
    color: 'bg-blue-500',
    voiceName: 'Fenrir',
    category: 'Professional',
    systemInstruction: `You are a professional, yet approachable hiring manager conducting a job interview. 
    Start by asking the candidate to introduce themselves. 
    Ask one question at a time. 
    If the user stumbles or uses too many filler words, gently point it out after they finish their answer, then move to the next question.
    Keep your responses concise to allow the user to speak more.`
  },
  {
    id: 'language_tutor',
    title: 'Language Tutor',
    description: 'Master pronunciation and grammar in English, Spanish, French, and more.',
    icon: 'fa-language',
    color: 'bg-indigo-600',
    voiceName: 'Puck',
    category: 'Learning',
    systemInstruction: ''
  },
  {
    id: 'social',
    title: 'Social Confidence',
    description: 'Practice asking someone out or making small talk at a party.',
    icon: 'fa-glass-cheers',
    color: 'bg-purple-500',
    voiceName: 'Kore',
    category: 'Social',
    systemInstruction: `You are a friendly Confidence Coach. 
    
    CRITICAL STARTUP PROCEDURE:
    Before any social roleplay, you MUST guide the user through a 4-7-8 breathing exercise to calm their nerves. 
    1. Briefly explain that we will start with a breathing exercise.
    2. Guide them through ONE full cycle:
       - Breathe in for 4 seconds: Output "[[B:IN]]" then count "1... 2... 3... 4."
       - Hold for 7 seconds: Output "[[B:HOLD]]" then count "1... 2... 3... 4... 5... 6... 7."
       - Breathe out for 8 seconds: Output "[[B:OUT]]" then count "1... 2... 3... 4... 5... 6... 7... 8."
    3. End the exercise by outputting "[[B:END]]".
    
    Once the breathing exercise is finished, proceed to the social roleplay.
    Roleplay a scenario where the user is trying to strike up a conversation at a party.
    Start by saying "Hey! I haven't seen you around here before."`
  },
  {
    id: 'debate',
    title: 'Fluency Booster',
    description: 'Fast-paced debate to reduce hesitation and filler words.',
    icon: 'fa-bolt',
    color: 'bg-yellow-500',
    voiceName: 'Zephyr',
    category: 'Fluency',
    systemInstruction: `You are a debate partner. 
    Pick a random lighthearted topic (like Cats vs Dogs, or Summer vs Winter). 
    Challenge the user's points playfully. 
    Your goal is to make them speak continuously without saying "um" or "uh". 
    If they pause for too long, prompt them quickly.`
  }
];

export const RESOURCES: Resource[] = [
  { id: '1', title: 'The Art of Small Talk', type: 'video', category: 'Social', duration: '5 min', xp: 50, imageColor: 'bg-purple-500', icon: 'fa-play' },
  { id: '2', title: 'Top 10 Tech Interview Questions', type: 'article', category: 'Career', duration: '3 min', xp: 30, imageColor: 'bg-blue-500', icon: 'fa-newspaper' },
  { id: '3', title: 'Intonation & Stress', type: 'podcast', category: 'Fluency', duration: '12 min', xp: 80, imageColor: 'bg-orange-500', icon: 'fa-headphones' },
  { id: '4', title: 'Body Language Basics', type: 'video', category: 'Confidence', duration: '8 min', xp: 60, imageColor: 'bg-teal-500', icon: 'fa-play' },
];

export const AUDIO_SAMPLE_RATE_INPUT = 16000;
export const AUDIO_SAMPLE_RATE_OUTPUT = 24000;

export const DEFAULT_USER_STATS: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  sessionsCompleted: 0,
  lastSessionDate: null,
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  skinColor: '#FFD1A9',
  hairStyle: 'short',
  hairColor: '#4A3B2C',
  clothingColor: '#3B82F6',
  accessory: 'none',
  backgroundColor: '#EFF6FF',
};

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

export const AVATAR_OPTIONS = {
  skinColors: ['#FFD1A9', '#E0AC69', '#9F7965', '#5C4033', '#F5CBA7'],
  hairColors: ['#4A3B2C', '#000000', '#D4AF37', '#8D2B0B', '#607D8B'],
  clothingColors: ['#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#F59E0B'],
  backgroundColors: ['#EFF6FF', '#F0FDF4', '#FAF5FF', '#FFFBEB', '#FEF2F2'],
};

// Builder Options
export const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'];

export const VOICE_METADATA: Record<string, { gender: 'Male' | 'Female', style: string }> = {
  'Puck': { gender: 'Male', style: 'Neutral, Clear' },
  'Charon': { gender: 'Male', style: 'Deep, Authoritative' },
  'Kore': { gender: 'Female', style: 'Calm, Soothing' },
  'Fenrir': { gender: 'Male', style: 'Energetic, Intense' },
  'Zephyr': { gender: 'Female', style: 'Friendly, Higher Pitch' },
  'Aoede': { gender: 'Female', style: 'Professional, Elegant' },
};

export const getVoiceMetadata = (voiceName: string) => {
  return VOICE_METADATA[voiceName] || { gender: 'Male', style: 'Neutral' };
};

export const SCENARIO_ICONS = ['fa-briefcase', 'fa-language', 'fa-glass-cheers', 'fa-bolt', 'fa-book', 'fa-heart', 'fa-plane', 'fa-code', 'fa-gavel', 'fa-stethoscope', 'fa-user-tie', 'fa-comment-dots', 'fa-coffee'];
export const SCENARIO_COLORS = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-slate-800'];

// Session Settings
export const DIFFICULTY_OPTIONS = [
  { id: 'beginner', label: 'Beginner', description: 'Simple words, slower pace, helpful tips.' },
  { id: 'intermediate', label: 'Intermediate', description: 'Natural conversation, standard vocabulary.' },
  { id: 'advanced', label: 'Advanced', description: 'Complex topics, fast pace, strict feedback.' },
];

export const SPEED_OPTIONS = [
  { id: 'slow', label: 'Slow', icon: 'fa-person-walking', desc: '0.8x Speed' },
  { id: 'normal', label: 'Normal', icon: 'fa-person', desc: '1.0x Speed' },
  { id: 'fast', label: 'Fast', icon: 'fa-person-running', desc: '1.2x Speed' },
];

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  difficulty: 'intermediate',
  speed: 'normal',
  voiceName: 'Puck',
  language: 'English',
};
