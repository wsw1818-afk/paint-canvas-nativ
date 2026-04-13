import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SpotifyColors, SpotifyFonts, SpotifySpacing } from '../../theme/spotify';
import Button from './Button';

/**
 * 빈 상태 컴포넌트
 * icon: 이모지 또는 컴포넌트
 * title: 메인 메시지
 * description: 보조 설명
 * actionLabel + onAction: CTA 버튼 (옵션)
 */
export default function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  style,
}) {
  return (
    <View style={[styles.wrap, style]}>
      {typeof icon === 'string' ? (
        <Text style={styles.icon}>{icon}</Text>
      ) : (
        icon
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="primary"
            size="md"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SpotifySpacing.xl,
    paddingVertical: SpotifySpacing.xxl,
  },
  icon: {
    fontSize: 64,
    marginBottom: SpotifySpacing.lg,
    opacity: 0.8,
  },
  title: {
    fontSize: SpotifyFonts.lg,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    textAlign: 'center',
    marginBottom: SpotifySpacing.sm,
  },
  description: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: SpotifySpacing.xl,
  },
});
