import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { migratePuzzles } from '../utils/puzzleStorage';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { t, addLanguageChangeListener } from '../locales';

export default function HomeScreen({ navigation }) {
  const [, forceUpdate] = useState(0);

  // 언어 변경 리스너
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  // 앱 시작 시 기존 퍼즐 마이그레이션 (백그라운드 실행)
  useEffect(() => {
    const runMigration = async () => {
      try {
        const result = await migratePuzzles();
        if (!result.alreadyDone && result.migrated > 0) {
          console.log(`🔄 ${result.migrated}개 퍼즐 마이그레이션 완료`);
        }
      } catch (error) {
        console.warn('마이그레이션 오류:', error);
      }
    };
    runMigration();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SpotifyColors.background} />
      <LinearGradient
        colors={[SpotifyColors.backgroundElevated, SpotifyColors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            {/* 설정 버튼 */}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('home.title')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Gallery View Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Gallery')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[SpotifyColors.backgroundElevated, SpotifyColors.backgroundLight]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.buttonInner}>
                  <View style={[styles.iconContainer, { backgroundColor: SpotifyColors.primary }]}>
                    <Text style={styles.buttonIcon}>🖼️</Text>
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonText}>{t('home.gallery')}</Text>
                    <Text style={styles.buttonSubtext}>{t('gallery.emptyDesc')}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Create Puzzle Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Generate', { sourceType: 'gallery' })}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[SpotifyColors.backgroundElevated, SpotifyColors.backgroundLight]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.buttonInner}>
                  <View style={[styles.iconContainer, { backgroundColor: SpotifyColors.primary }]}>
                    <Text style={styles.buttonIcon}>➕</Text>
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonText}>{t('home.newPuzzle')}</Text>
                    <Text style={styles.buttonSubtext}>{t('generate.selectImage')}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom branding */}
          <View style={styles.bottomBranding}>
            <View style={styles.brandingDot} />
            <Text style={styles.brandingText}>Color your world</Text>
            <View style={styles.brandingDot} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotifyColors.background,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SpotifySpacing.xl,
    paddingBottom: 60,
    alignItems: 'center',
    position: 'relative',
  },
  settingsButton: {
    position: 'absolute',
    top: 20,
    right: SpotifySpacing.base,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SpotifyColors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: SpotifyFonts.display,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.primary,
    marginBottom: SpotifySpacing.sm,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    fontWeight: SpotifyFonts.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: SpotifySpacing.base,
    justifyContent: 'center',
  },
  button: {
    marginBottom: SpotifySpacing.base,
    borderRadius: SpotifyRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonGradient: {
    padding: SpotifySpacing.base,
    borderRadius: SpotifyRadius.lg,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: SpotifyRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SpotifySpacing.base,
  },
  buttonIcon: {
    fontSize: 28,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    fontSize: SpotifyFonts.lg,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
  },
  chevron: {
    fontSize: 28,
    color: SpotifyColors.textSecondary,
    fontWeight: '300',
  },
  bottomBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SpotifySpacing.xl,
    gap: SpotifySpacing.sm,
  },
  brandingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SpotifyColors.primary,
  },
  brandingText: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textMuted,
    fontWeight: SpotifyFonts.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
