
import { GoogleGenAI, Modality } from "@google/genai";
import { pcmToWav, decode } from "./audioUtils";

export interface MultiCoachResponse {
  coach1: string;
  coach2: string;
  coach3: string;
  audioUrl?: string;
}

/**
 * Executes a sequential processing chain of three specialist coaches.
 * Each coach builds on the previous one's output and the shared conversation history.
 */
export const processMultiCoachTurn = async (
  userInput: string,
  history: { role: string; text: string }[],
  apiKey: string,
  onProgress: (coach: 1 | 2 | 3) => void
): Promise<MultiCoachResponse> => {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-pro-preview';

  // State initialization for sequential chain
  let coach1Text = "";
  let coach2Text = "";
  let coach3Text = "";

  // 1. Coach 1: Fluency Expert (Strict focus on mechanics)
  onProgress(1);
  const c1Response = await ai.models.generateContent({
    model,
    contents: `Fluency Expert. Analyze ONLY the user's latest input: "${userInput}". 
    Focus on fillers, pauses, and pace. Speak directly to the user. Keep it brief (max 35 words).`,
    config: {
      systemInstruction: "You are Coach 1, a Fluency Expert. You provide immediate feedback on speech flow."
    }
  });
  coach1Text = c1Response.text || "I noticed some hesitation in your delivery.";

  // 2. Coach 2: Confidence Coach (Focus on tone and assertiveness)
  onProgress(2);
  const c2Response = await ai.models.generateContent({
    model,
    contents: `Confidence Coach. Build on the session. 
    User said: "${userInput}". 
    Coach 1 said: "${coach1Text}".
    Focus on tone and assertiveness. Speak directly to the user. Keep it brief (max 35 words).`,
    config: {
      systemInstruction: "You are Coach 2, a Confidence Coach. You focus on the user's emotional presence."
    }
  });
  coach2Text = c2Response.text || "You sound capable, but let's push for more vocal clarity.";

  // 3. Coach 3: Synthesis Coach (Wrap up with actionable steps)
  onProgress(3);
  const c3Response = await ai.models.generateContent({
    model,
    contents: `Synthesis Coach. Summarize progress.
    User: "${userInput}"
    Coach 1: "${coach1Text}"
    Coach 2: "${coach2Text}"
    Provide exactly 3 quick actionable steps. Max 50 words.`,
    config: {
      systemInstruction: "You are Coach 3, the Synthesis Coach. You provide the final wrap-up."
    }
  });
  coach3Text = c3Response.text || "Next steps: focus on your breathing, use more direct verbs, and maintain this volume.";

  // 4. Multi-Speaker Audio Synthesis
  const ttsPrompt = `TTS the following conversation between three coaches:
  Coach1: ${coach1Text}
  Coach2: ${coach2Text}
  Coach3: ${coach3Text}`;

  let audioUrl: string | undefined;
  try {
    const ttsResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Coach1', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
              { speaker: 'Coach2', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              { speaker: 'Coach3', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
            ]
          }
        }
      }
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const wavBlob = pcmToWav(decode(base64Audio), 24000);
      audioUrl = URL.createObjectURL(wavBlob);
    }
  } catch (e) {
    console.warn("Multi-speaker TTS generation failed", e);
  }

  return {
    coach1: coach1Text,
    coach2: coach2Text,
    coach3: coach3Text,
    audioUrl
  };
};
