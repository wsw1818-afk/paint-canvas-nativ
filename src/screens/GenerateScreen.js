import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, ScrollView, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { processImage } from '../utils/imageProcessor';
import { savePuzzle } from '../utils/puzzleStorage';

const DIFFICULTIES = [
  { id: 'EASY', name: '쉬움 (빠른 플레이)', colors: 16, gridSize: 120, color: '#4CD964' },      // 120×120 = 14,400 셀, 16색
  { id: 'NORMAL', name: '보통 (균형잡힌)', colors: 36, gridSize: 160, color: '#5AB9EA' },   // 160×160 = 25,600 셀, 36색
  { id: 'HARD', name: '어려움 (사진처럼)', colors: 64, gridSize: 200, color: '#FF5757' },   // 200×200 = 40,000 셀, 64색
  { id: 'ULTRA', name: '초고화질 (실사)', colors: 96, gridSize: 250, color: '#9B59B6' },  // 250×250 = 62,500 셀, 96색
];

// 완성 모드 옵션
const COMPLETION_MODES = [
  { id: 'ORIGINAL', name: '원본 이미지', desc: '완성 시 원본 사진이 나타남', icon: '🖼️', color: '#FF6B6B' },
  { id: 'WEAVE', name: '위빙 텍스처', desc: '완성 시 색칠한 그대로 유지', icon: '🧶', color: '#9B59B6' },
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
        return { title: '갤러리', desc: '사진 앨범에서 이미지를 선택해주세요' };
      case 'camera':
        return { title: '카메라', desc: '카메라로 사진을 찍어주세요' };
      default:
        return { title: '샘플', desc: '연습용 샘플 이미지로 시작합니다' };
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
            Alert.alert('권한 필요', '카메라 권한이 필요합니다.\n설정 → 앱 → ColorPlayExpo → 권한에서 허용해주세요.');
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
            Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.\n설정 → 앱 → ColorPlayExpo → 권한에서 허용해주세요.');
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
      Alert.alert('오류', '이미지를 불러올 수 없습니다.\n앱을 완전히 종료 후 다시 시작해주세요.');
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage && sourceType !== 'sample') {
      Alert.alert('이미지 선택', '먼저 이미지를 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      const difficulty = DIFFICULTIES.find(d => d.id === selectedDifficulty);

      console.log('원본 이미지 URI:', selectedImage.uri);

      // 1단계: 이미지를 1024x1024로 리사이즈 (5MB 제한 방지)
      // JPEG 압축 사용으로 파일 크기 대폭 감소 (PNG 대비 90% 감소)
      const resizedImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: 1024, height: 1024 } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: false }  // JPEG 80% 품질
      );

      console.log('리사이즈 완료:', resizedImage.uri);

      // 2단계: 리사이즈된 이미지를 영구 저장소에 복사
      const timestamp = Date.now();
      const fileName = `puzzle_${timestamp}.jpg`;  // JPEG 확장자로 변경
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: resizedImage.uri,
        to: permanentUri
      });

      console.log('이미지 파일로 저장 완료:', permanentUri);

      // 3단계: 이미지를 격자로 처리하여 색상 추출
      const processedImage = await processImage(
        permanentUri,  // 저장된 파일 경로 사용
        difficulty.gridSize,  // 난이도별 격자 크기 (쉬움: 140, 보통: 160, 어려움: 220)
        difficulty.colors
      );

      console.log('이미지 처리 완료, gridColors:', processedImage.gridColors?.length);

      const puzzleData = {
        title: `퍼즐 ${new Date().toLocaleString('ko-KR')}`,
        imageUri: permanentUri,  // file:// URI로 저장
        colorCount: difficulty.colors,
        gridSize: difficulty.gridSize,  // 난이도별 격자 크기
        difficulty: selectedDifficulty,
        completionMode: completionMode,  // 완성 모드 (ORIGINAL: 원본 이미지, WEAVE: 위빙 텍스처)
        gridColors: processedImage.gridColors,  // 격자별 색상 매핑 데이터
        dominantColors: processedImage.dominantColors,  // 추출된 주요 색상
      };

      await savePuzzle(puzzleData);
      setLoading(false);

      // 격자 적용 완료 메시지 표시 후 갤러리로 이동
      Alert.alert(
        '격자 적용 완료',
        '이미지가 저장되었습니다. 갤러리에서 확인하세요.',
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('Gallery')
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error('퍼즐 저장 실패:', error);
      Alert.alert('저장 실패', error.message || '이미지 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#87CEEB', '#40E0D0', '#20B2AA']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>← 뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.title}>퍼즐 만들기</Text>
            <Text style={styles.headerSubtitle}>나만의 색칠 퍼즐 생성</Text>
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
                      {!permissionReady ? '초기화 중...' : '불러오는 중...'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.imagePickerIcon}>
                      {sourceType === 'camera' ? '📸' : '🖼️'}
                    </Text>
                    <Text style={styles.imagePickerText}>{sourceInfo.desc}</Text>
                    <Text style={styles.imagePickerButton}>탭하여 선택</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedImageContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.changeImageButton} onPress={() => pickImage(0)}>
                  <Text style={styles.changeImageText}>이미지 변경</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Difficulty Selection */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>난이도 선택 (색상 개수)</Text>

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
                  {diff.colors}가지 색상 · {diff.gridSize}×{diff.gridSize} 격자
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
          <Text style={styles.sectionTitle}>완성 모드 선택</Text>

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
                {selectedImage ? '격자 적용하기' : '이미지 선택 필요'}
              </Text>
            )}
          </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  backButton: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  imageSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  imagePicker: {
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  imagePickerText: {
    fontSize: 16,
    color: '#2C3E50',
    marginBottom: 8,
  },
  imagePickerButton: {
    fontSize: 14,
    color: '#20B2AA',
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#20B2AA',
    fontWeight: '600',
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 250,
    borderRadius: 20,
    marginBottom: 12,
  },
  changeImageButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  difficultyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  difficultyCardSelected: {
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  difficultyInfo: {
    flex: 1,
  },
  modeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  difficultyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  difficultyDesc: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
  },
  generateButton: {
    padding: 18,
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  generateButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowOpacity: 0,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
