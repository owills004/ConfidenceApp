
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptItem, SessionReport } from "../types";

export const generateSessionAnalysis = async (
  transcript: TranscriptItem[],
  scenarioTitle: string,
  apiKey: string
): Promise<Partial<SessionReport>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Extract only user text for analysis to save tokens and focus context
  const userItems = transcript.filter(t => t.role === 'user');
  const userText = userItems.map(t => t.text).join(' ');
  
  // If there's not enough data, return a neutral/empty report
  if (!userText || userText.trim().length < 15) {
      return {
          fluencyScore: 50,
          vocabularyScore: 50,
          grammarCorrections: [],
          confidenceTips: ["Try speaking more in the next session to receive detailed AI feedback."]
      };
  }

  const prompt = `
    You are an expert language and confidence coach. Analyze the following user transcript from a practice session titled '${scenarioTitle}'.
    
    User Transcript: "${userText}"
    
    Your goal is to provide constructive feedback.
    
    Tasks:
    1. Grammar & Phrasing: Identify up to 3 specific grammatical errors or awkward phrasings. 
       - Provide the original text.
       - Provide a corrected version.
       - Provide a concise explanation of the rule violated (e.g., "Subject-Verb Agreement", "Incorrect Tense", "Wrong Preposition").
    2. Fluency Score (0-100): Rate based on natural flow, sentence structure, and coherence (ignoring simple filler words which are counted separately).
    3. Vocabulary Score (0-100): Rate based on lexical variety and appropriateness for the scenario.
    4. Confidence Tips: Provide 2 specific, actionable tips to improve the user's tone or delivery based on the text content.
  `;

  try {
      // Always use 'gemini-3-flash-preview' for basic text tasks like feedback analysis
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fluencyScore: { type: Type.NUMBER },
              vocabularyScore: { type: Type.NUMBER },
              grammarCorrections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    correction: { type: Type.STRING },
                    explanation: { type: Type.STRING, description: "A concise rule or reason e.g. 'Subject-Verb Agreement'" }
                  }
                }
              },
              confidenceTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });
      
      const jsonText = response.text;
      if (!jsonText) throw new Error("Empty response from analysis model");
      
      return JSON.parse(jsonText);
  } catch (e) {
      console.error("Analysis failed", e);
      // Fallback in case of API error
      return {
          fluencyScore: 0,
          vocabularyScore: 0,
          grammarCorrections: [],
          confidenceTips: ["Analysis could not be generated at this time."]
      };
  }
};
