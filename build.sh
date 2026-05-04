#!/bin/bash
#
# build.sh - 一键构建 Android Release APK
#
# 用法: ./build.sh [--clean]
#   --clean: 重新生成 android/ 目录（会清理旧的）
#

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
ASSETS_MODELS="$ROOT_DIR/assets/models"
ANDROID_ASSETS="$ANDROID_DIR/app/src/main/assets/models"

# 检查 Android SDK
if [ ! -d "$HOME/Android/Sdk" ]; then
    echo "错误: 未找到 Android SDK ($HOME/Android/Sdk)"
    exit 1
fi

# 解析参数
CLEAN=false
if [[ "$1" == "--clean" ]]; then
    CLEAN=true
fi

echo "========================================"
echo "  Android Release APK 构建脚本"
echo "========================================"
echo ""

# Step 1: 检查模型文件
echo "[1/6] 检查模型文件..."
if [ ! -f "$ASSETS_MODELS/sense-voice-zh/model.int8.onnx" ]; then
    echo "错误: ASR 模型不存在"
    echo "  请先下载: HF_ENDPOINT=https://hf-mirror.com hf download csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 --local-dir $ASSETS_MODELS/sense-voice-zh"
    exit 1
fi

if [ ! -f "$ASSETS_MODELS/vits-zh/model.onnx" ]; then
    echo "错误: TTS 模型不存在"
    echo "  请先下载: HF_ENDPOINT=https://hf-mirror.com hf download csukuangfj/sherpa-onnx-vits-zh-ll --local-dir $ASSETS_MODELS/vits-zh"
    exit 1
fi
echo "  ✓ 模型文件存在"

# Step 2: Prebuild（如果需要）
if [ "$CLEAN" = true ]; then
    echo ""
    echo "[2/6] 重新生成 Android 项目..."
    cd "$ROOT_DIR"
    npx expo prebuild --platform android --clean
else
    echo ""
    echo "[2/6] 跳过 prebuild（使用现有 android/ 目录）"
    echo "  如需重新生成，使用: ./build.sh --clean"
fi

# Step 3: 配置 Gradle 镜像和代理
echo ""
echo "[3/6] 配置 Gradle..."

# 代理配置（注释掉的，按需启用）
cat >> "$ANDROID_DIR/gradle.properties" << 'EOF'

# 如需代理，取消下方注释
# systemProp.http.proxyHost=127.0.0.1
# systemProp.http.proxyPort=1885
# systemProp.https.proxyHost=127.0.0.1
# systemProp.https.proxyPort=1885
EOF

# SDK 路径
echo "sdk.dir=$HOME/Android/Sdk" > "$ANDROID_DIR/local.properties"

# Gradle wrapper 腾讯镜像
cat > "$ANDROID_DIR/gradle/wrapper/gradle-wrapper.properties" << 'EOF'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip
networkTimeout=600000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

# build.gradle 国内镜像
if ! grep -q "maven.aliyun.com" "$ANDROID_DIR/build.gradle"; then
    sed -i "s/google()/google { url 'https:\/\/maven.aliyun.com\/repository\/google' }/" "$ANDROID_DIR/build.gradle"
    sed -i "s/mavenCentral()/mavenCentral { url 'https:\/\/maven.aliyun.com\/repository\/central' }/" "$ANDROID_DIR/build.gradle"
    # 添加 sherpa-onnx 仓库
    sed -i "s|maven { url 'https://www.jitpack.io' }|maven { url 'https://www.jitpack.io' }\n    maven { url 'https://xdcobra.github.io/maven' }|" "$ANDROID_DIR/build.gradle"
fi
echo "  ✓ Gradle 配置完成"

# Step 4: 复制模型文件到 Android assets
echo ""
echo "[4/6] 复制模型文件到 Android assets..."
mkdir -p "$ANDROID_ASSETS"
rm -rf "$ANDROID_ASSETS/sense-voice-zh" "$ANDROID_ASSETS/vits-zh"
cp -r "$ASSETS_MODELS/sense-voice-zh" "$ANDROID_ASSETS/"
cp -r "$ASSETS_MODELS/vits-zh" "$ANDROID_ASSETS/"
ASR_SIZE=$(du -sh "$ANDROID_ASSETS/sense-voice-zh/model.int8.onnx" | cut -f1)
TTS_SIZE=$(du -sh "$ANDROID_ASSETS/vits-zh/model.onnx" | cut -f1)
echo "  ✓ ASR: $ASR_SIZE (sense-voice-zh)"
echo "  ✓ TTS: $TTS_SIZE (vits-zh)"

# Step 5: 构建 APK
echo ""
echo "[5/6] 构建 Release APK..."
cd "$ANDROID_DIR"

# 停止旧的 Gradle daemon
./gradlew --stop 2>/dev/null || true

# 构建
./gradlew assembleRelease --no-daemon

# Step 6: 输出结果
echo ""
echo "[6/6] 构建完成！"
echo ""

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
    echo "========================================"
    echo "  APK 路径: $APK_PATH"
    echo "  大小: $APK_SIZE"
    echo "========================================"
    echo ""
    echo "安装到手机:"
    echo "  adb install $APK_PATH"
else
    echo "错误: APK 未生成成功"
    exit 1
fi
