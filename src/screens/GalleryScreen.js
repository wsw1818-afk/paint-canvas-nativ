import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { loadPuzzles, deletePuzzle, updatePuzzle } from '../utils/puzzleStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GalleryScreen({ navigation }) {
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedPuzzles();
  }, []);

  const loadSavedPuzzles = async () => {
    try {
      const savedPuzzles = await loadPuzzles();
      setPuzzles(savedPuzzles);
    } catch (error) {
      console.error('퍼즐 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePuzzle = async (puzzle) => {
    Alert.alert(
      '퍼즐 삭제',
      `"${puzzle.title || '제목 없음'}"을(를) 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 진행 상황이 함께 삭제됩니다.`,
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePuzzle(puzzle.id);
              await loadSavedPuzzles();
              Alert.alert('삭제 완료', '퍼즐이 삭제되었습니다.');
            } catch (error) {
              console.error('퍼즐 삭제 실패:', error);
              Alert.alert('오류', '삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleResetPuzzle = async (puzzle) => {
    Alert.alert(
      '진행 상황 초기화',
      `"${puzzle.title || '제목 없음'}"의 모든 진행 상황을 초기화하시겠습니까?\n\n현재 완성도: ${Math.round(puzzle.progress || 0)}%\n\n이 작업은 되돌릴 수 없습니다.`,
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            try {
              // 퍼즐 진행 상황 초기화
              await updatePuzzle(puzzle.id, {
                progress: 0,
                lastPlayed: new Date().toISOString()
              });

              // AsyncStorage의 게임 데이터 삭제
              const imageUri = puzzle.imageUri || puzzle.imageBase64;
              const gameId = `game_${imageUri.split('/').pop()}_${puzzle.gridSize}_${puzzle.colorCount}`;
              await AsyncStorage.removeItem(gameId);

              // 목록 새로고침
              await loadSavedPuzzles();

              Alert.alert('초기화 완료', '진행 상황이 초기화되었습니다.');
            } catch (error) {
              console.error('퍼즐 초기화 실패:', error);
              Alert.alert('오류', '초기화에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const getDifficultyInfo = (colors) => {
    if (colors <= 16) return { name: '쉬움', color: '#4CD964' };      // 16색 이하 = 쉬움
    if (colors <= 36) return { name: '보통', color: '#5AB9EA' };     // 36색 이하 = 보통
    if (colors <= 64) return { name: '어려움', color: '#FF5757' };  // 64색 이하 = 어려움
    return { name: '초고화질', color: '#9B59B6' };                    // 96색 = 초고화질
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#20B2AA', '#40E0D0', '#87CEEB']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>← 뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.title}>갤러리</Text>
            <Text style={styles.headerSubtitle}>나의 작품들</Text>
          </View>

          {/* Puzzle List */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>불러오는 중...</Text>
          </View>
        ) : puzzles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyTitle}>완료된 작품이 없습니다</Text>
            <Text style={styles.emptyDesc}>격자 적용된 퍼즐에서 작업을 완료하면 여기에 저장됩니다</Text>
          </View>
        ) : (
          puzzles.map((puzzle) => {
            const difficultyInfo = getDifficultyInfo(puzzle.colorCount || 12);
            const completionMode = puzzle.completionMode || 'ORIGINAL';
            const modeInfo = completionMode === 'ORIGINAL'
              ? { icon: '🖼️', name: '원본 이미지', color: '#FF6B6B' }
              : { icon: '🧶', name: '위빙 텍스처', color: '#9B59B6' };

            // 썸네일 이미지 우선순위:
            // 1. 완성된 이미지 (100% 완성 시 캡처한 결과물)
            // 2. WEAVE 모드면 위빙 미리보기
            // 3. 원본 이미지
            const thumbnailUri = puzzle.completedImageUri
              ? puzzle.completedImageUri
              : (completionMode === 'WEAVE' && puzzle.weavePreviewUri
                  ? puzzle.weavePreviewUri
                  : (puzzle.imageUri || puzzle.imageBase64));

            return (
              <View key={puzzle.id} style={styles.puzzleCard}>
                <TouchableOpacity
                  style={styles.puzzleCardContent}
                  onPress={() => navigation.navigate('Play', {
                    puzzleId: puzzle.id,  // 퍼즐 ID 전달 (완성도 업데이트용)
                    imageUri: puzzle.imageUri || puzzle.imageBase64,  // file:// URI 전달 (하위 호환성 유지)
                    colorCount: puzzle.colorCount,
                    gridSize: puzzle.gridSize,  // 난이도별 격자 크기
                    gridColors: puzzle.gridColors,
                    dominantColors: puzzle.dominantColors,  // 이미지에서 추출한 실제 색상
                    completionMode: completionMode  // 완성 모드 (기본: 원본 이미지)
                  })}
                >
                  {/* 이미지 썸네일 - WEAVE 모드면 위빙 미리보기, 아니면 원본 */}
                  <Image
                    source={{ uri: thumbnailUri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />

                  <View style={styles.puzzleInfo}>
                    <View style={styles.puzzleInfoHeader}>
                      <Text style={styles.puzzleTitle}>{puzzle.title || '제목 없음'}</Text>
                      <View style={[styles.difficultyBadge, { backgroundColor: difficultyInfo.color }]}>
                        <Text style={styles.difficultyText}>{difficultyInfo.name}</Text>
                      </View>
                    </View>
                    <Text style={styles.puzzleSubtext}>{puzzle.colorCount}가지 색상</Text>
                    <View style={styles.infoRow}>
                      <View style={styles.modeInfo}>
                        <Text style={styles.modeIcon}>{modeInfo.icon}</Text>
                        <Text style={[styles.modeText, { color: modeInfo.color }]}>{modeInfo.name}</Text>
                      </View>
                      <View style={styles.progressInfo}>
                        <Text style={styles.progressText}>완성도: {Math.round(puzzle.progress || 0)}%</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => handleResetPuzzle(puzzle)}
                  >
                    <Text style={styles.resetButtonText}>🔄</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeletePuzzle(puzzle)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  puzzleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  puzzleCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: 120,
    height: 120,
    borderRadius: 14,
    margin: 12,
    backgroundColor: '#E0E0E0',
  },
  actionButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingRight: 8,
  },
  resetButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 22,
  },
  deleteButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 22,
  },
  puzzleInfo: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 8,
  },
  puzzleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  puzzleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  puzzleSubtext: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2C3E50',
  },
});
