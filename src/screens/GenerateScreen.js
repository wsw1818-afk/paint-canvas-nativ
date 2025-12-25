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
import { getPoints, deductPoints, getPuzzleCost } from '../utils/pointsStorage';

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
  const [loadingProgress, setLoadingProgress] = useState(0); // 0~100 진행률
  const [loadingStep, setLoadingStep] = useState(''); // 현재 단계 텍스트
  const [previewImage, setPreviewImage] = useState(null); // 점진적 로딩용 미리보기
  const [permissionReady, setPermissionReady] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0); // 현재 보유 포인트
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

  // 💎 포인트 로드
  useEffect(() => {
    const loadPoints = async () => {
      const points = await getPoints();
      setCurrentPoints(points);
    };
    loadPoints();

    // 언어 변경 시 포인트 재로드
    const removeListener = addLanguageChangeListener(loadPoints);
    return removeListener;
  }, []);

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

    // 💎 포인트 확인 및 차감
    const difficulty = DIFFICULTIES.find(d => d.id === selectedDifficulty);
    const cost = getPuzzleCost(difficulty.colors);
    const pointsCheck = await deductPoints(cost);

    if (!pointsCheck.success) {
      const shortfall = cost - pointsCheck.currentPoints;
      Alert.alert(
        t('generate.pointsRequired') || '포인트 필요',
        t('generate.pointsShortfall', { current: pointsCheck.currentPoints, cost, shortfall }) ||
        `포인트가 부족합니다.\n\n필요: ${cost.toLocaleString()}P\n보유: ${pointsCheck.currentPoints.toLocaleString()}P\n부족: ${shortfall.toLocaleString()}P\n\n더 많은 퍼즐을 색칠하여 포인트를 획득하세요!`
      );
      return;
    }

    // 포인트 차감 성공 → 화면에 반영
    setCurrentPoints(pointsCheck.newPoints);

    try {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingStep(t('generate.stepPreparing') || '준비 중...');

      console.log('원본 이미지 URI:', selectedImage.uri);

      // ⚡ 최적화: gridSize 기반 이미지 크기 결정 (한 번만 리사이즈)
      const optimizedSize = difficulty.gridSize >= 100 ? 256 : 1024;
      const thumbnailSize = 200;  // 갤러리 목록용 썸네일

      console.log(`📐 최적화 크기 결정: gridSize=${difficulty.gridSize} → ${optimizedSize}px`);

      // ⚡ 점진적 로딩: 썸네일 먼저 생성하여 미리보기 표시
      setLoadingProgress(5);
      setLoadingStep(t('generate.stepThumbnail') || '미리보기 생성 중...');

      const thumbnailImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: thumbnailSize, height: thumbnailSize } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: false }
      );

      // 🖼️ 썸네일 즉시 표시 (체감 속도 향상)
      setPreviewImage(thumbnailImage.uri);
      setLoadingProgress(15);
      console.log('✅ 썸네일 생성 완료:', thumbnailImage.uri);

      // 1단계: 최적화된 크기로 리사이즈
      setLoadingStep(t('generate.stepResize') || '이미지 최적화 중...');
      const resizedImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: optimizedSize, height: optimizedSize } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: false }
      );
      setLoadingProgress(30);
      console.log('✅ 리사이즈 완료:', resizedImage.uri);

      // 2단계: 파일 저장
      setLoadingStep(t('generate.stepSaving') || '파일 저장 중...');
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
      setLoadingProgress(40);
      console.log('✅ 파일 저장 완료:', permanentUri);

      // 3단계: 색상 추출 (가장 오래 걸림)
      setLoadingStep(t('generate.stepAnalyzing') || '색상 분석 중...');
      const processedImage = await processImage(
        permanentUri,
        difficulty.gridSize,
        difficulty.colors,
        optimizedSize
      );
      setLoadingProgress(80);
      console.log('✅ 이미지 처리 완료, gridColors:', processedImage.gridColors?.length);

      // 4단계: WEAVE 모드 선택 시 위빙 텍스처 미리보기
      let weavePreviewUri = null;
      if (completionMode === 'WEAVE' && processedImage.dominantColors && processedImage.gridColors) {
        setLoadingStep(t('generate.stepWeave') || '위빙 텍스처 생성 중...');
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
      setLoadingProgress(90);

      // 5단계: 퍼즐 데이터 저장
      setLoadingStep(t('generate.stepFinishing') || '저장 완료 중...');
      const puzzleData = {
        title: `퍼즐 ${new Date().toLocaleString('ko-KR')}`,
        imageUri: permanentUri,
        thumbnailUri: thumbnailUri,
        weavePreviewUri: weavePreviewUri,
        colorCount: difficulty.colors,
        gridSize: difficulty.gridSize,
        difficulty: selectedDifficulty,
        completionMode: completionMode,
        gridColors: processedImage.gridColors,
        dominantColors: processedImage.dominantColors,
        optimizedSize: optimizedSize,
        optimizedAt: Date.now(),
      };

      await savePuzzle(puzzleData);
      setLoadingProgress(100);
      setLoading(false);
      setPreviewImage(null);

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
      setPreviewImage(null);
      setLoadingProgress(0);
      console.error('퍼즐 저장 실패:', error);
      Alert.alert(t('generate.saveFailed'), error.message || t('generate.saveFailedMessage'));
    }
  };

  // 퍼즐 생성 중 로딩 화면 (프로그레스 바 + 점진적 로딩)
  if (loading && selectedImage) {
    return (
      <View style={styles.loadingOverlay}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

        {/* 🖼️ 점진적 로딩: 썸네일 미리보기 또는 기본 로딩 이미지 */}
        <Image
          source={previewImage ? { uri: previewImage } : loadingImage}
          style={[
            styles.loadingFullImage,
            previewImage && styles.loadingPreviewImage  // 미리보기일 때 둥근 모서리
          ]}
          resizeMode="contain"
        />

        <View style={styles.loadingStatusContainer}>
          {/* 📊 프로그레스 바 */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{loadingProgress}%</Text>

          {/* 현재 단계 표시 */}
          <Text style={styles.loadingStatusText}>{loadingStep || t('generate.processing')}</Text>
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
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsLabel}>💎</Text>
            <Text style={styles.pointsValue}>{currentPoints.toLocaleString()}</Text>
          </View>
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
                <Text style={[
                  styles.difficultyCost,
                  currentPoints < getPuzzleCost(diff.colors) && styles.difficultyCostInsufficient
                ]}>
                  💎 {getPuzzleCost(diff.colors).toLocaleString()}P
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
    marginTop: 8,
    fontWeight: '500',
  },
  loadingPreviewImage: {
    borderRadius: 16,
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
  },
  progressBarContainer: {
    width: SCREEN_WIDTH * 0.7,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 4,
  },
  progressText: {
    color: '#1DB954',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
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
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SpotifyColors.backgroundElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SpotifyColors.divider,
  },
  pointsLabel: {
    fontSize: 14,
    marginRight: 4,
  },
  pointsValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: SpotifyColors.primary,
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
  difficultyCost: {
    fontSize: 13,
    fontWeight: '600',
    color: SpotifyColors.primary,
    marginTop: 4,
  },
  difficultyCostInsufficient: {
    color: SpotifyColors.error,
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
