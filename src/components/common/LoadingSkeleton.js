import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { SpotifyColors, SpotifyRadius, SpotifySpacing } from '../../theme/spotify';

/**
 * Shimmer 스켈레톤 애니메이션
 * width/height: 고정 크기 또는 '100%'
 * borderRadius: 기본 md
 */
export function SkeletonBlock({ width, height, borderRadius = SpotifyRadius.md, style }) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius, opacity: opacityAnim },
        style,
      ]}
    />
  );
}

/**
 * 갤러리 카드 형태 스켈레톤
 */
export function GalleryCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={100} height={100} />
      <View style={styles.cardInfo}>
        <SkeletonBlock width="70%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="50%" height={12} style={{ marginBottom: 12 }} />
        <SkeletonBlock width="40%" height={10} />
      </View>
    </View>
  );
}

/**
 * 여러 개 카드 스켈레톤 리스트
 */
export function GalleryCardSkeletonList({ count = 6 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <GalleryCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SpotifySpacing.md,
    marginBottom: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
  },
  cardInfo: {
    flex: 1,
    marginLeft: SpotifySpacing.md,
  },
});

export default SkeletonBlock;
