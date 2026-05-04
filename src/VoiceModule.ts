import { NativeModules } from 'react-native';

export interface VoiceModuleType {
  /**
   * Initialize TTS model from path or asset
   * @param modelPath - File path or "asset:models/xxx.onnx"
   */
  initTTS(modelPath: string): Promise<boolean>;

  /**
   * Initialize ASR model from path or asset
   * @param modelPath - File path or "asset:models/xxx.onnx"
   */
  initASR(modelPath: string): Promise<boolean>;

  /**
   * Synthesize text to audio (WAV format, base64 encoded)
   * @param text - Text to synthesize
   * @returns Base64 encoded WAV audio data
   */
  synthesize(text: string): Promise<string>;

  /**
   * Recognize speech from audio data
   * @param audioData - Float32 array of PCM audio samples (16kHz, mono)
   * @returns Recognized text
   */
  recognize(audioData: number[]): Promise<string>;
}

const { VoiceModule } = NativeModules;

export default VoiceModule as VoiceModuleType;
