
export interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  systemInstruction: string;
  voiceName: string;
  color: string;
  isCustom?: boolean;
  category?: 'Professional' | 'Social' | 'Learning' | 'Fluency';
}

export interface LanguageConfig {
  id: string;
  name: string;
  voiceName: string;
  color: string;
  icon: string;
  promptName?: string; // Optional specific name for the system prompt (e.g., "Chinese (Mandarin)")
}

export interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface FeedbackMetric {
  category: string;
  score: number;
  tip: string;
}

export interface AvatarConfig {
  gender: 'male' | 'female';
  skinColor: string;
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'spiky' | 'curly';
  hairColor: string;
  clothingColor: string;
  accessory: 'none' | 'glasses' | 'headset';
  backgroundColor: string;
}

export interface Friend {
  id: string;
  name: string;
  avatarConfig: AvatarConfig;
  isOnline: boolean;
  lastActive: string;
  level: number;
  xp: number; // Added for leaderboard
}

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type SpeedLevel = 'slow' | 'normal' | 'fast';

export interface SessionSettings {
  difficulty: DifficultyLevel;
  speed: SpeedLevel;
  voiceName: string;
  language: string; // Added language selection
  groupSize?: number; // Added for group conversation simulation (1-3 coaches)
}

export interface GrammarCorrection {
  original: string;
  correction: string;
  explanation: string;
}

export interface SessionReport {
  durationSeconds: number;
  fillerWordCount: number;
  awkwardPauseCount: number; // New metric
  fillerWordsPerMinute: number;
  transcript: TranscriptItem[]; 
  dominantEmotion?: string; // New: Emotion analysis result
  dominantIntent?: string; // New: Intent analysis result
  
  // Feedback Engine Metrics
  grammarCorrections?: GrammarCorrection[];
  fluencyScore?: number; // 0-100
  vocabularyScore?: number; // 0-100
  paceWPM?: number; // Words Per Minute
  confidenceTips?: string[];
}

export interface SessionHistoryItem {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  date: string; // ISO String
  durationSeconds: number;
  settings: SessionSettings;
  report: SessionReport;
  status?: 'completed' | 'saved'; // New: status tracking
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  sessionsCompleted: number;
  lastSessionDate: string | null; // ISO Date string
}

export interface User {
  id: string;
  name: string;
  email: string;
  friends: Friend[];
  stats: UserStats;
  history: SessionHistoryItem[];
}

export interface Resource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'podcast';
  category: string;
  duration: string;
  xp: number;
  imageColor: string;
  icon: string;
  // Dynamic AI Content
  description?: string;
  isGenerated?: boolean;
  content?: {
    text?: string;
    audioUrl?: string;
    imageUrl?: string;
  };
}
