import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { LANGUAGES, getLanguage, setLanguage, t, addLanguageChangeListener } from '../locales';
import { ZOOM_PRESETS, getZoomPresetId, setZoomPresetId, GALLERY_IMAGE_MODES, getGalleryImageMode, setGalleryImageMode, getGridLinesEnabled, setGridLinesEnabled } from '../utils/zoomSettings';
import { resetPlayTutorial } from '../components/PlayTutorial';

export default function SettingsScreen({ navigation }) {
  const [currentLang, setCurrentLang] = useState(getLanguage());
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [, forceUpdate] = useState(0);
  const [currentZoomPreset, setCurrentZoomPreset] = useState('medium');
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [currentGalleryMode, setCurrentGalleryMode] = useState('original');
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [gridLinesOn, setGridLinesOn] = useState(false);

  // 언어 변경 리스너
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener((newLang) => {
      setCurrentLang(newLang);
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  // 줌 + 갤러리 + 격자선 설정 로드
  useEffect(() => {
    getZoomPresetId().then(setCurrentZoomPreset);
    getGalleryImageMode().then(setCurrentGalleryMode);
    getGridLinesEnabled().then(setGridLinesOn);
  }, []);

  // 언어 선택 핸들러
  const handleSelectLanguage = async (langCode) => {
    await setLanguage(langCode);
    setShowLanguageModal(false);
  };

  // 줌 선택 핸들러
  const handleSelectZoom = async (presetId) => {
    await setZoomPresetId(presetId);
    setCurrentZoomPreset(presetId);
    setShowZoomModal(false);
  };

  // 갤러리 이미지 모드 핸들러
  const handleSelectGalleryMode = async (modeId) => {
    await setGalleryImageMode(modeId);
    setCurrentGalleryMode(modeId);
    setShowGalleryModal(false);
  };

  // 현재 선택된 언어 정보
  const currentLanguageInfo = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
  const currentZoomInfo = ZOOM_PRESETS.find((z) => z.id === currentZoomPreset) || ZOOM_PRESETS[1];
  const currentGalleryInfo = GALLERY_IMAGE_MODES.find((m) => m.id === currentGalleryMode) || GALLERY_IMAGE_MODES[0];

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
            <Text style={styles.title}>{t('settings.title')}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Settings List */}
        <View style={styles.content}>
          {/* 언어 설정 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowLanguageModal(true)}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>{t('settings.language')}</Text>
                <Text style={styles.settingDesc}>{t('settings.languageDesc')}</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {currentLanguageInfo.flag} {currentLanguageInfo.name}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 확대 배율 설정 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔍 확대 배율</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowZoomModal(true)}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>기본 확대 배율</Text>
                <Text style={styles.settingDesc}>색칠 화면의 최대 확대 수준</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {currentZoomInfo.label}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 격자선 설정 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}># 격자선</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                const next = !gridLinesOn;
                setGridLinesOn(next);
                await setGridLinesEnabled(next);
              }}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>격자선 표시</Text>
                <Text style={styles.settingDesc}>확대 시 셀 사이 격자선 표시</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: gridLinesOn ? '#4CD964' : SpotifyColors.textSecondary }]}>
                  {gridLinesOn ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 갤러리 이미지 설정 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🖼️ 갤러리 이미지</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowGalleryModal(true)}
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>이미지 표시 방식</Text>
                <Text style={styles.settingDesc}>갤러리에서 보여줄 이미지 유형</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {currentGalleryInfo.label}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 도움말 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.help')}</Text>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => navigation.navigate('Help')}
              accessibilityLabel="도움말 화면 열기"
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>{t('settings.help')}</Text>
                <Text style={styles.settingDesc}>{t('settings.helpDesc')}</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.helpIcon}>📖</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>

            {/* 🎓 튜토리얼 다시 보기 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={async () => {
                const ok = await resetPlayTutorial();
                Alert.alert(
                  ok ? '튜토리얼 재설정 완료' : '오류',
                  ok ? '다음 색칠 화면 진입 시 튜토리얼이 표시됩니다.' : '재설정에 실패했습니다.',
                );
              }}
              accessibilityLabel="튜토리얼 다시 보기"
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>튜토리얼 다시 보기</Text>
                <Text style={styles.settingDesc}>색칠 화면 사용법을 처음부터 다시 보여드려요</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.helpIcon}>🎓</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 정보 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('settings.version')}</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{t('settings.developer')}</Text>
              <Text style={styles.settingValue}>wisangwon</Text>
            </View>
          </View>
        </View>

        {/* 언어 선택 모달 */}
        <Modal
          visible={showLanguageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLanguageModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('settings.selectLanguage')}</Text>
              <FlatList
                data={LANGUAGES}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.languageItem,
                      item.code === currentLang && styles.languageItemSelected,
                    ]}
                    onPress={() => handleSelectLanguage(item.code)}
                  >
                    <Text style={styles.languageFlag}>{item.flag}</Text>
                    <Text
                      style={[
                        styles.languageName,
                        item.code === currentLang && styles.languageNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.code === currentLang && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        {/* 줌 배율 선택 모달 */}
        <Modal
          visible={showZoomModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowZoomModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowZoomModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🔍 확대 배율 선택</Text>
              {ZOOM_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.languageItem,
                    preset.id === currentZoomPreset && styles.languageItemSelected,
                  ]}
                  onPress={() => handleSelectZoom(preset.id)}
                >
                  <Text style={styles.languageFlag}>🔍</Text>
                  <Text
                    style={[
                      styles.languageName,
                      preset.id === currentZoomPreset && styles.languageNameSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>
                  {preset.id === currentZoomPreset && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowZoomModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 갤러리 이미지 모드 선택 모달 */}
        <Modal
          visible={showGalleryModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGalleryModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowGalleryModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🖼️ 갤러리 이미지</Text>
              {GALLERY_IMAGE_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.languageItem,
                    mode.id === currentGalleryMode && styles.languageItemSelected,
                  ]}
                  onPress={() => handleSelectGalleryMode(mode.id)}
                >
                  <Text style={styles.languageFlag}>
                    {mode.id === 'original' ? '🖼️' : '🎨'}
                  </Text>
                  <Text
                    style={[
                      styles.languageName,
                      mode.id === currentGalleryMode && styles.languageNameSelected,
                    ]}
                  >
                    {mode.label}
                  </Text>
                  {mode.id === currentGalleryMode && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowGalleryModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  section: {
    marginBottom: SpotifySpacing.xl,
  },
  sectionTitle: {
    fontSize: SpotifyFonts.sm,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textSecondary,
    marginBottom: SpotifySpacing.sm,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SpotifyColors.backgroundLight,
    padding: SpotifySpacing.base,
    borderRadius: SpotifyRadius.md,
    marginBottom: SpotifySpacing.sm,
  },
  settingLeft: {
    flex: 1,
  },
  settingLabel: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textPrimary,
    fontWeight: SpotifyFonts.semiBold,
  },
  settingDesc: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    marginRight: SpotifySpacing.sm,
  },
  chevron: {
    fontSize: 20,
    color: SpotifyColors.textSecondary,
  },
  helpIcon: {
    fontSize: 20,
    marginRight: SpotifySpacing.sm,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    padding: SpotifySpacing.lg,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: SpotifyFonts.lg,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    textAlign: 'center',
    marginBottom: SpotifySpacing.lg,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SpotifySpacing.base,
    borderRadius: SpotifyRadius.md,
    marginBottom: SpotifySpacing.sm,
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  languageItemSelected: {
    backgroundColor: SpotifyColors.primary,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: SpotifySpacing.md,
  },
  languageName: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textPrimary,
    flex: 1,
  },
  languageNameSelected: {
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
  },
  checkmark: {
    fontSize: 18,
    color: SpotifyColors.background,
    fontWeight: 'bold',
  },
  modalCancel: {
    marginTop: SpotifySpacing.md,
    padding: SpotifySpacing.base,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
  },
});
