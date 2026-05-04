import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import { VoiceModule } from './src/VoiceModule';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [ttsText, setTtsText] = useState('你好，这是一个测试');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isReady, setIsReady] = useState({ asr: false, tts: false });
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    // 支持多行日志一次性添加
    const lines = message.split('\n').filter(l => l.trim());
    setLog((prev) => [...prev, ...lines.map(line => `[${new Date().toLocaleTimeString()}] ${line}`)]);
  }, []);

  const copyLogToClipboard = useCallback(async () => {
    const fullLog = log.join('\n');
    await Clipboard.setStringAsync(fullLog);
    Alert.alert('已复制', '日志已复制到剪贴板');
  }, [log]);

  // 初始化 ASR 和 TTS
  const handleInit = useCallback(async () => {
    setIsInitializing(true);
    addLog('开始初始化...');

    let asrOk = false;
    let ttsOk = false;

    try {
      addLog('正在初始化 ASR...');
      asrOk = await VoiceModule.initASR();
      addLog(`ASR: ${asrOk ? '成功' : '失败'}`);
    } catch (err: any) {
      // 错误信息已经在 VoiceModule 中详细记录了
      addLog(`ASR 异常:`);
      addLog(err.message || String(err));
    }

    try {
      addLog('正在初始化 TTS...');
      ttsOk = await VoiceModule.initTTS();
      addLog(`TTS: ${ttsOk ? '成功' : '失败'}`);
    } catch (err: any) {
      addLog(`TTS 异常:`);
      addLog(err.message || String(err));
    }

    const ready = VoiceModule.isReady();
    setIsReady(ready);
    addLog(`最终状态 - ASR: ${ready.asr ? '就绪' : '未就绪'}, TTS: ${ready.tts ? '就绪' : '未就绪'}`);

    if (asrOk && ttsOk) {
      Alert.alert('初始化成功', 'ASR 和 TTS 引擎已就绪');
    } else if (asrOk) {
      Alert.alert('部分成功', 'ASR 就绪，TTS 未初始化');
    } else {
      Alert.alert('初始化失败', '请查看下方日志了解详细原因');
    }
    setIsInitializing(false);
  }, [addLog]);

  // 开始录音（使用 sherpa-onnx 原生 PCM 流）
  const startRecording = useCallback(async () => {
    try {
      addLog('=== 开始录音 ===');
      addLog('调用 VoiceModule.startMicrophone()...');
      const startLog = await VoiceModule.startMicrophone();
      addLog(startLog);
      setIsRecording(true);
      addLog('录音已启动，请说话...');
    } catch (error: any) {
      addLog(`❌ 录音失败: ${error.message}`);
      Alert.alert('录音失败', error.message);
    }
  }, [addLog]);

  // 停止录音并识别
  const stopRecording = useCallback(async () => {
    try {
      addLog('=== 停止录音并识别 ===');
      setIsRecording(false);

      addLog('调用 VoiceModule.stopMicrophoneAndRecognize()...');
      const { text, debugLog } = await VoiceModule.stopMicrophoneAndRecognize();

      // 先输出调试日志到UI
      addLog(debugLog);

      setRecognizedText(text);
      if (text) {
        addLog(`✅ 识别成功: ${text}`);
      } else {
        addLog('⚠️ 识别结果为空！请查看上方调试日志了解原因');
      }
    } catch (error: any) {
      addLog(`❌ 识别异常:`);
      addLog(error.message || String(error));
      Alert.alert('识别失败', error.message);
    } finally {
      setRecording(null);
    }
  }, [addLog]);

  // TTS 合成并播放
  const handleSynthesize = useCallback(async () => {
    if (!ttsText.trim()) {
      Alert.alert('提示', '请输入要合成的文本');
      return;
    }

    setIsSynthesizing(true);
    addLog(`开始合成: ${ttsText}`);

    try {
      await VoiceModule.synthesizeAndPlay(ttsText);
      addLog('播放完成');
    } catch (error: any) {
      addLog(`合成异常:`);
      addLog(error.message || String(error));
      Alert.alert('合成失败', error.message);
    } finally {
      setIsSynthesizing(false);
    }
  }, [ttsText, addLog]);

  // 停止播放
  const handleStop = useCallback(async () => {
    await VoiceModule.stopPlaying();
    addLog('已停止播放');
  }, [addLog]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sherpa-ONNX 语音演示</Text>

      {/* 初始化按钮 */}
      <TouchableOpacity
        style={[styles.button, styles.initButton]}
        onPress={handleInit}
        disabled={isInitializing}
      >
        {isInitializing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            初始化 ASR + TTS
          </Text>
        )}
      </TouchableOpacity>

      {/* 状态显示 */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          ASR: {isReady.asr ? '✅ 就绪' : '❌ 未初始化'}
        </Text>
        <Text style={styles.statusText}>
          TTS: {isReady.tts ? '✅ 就绪' : '❌ 未初始化'}
        </Text>
      </View>

      {/* 录音控制 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>语音识别 (ASR)</Text>
        <TouchableOpacity
          style={[
            styles.button,
            isRecording ? styles.stopButton : styles.recordButton,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!isReady.asr}
        >
          <Text style={styles.buttonText}>
            {isRecording ? '⏹ 停止并识别' : '🎤 开始录音'}
          </Text>
        </TouchableOpacity>

        {recognizedText ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>识别结果:</Text>
            <Text
              style={styles.resultText}
              selectable
              onLongPress={() => {
                // Android 长按会自动弹出复制菜单
              }}
            >
              {recognizedText}
            </Text>
          </View>
        ) : null}
      </View>

      {/* TTS 控制 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>语音合成 (TTS)</Text>
        <TextInput
          style={styles.input}
          value={ttsText}
          onChangeText={setTtsText}
          placeholder="输入要合成的文本"
          placeholderTextColor="#999"
          multiline
        />
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.synthButton]}
            onPress={handleSynthesize}
            disabled={isSynthesizing || !isReady.tts}
          >
            {isSynthesizing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🔊 合成并播放</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStop}
            disabled={!isReady.tts}
          >
            <Text style={styles.buttonText}>⏹ 停止播放</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 日志 */}
      <View style={styles.logSection}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>日志（包含完整错误信息）</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={copyLogToClipboard}
            disabled={log.length === 0}
          >
            <Text style={styles.copyButtonText}>📋 复制日志</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.logBox} horizontal={false}>
          {log.map((line, index) => (
            <Text
              key={index}
              style={styles.logText}
              selectable
            >
              {line}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  initButton: {
    backgroundColor: '#2196F3',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  synthButton: {
    backgroundColor: '#9C27B0',
    flex: 1,
    marginRight: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    color: '#333',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  resultBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
  },
  logSection: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logBox: {
    flex: 1,
  },
  logText: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 1,
  },
});
