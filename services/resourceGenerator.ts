
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Resource, UserStats, SessionHistoryItem } from "../types";
import { pcmToWav, decode } from "./audioUtils";

const SCENARIO_COLORS = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-slate-800'];
const ICONS = {
  video: 'fa-play',
  article: 'fa-newspaper',
  podcast: 'fa-headphones'
};

export const fetchDailyRecommendations = async (
  stats: UserStats, 
  history: SessionHistoryItem[], 
  apiKey: string
): Promise<Resource[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toDateString();

  // 1. Analyze Context from History
  const recentHistory = history.slice(0, 5); // Analyze last 5 sessions
  const lastSession = history.length > 0 ? history[0] : null;
  const lastTopic = lastSession ? lastSession.scenarioTitle : "General Communication";

  // Identify Weaknesses dynamically
  const improvementAreas = [];
  
  // Filler words check
  const avgFillers = recentHistory.length > 0 
      ? recentHistory.reduce((acc, h) => acc + h.report.fillerWordCount, 0) / recentHistory.length
      : 0;
  if (avgFillers > 6) improvementAreas.push("Reducing filler words (um, uh)");

  // Confidence check
  const nervousCount = recentHistory.filter(h => h.report.dominantEmotion === 'Nervous' || h.report.dominantEmotion === 'Hesitant').length;
  if (nervousCount > 0) improvementAreas.push("Boosting speaking confidence");

  // Vocabulary check (heuristic based on difficulty)
  const basicSessions = recentHistory.filter(h => h.settings.difficulty === 'beginner').length;
  if (basicSessions > 2) improvementAreas.push("Expanding vocabulary complexity");
  
  // Specific Scenario Focus
  const interviewFocus = recentHistory.some(h => h.scenarioId === 'interview');
  if (interviewFocus) improvementAreas.push("Professional interview responses");

  // Default if no specific data
  if (improvementAreas.length === 0) improvementAreas.push("Advanced conversational nuances");

  const prompt = `
    Today is ${today}.
    Generate 3 distinct, daily coaching resources for a user learning languages and communication skills.
    
    User Profile:
    - Current Level: ${stats.level} (XP: ${stats.xp})
    - Last Practice Session: "${lastTopic}"
    - Targeted Improvement Areas: ${improvementAreas.join(', ')}.
    
    Task:
    Return a JSON array of 3 resources. 
    Ensure the titles and descriptions are unique to *today* and tailored to the user's recent activity.
    Vary the topics: include one specific technique, one mindset/confidence tip, and one practice drill.
    
    Required Types:
    1. 'video' (A visual lesson or drill).
    2. 'podcast' (A conversation or interview).
    3. 'article' (A guide or tip sheet).
    
    Schema per item:
    - title (String): Engaging and specific.
    - description (String): 1-2 sentences summarizing the value.
    - type (String): 'video', 'podcast', or 'article'.
    - category (String): e.g., "Fluency", "Social Skills", "Business", "Vocab".
    - duration (String): e.g., "3 min", "6 min".
    - xp (Number): Reward amount (30-100).
  `;

  try {
    // Basic Text Task: Use gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['video', 'podcast', 'article'] },
                    category: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    xp: { type: Type.NUMBER }
                }
            }
        }
      }
    });

    const data = JSON.parse(response.text || '[]');
    
    return data.map((item: any, index: number) => ({
      ...item,
      id: `daily_${Date.now()}_${index}`,
      icon: ICONS[item.type as keyof typeof ICONS] || 'fa-star',
      imageColor: SCENARIO_COLORS[Math.floor(Math.random() * SCENARIO_COLORS.length)],
      isGenerated: true
    }));

  } catch (e) {
    console.error("Failed to generate recommendations", e);
    // Return empty to allow fallback in UI or fallback resources
    return [];
  }
};

export const generateResourceContent = async (resource: Resource, apiKey: string): Promise<Resource['content']> => {
    const ai = new GoogleGenAI({ apiKey });
    const content: Resource['content'] = {};

    // Complexity modifier based on XP rewards (proxy for user level relevance)
    const complexityLevel = resource.xp > 70 ? "Advanced/Professional" : "Beginner/Intermediate";

    try {
        if (resource.type === 'article') {
            const prompt = `
            Write a high-quality, actionable short article titled "${resource.title}".
            Topic Category: ${resource.category}.
            Target Audience: ${complexityLevel} learner.
            
            Structure:
            1. **The Hook**: Why this matters right now.
            2. **Core Concept**: The main lesson.
            3. **3 Actionable Steps**: Practical things the user can do immediately.
            4. **Pro Tip**: A secret or advanced insight.
            
            Format: Markdown (use headers, bolding, lists).
            Tone: Encouraging, professional, expert coach.
            Length: ~400 words.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });
            content.text = response.text || "Content generation failed.";
        } 
        else if (resource.type === 'podcast') {
            const prompt = `
            Create a lively podcast script for 2 hosts (Alex and Sam) discussing "${resource.title}".
            Focus: ${resource.category}.
            Target Audience: ${complexityLevel}.
            
            Format:
            - Start with a quick energetic intro.
            - Alex explains the problem/topic.
            - Sam provides a solution or a "hack".
            - They roleplay a tiny 10-second example of doing it right vs wrong.
            - Quick summary and sign-off.
            
            Tone: Fun, fast-paced, like a radio show.
            Length: Approx 2 minutes spoken.
            Output: Just the dialogue text.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
                                { speaker: 'Sam', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                            ]
                        }
                    }
                }
            });

            const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                const wavBlob = pcmToWav(decode(audioData));
                content.audioUrl = URL.createObjectURL(wavBlob);
            }
        }
        else if (resource.type === 'video') {
            // Video Simulation: 1. Audio (Narration) 2. Visual (Thumbnail)
            
            // 1. Script & Audio
            const scriptPrompt = `
            You are recording a video lesson for "${resource.title}".
            Write the narration script.
            Target Audience: ${complexityLevel}.
            
            Structure:
            - "Hey everyone, welcome back to FluentFlow."
            - Define the specific problem regarding ${resource.category}.
            - Give one concrete exercise to fix it.
            - "Try this today and let me know how it goes."
            
            Tone: Youtube Educator (Warm, clear, concise).
            Length: 60 seconds spoken.
            `;

            const audioResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: scriptPrompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                         voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } // Deep authoritative voice
                    }
                }
            });
            
            const audioData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                const wavBlob = pcmToWav(decode(audioData));
                content.audioUrl = URL.createObjectURL(wavBlob);
            }

            // 2. Thumbnail
            const imagePrompt = `
            A modern, flat vector illustration for a video thumbnail about "${resource.title}".
            Style: Corporate Memphis, minimal, vibrant colors (Blue, Orange, White).
            Subject: Abstract representation of ${resource.category}, communication, speaking, or confidence.
            Text free. High quality.
            `;
            
            try {
                const imageResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: imagePrompt }] },
                });
                
                // Iterate parts to find image data as per guidelines
                const parts = imageResponse.candidates?.[0]?.content?.parts;
                let imageData;
                if (parts) {
                    for (const part of parts) {
                        if (part.inlineData) {
                            imageData = part.inlineData.data;
                            break;
                        }
                    }
                }
                
                if (imageData) {
                     content.imageUrl = `data:image/jpeg;base64,${imageData}`;
                }
            } catch (imgErr) {
                console.warn("Image gen failed", imgErr);
            }
        }
    } catch (e) {
        console.error("Content generation failed", e);
        throw e;
    }

    return content;
};
