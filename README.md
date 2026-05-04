# 语音演示（Sherpa-ONNX ASR + TTS）

基于 [Sherpa-ONNX](https://github.com/k2-fsa/sherpa-onnx) 的离线语音识别（ASR）和语音合成（TTS）React Native 应用，完全在设备端运行，无需联网。

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React Native | 0.81.5 |
| SDK | Expo | 54.0.33 |
| 语音引擎 | react-native-sherpa-onnx | 0.4.2 |
| 底层推理 | sherpa-onnx / ONNX Runtime | 1.12.34 / 1.24.4 |
| 录音 | expo-av | 16.0.8 |
| 文件系统 | expo-file-system | 55.0.17 |

## 模型

| 模型 | 用途 | 类型 | 大小 | 来源 |
|------|------|------|------|------|
| SenseVoice | 中文 ASR | INT8 量化 | ~229MB | [HuggingFace](https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17) |
| VITS | 中文 TTS | FP32 | ~116MB | [HuggingFace](https://huggingface.co/csukuangfj/sherpa-onnx-vits-zh-ll) |

模型文件打包在 APK 的 `assets/models/` 目录，随应用一起安装，无需运行时下载。

## 架构

```
┌─────────────────────────────────────────┐
│              App.tsx (UI)               │
│  录音按钮 / 识别结果展示 / TTS输入播放    │
├─────────────────────────────────────────┤
│          VoiceModule.ts (TS 封装)        │
│  initASR / initTTS / recognize / synthesize│
├─────────────────────────────────────────┤
│     react-native-sherpa-onnx (RN 模块)   │
│  TurboModule Bridge (C++ JNI + Kotlin)   │
├─────────────────────────────────────────┤
│        sherpa-onnx (C++ 原生库)          │
│     ONNX Runtime + 模型推理引擎           │
├─────────────────────────────────────────┤
│          Android (arm64-v8a, etc)       │
└─────────────────────────────────────────┘
```

## 构建流程

### 环境要求

- Node.js + pnpm
- Android SDK（NDK 27.1.12297006）
- 网络代理（用于下载 Gradle 依赖和 Sherpa-ONNX 原生库）

### 安装依赖

```bash
pnpm install
```

### 下载模型

模型从 HuggingFace 国内镜像下载（需要 `hf` CLI 工具）：

```bash
mkdir -p assets/models

# ASR 模型（SenseVoice 中文）
HF_ENDPOINT=https://hf-mirror.com hf download csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 --local-dir ./assets/models/sense-voice-zh

# TTS 模型（VITS 中文）
HF_ENDPOINT=https://hf-mirror.com hf download csukuangfj/sherpa-onnx-vits-zh-ll --local-dir ./assets/models/vits-zh
```

下载后清理不必要的文件（`.cache`, `test_wavs`, `*.py` 等），只保留核心 `.onnx` 和 `.txt` 文件。

### 生成原生项目

```bash
npx expo prebuild --platform android
```

### 构建 APK

需要配置代理和 Gradle 镜像：

**gradle.properties** 添加代理：
```properties
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=1885
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=1885
```

**build.gradle** 添加镜像：
```groovy
allprojects {
    repositories {
        google { url 'https://maven.aliyun.com/repository/google' }
        mavenCentral { url 'https://maven.aliyun.com/repository/central' }
        maven { url 'https://xdcobra.github.io/maven' }  // sherpa-onnx 原生库
    }
}
```

**gradle-wrapper.properties** 使用腾讯镜像：
```properties
distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip
```

构建：
```bash
cd android && ./gradlew assembleDebug
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`（~251MB）

### 安装到设备

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## 项目结构

```
├── App.tsx                     # 主界面
├── src/
│   ├── VoiceModule.ts          # ASR/TTS 封装（初始化、识别、合成）
│   └── ModelManager.ts         # 模型管理（备用，当前模型已内置）
├── assets/
│   └── models/
│       ├── sense-voice-zh/     # SenseVoice 中文 ASR 模型
│       │   ├── model.int8.onnx
│       │   └── tokens.txt
│       └── vits-zh/            # VITS 中文 TTS 模型
│           ├── model.onnx
│           ├── lexicon.txt
│           └── tokens.txt
├── app.json                    # Expo 配置（权限、插件）
├── package.json
└── android/                    # 生成的原生 Android 项目
```

## 使用方式

1. 打开应用
2. 点击 **「初始化 ASR + TTS」**（首次加载模型需要几秒钟）
3. **语音识别**：点击「开始录音」→ 说话 → 点击「停止并识别」，结果会显示在下方
4. **语音合成**：输入中文文本 → 点击「合成并播放」

## 注意事项

- APK 体积较大（~251MB）是因为内置了两个模型
- 首次初始化时模型从 assets 拷贝到应用目录，可能需要几秒
- 完全离线可用，不依赖网络和 Google 服务
- 仅支持 Android API 24+（Android 7.0+）
