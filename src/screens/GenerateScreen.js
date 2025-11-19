import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { processImage } from '../utils/imageProcessor';
import { savePuzzle } from '../utils/puzzleStorage';

const DIFFICULTIES = [
  { id: 'EASY', name: '쉬움', colors: 12, color: '#4CD964' },
  { id: 'NORMAL', name: '보통', colors: 24, color: '#5AB9EA' },
  { id: 'HARD', name: '어려움', colors: 36, color: '#FF5757' },
];

export default function GenerateScreen({ route, navigation }) {
  const { sourceType } = route.params;
  const [selectedDifficulty, setSelectedDifficulty] = useState('NORMAL');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const pickImage = async () => {
    try {
      let result;

      if (sourceType === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        // 이미지 URI만 저장, 처리는 나중에
        setSelectedImage({ uri: result.assets[0].uri });
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('오류', '이미지를 불러올 수 없습니다.');
      console.error(error);
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

      // 1단계: 이미지를 600x600으로 리사이즈 (PlayScreen의 gridPixelSize와 동일)
      const resizedImage = await manipulateAsync(
        selectedImage.uri,
        [{ resize: { width: 600, height: 600 } }],
        { compress: 0.9, format: SaveFormat.PNG }
      );

      console.log('리사이즈 완료:', resizedImage.uri);

      // 2단계: 리사이즈된 이미지를 영구 저장소에 복사
      const timestamp = Date.now();
      const fileName = `puzzle_${timestamp}.png`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: resizedImage.uri,
        to: permanentUri
      });

      console.log('이미지 파일로 저장 완료:', permanentUri);

      // 3단계: 이미지를 격자로 처리하여 색상 추출
      const processedImage = await processImage(
        permanentUri,  // 저장된 파일 경로 사용
        60,  // gridSize - 60x60 격자 (세밀한 그리기)
        difficulty.colors
      );

      console.log('이미지 처리 완료, gridColors:', processedImage.gridColors?.length);

      const puzzleData = {
        title: `퍼즐 ${new Date().toLocaleString('ko-KR')}`,
        imageUri: permanentUri,  // file:// URI로 저장
        colorCount: difficulty.colors,
        difficulty: selectedDifficulty,
        gridColors: processedImage.gridColors,  // 격자별 색상 매핑 데이터
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>퍼즐 만들기</Text>
      </View>

      {/* Image Selection */}
      {sourceType !== 'sample' && (
        <View style={styles.imageSection}>
          {!selectedImage ? (
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="large" color="#A255FF" />
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
              <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
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
                {diff.colors}가지 색상
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#A255FF',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1B1F',
  },
  imageSection: {
    margin: 24,
  },
  imagePicker: {
    height: 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
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
    color: '#666',
    marginBottom: 8,
  },
  imagePickerButton: {
    fontSize: 14,
    color: '#A255FF',
    fontWeight: 'bold',
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
  },
  changeImageButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#5AB9EA',
    borderRadius: 8,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginBottom: 16,
  },
  difficultyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  difficultyCardSelected: {
    borderWidth: 2,
    backgroundColor: '#F5F5F5',
  },
  difficultyInfo: {
    flex: 1,
  },
  difficultyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginBottom: 4,
  },
  difficultyDesc: {
    fontSize: 13,
    color: '#666',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 40,
  },
  generateButton: {
    padding: 20,
    backgroundColor: '#A255FF',
    borderRadius: 16,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#CCC',
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
