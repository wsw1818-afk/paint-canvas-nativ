import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpotifyColors, SpotifyFonts, SpotifySpacing } from '../theme/spotify';
import ProgressBar from '../components/common/ProgressBar';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * 스플래시 화면
 *
 * props:
 *   progress: 0~100 (초기화 진행률)
 *   current / total: 선택적 (예: 15/47 표시)
 *   message: 진행 중인 작업 메시지 (옵션)
 */
const TIPS = [
  '원본 이미지에서 색상을 추출하고 있어요',
  '예쁜 격자를 만들고 있어요',
  '퍼즐 데이터를 준비하고 있어요',
  '이 앱은 무료 퍼즐로 시작합니다',
  '두 손가락으로 화면을 확대할 수 있어요',
];

export default function SplashScreen({
  progress = 0,
  current,
  total,
  message,
}) {
  const [tipIndex, setTipIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const tipFadeAnim = useRef(new Animated.Value(1)).current;

  // 로고 등장 애니메이션
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 팁 로테이션 (2.5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipFadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(tipFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const progressLabel = current != null && total != null
    ? `${current} / ${total}`
    : `${Math.round(progress)}%`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SpotifyColors.background} />
      <SafeAreaView style={styles.safeArea}>
        {/* 중앙 로고 영역 */}
        <View style={styles.logoArea}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: logoScaleAnim }],
              alignItems: 'center',
            }}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🎨</Text>
            </View>
            <Text style={styles.appName}>ColorPlay</Text>
            <Text style={styles.tagline}>숫자로 그리는 그림</Text>
          </Animated.View>
        </View>

        {/* 하단 진행률 영역 */}
        <Animated.View style={[styles.progressArea, { opacity: fadeAnim }]}>
          <Text style={styles.statusMessage}>
            {message || '퍼즐을 준비하고 있어요'}
          </Text>

          <View style={styles.progressWrap}>
            <ProgressBar value={progress} height={8} />
            <Text style={styles.progressLabel}>{progressLabel}</Text>
          </View>

          {/* 로테이션 팁 */}
          <Animated.Text style={[styles.tip, { opacity: tipFadeAnim }]}>
            💡 {TIPS[tipIndex]}
          </Animated.Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotifyColors.background,
  },
  safeArea: {
    flex: 1,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: SpotifyColors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SpotifySpacing.xl,
    borderWidth: 2,
    borderColor: SpotifyColors.primary,
  },
  logoEmoji: {
    fontSize: 64,
  },
  appName: {
    fontSize: SpotifyFonts.xxxl,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: SpotifySpacing.xs,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
  },
  progressArea: {
    paddingHorizontal: SpotifySpacing.xl,
    paddingBottom: SpotifySpacing.xxl,
  },
  statusMessage: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textPrimary,
    fontWeight: SpotifyFonts.semiBold,
    textAlign: 'center',
    marginBottom: SpotifySpacing.md,
  },
  progressWrap: {
    marginBottom: SpotifySpacing.lg,
  },
  progressLabel: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
    textAlign: 'center',
    marginTop: SpotifySpacing.sm,
  },
  tip: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textMuted,
    textAlign: 'center',
    minHeight: 40,
    paddingHorizontal: SpotifySpacing.base,
  },
});
