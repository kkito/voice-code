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
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
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
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // 初始化 ASR 和 TTS
  const handleInit = useCallback(async () => {
    setIsInitializing(true);
    addLog('开始初始化...');

    let asrOk = false;
    let ttsOk = false;

    try {
      asrOk = await VoiceModule.initASR();
      addLog(`ASR: ${asrOk ? '成功' : '失败'}`);
    } catch (err: any) {
      addLog(`ASR 错误: ${err.message}`);
    }

    try {
      ttsOk = await VoiceModule.initTTS();
      addLog(`TTS: ${ttsOk ? '成功' : '失败'}`);
    } catch (err: any) {
      addLog(`TTS 错误: ${err.message}`);
    }

    setIsReady(VoiceModule.isReady());

    if (asrOk && ttsOk) {
      Alert.alert('初始化成功', 'ASR 和 TTS 引擎已就绪');
    } else if (asrOk) {
      Alert.alert('部分成功', 'ASR 就绪，TTS 未初始化');
    } else {
      Alert.alert('初始化失败', '请检查日志了解详细原因');
    }
    setIsInitializing(false);
  }, [addLog]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      addLog('请求录音权限...');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('权限被拒绝', '需要录音权限才能使用语音识别');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      addLog('开始录音...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error: any) {
      addLog(`录音失败: ${error.message}`);
      Alert.alert('录音失败', error.message);
    }
  }, [addLog]);

  // 停止录音并识别
  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      addLog('停止录音...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('错误', '录音文件路径为空');
        return;
      }

      addLog(`录音文件: ${uri}`);
      addLog('开始识别...');

      const text = await VoiceModule.recognizeAudioFile(uri);
      setRecognizedText(text);
      addLog(`识别结果: ${text}`);
    } catch (error: any) {
      addLog(`识别失败: ${error.message}`);
      Alert.alert('识别失败', error.message);
    } finally {
      setRecording(null);
    }
  }, [recording, addLog]);

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
      addLog(`合成失败: ${error.message}`);
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
            <Text style={styles.resultText}>{recognizedText}</Text>
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
        <Text style={styles.sectionTitle}>日志</Text>
        <ScrollView style={styles.logBox}>
          {log.map((line, index) => (
            <Text key={index} style={styles.logText}>
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
  logBox: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
});
