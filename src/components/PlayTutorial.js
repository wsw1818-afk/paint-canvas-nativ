import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import Button from './common/Button';

const TUTORIAL_KEY = '@hasSeenPlayTutorial';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const STEPS = [
  {
    title: '1. 색상 선택',
    description: '하단 팔레트에서 칠하고 싶은 색상을 탭하세요.',
    emoji: '🎨',
    highlightArea: 'palette', // 하단
  },
  {
    title: '2. 칸 색칠',
    description: '캔버스의 알파벳이 표시된 칸을 탭하면 선택한 색상으로 칠해집니다.',
    emoji: '👆',
    highlightArea: 'canvas', // 중앙
  },
  {
    title: '3. 확대 / 이동',
    description: '두 손가락으로 핀치해서 확대하고, 드래그해서 화면을 이동할 수 있어요.',
    emoji: '✌️',
    highlightArea: 'gesture', // 전체
  },
];

/**
 * Play 화면 첫 진입 튜토리얼
 * AsyncStorage '@hasSeenPlayTutorial'가 없을 때만 표시
 *
 * props:
 *   ready: 캔버스 로딩 완료 여부 (true일 때만 튜토리얼 표시)
 *   onComplete: 튜토리얼 완료/스킵 콜백
 */
export default function PlayTutorial({ ready = true, onComplete }) {
  const [shouldShow, setShouldShow] = useState(false); // AsyncStorage 체크 결과
  const [visible, setVisible] = useState(false);        // 실제 표시 여부
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // AsyncStorage 체크 (첫 렌더 1회)
  useEffect(() => {
    const checkShouldShow = async () => {
      try {
        const seen = await AsyncStorage.getItem(TUTORIAL_KEY);
        if (!seen) {
          setShouldShow(true);
        } else {
          if (typeof onComplete === 'function') onComplete();
        }
      } catch (e) {
        if (typeof onComplete === 'function') onComplete();
      }
    };
    checkShouldShow();
  }, []);

  // 로딩 끝나고 shouldShow=true일 때만 표시 + fade in
  useEffect(() => {
    if (!shouldShow || !ready || visible) return;
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, ready, visible]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    } catch (e) {}
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      if (typeof onComplete === 'function') onComplete();
    });
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      finish();
    }
  };

  if (!visible) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      accessible
      accessibilityViewIsModal
      accessibilityLabel={`튜토리얼 ${stepIndex + 1}단계 / ${STEPS.length}단계`}
    >
      {/* 어두운 배경 */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* 스킵 버튼 (우측 상단) */}
      <TouchableOpacity
        onPress={finish}
        style={styles.skipButton}
        accessibilityLabel="튜토리얼 건너뛰기"
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>건너뛰기</Text>
      </TouchableOpacity>

      {/* 중앙 카드 */}
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <Text style={styles.stepBadge}>{stepIndex + 1} / {STEPS.length}</Text>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          <View style={styles.button}>
            <Button
              title={isLast ? '시작하기' : '다음'}
              onPress={handleNext}
              variant="primary"
              size="md"
              fullWidth
              accessibilityLabel={isLast ? '튜토리얼 완료하고 시작하기' : '다음 단계'}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * 튜토리얼 상태 리셋 (Settings에서 "다시 보기" 누를 때 호출)
 */
export const resetPlayTutorial = async () => {
  try {
    await AsyncStorage.removeItem(TUTORIAL_KEY);
    return true;
  } catch {
    return false;
  }
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  skipButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    padding: SpotifySpacing.sm,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: SpotifyColors.textSecondary,
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.semiBold,
  },
  cardWrap: {
    width: '100%',
    paddingHorizontal: SpotifySpacing.xl,
  },
  card: {
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.xl,
    padding: SpotifySpacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SpotifyColors.backgroundElevated,
  },
  stepBadge: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.primary,
    fontWeight: SpotifyFonts.bold,
    marginBottom: SpotifySpacing.md,
    letterSpacing: 1,
  },
  emoji: {
    fontSize: 56,
    marginBottom: SpotifySpacing.base,
  },
  title: {
    fontSize: SpotifyFonts.xl,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: SpotifySpacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SpotifySpacing.xl,
  },
  button: {
    width: '100%',
  },
});
