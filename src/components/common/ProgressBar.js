import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SpotifyColors, SpotifyFonts, SpotifyRadius } from '../../theme/spotify';

/**
 * 공통 ProgressBar
 * value: 0~100 (percent)
 * height: 선 굵기
 * showLabel: "42%" 같은 텍스트 표시 여부
 * color: 진행 부분 색상 (기본 primary)
 */
export default function ProgressBar({
  value = 0,
  height = 6,
  showLabel = false,
  color = SpotifyColors.primary,
  trackColor = SpotifyColors.backgroundElevated,
  label,
  style,
}) {
  const percent = Math.max(0, Math.min(100, value));
  const widthAnim = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      accessibilityLabel={label || `진행률 ${Math.round(percent)}%`}
    >
      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.label}>{label || `${Math.round(percent)}%`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  track: {
    flex: 1,
    borderRadius: SpotifyRadius.full,
    overflow: 'hidden',
  },
  fill: { borderRadius: SpotifyRadius.full },
  label: {
    marginLeft: 8,
    fontSize: SpotifyFonts.sm,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    minWidth: 40,
    textAlign: 'right',
  },
});
