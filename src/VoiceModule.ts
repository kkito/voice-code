/**
 * VoiceModule - 最基础版本（错误信息全部输出到 UI 日志）
 */

import { createSTT } from 'react-native-sherpa-onnx/stt';
import { createTTS, saveAudioToFile } from 'react-native-sherpa-onnx/tts';
import type { SttEngine, TtsEngine } from 'react-native-sherpa-onnx';
import { Audio } from 'expo-av';
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';

// 模型路径（打包在 assets 中）
const ASR_MODEL_PATH = 'models/sense-voice-zh';
const TTS_MODEL_PATH = 'models/vits-zh';

// 验证导入是否成功（在模块加载时就检查）
console.log('[VoiceModule 模块加载] createSTT 类型:', typeof createSTT);
console.log('[VoiceModule 模块加载] createTTS 类型:', typeof createTTS);
console.log('[VoiceModule 模块加载] saveAudioToFile 类型:', typeof saveAudioToFile);

// 详细日志辅助函数 - 返回格式化后的错误字符串
export const formatError = (context: string, error: any): string => {
  let msg = `\n========== 错误: ${context} ==========\n`;
  msg += `错误类型: ${error?.constructor?.name || 'Unknown'}\n`;
  msg += `错误消息: ${error?.message || String(error)}\n`;
  
  if (error?.stack) {
    msg += `\n错误堆栈:\n${error.stack}\n`;
  }
  
  // 尝试获取更多信息
  try {
    msg += `\n完整错误对象:\n${JSON.stringify(error, null, 2)}\n`;
  } catch (e) {
    msg += `\n(无法序列化错误对象)\n`;
  }
  
  msg += '========================================\n';
  return msg;
};

interface VoiceModuleType {
  initASR(): Promise<boolean>;
  initTTS(): Promise<boolean>;
  recognizeAudioFile(filePath: string): Promise<string>;
  synthesizeAndPlay(text: string): Promise<void>;
  stopPlaying(): Promise<void>;
  destroy(): Promise<void>;
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
    let log = '[VoiceModule] 开始初始化 ASR\n';
    log += `[VoiceModule] 模型路径: ${ASR_MODEL_PATH}\n`;
    log += `[VoiceModule] createSTT 类型: ${typeof createSTT}\n`;
    
    try {
      if (this.sttEngine) {
        log += '[VoiceModule] ASR 已初始化过，跳过\n';
        return true;
      }

      if (typeof createSTT !== 'function') {
        const err = new Error(`createSTT is not a function! typeof = ${typeof createSTT}`);
        throw err;
      }
      
      log += '[VoiceModule] 调用 createSTT()...\n';
      this.sttEngine = await createSTT({
        modelPath: { type: 'asset', path: ASR_MODEL_PATH },
        modelType: 'auto',
        preferInt8: true,
      });
      
      log += '[VoiceModule] createSTT() 返回成功\n';
      log += `[VoiceModule] sttEngine: ${this.sttEngine ? '存在' : 'null'}\n`;
      log += `[VoiceModule] sttEngine 方法: ${this.sttEngine ? Object.keys(this.sttEngine).join(', ') : 'N/A'}\n`;
      log += '[VoiceModule] ASR 初始化成功!\n';
      return true;
    } catch (error: any) {
      log += formatError('initASR', error);
      // 弹窗显示错误
      Alert.alert('ASR 初始化失败', error?.message || '未知错误');
      throw new Error(log);
    }
  }

  async initTTS(): Promise<boolean> {
    let log = '[VoiceModule] 开始初始化 TTS\n';
    log += `[VoiceModule] 模型路径: ${TTS_MODEL_PATH}\n`;
    log += `[VoiceModule] createTTS 类型: ${typeof createTTS}\n`;
    log += `[VoiceModule] saveAudioToFile 类型: ${typeof saveAudioToFile}\n`;
    
    try {
      if (this.ttsEngine) {
        log += '[VoiceModule] TTS 已初始化过，跳过\n';
        return true;
      }

      if (typeof createTTS !== 'function') {
        const err = new Error(`createTTS is not a function! typeof = ${typeof createTTS}`);
        throw err;
      }
      
      log += '[VoiceModule] 调用 createTTS()...\n';
      this.ttsEngine = await createTTS({
        modelPath: { type: 'asset', path: TTS_MODEL_PATH },
        modelType: 'auto',
      });
      
      log += '[VoiceModule] createTTS() 返回成功\n';
      log += `[VoiceModule] ttsEngine: ${this.ttsEngine ? '存在' : 'null'}\n`;
      log += `[VoiceModule] ttsEngine 方法: ${this.ttsEngine ? Object.keys(this.ttsEngine).join(', ') : 'N/A'}\n`;
      log += '[VoiceModule] TTS 初始化成功!\n';
      return true;
    } catch (error: any) {
      log += formatError('initTTS', error);
      Alert.alert('TTS 初始化失败', error?.message || '未知错误');
      throw new Error(log);
    }
  }

  async recognizeAudioFile(filePath: string): Promise<string> {
    let log = '[VoiceModule] 开始识别文件\n';
    log += `[VoiceModule] 文件路径: ${filePath}\n`;
    
    try {
      if (!this.sttEngine) {
        throw new Error('ASR 引擎未初始化');
      }

      log += `[VoiceModule] transcribeFile 类型: ${typeof this.sttEngine.transcribeFile}\n`;
      
      if (typeof this.sttEngine.transcribeFile !== 'function') {
        throw new Error(`transcribeFile is not a function! typeof = ${typeof this.sttEngine.transcribeFile}`);
      }
      
      log += '[VoiceModule] 调用 transcribeFile()...\n';
      const result = await this.sttEngine.transcribeFile(filePath);
      log += `[VoiceModule] 识别结果: ${result.text}\n`;
      return result.text;
    } catch (error: any) {
      log += formatError('recognizeAudioFile', error);
      Alert.alert('识别失败', error?.message || '未知错误');
      throw new Error(log);
    }
  }

  async synthesizeAndPlay(text: string): Promise<void> {
    let log = '[VoiceModule] 开始合成文本\n';
    log += `[VoiceModule] 输入文本: ${text}\n`;
    
    try {
      if (!this.ttsEngine) {
        throw new Error('TTS 引擎未初始化');
      }

      log += `[VoiceModule] generateSpeech 类型: ${typeof this.ttsEngine.generateSpeech}\n`;
      
      if (typeof this.ttsEngine.generateSpeech !== 'function') {
        throw new Error(`generateSpeech is not a function! typeof = ${typeof this.ttsEngine.generateSpeech}`);
      }
      
      log += '[VoiceModule] 调用 generateSpeech()...\n';
      const audio = await this.ttsEngine.generateSpeech(text);
      log += '[VoiceModule] generateSpeech() 返回成功\n';
      log += `[VoiceModule] audio 对象: ${audio ? '存在' : 'null'}\n`;
      log += `[VoiceModule] audio 键: ${audio ? Object.keys(audio).join(', ') : 'N/A'}\n`;
      log += `[VoiceModule] sampleRate: ${audio?.sampleRate}\n`;
      log += `[VoiceModule] samples 长度: ${audio?.samples?.length}\n`;

      // 保存到文件
      const outputPath = `${FileSystem.cacheDirectory}/tts_${Date.now()}.wav`;
      log += `[VoiceModule] 保存路径: ${outputPath}\n`;
      log += `[VoiceModule] saveAudioToFile 类型: ${typeof saveAudioToFile}\n`;
      
      if (typeof saveAudioToFile !== 'function') {
        throw new Error(`saveAudioToFile is not a function! typeof = ${typeof saveAudioToFile}`);
      }
      
      log += '[VoiceModule] 调用 saveAudioToFile()...\n';
      await saveAudioToFile(audio, outputPath);
      log += '[VoiceModule] saveAudioToFile() 返回成功\n';

      // 停止之前的播放
      await this.stopPlaying();

      // 播放
      log += '[VoiceModule] 调用 Audio.Sound.createAsync()...\n';
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: Platform.OS === 'android' ? `file://${outputPath}` : outputPath },
        { shouldPlay: true }
      );

      this.sound = newSound;
      log += '[VoiceModule] 开始播放...\n';

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          log += '[VoiceModule] 播放完成\n';
          this.sound = null;
        }
      });
      
      log += '[VoiceModule] synthesizeAndPlay 完成!\n';
    } catch (error: any) {
      log += formatError('synthesizeAndPlay', error);
      Alert.alert('合成失败', error?.message || '未知错误');
      throw new Error(log);
    }
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

export const VoiceModule = new VoiceModuleImpl();
export type { VoiceModuleType };
export default VoiceModule;
