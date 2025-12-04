import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { t, addLanguageChangeListener } from '../locales';

export default function HelpScreen({ navigation }) {
  const [, forceUpdate] = useState(0);

  // 언어 변경 리스너
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  // 도움말 섹션 데이터
  const helpSections = [
    {
      title: t('help.gettingStarted'),
      icon: '🎯',
      items: [
        { q: t('help.q1'), a: t('help.a1') },
        { q: t('help.q2'), a: t('help.a2') },
      ],
    },
    {
      title: t('help.createPuzzle'),
      icon: '🖼️',
      items: [
        { q: t('help.q3'), a: t('help.a3') },
        { q: t('help.q4'), a: t('help.a4') },
        { q: t('help.q5'), a: t('help.a5') },
      ],
    },
    {
      title: t('help.playPuzzle'),
      icon: '🎨',
      items: [
        { q: t('help.q6'), a: t('help.a6') },
        { q: t('help.q7'), a: t('help.a7') },
        { q: t('help.q8'), a: t('help.a8') },
      ],
    },
    {
      title: t('help.gallery'),
      icon: '🏛️',
      items: [
        { q: t('help.q9'), a: t('help.a9') },
        { q: t('help.q10'), a: t('help.a10') },
      ],
    },
    {
      title: t('help.tips'),
      icon: '💡',
      items: [
        { q: t('help.tip1'), a: t('help.tipDesc1') },
        { q: t('help.tip2'), a: t('help.tipDesc2') },
        { q: t('help.tip3'), a: t('help.tipDesc3') },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SpotifyColors.background} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t('help.title')}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 인트로 */}
          <View style={styles.introCard}>
            <Text style={styles.introEmoji}>📱</Text>
            <Text style={styles.introTitle}>{t('help.welcome')}</Text>
            <Text style={styles.introDesc}>{t('help.welcomeDesc')}</Text>
          </View>

          {/* 도움말 섹션들 */}
          {helpSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.helpItem}>
                  <Text style={styles.question}>{item.q}</Text>
                  <Text style={styles.answer}>{item.a}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* 하단 여백 */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SpotifySpacing.base,
    paddingVertical: SpotifySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SpotifyColors.divider,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    fontSize: 32,
    color: SpotifyColors.textPrimary,
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  title: {
    fontSize: SpotifyFonts.lg,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
  },
  content: {
    flex: 1,
    padding: SpotifySpacing.base,
  },
  // 인트로 카드
  introCard: {
    backgroundColor: SpotifyColors.primary,
    borderRadius: SpotifyRadius.lg,
    padding: SpotifySpacing.xl,
    alignItems: 'center',
    marginBottom: SpotifySpacing.xl,
  },
  introEmoji: {
    fontSize: 48,
    marginBottom: SpotifySpacing.md,
  },
  introTitle: {
    fontSize: SpotifyFonts.xl,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
    marginBottom: SpotifySpacing.sm,
    textAlign: 'center',
  },
  introDesc: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.background,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  // 섹션
  section: {
    marginBottom: SpotifySpacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SpotifySpacing.md,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: SpotifySpacing.sm,
  },
  sectionTitle: {
    fontSize: SpotifyFonts.lg,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
  },
  // 도움말 항목
  helpItem: {
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.md,
    padding: SpotifySpacing.base,
    marginBottom: SpotifySpacing.sm,
  },
  question: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.semiBold,
    color: SpotifyColors.primary,
    marginBottom: SpotifySpacing.xs,
  },
  answer: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
