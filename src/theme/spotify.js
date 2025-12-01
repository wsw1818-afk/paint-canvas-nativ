/**
 * Spotify 테마 - ColorPlayExpo
 * Figma Spotify Mobile UI Kit 기반
 * https://www.figma.com/design/OfED2awVGssJu0cfwii75t/Spotify---Mobile-UI-Kit--Community-
 */

export const SpotifyColors = {
  // Primary Colors
  primary: '#1DB954',        // Spotify Green (강조색)
  primaryDark: '#1AA34A',    // Darker green
  primaryLight: '#1ED760',   // Lighter green

  // Background Colors
  background: '#121212',     // Main dark background
  backgroundLight: '#181818', // Card background
  backgroundElevated: '#282828', // Elevated surfaces
  backgroundHighlight: '#333333', // Highlight/hover

  // Text Colors
  textPrimary: '#FFFFFF',    // Primary text
  textSecondary: '#B3B3B3',  // Secondary text
  textMuted: '#727272',      // Muted/disabled text
  textSubdued: '#535353',    // Even more muted

  // UI Colors
  divider: '#282828',        // Dividers
  border: '#333333',         // Borders
  overlay: 'rgba(0, 0, 0, 0.7)', // Overlay backgrounds

  // Status Colors
  success: '#1DB954',        // Success (same as primary)
  error: '#E22134',          // Error/destructive
  warning: '#F59B23',        // Warning

  // Gradient
  gradientStart: '#1DB954',
  gradientEnd: '#121212',
};

export const SpotifyFonts = {
  // Font Weights
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',

  // Font Sizes
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  display: 48,
};

export const SpotifySpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const SpotifyRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

// Common style patterns
export const SpotifyStyles = {
  // Containers
  container: {
    flex: 1,
    backgroundColor: SpotifyColors.background,
  },

  // Cards
  card: {
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.md,
    padding: SpotifySpacing.base,
  },

  cardElevated: {
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.md,
    padding: SpotifySpacing.base,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: SpotifyColors.primary,
    borderRadius: SpotifyRadius.full,
    paddingVertical: SpotifySpacing.md,
    paddingHorizontal: SpotifySpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SpotifyColors.textSecondary,
    borderRadius: SpotifyRadius.full,
    paddingVertical: SpotifySpacing.md,
    paddingHorizontal: SpotifySpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: SpotifyColors.textPrimary,
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
  },

  // Typography
  title: {
    color: SpotifyColors.textPrimary,
    fontSize: SpotifyFonts.xxxl,
    fontWeight: SpotifyFonts.bold,
  },

  subtitle: {
    color: SpotifyColors.textSecondary,
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.regular,
  },

  heading: {
    color: SpotifyColors.textPrimary,
    fontSize: SpotifyFonts.xl,
    fontWeight: SpotifyFonts.bold,
  },

  body: {
    color: SpotifyColors.textPrimary,
    fontSize: SpotifyFonts.base,
    fontWeight: SpotifyFonts.regular,
  },

  caption: {
    color: SpotifyColors.textSecondary,
    fontSize: SpotifyFonts.sm,
    fontWeight: SpotifyFonts.regular,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SpotifySpacing.base,
    paddingVertical: SpotifySpacing.md,
    backgroundColor: SpotifyColors.background,
  },

  // Bottom Tab Bar style
  tabBar: {
    backgroundColor: SpotifyColors.backgroundLight,
    borderTopWidth: 0,
    elevation: 0,
    height: 60,
    paddingBottom: 8,
  },
};

export default {
  colors: SpotifyColors,
  fonts: SpotifyFonts,
  spacing: SpotifySpacing,
  radius: SpotifyRadius,
  styles: SpotifyStyles,
};
