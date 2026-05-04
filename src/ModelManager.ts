/**
 * ModelManager - 模型下载和管理模块
 * 
 * 由于模型文件较大（ASR 229MB + TTS 116MB），
 * 不打包进 APK，而是在首次运行时下载到应用私有目录。
 */

import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

// 模型下载地址（使用国内镜像源）
const MODEL_DOWNLOAD_URLS = {
  asr: {
    // SenseVoice 中文 ASR 模型（INT8 量化版本）
    model: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx',
    tokens: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt',
  },
  tts: {
    // VITS 中文 TTS 模型
    model: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/model.onnx',
    tokens: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/tokens.txt',
    lexicon: 'https://hf-mirror.com/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/lexicon.txt',
  },
};

interface ModelManagerType {
  /** 检查模型是否已下载 */
  isModelDownloaded(type: 'asr' | 'tts'): Promise<boolean>;
  
  /** 下载模型文件 */
  downloadModel(type: 'asr' | 'tts', onProgress?: (progress: number) => void): Promise<string>;
  
  /** 获取模型本地路径 */
  getModelPath(type: 'asr' | 'tts'): string;
  
  /** 删除已下载的模型 */
  deleteModel(type: 'asr' | 'tts'): Promise<void>;
  
  /** 获取模型总大小（MB） */
  getModelSizeMB(type: 'asr' | 'tts'): number;
}

class ModelManagerImpl implements ModelManagerType {
  private getModelsDir(): string {
    return `${FileSystem.documentDirectory}models`;
  }

  private getModelDir(type: 'asr' | 'tts'): string {
    return `${this.getModelsDir()}/${type === 'asr' ? 'sense-voice-zh' : 'vits-zh'}`;
  }

  getModelPath(type: 'asr' | 'tts'): string {
    return this.getModelDir(type);
  }

  getModelSizeMB(type: 'asr' | 'tts'): number {
    return type === 'asr' ? 229 : 116;
  }

  async isModelDownloaded(type: 'asr' | 'tts'): Promise<boolean> {
    const modelDir = this.getModelDir(type);
    const modelPath = `${modelDir}/model.onnx`;
    const info = await FileSystem.getInfoAsync(modelPath);
    return info.exists;
  }

  async downloadModel(
    type: 'asr' | 'tts',
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const modelDir = this.getModelDir(type);
    
    // 创建目录
    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

    const urls = MODEL_DOWNLOAD_URLS[type];
    const files = Object.entries(urls);
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const [filename, url] = files[i];
      const destPath = `${modelDir}/${filename.split('/').pop()}`;
      
      console.log(`[ModelManager] 下载 ${filename}...`);
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          const overallProgress = ((i + progress) / totalFiles) * 100;
          onProgress?.(overallProgress);
        }
      );

      try {
        const result = await downloadResumable.downloadAsync();
        if (!result?.uri) {
          throw new Error(`下载 ${filename} 失败`);
        }
        console.log(`[ModelManager] ${filename} 下载完成`);
      } catch (error: any) {
        throw new Error(`下载 ${filename} 失败: ${error.message}`);
      }
    }

    // 验证下载
    const isDownloaded = await this.isModelDownloaded(type);
    if (!isDownloaded) {
      throw new Error('模型下载后验证失败');
    }

    return modelDir;
  }

  async deleteModel(type: 'asr' | 'tts'): Promise<void> {
    const modelDir = this.getModelDir(type);
    const info = await FileSystem.getInfoAsync(modelDir);
    if (info.exists) {
      await FileSystem.deleteAsync(modelDir);
    }
  }
}

// 导出单例
export const ModelManager = new ModelManagerImpl();
export type { ModelManagerType };
export default ModelManager;
