
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData, float32ToWav } from './audioUtils';
import { AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../constants';
import { AudioQuality } from '../types';

export type TranscriptCallback = (text: string, isUser: boolean, isFinal: boolean) => void;
export type VolumeCallback = (inputVolume: number, outputVolume: number) => void;
export type GroundingCallback = (metadata: any) => void;
export type AnalysisCallback = (emotion: string, intent: string) => void;
export type BreathCallback = (phase: 'IN' | 'HOLD' | 'OUT' | 'END') => void;

const ANALYSIS_REGEX = /\[\[E:([^\]]+)\]\](?:\[\[I:([^\]]+)\]\])?/g;
const BREATH_REGEX = /\[\[B:(\w+)\]\]/g;

export class LiveClient {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-native-audio-preview-12-2025';
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  
  // Advanced Recording Mastering Chain
  private recordingProcessor: ScriptProcessorNode | null = null;
  private recordingHighPass: BiquadFilterNode | null = null;
  private recordingPresence: BiquadFilterNode | null = null; // Mid-boost for clarity
  private recordingAir: BiquadFilterNode | null = null; // High-shelf for "shimmer"
  private recordingCompressor: DynamicsCompressorNode | null = null;
  private recordingLimiter: DynamicsCompressorNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording: boolean = false;
  private quality: AudioQuality = 'standard';

  // Analysis State
  private currentModelTurnText: string = '';

  // Callbacks
  private onTranscript: TranscriptCallback;
  private onVolume: VolumeCallback;
  private onGrounding: GroundingCallback;
  private onAnalysis: AnalysisCallback;
  private onBreath: BreathCallback;
  private onClose: () => void;
  private onError: (err: Error) => void;

  private sessionPromise: Promise<any> | null = null;

  constructor(
    apiKey: string, 
    onTranscript: TranscriptCallback, 
    onVolume: VolumeCallback,
    onGrounding: GroundingCallback,
    onAnalysis: AnalysisCallback,
    onBreath: BreathCallback,
    onClose: () => void,
    onError: (err: Error) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onTranscript = onTranscript;
    this.onVolume = onVolume;
    this.onGrounding = onGrounding;
    this.onAnalysis = onAnalysis;
    this.onBreath = onBreath;
    this.onClose = onClose;
    this.onError = onError;
  }

  public async connect(systemInstruction: string, voiceName: string, quality: AudioQuality = 'standard') {
    this.quality = quality;
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_INPUT,
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_OUTPUT,
      });
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = this.quality === 'studio' ? 512 : 256;
      this.inputAnalyser.smoothingTimeConstant = 0.1;

      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = this.quality === 'studio' ? 512 : 256;
      this.outputAnalyser.smoothingTimeConstant = 0.1;
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      this.setupRecorder();

      const promise = this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          thinkingConfig: { thinkingBudget: 0 } 
        },
        callbacks: {
          onopen: () => {
            this.startAudioInput(promise);
            this.startAnalysisLoop();
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => {
            this.onClose();
          },
          onerror: (err: ErrorEvent) => {
            this.onError(new Error("Connection error: " + err.message));
          }
        }
      });

      this.sessionPromise = promise;
    } catch (error) {
      this.onError(error as Error);
    }
  }

  private setupRecorder() {
    if (!this.outputAudioContext || !this.mediaStream) return;

    const now = this.outputAudioContext.currentTime;
    const isStudio = this.quality === 'studio';

    // 1. High Pass Filter - Remove sub-80Hz noise
    this.recordingHighPass = this.outputAudioContext.createBiquadFilter();
    this.recordingHighPass.type = 'highpass';
    this.recordingHighPass.frequency.setValueAtTime(isStudio ? 90 : 80, now);
    this.recordingHighPass.Q.setValueAtTime(0.7, now);

    // 2. Presence Filter - Boost mid-highs (3kHz) for vocal clarity
    this.recordingPresence = this.outputAudioContext.createBiquadFilter();
    this.recordingPresence.type = 'peaking';
    this.recordingPresence.frequency.setValueAtTime(3200, now);
    this.recordingPresence.gain.setValueAtTime(isStudio ? 3.5 : 2.0, now);
    this.recordingPresence.Q.setValueAtTime(1.0, now);

    // 3. Air Filter - High shelf for professional "shimmer" (10kHz+)
    this.recordingAir = this.outputAudioContext.createBiquadFilter();
    this.recordingAir.type = 'highshelf';
    this.recordingAir.frequency.setValueAtTime(10000, now);
    this.recordingAir.gain.setValueAtTime(isStudio ? 4.0 : 1.5, now);

    // 4. Vocal Compressor - Tighten dynamics
    this.recordingCompressor = this.outputAudioContext.createDynamicsCompressor();
    this.recordingCompressor.threshold.setValueAtTime(isStudio ? -24 : -18, now);
    this.recordingCompressor.knee.setValueAtTime(12, now);
    this.recordingCompressor.ratio.setValueAtTime(isStudio ? 5 : 4, now);
    this.recordingCompressor.attack.setValueAtTime(0.005, now);
    this.recordingCompressor.release.setValueAtTime(0.2, now);

    // 5. Mastering Limiter - Protect from clipping
    this.recordingLimiter = this.outputAudioContext.createDynamicsCompressor();
    this.recordingLimiter.threshold.setValueAtTime(-1.5, now);
    this.recordingLimiter.knee.setValueAtTime(0, now);
    this.recordingLimiter.ratio.setValueAtTime(20, now);
    this.recordingLimiter.attack.setValueAtTime(0.001, now);
    this.recordingLimiter.release.setValueAtTime(0.05, now);

    // Capture Processor
    this.recordingProcessor = this.outputAudioContext.createScriptProcessor(2048, 1, 1);
    this.recordedChunks = [];
    this.isRecording = true;

    this.recordingProcessor.onaudioprocess = (e) => {
      if (this.isRecording) {
        const inputData = e.inputBuffer.getChannelData(0);
        this.recordedChunks.push(new Float32Array(inputData));
      }
    };

    // Routing: Mic -> Gain -> HPF -> Presence -> Air -> Compressor -> Limiter -> Capture
    const micSource = this.outputAudioContext.createMediaStreamSource(this.mediaStream);
    const micGain = this.outputAudioContext.createGain();
    micGain.gain.value = 1.0; 
    
    micSource.connect(micGain);
    micGain.connect(this.recordingHighPass);
    this.recordingHighPass.connect(this.recordingPresence);
    this.recordingPresence.connect(this.recordingAir);
    this.recordingAir.connect(this.recordingCompressor);
    this.recordingCompressor.connect(this.recordingLimiter);
    this.recordingLimiter.connect(this.recordingProcessor);
    this.recordingProcessor.connect(this.outputAudioContext.destination);
  }

  public getSessionRecording(): globalThis.Blob | null {
    if (this.recordedChunks.length === 0) return null;

    // Advanced Peak Normalization
    let maxVal = 0;
    for (const chunk of this.recordedChunks) {
      for (let i = 0; i < chunk.length; i++) {
        const absVal = Math.abs(chunk[i]);
        if (absVal > maxVal) maxVal = absVal;
      }
    }

    const targetPeak = 0.95; // -0.5dB
    if (maxVal > 0) {
      const scale = targetPeak / maxVal;
      for (const chunk of this.recordedChunks) {
        for (let i = 0; i < chunk.length; i++) {
          chunk[i] *= scale;
        }
      }
    }

    return float32ToWav(this.recordedChunks, AUDIO_SAMPLE_RATE_OUTPUT);
  }

  private startAnalysisLoop() {
    const dataArray = new Uint8Array(128);
    
    const analyze = () => {
      let inputVol = 0;
      let outputVol = 0;

      if (this.inputAnalyser) {
        this.inputAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
          const x = (dataArray[i] - 128) / 128.0;
          sum += x * x;
        }
        inputVol = Math.sqrt(sum / dataArray.length);
      }

      if (this.outputAnalyser) {
        this.outputAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
          const x = (dataArray[i] - 128) / 128.0;
          sum += x * x;
        }
        outputVol = Math.sqrt(sum / dataArray.length);
      }

      this.onVolume(inputVol, outputVol);
      this.animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.mediaStream || !this.inputAnalyser) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      sessionPromise.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
      this.playAudio(audioData);
    }

    const userTranscript = message.serverContent?.inputTranscription?.text;
    if (userTranscript) {
      this.onTranscript(userTranscript, true, !!message.serverContent?.turnComplete);
    }

    const modelTranscriptChunk = message.serverContent?.outputTranscription?.text;
    if (modelTranscriptChunk) {
       this.currentModelTurnText += modelTranscriptChunk;
       
       let analysisMatch;
       const analysisRegexClone = new RegExp(ANALYSIS_REGEX);
       while ((analysisMatch = analysisRegexClone.exec(this.currentModelTurnText)) !== null) {
         this.onAnalysis(analysisMatch[1], analysisMatch[2] || 'Neutral');
       }

       let breathMatch;
       const breathRegexClone = new RegExp(BREATH_REGEX);
       while ((breathMatch = breathRegexClone.exec(this.currentModelTurnText)) !== null) {
         this.onBreath(breathMatch[1] as any);
       }

       this.onTranscript(modelTranscriptChunk, false, !!message.serverContent?.turnComplete);
    }

    const groundingMetadata = message.serverContent?.groundingMetadata;
    if (groundingMetadata) {
      this.onGrounding(groundingMetadata);
    }

    if (message.serverContent?.interrupted) {
      this.stopPlayback();
    }

    if (message.serverContent?.turnComplete) {
       this.currentModelTurnText = '';
    }
  }

  private async playAudio(base64Data: string) {
    if (!this.outputAudioContext || !this.outputAnalyser || !this.recordingCompressor) return;

    const bytes = decode(base64Data);
    const buffer = await decodeAudioData(bytes, this.outputAudioContext, AUDIO_SAMPLE_RATE_OUTPUT, 1);
    
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    
    source.connect(this.outputAnalyser);
    
    // Connect AI response to the recording mastering chain to include it in the final WAV
    if (this.recordingHighPass) {
      source.connect(this.recordingHighPass);
    }
    
    source.addEventListener('ended', () => {
      this.activeSources.delete(source);
    });

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    this.activeSources.add(source);
  }

  private stopPlayback() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    this.activeSources.clear();
    this.nextStartTime = this.outputAudioContext?.currentTime || 0;
  }

  public async disconnect() {
    this.isRecording = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sessionPromise) {
      try {
          const session = await this.sessionPromise;
          session.close();
      } catch (e) {
          console.debug('Error closing session', e);
      }
      this.sessionPromise = null;
    }

    this.stopPlayback();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.recordingProcessor) {
      this.recordingProcessor.disconnect();
      this.recordingProcessor = null;
    }
    if (this.recordingHighPass) {
      this.recordingHighPass.disconnect();
      this.recordingHighPass = null;
    }
    if (this.recordingPresence) {
      this.recordingPresence.disconnect();
      this.recordingPresence = null;
    }
    if (this.recordingAir) {
      this.recordingAir.disconnect();
      this.recordingAir = null;
    }
    if (this.recordingCompressor) {
      this.recordingCompressor.disconnect();
      this.recordingCompressor = null;
    }
    if (this.recordingLimiter) {
      this.recordingLimiter.disconnect();
      this.recordingLimiter = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioContext) {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      await this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    this.onVolume(0, 0);
  }
}
