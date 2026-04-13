import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../../theme/spotify';

/**
 * 공통 Button 컴포넌트
 * variant: 'primary' | 'secondary' | 'ghost'
 * size: 'sm' | 'md' | 'lg'
 * 접근성: 자동 role=button, label=title (accessibilityLabel prop으로 오버라이드 가능)
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  accessibilityLabel,
  style,
  textStyle,
}) {
  const variantStyle = styles[`variant_${variant}`] || styles.variant_primary;
  const sizeStyle = styles[`size_${size}`] || styles.size_md;
  const textSizeStyle = styles[`textSize_${size}`] || styles.textSize_md;
  const textVariantStyle = styles[`textVariant_${variant}`] || styles.textVariant_primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? SpotifyColors.background : SpotifyColors.textPrimary}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.text, textSizeStyle, textVariantStyle, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: SpotifyRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // a11y: 터치 타깃 44 dp
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: SpotifySpacing.sm },
  text: { fontWeight: SpotifyFonts.bold, textAlign: 'center' },

  variant_primary: { backgroundColor: SpotifyColors.primary },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SpotifyColors.textPrimary,
  },
  variant_ghost: { backgroundColor: 'transparent' },

  textVariant_primary: { color: SpotifyColors.background },
  textVariant_secondary: { color: SpotifyColors.textPrimary },
  textVariant_ghost: { color: SpotifyColors.textPrimary },

  size_sm: { paddingHorizontal: SpotifySpacing.base, paddingVertical: SpotifySpacing.sm },
  size_md: { paddingHorizontal: SpotifySpacing.lg, paddingVertical: SpotifySpacing.md },
  size_lg: { paddingHorizontal: SpotifySpacing.xl, paddingVertical: SpotifySpacing.base },

  textSize_sm: { fontSize: SpotifyFonts.sm },
  textSize_md: { fontSize: SpotifyFonts.md },
  textSize_lg: { fontSize: SpotifyFonts.lg },
});
