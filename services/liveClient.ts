
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData, float32ToWav } from './audioUtils';
import { AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../constants';

export type TranscriptCallback = (text: string, isUser: boolean, isFinal: boolean) => void;
export type VolumeCallback = (inputVolume: number, outputVolume: number) => void;
export type GroundingCallback = (metadata: any) => void;
export type AnalysisCallback = (emotion: string, intent: string) => void;
export type BreathCallback = (phase: 'IN' | 'HOLD' | 'OUT' | 'END') => void;

const ANALYSIS_REGEX = /\[\[E:(\w+)\]\](?:\[\[I:(\w+)\]\])?/;
const BREATH_REGEX = /\[\[B:(\w+)\]\]/;

export class LiveClient {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-native-audio-preview-09-2025';
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
  
  // Recording Mastering Chain
  private recordingProcessor: ScriptProcessorNode | null = null;
  private recordingCompressor: DynamicsCompressorNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording: boolean = false;

  // Analysis State
  private currentModelTurnText: string = '';
  private hasEmittedAnalysisForTurn: boolean = false;

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

  public async connect(systemInstruction: string, voiceName: string) {
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_INPUT,
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_SAMPLE_RATE_OUTPUT,
      });
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.inputAnalyser.smoothingTimeConstant = 0.1;

      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;
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
          tools: [{ googleSearch: {} }]
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

    // 1. Create a mastering chain for the recording to balance voice levels
    this.recordingCompressor = this.outputAudioContext.createDynamicsCompressor();
    // Configure for high-quality speech mastering
    this.recordingCompressor.threshold.setValueAtTime(-24, this.outputAudioContext.currentTime);
    this.recordingCompressor.knee.setValueAtTime(30, this.outputAudioContext.currentTime);
    this.recordingCompressor.ratio.setValueAtTime(12, this.outputAudioContext.currentTime);
    this.recordingCompressor.attack.setValueAtTime(0.003, this.outputAudioContext.currentTime);
    this.recordingCompressor.release.setValueAtTime(0.25, this.outputAudioContext.currentTime);

    // 2. Setup the processor that captures raw Float32 data
    this.recordingProcessor = this.outputAudioContext.createScriptProcessor(4096, 1, 1);
    this.recordedChunks = [];
    this.isRecording = true;

    this.recordingProcessor.onaudioprocess = (e) => {
      if (this.isRecording) {
        const inputData = e.inputBuffer.getChannelData(0);
        this.recordedChunks.push(new Float32Array(inputData));
      }
    };

    // 3. Chain: Sources -> Compressor -> Processor
    const micSource = this.outputAudioContext.createMediaStreamSource(this.mediaStream);
    const micGain = this.outputAudioContext.createGain();
    micGain.gain.value = 1.0; 
    
    micSource.connect(micGain);
    micGain.connect(this.recordingCompressor);
    
    this.recordingCompressor.connect(this.recordingProcessor);
    // Note: Processor needs a destination connection to keep ticking
    this.recordingProcessor.connect(this.outputAudioContext.destination);
  }

  public getSessionRecording(): globalThis.Blob | null {
    if (this.recordedChunks.length === 0) return null;
    // Export at output sample rate (24k) for consistent voice quality
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
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

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
       
       // Handle Breath Tags
       const breathMatch = this.currentModelTurnText.match(BREATH_REGEX);
       if (breathMatch) {
         this.onBreath(breathMatch[1] as any);
         // Clear tag so it doesn't match again immediately in this turn
         this.currentModelTurnText = this.currentModelTurnText.replace(BREATH_REGEX, '');
       }

       if (!this.hasEmittedAnalysisForTurn) {
          const match = this.currentModelTurnText.match(ANALYSIS_REGEX);
          if (match) {
            const emotion = match[1];
            const intent = match[2] || 'Neutral';
            this.onAnalysis(emotion, intent);
            this.hasEmittedAnalysisForTurn = true;
          }
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
       this.hasEmittedAnalysisForTurn = false;
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
    // Connect AI response to the mastered recording chain
    source.connect(this.recordingCompressor);
    
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
    if (this.recordingCompressor) {
      this.recordingCompressor.disconnect();
      this.recordingCompressor = null;
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
