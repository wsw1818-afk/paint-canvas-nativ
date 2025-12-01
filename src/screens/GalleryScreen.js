import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, StatusBar, Alert, InteractionManager, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadPuzzles, deletePuzzle, updatePuzzle } from '../utils/puzzleStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';

export default function GalleryScreen({ navigation }) {
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);  // 화면 전환 완료 여부
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 🚀 화면 전환 애니메이션 완료 후 데이터 로딩 (초기 지연 해결)
  useEffect(() => {
    // 즉시 ready 상태로 전환하여 UI 먼저 표시
    setReady(true);

    // 화면 전환 애니메이션 완료 후 데이터 로딩
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      loadSavedPuzzles();
    });

    return () => interactionPromise.cancel();
  }, []);

  const loadSavedPuzzles = async () => {
    try {
      const savedPuzzles = await loadPuzzles();
      setPuzzles(savedPuzzles);

      // 데이터 로드 완료 후 페이드인 애니메이션
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
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

  const getDifficultyInfo = (colors, gridSize) => {
    // 난이도 판별: 색상 수 + 격자 크기로 구분
    if (colors <= 16) return { name: '쉬움', color: SpotifyColors.primary };      // 16색 이하 = 쉬움
    if (colors > 36 || gridSize >= 200) return { name: '어려움', color: SpotifyColors.error };  // 36색 초과 또는 200×200 이상 = 어려움
    return { name: '보통', color: SpotifyColors.warning };                         // 그 외 = 보통
  };

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
            <Text style={styles.title}>갤러리</Text>
            <Text style={styles.headerSubtitle}>{puzzles.length}개의 작품</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

          {/* Puzzle List */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          // 🎯 스켈레톤 플레이스홀더 - 즉각적인 UI 반응
          <View>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonImage} />
                <View style={styles.skeletonInfo}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonSubtext} />
                  <View style={styles.skeletonProgress} />
                </View>
              </View>
            ))}
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>불러오는 중...</Text>
            </View>
          </View>
        ) : puzzles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyTitle}>완료된 작품이 없습니다</Text>
            <Text style={styles.emptyDesc}>격자 적용된 퍼즐에서 작업을 완료하면 여기에 저장됩니다</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
          {puzzles.map((puzzle) => {
            const difficultyInfo = getDifficultyInfo(puzzle.colorCount || 12, puzzle.gridSize || 120);
            const completionMode = puzzle.completionMode || 'ORIGINAL';
            const modeInfo = completionMode === 'ORIGINAL'
              ? { icon: '🖼️', name: '원본 이미지', color: '#FF6B6B' }
              : { icon: '🧶', name: '위빙 텍스처', color: '#9B59B6' };

            // 썸네일 이미지 우선순위:
            // 1. 진행 썸네일 (색칠 진행 중인 상태)
            // 2. 최적화된 썸네일 (새로 생성된 퍼즐)
            // 3. 원본 이미지 (기존 퍼즐 하위 호환)
            const thumbnailUri = puzzle.progressThumbnailUri
              ? puzzle.progressThumbnailUri
              : (puzzle.thumbnailUri || puzzle.imageUri || puzzle.imageBase64);

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
          })}
          </Animated.View>
        )}
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
  headerSubtitle: {
    fontSize: SpotifyFonts.xs,
    color: SpotifyColors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SpotifySpacing.base,
    paddingBottom: SpotifySpacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    backgroundColor: SpotifyColors.backgroundLight,
    marginHorizontal: SpotifySpacing.base,
    borderRadius: SpotifyRadius.lg,
    padding: SpotifySpacing.xxl,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: SpotifySpacing.base,
  },
  emptyTitle: {
    fontSize: SpotifyFonts.xl,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    marginBottom: SpotifySpacing.sm,
  },
  emptyDesc: {
    fontSize: SpotifyFonts.base,
    color: SpotifyColors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: SpotifyFonts.base,
    color: SpotifyColors.textSecondary,
    marginLeft: SpotifySpacing.sm,
  },
  puzzleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    overflow: 'hidden',
  },
  puzzleCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: 100,
    height: 100,
    borderRadius: SpotifyRadius.md,
    margin: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  actionButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingRight: SpotifySpacing.sm,
  },
  resetButton: {
    padding: SpotifySpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    padding: SpotifySpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
  },
  puzzleInfo: {
    flex: 1,
    paddingVertical: SpotifySpacing.md,
    paddingRight: SpotifySpacing.sm,
  },
  puzzleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SpotifySpacing.xs,
  },
  puzzleTitle: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
    flex: 1,
    marginRight: SpotifySpacing.sm,
  },
  difficultyBadge: {
    paddingHorizontal: SpotifySpacing.sm,
    paddingVertical: SpotifySpacing.xs,
    borderRadius: SpotifyRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyText: {
    fontSize: SpotifyFonts.xs,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
  },
  puzzleSubtext: {
    fontSize: SpotifyFonts.sm,
    color: SpotifyColors.textSecondary,
    marginBottom: SpotifySpacing.sm,
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
    fontSize: 12,
    marginRight: 4,
  },
  modeText: {
    fontSize: SpotifyFonts.xs,
    fontWeight: SpotifyFonts.semiBold,
  },
  progressInfo: {
    backgroundColor: SpotifyColors.backgroundElevated,
    paddingHorizontal: SpotifySpacing.sm,
    paddingVertical: SpotifySpacing.xs,
    borderRadius: SpotifyRadius.sm,
  },
  progressText: {
    fontSize: SpotifyFonts.xs,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.primary,
  },
  // 스켈레톤 로딩 스타일
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SpotifySpacing.md,
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    padding: SpotifySpacing.md,
  },
  skeletonImage: {
    width: 100,
    height: 100,
    borderRadius: SpotifyRadius.md,
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  skeletonInfo: {
    flex: 1,
    marginLeft: SpotifySpacing.base,
  },
  skeletonTitle: {
    width: '70%',
    height: 16,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.sm,
    marginBottom: SpotifySpacing.md,
  },
  skeletonSubtext: {
    width: '50%',
    height: 12,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.sm,
    marginBottom: SpotifySpacing.md,
  },
  skeletonProgress: {
    width: '40%',
    height: 12,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.sm,
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SpotifySpacing.base,
  },
});
