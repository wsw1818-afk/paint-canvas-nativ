import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, StatusBar, Alert, InteractionManager, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadPuzzles, deletePuzzle, updatePuzzle } from '../utils/puzzleStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';

// 🐛 썸네일 이미지 컴포넌트 - 로드 실패 시 자동 fallback + 파일 존재 확인
function ThumbnailImage({ uri, fallbackUri, puzzleId, progress }) {
  const [currentUri, setCurrentUri] = useState(uri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 🐛 파일 존재 여부 확인 (file:// URI인 경우)
    const checkAndSetUri = async () => {
      if (uri?.startsWith('file://')) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (cancelled) return;
          if (!info.exists) {
            console.warn(`[GalleryScreen] ⚠️ 파일 없음 [${puzzleId}]:`, uri?.substring(0, 60));
            // 파일이 없으면 바로 fallback 사용
            if (fallbackUri && fallbackUri !== uri) {
              setCurrentUri(fallbackUri);
              setHasError(true);
              return;
            }
          }
        } catch (err) {
          if (cancelled) return;
          console.warn(`[GalleryScreen] ❌ 파일 체크 실패 [${puzzleId}]:`, err.message);
        }
      }
      if (cancelled) return;
      setCurrentUri(uri);
      setHasError(false);
    };

    checkAndSetUri();
    return () => { cancelled = true; };
  }, [uri, puzzleId, progress, fallbackUri]);

  const handleError = (e) => {
    console.warn(`[GalleryScreen] ❌ 썸네일 로드 실패 [${puzzleId}]:`, e.nativeEvent?.error);
    console.warn(`[GalleryScreen] ❌ 현재 URI:`, currentUri?.substring(0, 50));
    console.warn(`[GalleryScreen] ❌ fallbackUri:`, fallbackUri?.substring(0, 50));
    
    if (!hasError && fallbackUri && fallbackUri !== currentUri) {
      console.log(`[GalleryScreen] 🔄 fallback 사용 [${puzzleId}]:`, fallbackUri?.substring(0, 50) + '...');
      setCurrentUri(fallbackUri);
      setHasError(true);
    } else {
      console.warn('[GalleryScreen] ⚠️ 썸네일 로드 실패 (fallback 없음 또는 이미 시도함):', puzzleId);
    }
  };

  if (!currentUri) {
    console.warn(`[GalleryScreen] ⚠️ URI가 없음 [${puzzleId}]`);
    return <View style={[styles.thumbnailImage, { backgroundColor: SpotifyColors.backgroundElevated }]} />;
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={styles.thumbnailImage}
      resizeMode="cover"
      fadeDuration={0}
      onError={handleError}
    />
  );
}
import { showPuzzleSelectAd } from '../utils/adManager';
import { t, addLanguageChangeListener } from '../locales';
import TexturePickerModal from '../components/TexturePickerModal';
import { TEXTURES } from '../utils/textureStorage';
import { useFocusEffect } from '@react-navigation/native';

export default function GalleryScreen({ navigation }) {
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);  // 화면 전환 완료 여부
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [, forceUpdate] = useState(0);

  // 🎨 텍스처 선택 모달 상태
  const [showTextureModal, setShowTextureModal] = useState(false);
  const [pendingPuzzle, setPendingPuzzle] = useState(null);  // 텍스처 선택 후 시작할 퍼즐

  // 🐛 자동 복구 상태 (컴포넌트 최상단에 선언)
  const [repairQueue, setRepairQueue] = useState([]);  // 복구 대기열
  const isNavigatingRef = useRef(false);  // 네비게이션 중복 방지

  // 🌐 언어 변경 리스너
  useEffect(() => {
    const unsubscribe = addLanguageChangeListener(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

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

      // 🐛 격자선 버그 수정: completedImageUri 검증 및 복구
      const needsRepair = [];
      const validatedPuzzles = await Promise.all(
        savedPuzzles.map(async (puzzle) => {
          const progress = Math.round(puzzle.progress || 0);

          // Case 1: completedImageUri가 있지만 파일이 없는 경우
          if (puzzle.completedImageUri) {
            try {
              const info = await FileSystem.getInfoAsync(puzzle.completedImageUri);
              if (!info.exists) {
                console.warn(`[GalleryScreen] 🗑️ 완성 이미지 파일 없음 → 복구 대상 [${puzzle.id}]`);
                // DB도 업데이트
                updatePuzzle(puzzle.id, { completedImageUri: null }).catch(() => {});

                // 100% 완료된 퍼즐이면 자동 복구 대상에 추가
                if (progress >= 100) {
                  needsRepair.push({ ...puzzle, completedImageUri: null });
                }
                return { ...puzzle, completedImageUri: null };
              }
            } catch (err) {
              console.warn(`[GalleryScreen] ❌ 파일 체크 실패 [${puzzle.id}]:`, err.message);
            }
          }
          // Case 2: 100% 완료인데 completedImageUri가 아예 없는 경우
          else if (progress >= 100 && !puzzle.completedImageUri) {
            console.warn(`[GalleryScreen] 🔧 100% 완료 + 이미지 없음 → 복구 대상 [${puzzle.id}]`);
            needsRepair.push(puzzle);
          }

          return puzzle;
        })
      );

      setPuzzles(validatedPuzzles);

      // 🐛 자동 복구 대상이 있으면 대기열에 추가
      if (needsRepair.length > 0) {
        console.log(`[GalleryScreen] 🔧 자동 복구 대상 ${needsRepair.length}개 발견`);
        setRepairQueue(needsRepair);
      }

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

  // 🐛 자동 복구: 화면 포커스 시 복구 대기열 처리
  // ⚠️ 임시 비활성화 - 크래시 원인 파악 중
  // useFocusEffect(
  //   useCallback(() => {
  //     let interactionHandle = null;
  //
  //     // 복구 대기열이 있고, 네비게이션 중이 아닐 때만 실행
  //     if (repairQueue.length > 0 && !isNavigatingRef.current && !loading) {
  //       const puzzle = repairQueue[0];
  //       console.log('[GalleryScreen] 🔧 자동 복구 시작:', puzzle.id, '(남은', repairQueue.length + '개)');
  //
  //       isNavigatingRef.current = true;
  //
  //       // InteractionManager로 UI 렌더링 완료 후 실행 (크래시 방지)
  //       interactionHandle = InteractionManager.runAfterInteractions(function() {
  //         const completionMode = puzzle.completionMode || 'ORIGINAL';
  //         const textureUri = puzzle.textureUri || null;
  //
  //         // 대기열에서 제거
  //         setRepairQueue(function(prev) { return prev.slice(1); });
  //
  //         // Play 화면으로 이동 (자동 복구 모드)
  //         navigation.navigate('Play', {
  //           puzzleId: puzzle.id,
  //           imageUri: puzzle.imageUri || puzzle.imageBase64,
  //           colorCount: puzzle.colorCount,
  //           gridSize: puzzle.gridSize,
  //           gridColors: puzzle.gridColors,
  //           dominantColors: puzzle.dominantColors,
  //           completionMode: completionMode,
  //           textureUri: textureUri,
  //           isAutoRecapture: true
  //         });
  //       });
  //     }
  //
  //     // cleanup 함수 (단일 return)
  //     return function() {
  //       if (interactionHandle) {
  //         interactionHandle.cancel();
  //       }
  //       isNavigatingRef.current = false;
  //     };
  //   }, [repairQueue, loading, navigation])
  // );

  const handleDeletePuzzle = async (puzzle) => {
    Alert.alert(
      t('gallery.deleteTitle'),
      t('gallery.deleteMessage', { title: puzzle.title || 'Untitled' }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePuzzle(puzzle.id);
              await loadSavedPuzzles();
              Alert.alert(t('common.success'), t('gallery.deleteSuccess'));
            } catch (error) {
              console.error('퍼즐 삭제 실패:', error);
              Alert.alert(t('common.error'), t('common.error'));
            }
          }
        }
      ]
    );
  };

  const handleResetPuzzle = async (puzzle) => {
    Alert.alert(
      t('gallery.resetTitle'),
      t('gallery.resetMessage', {
        title: puzzle.title || t('gallery.untitled'),
        progress: Math.round(puzzle.progress || 0)
      }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('gallery.reset'),
          style: 'destructive',
          onPress: async () => {
            try {
              // 퍼즐 진행 상황 초기화
              await updatePuzzle(puzzle.id, {
                progress: 0,
                completed: false,
                completedAt: null,
                completedImageUri: null,
                progressThumbnailUri: null,
                lastPlayed: new Date().toISOString()
              });

              // 🔄 AsyncStorage의 게임 데이터 삭제 (PlayScreen에서 사용하는 키)
              const gameId = `puzzle_progress_${puzzle.id}`;
              await AsyncStorage.removeItem(gameId);
              console.log('[GalleryScreen] 🗑️ AsyncStorage 삭제:', gameId);

              // 목록 새로고침
              await loadSavedPuzzles();

              // 🎨 텍스처 선택 모달 표시 (새로 시작)
              setPendingPuzzle(puzzle);
              setShowTextureModal(true);
            } catch (error) {
              console.error('퍼즐 초기화 실패:', error);
              Alert.alert(t('common.error'), t('gallery.resetFailed'));
            }
          }
        }
      ]
    );
  };


  // 🎨 텍스처 선택 완료 핸들러
  const handleTextureSelect = useCallback((texture) => {
    console.log('[GalleryScreen] 🎨 handleTextureSelect 호출됨:', JSON.stringify({
      textureId: texture?.id,
      textureName: texture?.name,
      hasImage: !!texture?.image
    }));

    setShowTextureModal(false);
    if (pendingPuzzle) {
      // 🎨 갤러리 리셋 시: 항상 WEAVE 모드 (기본 텍스처 또는 사용자 선택 텍스처)
      // - 텍스처 '없음' 선택 → WEAVE + textureUri=null (Native 기본 텍스처 사용)
      // - 텍스처 선택 → WEAVE + textureUri (사용자 선택 텍스처 사용)
      // ※ 원본 이미지 모드(ORIGINAL)는 새 퍼즐 만들기에서만 선택 가능
      const completionMode = 'WEAVE';

      // 텍스처 URI 변환 (사용자가 텍스처를 선택한 경우에만)
      let textureUri = null;
      const hasUserTexture = texture && texture.id !== 'none' && texture.image;
      if (hasUserTexture) {
        const resolved = Image.resolveAssetSource(texture.image);
        console.log('[GalleryScreen] 🔍 resolveAssetSource 결과:', JSON.stringify(resolved));
        textureUri = resolved?.uri || null;
      }

      console.log('[GalleryScreen] 🎨 최종 파라미터:', JSON.stringify({
        completionMode,
        textureUri,
        puzzleId: pendingPuzzle?.id
      }));

      // 🎨 퍼즐 데이터에 텍스처 정보 저장 (다음에 이어할 때 사용)
      // textureSelected: true → 최초 텍스처 선택 완료 표시 (다음부터 모달 안 뜸)
      updatePuzzle(pendingPuzzle.id, {
        completionMode: completionMode,
        textureUri: textureUri,
        textureSelected: true  // 🎨 최초 텍스처 선택 완료 플래그
      }).catch(err => console.error('[GalleryScreen] ❌ 텍스처 정보 저장 실패:', err));

      showPuzzleSelectAd(() => {
        navigation.navigate('Play', {
          puzzleId: pendingPuzzle.id,
          imageUri: pendingPuzzle.imageUri || pendingPuzzle.imageBase64,
          colorCount: pendingPuzzle.colorCount,
          gridSize: pendingPuzzle.gridSize,
          gridColors: pendingPuzzle.gridColors,
          dominantColors: pendingPuzzle.dominantColors,
          completionMode: completionMode,
          textureUri: textureUri,
          isReset: true  // 🗑️ 리셋 플래그 (Native SharedPreferences 초기화)
        });
      });
      setPendingPuzzle(null);
    }
  }, [pendingPuzzle, navigation]);

  const getDifficultyInfo = (colors, gridSize) => {
    // 난이도 판별: 색상 수 + 격자 크기로 구분
    if (colors <= 16) return { name: t('gallery.difficultyEasy'), color: SpotifyColors.primary };      // 16색 이하 = 쉬움
    if (colors > 36 || gridSize >= 200) return { name: t('gallery.difficultyHard'), color: SpotifyColors.error };  // 36색 초과 또는 200×200 이상 = 어려움
    return { name: t('gallery.difficultyMedium'), color: SpotifyColors.warning };                         // 그 외 = 보통
  };

  // 📢 퍼즐 선택 핸들러 (3회마다 전면 광고)
  const handlePuzzleSelect = useCallback((puzzle, completionMode) => {
    // 🎨 최초 실행 시 텍스처 선택 모달 표시 (textureSelected 플래그로 판단)
    // - textureSelected가 없거나 false면 최초 실행 → 텍스처 선택 모달
    // - textureSelected가 true면 이미 선택됨 → 바로 플레이
    // ※ 초기화(리셋) 시에는 handleResetPuzzle에서 별도 처리
    if (!puzzle.textureSelected) {
      console.log('[GalleryScreen] 🎨 최초 실행 - 텍스처 선택 모달 표시:', puzzle.id);
      setPendingPuzzle(puzzle);
      setShowTextureModal(true);
      return;
    }

    // 🎨 저장된 textureUri 사용 (리셋 없이 이어하기)
    const textureUri = puzzle.textureUri || null;
    console.log('[GalleryScreen] 📌 퍼즐 선택:', puzzle.id, 'completionMode:', completionMode, 'textureUri:', textureUri);

    showPuzzleSelectAd(() => {
      navigation.navigate('Play', {
        puzzleId: puzzle.id,
        imageUri: puzzle.imageUri || puzzle.imageBase64,
        colorCount: puzzle.colorCount,
        gridSize: puzzle.gridSize,
        gridColors: puzzle.gridColors,
        dominantColors: puzzle.dominantColors,
        completionMode: completionMode,
        textureUri: textureUri
      });
    });
  }, [navigation]);

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
            <Text style={styles.title}>{t('gallery.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('gallery.itemCount', { count: puzzles.length })}</Text>
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
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          </View>
        ) : puzzles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyTitle}>{t('gallery.emptyTitle')}</Text>
            <Text style={styles.emptyDesc}>{t('gallery.emptyDesc')}</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
          {puzzles.map((puzzle) => {
            const difficultyInfo = getDifficultyInfo(puzzle.colorCount || 12, puzzle.gridSize || 120);
            const completionMode = puzzle.completionMode || 'ORIGINAL';
            const modeInfo = completionMode === 'ORIGINAL'
              ? { icon: '🖼️', name: t('gallery.modeOriginal'), color: '#FF6B6B' }
              : { icon: '🧶', name: t('gallery.modeWeave'), color: '#9B59B6' };

            // 썸네일 이미지 우선순위:
            // 1. 완성 이미지 (100% 완료된 퍼즐)
            // 2. 진행 썸네일 (색칠 진행 중인 상태)
            // 3. 최적화된 썸네일 (새로 생성된 퍼즐)
            // 4. 원본 이미지 (기존 퍼즐 하위 호환)
            const thumbnailUri = puzzle.completedImageUri
              ? puzzle.completedImageUri
              : puzzle.progressThumbnailUri
                ? puzzle.progressThumbnailUri
                : (puzzle.thumbnailUri || puzzle.imageUri || puzzle.imageBase64);

            // 🐛 디버깅: 어떤 타입의 이미지를 사용하는지 확인
            const imageType = puzzle.completedImageUri ? 'COMPLETED' 
              : puzzle.progressThumbnailUri ? 'PROGRESS' 
              : puzzle.thumbnailUri ? 'THUMBNAIL' 
              : puzzle.imageUri ? 'IMAGE' 
              : 'BASE64';
            
            if ((puzzle.progress || 0) >= 100) {
              console.log(`[GalleryScreen] 🔍 [${puzzle.id}] 타입: ${imageType}, completedImageUri: ${puzzle.completedImageUri ? '있음' : '없음'}, URI: ${thumbnailUri?.substring(0, 40)}...`);
            }

            // Fallback 이미지 우선순위 (completedImageUri 로드 실패 시 사용)
            const fallbackUri = puzzle.progressThumbnailUri
              || puzzle.thumbnailUri
              || puzzle.imageUri
              || puzzle.imageBase64;

            return (
              <View key={puzzle.id} style={styles.puzzleCard}>
                <TouchableOpacity
                  style={styles.puzzleCardContent}
                  onPress={() => handlePuzzleSelect(puzzle, completionMode)}
                >
                  {/* 이미지 썸네일 - WEAVE 모드면 위빙 미리보기, 아니면 원본 */}
                  <View style={styles.thumbnailContainer}>
                    <ThumbnailImage
                      key={`thumb-${puzzle.id}`}
                      uri={thumbnailUri}
                      fallbackUri={fallbackUri}
                      puzzleId={puzzle.id}
                      progress={puzzle.progress}
                    />
                    {/* 진행 썸네일이 없고 완성도가 100% 미만일 때만 음영 오버레이 표시 */}
                    {/* 🐛 버그 수정: 100% 완료된 퍼즐은 음영 표시 안함 (completedImageUri 유무와 관계없이) */}
                    {Math.round(puzzle.progress || 0) < 100 && !puzzle.progressThumbnailUri && (
                      <View style={styles.thumbnailShadowOverlay} />
                    )}
                  </View>

                  <View style={styles.puzzleInfo}>
                    <View style={styles.puzzleInfoHeader}>
                      <Text style={styles.puzzleTitle}>{puzzle.title || t('gallery.untitled')}</Text>
                      <View style={[styles.difficultyBadge, { backgroundColor: difficultyInfo.color }]}>
                        <Text style={styles.difficultyText}>{difficultyInfo.name}</Text>
                      </View>
                    </View>
                    <Text style={styles.puzzleSubtext}>{t('gallery.colorCount', { count: puzzle.colorCount })}</Text>
                    <View style={styles.infoRow}>
                      <View style={styles.modeInfo}>
                        <Text style={styles.modeIcon}>{modeInfo.icon}</Text>
                        <Text style={[styles.modeText, { color: modeInfo.color }]}>{modeInfo.name}</Text>
                      </View>
                      <View style={styles.progressInfo}>
                        <Text style={styles.progressText}>{t('gallery.progress', { percent: Math.round(puzzle.progress || 0) })}</Text>
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

      {/* 🎨 텍스처 선택 모달 */}
      <TexturePickerModal
        visible={showTextureModal}
        onClose={() => {
          // X 버튼으로 닫을 때: 모달만 닫고 아무것도 안 함 (취소)
          setShowTextureModal(false);
          setPendingPuzzle(null);
        }}
        onSelect={handleTextureSelect}
      />
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
  thumbnailContainer: {
    width: 100,
    height: 100,
    margin: SpotifySpacing.md,
    borderRadius: SpotifyRadius.md,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: SpotifyRadius.md,
    backgroundColor: SpotifyColors.backgroundElevated,
  },
  thumbnailShadowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: SpotifyRadius.md,
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
