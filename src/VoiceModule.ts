/**
 * VoiceModule - 基于 Sherpa-ONNX 的离线 ASR + TTS 模块
 * 
 * 功能：
 * - ASR: 语音识别（中文 SenseVoice 模型）
 * - TTS: 语音合成（中文 VITS 模型）
 * - 完全离线，无需网络
 * - 不依赖 GMS，适合国内安卓设备
 */

import { createSTT, createTTS } from 'react-native-sherpa-onnx';
import type { SttEngine, TtsEngine, SttRecognitionResult, GeneratedAudio } from 'react-native-sherpa-onnx';
import { Audio } from 'expo-av';

// 模型路径（打包在 assets 中）
const ASR_MODEL_PATH = 'models/sense-voice-zh';
const TTS_MODEL_PATH = 'models/vits-zh';

interface VoiceModuleType {
  /** 初始化 ASR 引擎 */
  initASR(): Promise<boolean>;
  
  /** 初始化 TTS 引擎 */
  initTTS(): Promise<boolean>;
  
  /** 语音识别：将音频文件转换为文本 */
  recognizeAudioFile(filePath: string): Promise<string>;
  
  /** 语音识别：将 PCM 样本转换为文本 */
  recognizeSamples(samples: number[], sampleRate?: number): Promise<string>;
  
  /** 语音合成：将文本转换为音频并播放 */
  synthesizeAndPlay(text: string): Promise<void>;
  
  /** 停止当前播放 */
  stopPlaying(): Promise<void>;
  
  /** 释放所有资源 */
  destroy(): Promise<void>;
  
  /** 检查是否已初始化 */
  isReady(): { asr: boolean; tts: boolean };
}

class VoiceModuleImpl implements VoiceModuleType {
  private sttEngine: SttEngine | null = null;
  private ttsEngine: TtsEngine | null = null;
  private sound: Audio.Sound | null = null;

  isReady(): { asr: boolean; tts: boolean } {
    return {
      asr: this.sttEngine !== null,
      tts: this.ttsEngine !== null,
    };
  }

  async initASR(): Promise<boolean> {
    try {
      if (this.sttEngine) {
        return true;
      }

      console.log('[VoiceModule] 初始化 ASR 引擎, 路径:', ASR_MODEL_PATH);
      
      this.sttEngine = await createSTT({
        modelPath: { type: 'asset', path: ASR_MODEL_PATH },
        modelType: 'auto',
        preferInt8: true,
      });
      console.log('[VoiceModule] ASR 初始化成功');
      return true;
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('[VoiceModule] ASR 初始化失败:', msg);
      // 抛出具体错误信息
      throw new Error(msg);
    }
  }

  async initTTS(): Promise<boolean> {
    try {
      if (this.ttsEngine) {
        return true;
      }

      console.log('[VoiceModule] 初始化 TTS 引擎, 路径:', TTS_MODEL_PATH);
      
      this.ttsEngine = await createTTS({
        modelPath: { type: 'asset', path: TTS_MODEL_PATH },
        modelType: 'auto',
      });
      console.log('[VoiceModule] TTS 初始化成功');
      return true;
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('[VoiceModule] TTS 初始化失败:', msg);
      throw new Error(msg);
    }
  }

  async recognizeAudioFile(filePath: string): Promise<string> {
    if (!this.sttEngine) {
      throw new Error('ASR 引擎未初始化，请先调用 initASR()');
    }

    const result: SttRecognitionResult = await this.sttEngine.transcribeFile(filePath);
    return result.text;
  }

  async recognizeSamples(samples: number[], sampleRate: number = 16000): Promise<string> {
    if (!this.sttEngine) {
      throw new Error('ASR 引擎未初始化，请先调用 initASR()');
    }

    const result: SttRecognitionResult = await this.sttEngine.transcribeSamples(samples, sampleRate);
    return result.text;
  }

  async synthesizeAndPlay(text: string): Promise<void> {
    if (!this.ttsEngine) {
      throw new Error('TTS 引擎未初始化，请先调用 initTTS()');
    }

    const generated: GeneratedAudio = await this.ttsEngine.generateSpeech(text);
    
    // 停止之前的播放
    await this.stopPlaying();

    // 使用 expo-av 播放合成的音频
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: `data:audio/wav;base64,${generated.audioBase64}` },
      { shouldPlay: true }
    );
    
    this.sound = newSound;
    
    // 监听播放结束事件
    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        this.sound = null;
      }
    });
  }

  async stopPlaying(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }

  async destroy(): Promise<void> {
    await this.stopPlaying();
    
    if (this.sttEngine) {
      await this.sttEngine.destroy();
      this.sttEngine = null;
    }
    
    if (this.ttsEngine) {
      await this.ttsEngine.destroy();
      this.ttsEngine = null;
    }
  }
}

// 导出单例
export const VoiceModule = new VoiceModuleImpl();
export type { VoiceModuleType };
export default VoiceModule;
