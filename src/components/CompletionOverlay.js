import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import Button from './common/Button';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// 간단한 파티클 (별/색종이 이모지)
const PARTICLES = ['🎉', '⭐', '✨', '🎊', '💫'];

/**
 * 풀스크린 퍼즐 완성 오버레이
 *
 * props:
 *   visible: boolean
 *   imageUri: 완성 이미지 URI (captureCanvas 결과)
 *   puzzleTitle: 퍼즐 제목
 *   puzzleNumber: "n번째 퍼즐" 표시용
 *   elapsed: 소요 시간 (초)
 *   pointsEarned: 획득 포인트
 *   onNext: 다음 퍼즐 버튼
 *   onShare: 공유 버튼
 *   onGallery: 갤러리 버튼
 */
export default function CompletionOverlay({
  visible,
  imageUri,
  puzzleTitle,
  puzzleNumber,
  elapsed,
  pointsEarned = 100,
  onNext,
  onShare,
  onGallery,
}) {
  const backdropFade = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.5)).current;
  const imageFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-100)).current;
  const buttonsSlide = useRef(new Animated.Value(200)).current;

  // 파티클들 (8개 랜덤 배치)
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      x: Math.random() * SCREEN_W,
      delay: Math.random() * 300,
      emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)],
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // 0. 배경 페이드 인
    Animated.timing(backdropFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // 0.0-0.5초: 파티클 폭죽
    particleAnims.forEach((p) => {
      Animated.parallel([
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(1500),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.translateY, {
            toValue: SCREEN_H * 0.8,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.loop(
            Animated.timing(p.rotate, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            { iterations: 2 }
          ),
        ]),
      ]).start();
    });

    // 0.5-1.5초: 완성 이미지 확대 페이드인
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(imageScale, {
          toValue: 1,
          tension: 30,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(imageFade, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 1.5-3.0초: 헤더 슬라이드 다운
    Animated.sequence([
      Animated.delay(1200),
      Animated.spring(headerSlide, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // 3.0초: 버튼 슬라이드 업
    Animated.sequence([
      Animated.delay(2500),
      Animated.spring(buttonsSlide, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const formatElapsed = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}분 ${s}초`;
  };

  return (
    <Animated.View
      style={[styles.overlay, { opacity: backdropFade }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
      accessibilityLabel={`${puzzleTitle} 퍼즐 완성! 포인트 ${pointsEarned} 획득`}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />

      {/* 파티클 */}
      {particleAnims.map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              left: p.x,
              opacity: p.opacity,
              transform: [
                { translateY: p.translateY },
                {
                  rotate: p.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {p.emoji}
        </Animated.Text>
      ))}

      <SafeAreaView style={styles.safeArea}>
        {/* 상단 헤더 (나중에 슬라이드) */}
        <Animated.View style={[styles.header, { transform: [{ translateY: headerSlide }] }]}>
          <Text style={styles.congratsTitle}>완성!</Text>
          <Text style={styles.subtitle}>
            {puzzleTitle}
            {elapsed ? ` · ${formatElapsed(elapsed)}` : ''}
          </Text>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>+{pointsEarned.toLocaleString()} 포인트</Text>
          </View>
        </Animated.View>

        {/* 완성 이미지 */}
        <View style={styles.imageWrap}>
          <Animated.View
            style={{
              opacity: imageFade,
              transform: [{ scale: imageScale }],
            }}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="완성된 퍼즐 이미지"
              />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.placeholderEmoji}>🎨</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* 하단 버튼 (나중에 슬라이드) */}
        <Animated.View style={[styles.actions, { transform: [{ translateY: buttonsSlide }] }]}>
          <View style={styles.primaryAction}>
            <Button
              title="다음 퍼즐"
              onPress={onNext}
              variant="primary"
              size="lg"
              fullWidth
              accessibilityLabel="다음 퍼즐로 이동"
            />
          </View>
          <View style={styles.secondaryActions}>
            <View style={styles.secondaryButton}>
              <Button
                title="공유하기"
                onPress={onShare}
                variant="secondary"
                size="md"
                fullWidth
                accessibilityLabel="완성 이미지 공유"
              />
            </View>
            <View style={styles.secondaryButton}>
              <Button
                title="갤러리"
                onPress={onGallery}
                variant="ghost"
                size="md"
                fullWidth
                accessibilityLabel="갤러리로 이동"
              />
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  safeArea: {
    flex: 1,
  },
  particle: {
    position: 'absolute',
    top: -40,
    fontSize: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: SpotifySpacing.xl,
    paddingHorizontal: SpotifySpacing.xl,
  },
  congratsTitle: {
    fontSize: SpotifyFonts.display,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    marginTop: SpotifySpacing.sm,
    textAlign: 'center',
  },
  pointsBadge: {
    backgroundColor: SpotifyColors.primary,
    paddingHorizontal: SpotifySpacing.base,
    paddingVertical: SpotifySpacing.sm,
    borderRadius: SpotifyRadius.full,
    marginTop: SpotifySpacing.md,
  },
  pointsText: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SpotifySpacing.xl,
  },
  image: {
    width: Math.min(SCREEN_W - 40, 400),
    height: Math.min(SCREEN_W - 40, 400),
    borderRadius: SpotifyRadius.xl,
  },
  imagePlaceholder: {
    backgroundColor: SpotifyColors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 80,
  },
  actions: {
    paddingHorizontal: SpotifySpacing.xl,
    paddingBottom: SpotifySpacing.xl,
  },
  primaryAction: {
    marginBottom: SpotifySpacing.md,
  },
  secondaryActions: {
    flexDirection: 'row',
  },
  secondaryButton: {
    flex: 1,
    marginHorizontal: SpotifySpacing.xs,
  },
});
