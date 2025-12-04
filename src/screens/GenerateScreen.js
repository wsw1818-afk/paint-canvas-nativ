import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, ScrollView, StatusBar, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { processImage } from '../utils/imageProcessor';
import { savePuzzle } from '../utils/puzzleStorage';
import { generateWeavePreviewImage } from '../utils/weavePreviewGenerator';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { t, addLanguageChangeListener } from '../locales';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const loadingImage = require('../../assets/loading-image.png');

// 난이도 옵션 (t() 함수를 사용하기 위해 컴포넌트 내부에서 생성)
const getDifficulties = () => [
  { id: 'EASY', name: t('generate.easyName'), colors: 16, gridSize: 120, color: SpotifyColors.primary },
  { id: 'NORMAL', name: t('generate.normalName'), colors: 36, gridSize: 160, color: SpotifyColors.warning },
  { id: 'HARD', name: t('generate.hardName'), colors: 64, gridSize: 200, color: SpotifyColors.error },
];

// 완성 모드 옵션
const getCompletionModes = () => [
  { id: 'ORIGINAL', name: t('generate.originalMode'), desc: t('generate.originalModeDesc'), icon: '🖼️', color: SpotifyColors.primary },
  { id: 'WEAVE', name: t('generate.weaveMode'), desc: t('generate.weaveModeDesc'), icon: '🧶', color: '#9B59B6' },
];

export default function GenerateScreen({ route, navigation }) {
  const { sourceType } = route.params;
  const [selectedDifficulty, setSelectedDifficulty] = useState('NORMAL');
  const [completionMode, setCompletionMode] = useState('ORIGINAL'); // 완성 모드 (ORIGINAL: 원본 이미지, WEAVE: 위빙 텍스처)
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionReady, setPermissionReady] = useState(false);
  const isMounted = useRef(true);

  // 컴포넌트 마운트 시 권한 미리 요청 (ActivityResultLauncher 초기화 보장)
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (sourceType === 'camera') {
          await ImagePicker.requestCameraPermissionsAsync();
        } else {
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        }
        // 네이티브 모듈 초기화 대기
        if (isMounted.current) {
          setTimeout(() => {
            if (isMounted.current) {
              setPermissionReady(true);
            }
          }, 300);
        }
      } catch (error) {
        console.log('권한 요청 중 오류:', error);
        if (isMounted.current) {
          setPermissionReady(true); // 오류 시에도 진행 허용
        }
      }
    };

    requestPermissions();

    return () => {
      isMounted.current = false;
    };
  }, [sourceType]);

  const getSourceInfo = () => {
    switch (sourceType) {
      case 'gallery':
        return { title: t('generate.fromGallery'), desc: t('generate.selectFromGallery') };
      case 'camera':
        return { title: t('generate.takePhoto'), desc: t('generate.takePhotoDesc') };
      default:
        return { title: t('generate.sample'), desc: t('generate.sampleDesc') };
    }
  };

  const sourceInfo = getSourceInfo();

  const pickImage = async (retryCount = 0) => {
    // 권한 초기화가 완료될 때까지 대기
    if (!permissionReady && retryCount === 0) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        pickImage(1);
      }, 500);
      return;
    }

    try {
      let result;

      if (sourceType === 'camera') {
        const permission = await ImagePicker.getCameraPermissionsAsync();
        if (!permission.granted) {
          const newPermission = await ImagePicker.requestCameraPermissionsAsync();
          if (!newPermission.granted) {
            Alert.alert(t('generate.permissionRequired'), t('generate.cameraPermissionMessage'));
            return;
          }
        }
        // 지연 후 실행하여 ActivityResultLauncher 등록 보장
        await new Promise(resolve => setTimeout(resolve, 100));
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,  // 편집 비활성화로 원본 화질 유지
          quality: 1.0,
          exif: false,
        });
      } else {
        const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          const newPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!newPermission.granted) {
            Alert.alert(t('generate.permissionRequired'), t('generate.galleryPermissionMessage'));
            return;
          }
        }
        // 지연 후 실행하여 ActivityResultLauncher 등록 보장 (500ms로 증가)
        await new Promise(resolve => setTimeout(resolve, 500));
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,  // 배열 대신 enum 사용
          allowsEditing: false,  // 편집 비활성화로 원본 화질 유지
          quality: 1.0,
          exif: false,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage({ uri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      // ActivityResultLauncher 오류인 경우 한 번 더 시도
      if (error.message?.includes('ActivityResultLauncher') && retryCount < 2) {
        console.log(`재시도 ${retryCount + 1}/2...`);
        setTimeout(() => pickImage(retryCount + 1), 500);
        return;
      }
      setLoading(false);
      Alert.alert(t('common.error'), t('generate.loadImageError'));
    }
  };

  // 다국어 데이터 생성 (렌더링 시점에 호출)
  const DIFFICULTIES = getDifficulties();
  const COMPLETION_MODES = getCompletionModes();

  const handleGenerate = async () => {
    if (!selectedImage && sourceType !== 'sample') {
      Alert.alert(t('generate.selectImageTitle'), t('generate.selectImageMessage'));
      return;
    }

    try {
      setLoading(true);
      const difficulty = DIFFICULTIES.find(d => d.id === selectedDifficulty);

      console.log('원본 이미지 URI:', selectedImage.uri);

      // ⚡ 최적화: gridSize 기반 이미지 크기 결정 (한 번만 리사이즈)
      // - gridSize >= 100 (대형 그리드) → 256px (OOM 방지 강화)
      // - gridSize < 100 (소형 그리드) → 1024px (고화질 유지)
      // 170×170 격자에서 256px = 셀당 1.5px, 메모리 75% 감소
      const optimizedSize = difficulty.gridSize >= 100 ? 256 : 1024;
      const thumbnailSize = 200;  // 갤러리 목록용 썸네일

      console.log(`📐 최적화 크기 결정: gridSize=${difficulty.gridSize} → ${optimizedSize}px`);

      // 1단계: 최적화된 크기로 한 번만 리사이즈
      const resizedImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: optimizedSize, height: optimizedSize } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: false }
      );

      console.log('✅ 리사이즈 완료:', resizedImage.uri);

      // 2단계: 썸네일 생성 (갤러리 목록용)
      const thumbnailImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: thumbnailSize, height: thumbnailSize } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: false }
      );

      console.log('✅ 썸네일 생성 완료:', thumbnailImage.uri);

      // 3단계: 파일 저장 (최적화 이미지 + 썸네일)
      const timestamp = Date.now();
      const fileName = `puzzle_${timestamp}.jpg`;
      const thumbnailFileName = `puzzle_${timestamp}_thumb.jpg`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      const thumbnailUri = `${FileSystem.documentDirectory}${thumbnailFileName}`;

      await FileSystem.copyAsync({
        from: resizedImage.uri,
        to: permanentUri
      });

      await FileSystem.copyAsync({
        from: thumbnailImage.uri,
        to: thumbnailUri
      });

      console.log('✅ 파일 저장 완료:', permanentUri);
      console.log('✅ 썸네일 저장 완료:', thumbnailUri);

      // 4단계: 이미지를 격자로 처리하여 색상 추출
      // ⚡ imageProcessor에 이미 최적화된 이미지 전달 (중복 리사이즈 방지)
      const processedImage = await processImage(
        permanentUri,
        difficulty.gridSize,
        difficulty.colors,
        optimizedSize  // 이미 최적화된 크기 전달
      );

      console.log('✅ 이미지 처리 완료, gridColors:', processedImage.gridColors?.length);

      // 5단계: WEAVE 모드 선택 시 위빙 텍스처 미리보기 이미지 생성
      let weavePreviewUri = null;
      if (completionMode === 'WEAVE' && processedImage.dominantColors && processedImage.gridColors) {
        console.log('🧶 위빙 텍스처 미리보기 이미지 생성 중...');
        try {
          weavePreviewUri = await generateWeavePreviewImage(
            permanentUri,
            processedImage.dominantColors,
            processedImage.gridColors,
            difficulty.gridSize
          );
          console.log('✅ 위빙 미리보기 저장 완료:', weavePreviewUri);
        } catch (weaveError) {
          console.warn('위빙 미리보기 생성 실패, 원본 사용:', weaveError);
        }
      }

      const puzzleData = {
        title: `퍼즐 ${new Date().toLocaleString('ko-KR')}`,
        imageUri: permanentUri,  // 최적화된 이미지 URI
        thumbnailUri: thumbnailUri,  // 썸네일 이미지 URI (갤러리 목록용)
        weavePreviewUri: weavePreviewUri,  // 위빙 텍스처 미리보기 이미지 (WEAVE 모드 전용)
        colorCount: difficulty.colors,
        gridSize: difficulty.gridSize,
        difficulty: selectedDifficulty,
        completionMode: completionMode,
        gridColors: processedImage.gridColors,
        dominantColors: processedImage.dominantColors,
        optimizedSize: optimizedSize,  // 최적화된 이미지 크기 기록
        optimizedAt: Date.now(),  // 최적화 시점 기록 (마이그레이션 체크용)
      };

      await savePuzzle(puzzleData);
      setLoading(false);

      // 격자 적용 완료 메시지 표시 후 갤러리로 이동
      Alert.alert(
        t('generate.gridApplied'),
        t('generate.gridAppliedMessage'),
        [
          {
            text: t('common.confirm'),
            onPress: () => navigation.navigate('Gallery')
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error('퍼즐 저장 실패:', error);
      Alert.alert(t('generate.saveFailed'), error.message || t('generate.saveFailedMessage'));
    }
  };

  // 퍼즐 생성 중 로딩 화면
  if (loading && selectedImage) {
    return (
      <View style={styles.loadingOverlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
        <Image
          source={loadingImage}
          style={styles.loadingFullImage}
          resizeMode="contain"
        />
        <View style={styles.loadingStatusContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingStatusText}>{t('generate.processing')}</Text>
        </View>
      </View>
    );
  }

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
            <Text style={styles.title}>{t('generate.title')}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        {/* Image Selection */}
        {sourceType !== 'sample' && (
          <View style={styles.imageSection}>
            {!selectedImage ? (
              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(0)} disabled={loading}>
                {loading || !permissionReady ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#20B2AA" />
                    <Text style={styles.loadingText}>
                      {!permissionReady ? t('generate.initializing') : t('common.loading')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.imagePickerIcon}>
                      {sourceType === 'camera' ? '📸' : '🖼️'}
                    </Text>
                    <Text style={styles.imagePickerText}>{sourceInfo.desc}</Text>
                    <Text style={styles.imagePickerButton}>{t('generate.tapToSelect')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedImageContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.changeImageButton} onPress={() => pickImage(0)}>
                  <Text style={styles.changeImageText}>{t('generate.changeImage')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Difficulty Selection */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>{t('generate.difficulty')}</Text>

          {DIFFICULTIES.map((diff) => (
            <TouchableOpacity
              key={diff.id}
              style={[
                styles.difficultyCard,
                selectedDifficulty === diff.id && styles.difficultyCardSelected,
                { borderColor: diff.color }
              ]}
              onPress={() => setSelectedDifficulty(diff.id)}
            >
              <View style={styles.difficultyInfo}>
                <Text style={[
                  styles.difficultyName,
                  selectedDifficulty === diff.id && { color: diff.color }
                ]}>
                  {diff.name}
                </Text>
                <Text style={styles.difficultyDesc}>
                  {t('generate.colorGrid', { colors: diff.colors, gridSize: diff.gridSize })}
                </Text>
              </View>
              {selectedDifficulty === diff.id && (
                <View style={[styles.checkmark, { backgroundColor: diff.color }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Completion Mode Selection */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>{t('generate.completionMode')}</Text>

          {COMPLETION_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.difficultyCard,
                completionMode === mode.id && styles.difficultyCardSelected,
                { borderColor: mode.color }
              ]}
              onPress={() => setCompletionMode(mode.id)}
            >
              <Text style={styles.modeIcon}>{mode.icon}</Text>
              <View style={styles.difficultyInfo}>
                <Text style={[
                  styles.difficultyName,
                  completionMode === mode.id && { color: mode.color }
                ]}>
                  {mode.name}
                </Text>
                <Text style={styles.difficultyDesc}>
                  {mode.desc}
                </Text>
              </View>
              {completionMode === mode.id && (
                <View style={[styles.checkmark, { backgroundColor: mode.color }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.generateButton, (!selectedImage || loading) && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={!selectedImage || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>
                {selectedImage ? t('generate.createPuzzle') : t('generate.selectImageRequired')}
              </Text>
            )}
          </TouchableOpacity>
            </View>
          </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  loadingStatusContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.15,
    alignItems: 'center',
  },
  loadingStatusText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SpotifySpacing.xxl,
  },
  imageSection: {
    marginHorizontal: SpotifySpacing.base,
    marginTop: SpotifySpacing.base,
  },
  imagePicker: {
    height: 180,
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    borderWidth: 2,
    borderColor: SpotifyColors.backgroundElevated,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerIcon: {
    fontSize: 48,
    marginBottom: SpotifySpacing.md,
  },
  imagePickerText: {
    fontSize: SpotifyFonts.md,
    color: SpotifyColors.textSecondary,
    marginBottom: SpotifySpacing.sm,
  },
  imagePickerButton: {
    fontSize: SpotifyFonts.base,
    color: SpotifyColors.primary,
    fontWeight: SpotifyFonts.bold,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SpotifySpacing.md,
    fontSize: SpotifyFonts.base,
    color: SpotifyColors.primary,
    fontWeight: SpotifyFonts.semiBold,
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 250,
    borderRadius: SpotifyRadius.lg,
    marginBottom: SpotifySpacing.md,
  },
  changeImageButton: {
    paddingHorizontal: SpotifySpacing.xl,
    paddingVertical: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.full,
  },
  changeImageText: {
    color: SpotifyColors.textPrimary,
    fontWeight: SpotifyFonts.bold,
  },
  content: {
    paddingHorizontal: SpotifySpacing.base,
    paddingTop: SpotifySpacing.base,
  },
  sectionTitle: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: SpotifySpacing.md,
  },
  difficultyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SpotifySpacing.base,
    marginBottom: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  difficultyCardSelected: {
    borderWidth: 2,
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  difficultyInfo: {
    flex: 1,
  },
  modeIcon: {
    fontSize: 28,
    marginRight: SpotifySpacing.md,
  },
  difficultyName: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: SpotifySpacing.xs,
  },
  difficultyDesc: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: SpotifyColors.background,
    fontSize: SpotifyFonts.base,
    fontWeight: SpotifyFonts.bold,
  },
  buttonContainer: {
    marginHorizontal: SpotifySpacing.base,
    marginTop: SpotifySpacing.xl,
    marginBottom: SpotifySpacing.lg,
  },
  generateButton: {
    padding: SpotifySpacing.base,
    backgroundColor: SpotifyColors.primary,
    borderRadius: SpotifyRadius.full,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  generateButtonText: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
  },
});
