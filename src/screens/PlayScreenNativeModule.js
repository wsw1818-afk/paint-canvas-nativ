import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, useWindowDimensions, ActivityIndicator, PixelRatio, InteractionManager, Alert, Image, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaintCanvasView, captureCanvas, captureThumbnail, getMinimapImage, setViewportPosition, clearProgressForGame } from 'paint-canvas-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { updatePuzzle, getPuzzleById } from '../utils/puzzleStorage';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { showPuzzleCompleteAd, showBackNavigationAd } from '../utils/adManager';
import { t, addLanguageChangeListener } from '../locales';
import { addPoints, getPuzzleCost } from '../utils/pointsStorage';
import { getTextureById } from '../utils/textureStorage';

// 🎯 광고 ID 설정
// - 정식 ID (플레이스토어): 'ca-app-pub-8246295829048098/7057199542'
// - 테스트 ID: 'ca-app-pub-3940256099942544/6300978111'
// - 비활성화: null
const adUnitId = null;  // 개발자 테스트용 - 광고 비활성화

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 🎨 팔레트 버튼 크기 계산 (화면 너비 기반)
// 화면 너비 - 패딩(16) - 되돌리기버튼(34) - gap(4) - 팔레트패딩(8*2)
// 한 줄에 9개 버튼, gap 2px
const PALETTE_AVAILABLE_WIDTH = SCREEN_WIDTH - 16 - 34 - 4 - 16;
const BUTTONS_PER_ROW = 9;
const BUTTON_GAP = 2;
const COLOR_BUTTON_SIZE = Math.floor((PALETTE_AVAILABLE_WIDTH - (BUTTONS_PER_ROW - 1) * BUTTON_GAP) / BUTTONS_PER_ROW);

// 🖼️ 로딩 화면 이미지
const loadingImage = require('../../assets/loading-image.png');

// ⚡ 최적화: 색상 버튼 컴포넌트 분리 (memo로 불필요한 리렌더링 방지)
const ColorButton = memo(({ color, isSelected, onSelect, luminance, isCompleted, tabletSize }) => {
  const textColor = luminance > 128 ? '#000' : '#FFF';
  const shadowColor = luminance > 128 ? '#FFF' : '#000';
  // 🐛 태블릿용 크기 오버라이드
  const sizeOverride = tabletSize ? { width: tabletSize, height: tabletSize } : null;
  const fontOverride = tabletSize ? { fontSize: tabletSize > 28 ? 11 : 9 } : null;

  return (
    <TouchableOpacity
      style={[
        colorButtonStyles.button,
        sizeOverride,
        { backgroundColor: color.hex },
        isSelected && colorButtonStyles.selected,
        isCompleted && colorButtonStyles.completed
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* 완료된 색상은 라벨 숨김, 원색만 표시 */}
      {!isCompleted && (
        <Text style={[colorButtonStyles.id, { color: textColor, textShadowColor: shadowColor }, fontOverride]}>
          {color.id}
        </Text>
      )}
      {/* 완료 표시 (체크마크) */}
      {isCompleted && (
        <Text style={[colorButtonStyles.checkmark, { color: textColor, textShadowColor: shadowColor }, fontOverride]}>
          ✓
        </Text>
      )}
    </TouchableOpacity>
  );
}, (prev, next) => {
  // isSelected, isCompleted 변경 시에만 리렌더링
  return prev.isSelected === next.isSelected &&
         prev.color.id === next.color.id &&
         prev.isCompleted === next.isCompleted &&
         prev.tabletSize === next.tabletSize;
});

const colorButtonStyles = StyleSheet.create({
  button: {
    width: COLOR_BUTTON_SIZE,
    height: COLOR_BUTTON_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  selected: {
    borderColor: '#FFD700',
    borderWidth: 4,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  completed: {
    opacity: 0.7,
    borderColor: '#4CD964',
    borderWidth: 2,
  },
  id: {
    fontSize: 12,
    fontWeight: 'bold',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});

// 색상 팔레트 (64색 지원 - 2자리 라벨 사용)
// 1~36: 단일 문자 (A-Z, 0-9)
// 37~64: 2자리 라벨 (a1~z9)
const COLOR_PALETTE = [
  // 1~26: A-Z
  { id: 'A', hex: '#FF5757', name: '빨강' },
  { id: 'B', hex: '#4CD964', name: '초록' },
  { id: 'C', hex: '#5AB9EA', name: '파랑' },
  { id: 'D', hex: '#8B4513', name: '갈색' },
  { id: 'E', hex: '#A255FF', name: '보라' },
  { id: 'F', hex: '#FFD700', name: '골드' },
  { id: 'G', hex: '#32CD32', name: '라임' },
  { id: 'H', hex: '#00D4AA', name: '청록' },
  { id: 'I', hex: '#FF9500', name: '주황' },
  { id: 'J', hex: '#6B8E23', name: '올리브' },
  { id: 'K', hex: '#8FBC8F', name: '다크시그린' },
  { id: 'L', hex: '#20B2AA', name: '라이트시그린' },
  { id: 'M', hex: '#B0B0B0', name: '회색' },
  { id: 'N', hex: '#9ACD32', name: '옐로우그린' },
  { id: 'O', hex: '#DC143C', name: '크림슨' },
  { id: 'P', hex: '#4B0082', name: '인디고' },
  { id: 'Q', hex: '#2F4F4F', name: '다크슬레이트' },
  { id: 'R', hex: '#D2691E', name: '초콜릿' },
  { id: 'S', hex: '#228B22', name: '포레스트그린' },
  { id: 'T', hex: '#40E0D0', name: '터키석' },
  { id: 'U', hex: '#EE82EE', name: '바이올렛' },
  { id: 'V', hex: '#C0C0C0', name: '실버' },
  { id: 'W', hex: '#FFFFFF', name: '흰색' },
  { id: 'X', hex: '#FFB6C1', name: '라이트핑크' },
  { id: 'Y', hex: '#FFFFE0', name: '라이트옐로우' },
  { id: 'Z', hex: '#98FB98', name: '페일그린' },
  // 27~36: 0-9
  { id: '1', hex: '#FFC0CB', name: '핑크' },
  { id: '2', hex: '#DDA0DD', name: '플럼' },
  { id: '3', hex: '#87CEEB', name: '스카이블루' },
  { id: '4', hex: '#F0E68C', name: '카키' },
  { id: '5', hex: '#E6E6FA', name: '라벤더' },
  { id: '6', hex: '#90EE90', name: '라이트그린' },
  { id: '7', hex: '#FA8072', name: '연어' },
  { id: '8', hex: '#DEB887', name: '버릴우드' },
  { id: '9', hex: '#5F9EA0', name: '카뎃블루' },
  { id: '0', hex: '#191970', name: '미드나잇블루' },
  // 37~64: 2자리 라벨 (a1~z9) - 추가 28색
  { id: 'a1', hex: '#FF6B6B', name: '코랄레드' },
  { id: 'a2', hex: '#4ECDC4', name: '민트' },
  { id: 'a3', hex: '#45B7D1', name: '스카이' },
  { id: 'a4', hex: '#96CEB4', name: '세이지' },
  { id: 'a5', hex: '#FFEAA7', name: '바나나' },
  { id: 'a6', hex: '#DFE6E9', name: '클라우드' },
  { id: 'a7', hex: '#FDA7DF', name: '핑크버블' },
  { id: 'a8', hex: '#A29BFE', name: '페리윙클' },
  { id: 'b1', hex: '#6C5CE7', name: '일렉트릭퍼플' },
  { id: 'b2', hex: '#00B894', name: '민트그린' },
  { id: 'b3', hex: '#E17055', name: '테라코타' },
  { id: 'b4', hex: '#FDCB6E', name: '선플라워' },
  { id: 'b5', hex: '#E84393', name: '핫핑크' },
  { id: 'b6', hex: '#00CEC9', name: '로빈스에그' },
  { id: 'b7', hex: '#FF7675', name: '살몬핑크' },
  { id: 'b8', hex: '#74B9FF', name: '베이비블루' },
  { id: 'c1', hex: '#55EFC4', name: '아쿠아마린' },
  { id: 'c2', hex: '#81ECEC', name: '터키스' },
  { id: 'c3', hex: '#FAB1A0', name: '피치' },
  { id: 'c4', hex: '#FF9FF3', name: '바이올렛핑크' },
  { id: 'c5', hex: '#54A0FF', name: '도저블루' },
  { id: 'c6', hex: '#5F27CD', name: '로얄퍼플' },
  { id: 'c7', hex: '#00D2D3', name: '틸' },
  { id: 'c8', hex: '#FF6F61', name: '리빙코랄' },
  { id: 'd1', hex: '#9B59B6', name: '아메시스트' },
  { id: 'd2', hex: '#3498DB', name: '피터리버' },
  { id: 'd3', hex: '#1ABC9C', name: '그린씨' },
  { id: 'd4', hex: '#F39C12', name: '오렌지' },
];

export default function PlayScreenNativeModule({ route, navigation }) {
  const { puzzleId, imageUri, colorCount = 36, gridSize: paramGridSize, gridColors, dominantColors: paramDominantColors, completionMode: paramCompletionMode, isReset, textureUri: paramTextureUri, isAutoRecapture } = route.params || {};
  const gridSize = paramGridSize || 250; // 기본 250x250 격자 (높은 난이도, 많은 셀)
  const completionMode = paramCompletionMode || 'ORIGINAL'; // 완성 모드 (ORIGINAL: 원본 이미지, WEAVE: 위빙 텍스처)

  // 🔍 디버그 로그
  console.log('[PlayScreen] 🚀 시작 - isReset:', isReset, 'completionMode:', completionMode, 'textureUri:', paramTextureUri, 'isAutoRecapture:', isAutoRecapture);
  const { width, height } = useWindowDimensions();

  // 🎨 색상 밝기 계산 함수 (힌트 패널 텍스트 색상용)
  const getLuminance = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  // 64색까지 고유 라벨 생성 함수
  const generateLabel = (idx) => {
    if (idx < 36) {
      // 0-35: COLOR_PALETTE에서 가져옴
      return COLOR_PALETTE[idx]?.id || String.fromCharCode(65 + idx);
    }
    // 36-63: 2자리 라벨 (a1, a2, ..., d4)
    const group = Math.floor((idx - 36) / 8); // 0=a, 1=b, 2=c, 3=d
    const num = (idx - 36) % 8 + 1; // 1-8
    return `${String.fromCharCode(97 + group)}${num}`; // a1, a2, ..., d4
  };

  // 실제 이미지에서 추출한 색상 사용 (없으면 기본 팔레트 사용)
  const actualColors = useMemo(() => {
    if (paramDominantColors && paramDominantColors.length > 0) {
      // 이미지에서 추출한 색상을 팔레트 형식으로 변환 (64색까지 고유 라벨 지원)
      const colors = paramDominantColors.map((color, idx) => ({
        id: COLOR_PALETTE[idx]?.id || generateLabel(idx),
        hex: color.hex,
        name: color.name || `색상 ${idx + 1}`
      }));
      console.log('[팔레트] actualColors 생성:', colors.length, '색,', colors.slice(0, 5).map(c => `${c.id}=${c.hex}`).join(', '), '...');
      return colors;
    }
    return COLOR_PALETTE.slice(0, colorCount);
  }, [paramDominantColors, colorCount]);

  const [selectedColor, setSelectedColor] = useState(null); // 초기값 null로 변경
  const [score, setScore] = useState(60);
  const [filledCells, setFilledCells] = useState(new Set());
  const [wrongCells, setWrongCells] = useState(new Set()); // 잘못 칠한 셀 추적
  const [everWrongCells, setEverWrongCells] = useState(new Set()); // 한 번이라도 틀린 셀 (재색칠 시 점수 X)
  const [undoMode, setUndoMode] = useState(false); // 고치기 모드
  const [viewDimensions, setViewDimensions] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }); // 전체 화면 크기 (dp)
  // 🔍 디버그 로그 상태 (프로덕션에서는 비활성화)
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(__DEV__ ? false : false); // 기본 비활성화 (성능)

  // 🗺️ 미니맵 상태
  const [showMinimap, setShowMinimap] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [minimapImage, setMinimapImage] = useState(null);
  const minimapUpdateRef = useRef(null);

  // 🎯 남은 셀 힌트 상태
  const [showRemainingHint, setShowRemainingHint] = useState(false);

  // 🎨 텍스처 (갤러리에서 선택하여 전달받음)
  const textureUri = paramTextureUri || null;

  // 📢 뒤로가기 핸들러 (5회마다 전면 광고)
  // 🐛 버그 수정: 뒤로가기 전 진행 상황 즉시 저장 (디바운스 3초 내 데이터 손실 방지)
  const handleBackPress = useCallback(() => {
    // 저장 디바운스 타이머가 있으면 취소하고 즉시 저장
    if (saveProgressRef.current) {
      clearTimeout(saveProgressRef.current);
      saveProgressRef.current = null;
    }
    // 포인트 배치 저장도 즉시 처리
    if (pointsFlushTimerRef.current) {
      clearTimeout(pointsFlushTimerRef.current);
      const points = pendingPointsRef.current;
      if (points > 0) {
        pendingPointsRef.current = 0;
        addPoints(points).catch(() => {});
      }
    }
    showBackNavigationAd(() => {
      navigation.goBack();
    });
  }, [navigation]);

  // ✨ 되돌리기 버튼 반짝임 애니메이션
  const undoPulseAnim = useRef(new Animated.Value(1)).current;
  // 🗺️ 미니맵 틀린 셀 깜빡임 애니메이션
  const wrongCellFlashAnim = useRef(new Animated.Value(0)).current;

  // 고유 게임 ID (puzzleId 기반) - 일관된 저장/복원을 위해 puzzleId 사용
  // puzzleId가 없으면 imageUri 기반으로 폴백 (하위 호환성)
  const gameId = useMemo(() => {
    if (puzzleId) {
      return `puzzle_progress_${puzzleId}`;
    }
    if (!imageUri) return null;
    // 폴백: 파일명에서 확장자 제거
    const fileName = imageUri.split('/').pop()?.split('.')[0] || '';
    return `native_${fileName}_${gridSize}`;
  }, [puzzleId, imageUri, gridSize]);

  // 🗑️ 리셋 시 Native SharedPreferences 삭제 (View 생성 전에 호출)
  useEffect(() => {
    if (isReset && gameId) {
      console.log('[PlayScreen] 🗑️ 리셋 모드 - Native SharedPreferences 삭제:', gameId);
      clearProgressForGame(gameId);
    }
  }, [isReset, gameId]);

  // 폴드7 접힘/펼침 감지
  // 접힘: 884 x 2208 (가로)
  // 펼침: 1768 x 2208 (가로)
  // 가로가 1200 이상이면 태블릿 모드
  const isTablet = width >= 1200;

  // 🐛 태블릿 팔레트 버튼 크기 (펼침 화면에서 버튼이 넘치는 문제 수정)
  const TABLET_PALETTE_WIDTH = 80;
  const TABLET_BUTTON_SIZE = 32;  // 태블릿용 고정 버튼 크기

  // 캔버스 크기 계산 - 최대화
  // 태블릿: 높이 우선 (헤더 제외), 너비는 툴바+팔레트 제외
  // 모바일: 헤더 + 팔레트 제외, 최소 여백으로 최대 크기 확보
  const HEADER_HEIGHT = 44; // 헤더 높이 (패딩 6×2 + 테두리 + 내용)
  const PALETTE_AREA_HEIGHT = 132; // 팔레트 영역 전체 (버튼 32×3 + 간격 4×2 + 패딩 6+18 + 테두리 1)

  const canvasSize = isTablet
    ? Math.min(height - HEADER_HEIGHT - 8, width - TABLET_PALETTE_WIDTH - 80) // 태블릿: 팔레트+툴바 공간 제외
    : Math.min(
        width - 8, // 좌우 여백 최소화 (12 → 8)
        height - HEADER_HEIGHT - PALETTE_AREA_HEIGHT - 4 // 안전 여백 최소화 (8 → 4)
      );


  // selectedColor 초기화 (actualColors가 준비되면)
  useEffect(() => {
    if (actualColors.length > 0 && selectedColor === null) {
      setSelectedColor(actualColors[0]);
    }
  }, [actualColors, selectedColor]);

  // ⚡ 셀 데이터 비동기 생성 (UI 블로킹 방지)
  const [cells, setCells] = useState([]);
  const [isCellsReady, setIsCellsReady] = useState(false);
  // 🎨 각 색상별 전체 셀 개수 (라벨 → 개수)
  const [colorCellCounts, setColorCellCounts] = useState({});

  useEffect(() => {
    if (actualColors.length === 0) return;

    // ⚡ 최적화: requestAnimationFrame으로 더 빠르게 시작 (InteractionManager 대기 제거)
    const rafId = requestAnimationFrame(() => {
      const startTime = Date.now();
      if (__DEV__) {
        console.log('[셀생성] 시작:', { gridSize, colorCount, actualColorsCount: actualColors.length });
      }

      const totalCells = gridSize * gridSize;
      const cellList = new Array(totalCells);
      const actualColorsLength = actualColors.length;
      const hasGridColors = gridColors && gridColors.length > 0;

      // 🎨 색상별 셀 개수 카운트
      const cellCounts = {};

      // ⚡ 최적화: colorMap 제거, 직접 접근
      // ⚡ 루프 최적화: 조건문 최소화
      for (let idx = 0; idx < totalCells; idx++) {
        const row = (idx / gridSize) | 0;
        const col = idx % gridSize;

        let colorIndex;
        if (hasGridColors && gridColors[row]?.[col] !== undefined) {
          colorIndex = gridColors[row][col] % actualColorsLength;
        } else {
          colorIndex = idx % actualColorsLength;
        }

        const color = actualColors[colorIndex];
        const label = color?.id || 'A';
        cellList[idx] = {
          row,
          col,
          targetColorHex: color?.hex || '#FFFFFF',
          label,
        };

        // 색상별 셀 개수 증가
        cellCounts[label] = (cellCounts[label] || 0) + 1;
      }

      if (__DEV__) {
        console.log('[셀생성] 완료:', totalCells, '개 셀,', Date.now() - startTime, 'ms');
        console.log('[색상별 셀 개수]:', Object.keys(cellCounts).length, '색상');
      }

      setCells(cellList);
      setColorCellCounts(cellCounts);
      setIsCellsReady(true);
    });

    return () => cancelAnimationFrame(rafId);
  }, [gridSize, colorCount, gridColors, actualColors]);

  // 저장된 진행 상황 불러오기
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  // 🚀 Native 캔버스 초기화 완료 상태 (이미지 + 진행상황 로딩)
  const [isNativeReady, setIsNativeReady] = useState(false);

  useEffect(() => {
    const loadProgress = async () => {
      if (gameId) {
        try {
          const savedData = await AsyncStorage.getItem(gameId);
          if (savedData) {
            const { filledCells: saved, score: savedScore, wrongCells: savedWrong, everWrongCells: savedEverWrong } = JSON.parse(savedData);
            setFilledCells(new Set(saved));
            setWrongCells(new Set(savedWrong || []));
            setEverWrongCells(new Set(savedEverWrong || savedWrong || [])); // 기존 wrongCells로 폴백
            setScore(savedScore || 60);
          }
        } catch (error) {
          console.error('Failed to load progress:', error);
        }
      }
      setIsCanvasReady(true);
    };

    loadProgress();
  }, [gameId]);

  // 진행 상황 저장 (더 긴 디바운스 - 성능 최적화)
  const saveProgressRef = useRef(null);
  const filledCellsRef = useRef(filledCells);
  const wrongCellsRef = useRef(wrongCells);
  const everWrongCellsRef = useRef(everWrongCells);
  const scoreRef = useRef(score);

  // ⚡ 포인트 배치 처리 (매 색칠마다 AsyncStorage 호출 방지)
  const pendingPointsRef = useRef(0);
  const pointsFlushTimerRef = useRef(null);

  // Ref 업데이트 (리렌더링 없이)
  useEffect(() => {
    filledCellsRef.current = filledCells;
    wrongCellsRef.current = wrongCells;
    everWrongCellsRef.current = everWrongCells;
    scoreRef.current = score;
  }, [filledCells, wrongCells, everWrongCells, score]);

  // ⚡ 포인트 배치 저장 (3초 디바운스 + InteractionManager)
  useEffect(() => {
    if (pendingPointsRef.current > 0) {
      if (pointsFlushTimerRef.current) {
        clearTimeout(pointsFlushTimerRef.current);
      }
      pointsFlushTimerRef.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          const points = pendingPointsRef.current;
          if (points > 0) {
            pendingPointsRef.current = 0;
            addPoints(points).catch(() => {}); // 에러 로그 제거
          }
        });
      }, 3000); // ⚡ 2초 → 3초
    }
    return () => {
      if (pointsFlushTimerRef.current) {
        clearTimeout(pointsFlushTimerRef.current);
      }
    };
  }, [filledCells.size]);

  // 🖼️ 100% 완성 시 캡처 및 저장 (한 번만 실행)
  const hasCompletedRef = useRef(false);

  const captureAndSaveCompletion = useCallback(async () => {
    if (hasCompletedRef.current || !puzzleId) return;
    hasCompletedRef.current = true;

    console.log('🎉 100% 완성! 캔버스 캡처 시작...');
    console.log('[captureAndSaveCompletion] puzzleId:', puzzleId);
    console.log('[captureAndSaveCompletion] filledCells.size:', filledCells?.size);
    console.log('[captureAndSaveCompletion] gridSize:', gridSize);
    console.log('[captureAndSaveCompletion] totalCells:', gridSize * gridSize);

    try {
      // Native 캡처 호출 (512x512 PNG)
      console.log('[captureAndSaveCompletion] captureCanvas(512) 호출...');
      const base64Image = captureCanvas(512);
      console.log('[captureAndSaveCompletion] captureCanvas 결과:', base64Image ? `Base64 length: ${base64Image.length}` : 'null');

      if (base64Image) {
        // Base64를 파일로 저장
        const timestamp = Date.now();
        const fileName = `completed_${puzzleId}_${timestamp}.png`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, base64Image, {
          encoding: FileSystem.EncodingType.Base64
        });

        console.log('✅ 완성 이미지 저장 완료:', fileUri);

        // 퍼즐 데이터에 완성 이미지 URI 저장
        await updatePuzzle(puzzleId, {
          completedImageUri: fileUri,
          progress: 100,
          completed: true,
          completedAt: new Date().toISOString()
        });

        // 🎁 완성 보상: 퍼즐 제작 비용의 1/4 × 점수 비율
        const puzzleCost = getPuzzleCost(colorCount);
        const baseReward = Math.floor(puzzleCost / 4);

        // 최대 점수 계산: 초기 60점 + (전체 셀 수 × 10점)
        const totalCells = gridSize * gridSize;
        const maxScore = 60 + (totalCells * 10);
        const currentScore = scoreRef.current;

        // 점수 비율 계산 (10% 단위로 내림)
        // 100% = 100%, 90~99% = 90%, 80~89% = 80%, ...
        const scorePercent = Math.floor((currentScore / maxScore) * 10) * 10;
        // 🐛 최소 10% 보장 (100% 완료했는데 보상 0 방지)
        const scoreMultiplier = Math.max(10, Math.min(100, scorePercent)) / 100;

        // 최종 보상 = 기본 보상 × 점수 비율
        const completionReward = Math.floor(baseReward * scoreMultiplier);
        await addPoints(completionReward);
        console.log(`🎁 완성 보상: +${completionReward}P (기본 ${baseReward}P × ${scorePercent}% 점수)`);
        console.log(`   점수: ${currentScore}/${maxScore} (${Math.floor((currentScore / maxScore) * 100)}%)`);

        // 🐛 자동 복구 모드: 캡처 완료 후 갤러리로 자동 복귀 (광고, 알림 생략)
        if (isAutoRecapture) {
          console.log('[PlayScreen] 🔧 자동 복구 완료 → 갤러리로 복귀');
          navigation.goBack();
          return;
        }

        // 📢 퍼즐 완료 시 전면 광고 표시 후 알림
        showPuzzleCompleteAd(() => {
          Alert.alert(
            t('play.completeTitle'),
            t('play.completeMessage', { reward: completionReward, percent: scorePercent }),
            [{ text: t('common.confirm'), style: 'default' }]
          );
        });
      } else {
        console.warn('⚠️ 캔버스 캡처 실패 (null 반환)');
        // 🐛 자동 복구 모드: 캡처 실패해도 갤러리로 복귀 (다음 기회에 다시 시도)
        if (isAutoRecapture) {
          console.warn('[PlayScreen] ⚠️ 자동 복구 실패 → 갤러리로 복귀');
          navigation.goBack();
          return;
        }
      }
    } catch (error) {
      console.error('❌ 완성 이미지 캡처/저장 실패:', error);
      hasCompletedRef.current = false; // 재시도 가능하도록
      // 🐛 자동 복구 모드: 에러 발생해도 갤러리로 복귀
      if (isAutoRecapture) {
        console.error('[PlayScreen] ❌ 자동 복구 에러 → 갤러리로 복귀');
        navigation.goBack();
        return;
      }
    }
  }, [puzzleId, isAutoRecapture, navigation]);

  // 🖼️ 진행 썸네일 캡처 (갤러리에서 진행 상황 표시용)
  // 원본 이미지 위에 색칠된 부분만 오버레이 (참조 앱 스타일)
  // ⚡ 최적화: 30초 간격 + InteractionManager로 터치 방해 방지
  const lastThumbnailCaptureRef = useRef(0);
  const THUMBNAIL_CAPTURE_INTERVAL = 30000; // ⚡ 10초 → 30초마다 썸네일 갱신

  const captureProgressThumbnail = useCallback((progress) => {
    if (!puzzleId) return;

    // 30초 내 중복 캡처 방지
    const now = Date.now();
    if (now - lastThumbnailCaptureRef.current < THUMBNAIL_CAPTURE_INTERVAL) return;
    lastThumbnailCaptureRef.current = now;

    // ⚡ InteractionManager로 터치 처리 후 실행
    InteractionManager.runAfterInteractions(async () => {
      try {
        // 📸 Native 썸네일 캡처 (원본 이미지 + 색칠된 부분 오버레이)
        const base64Image = captureThumbnail(256);

        if (base64Image) {
          const fileName = `progress_${puzzleId}.png`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;

          await FileSystem.writeAsStringAsync(fileUri, base64Image, {
            encoding: FileSystem.EncodingType.Base64
          });

          // 퍼즐 데이터에 진행 썸네일 URI 저장
          await updatePuzzle(puzzleId, {
            progressThumbnailUri: fileUri
          });
        }
      } catch (error) {
        // 에러 로그 제거 (성능)
      }
    });
  }, [puzzleId]);

  // 저장 함수 (Ref 사용으로 의존성 제거)
  // ⚡ 최적화: 3초 디바운스 + InteractionManager로 터치 방해 방지
  const saveProgress = useCallback(() => {
    if (!gameId) return;

    if (saveProgressRef.current) {
      clearTimeout(saveProgressRef.current);
    }

    saveProgressRef.current = setTimeout(() => {
      // ⚡ 터치 이벤트 처리 후 저장 실행
      InteractionManager.runAfterInteractions(async () => {
        try {
          const data = {
            filledCells: Array.from(filledCellsRef.current),
            wrongCells: Array.from(wrongCellsRef.current),
            everWrongCells: Array.from(everWrongCellsRef.current),
            score: scoreRef.current,
            timestamp: Date.now()
          };
          await AsyncStorage.setItem(gameId, JSON.stringify(data));

          // 퍼즐 완성도 업데이트 (puzzleStorage에 저장)
          if (puzzleId) {
            const totalCells = gridSize * gridSize;
            const correctCells = filledCellsRef.current.size - wrongCellsRef.current.size;
            // 🐛 버그 수정: 소수점 반올림하여 저장 (갤러리에서 100% 판정 정확도)
            const progress = Math.round(Math.max(0, Math.min(100, (correctCells / totalCells) * 100)));

            await updatePuzzle(puzzleId, {
              progress: progress,
              lastPlayed: new Date().toISOString()
            });

            // 🖼️ 진행 중 썸네일 캡처 (1% 이상일 때만)
            if (progress >= 1 && progress < 100) {
              captureProgressThumbnail(progress);
            }

            // 🎉 100% 완성 시 캡처
            if (progress >= 100 && !hasCompletedRef.current) {
              captureAndSaveCompletion();
            }
          }
        } catch (error) {
          // 저장 실패 로그 제거 (성능)
        }
      });
    }, 3000); // ⚡ 2초 → 3초 디바운스
  }, [gameId, puzzleId, gridSize, captureAndSaveCompletion, captureProgressThumbnail]);

  // filledCells 변경 시 자동 저장 (score는 제외 - 너무 자주 변경됨)
  // 🔧 언마운트 시 saveProgressRef 타이머 정리 추가
  useEffect(() => {
    if (isCanvasReady && filledCells.size > 0) {
      saveProgress();
    }

    // 🔧 cleanup: 언마운트 시 대기 중인 저장 타이머 정리 + 포인트 즉시 저장
    return () => {
      if (saveProgressRef.current) {
        clearTimeout(saveProgressRef.current);
        saveProgressRef.current = null;
      }
      // 🐛 포인트 손실 방지: 언마운트 시 대기 중인 포인트 즉시 저장
      if (pendingPointsRef.current > 0) {
        const points = pendingPointsRef.current;
        pendingPointsRef.current = 0;
        addPoints(points).catch(() => {});
      }
      if (pointsFlushTimerRef.current) {
        clearTimeout(pointsFlushTimerRef.current);
        pointsFlushTimerRef.current = null;
      }
    };
  }, [filledCells.size, isCanvasReady, saveProgress]);

  // 🚀 Native 캔버스 초기화 완료 핸들러
  // 🐛 잠재적 문제 해결: Native에서 복원한 상태를 JS에 동기화
  const handleCanvasReady = useCallback((event) => {
    const { ready, filledCells: nativeFilledCells, wrongCells: nativeWrongCells } = event.nativeEvent;
    console.log('[PlayScreen] 🚀 Native Canvas Ready:', { ready, filledCells: nativeFilledCells, wrongCells: nativeWrongCells });

    // Native에서 복원한 데이터가 있으면 JS 상태에 반영 (Native가 마스터)
    if (nativeFilledCells && nativeFilledCells > 0) {
      // Native가 더 많은 데이터를 가지고 있으면 JS AsyncStorage에서 다시 로드
      // (이미 loadProgress에서 로드했으므로 여기서는 개수만 확인)
      console.log('[PlayScreen] 📊 Native 상태 동기화: filled=' + nativeFilledCells + ', wrong=' + nativeWrongCells);
    }

    setIsNativeReady(true);

    // 🐛 완성 이미지 누락 버그 수정: 100% 완료된 퍼즐이지만 완성 이미지가 없는 경우 자동 캡처
    const totalCells = gridSize * gridSize;
    const correctCells = nativeFilledCells - (nativeWrongCells || 0);
    const progress = Math.round((correctCells / totalCells) * 100);

    if (progress >= 100 && puzzleId && !hasCompletedRef.current) {
      // 🐛 자동 복구 모드: 즉시 캡처 시작 (기존 이미지 체크 생략)
      if (isAutoRecapture) {
        console.log('[PlayScreen] 🔧 자동 복구 모드 - 즉시 캡처 시작...');
        setTimeout(() => {
          captureAndSaveCompletion();
        }, 500);  // 더 빠르게 시작 (자동 복구용)
        return;
      }

      // 🐛 100% 완료 퍼즐: 항상 새로 캡처 (격자 버그 수정 반영)
      console.log('[PlayScreen] 🎉 100% 완료 퍼즐 감지! 완성 이미지 캡처 시작...');
      setTimeout(() => {
        captureAndSaveCompletion();
      }, 1000);
    }
  }, [gridSize, puzzleId, captureAndSaveCompletion, isAutoRecapture]);

  // 🔍 디버그 로그 핸들러 (성능 최적화: 디버그 패널 열릴 때만 활성화)
  const handleDebugLog = useCallback((event) => {
    // ⚡ 최적화: 디버그 패널이 닫혀있으면 로그 무시
    if (!showDebugPanel) return;

    const { message } = event.nativeEvent;
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLogs(prev => {
      const newLogs = [...prev, `[${timestamp}] ${message}`];
      return newLogs.slice(-30); // ⚡ 30개로 축소 (성능)
    });
  }, [showDebugPanel]);

  // 🔧 Native 로그를 Metro 터널로 전달 (console.log)
  const handleNativeLog = useCallback((event) => {
    const { tag, message } = event.nativeEvent;
    console.log(`[${tag}] ${message}`);
  }, []);

  // 🗺️ 미니맵 이미지 갱신 함수
  // ⚡ 최적화: 디바운스 800ms로 증가 + InteractionManager로 UI 블로킹 방지
  const updateMinimapImage = useCallback(() => {
    if (!showMinimap) return;

    // 디바운스: 800ms 내 중복 호출 방지 (300→800ms)
    if (minimapUpdateRef.current) {
      clearTimeout(minimapUpdateRef.current);
    }

    minimapUpdateRef.current = setTimeout(() => {
      // ⚡ InteractionManager로 애니메이션 끝난 후 실행
      InteractionManager.runAfterInteractions(() => {
        try {
          const base64 = getMinimapImage(120);
          if (base64) {
            setMinimapImage(`data:image/png;base64,${base64}`);
          }
        } catch (e) {
          // 무시 (성능 로그 제거)
        }
      });
    }, 800);
  }, [showMinimap]);

  // 🗺️ 미니맵 열릴 때 + 색칠 진행 시 이미지 갱신
  // ⚡ 최적화: 10셀마다 갱신 (매 셀 X)
  const lastMinimapUpdateSizeRef = useRef(0);
  useEffect(() => {
    if (showMinimap && isNativeReady) {
      // 미니맵 열릴 때 즉시 갱신
      if (lastMinimapUpdateSizeRef.current === 0) {
        updateMinimapImage();
        lastMinimapUpdateSizeRef.current = filledCells.size;
      }
      // 10셀 이상 변경 시에만 갱신
      else if (Math.abs(filledCells.size - lastMinimapUpdateSizeRef.current) >= 10) {
        updateMinimapImage();
        lastMinimapUpdateSizeRef.current = filledCells.size;
      }
    }
  }, [showMinimap, isNativeReady, filledCells.size, updateMinimapImage]);

  // ✨ 틀린 부분 있을 때 되돌리기 버튼 반짝임
  useEffect(() => {
    if (wrongCells.size > 0 && !undoMode) {
      // 반짝임 애니메이션 시작
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(undoPulseAnim, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(undoPulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      // 애니메이션 정지 및 원래대로
      undoPulseAnim.setValue(1);
    }
  }, [wrongCells.size, undoMode, undoPulseAnim]);

  // 🗺️ 미니맵에서 틀린 셀 깜빡임 애니메이션
  useEffect(() => {
    if (wrongCells.size > 0 && showMinimap) {
      const flashAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(wrongCellFlashAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(wrongCellFlashAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      flashAnimation.start();
      return () => flashAnimation.stop();
    } else {
      wrongCellFlashAnim.setValue(0);
    }
  }, [wrongCells.size, showMinimap, wrongCellFlashAnim]);

  // 🗺️ 뷰포트 변경 핸들러 (미니맵용)
  const handleViewportChange = useCallback((event) => {
    const { viewportX, viewportY, viewportWidth, viewportHeight } = event.nativeEvent;
    setViewport({
      x: viewportX,
      y: viewportY,
      width: viewportWidth,
      height: viewportHeight
    });
  }, []);

  // 셀 칠해짐 이벤트 핸들러 (⚡ 최적화: 불필요한 Set 재생성 방지)
  // 🔧 버그 수정: wrongCells를 의존성에서 제거하고, setWrongCells의 함수형 업데이트로 현재값 참조
  const handleCellPainted = useCallback((event) => {
    const { row, col, correct } = event.nativeEvent;
    const cellKey = `${row}-${col}`;

    // 🔧 고치기 모드(undoMode)일 때는 X 제거 이벤트만 처리
    if (undoMode) {
      if (correct) {
        // ⚡ 함수형 업데이트로 현재값 직접 참조 (stale closure 방지)
        setWrongCells(prev => {
          if (!prev.has(cellKey)) return prev; // 없으면 변경 없음
          const newSet = new Set(prev);
          newSet.delete(cellKey);
          if (newSet.size === 0) {
            setTimeout(() => setUndoMode(false), 100);
          }
          return newSet;
        });
        setFilledCells(prev => {
          if (!prev.has(cellKey)) return prev;
          const newSet = new Set(prev);
          newSet.delete(cellKey);
          return newSet;
        });
      }
      return;
    }

    if (correct) {
      // ⚡ 이미 칠한 셀이면 스킵
      if (filledCellsRef.current.has(cellKey)) return;

      setFilledCells(prev => {
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });

      // 🚫 한 번이라도 틀린 적 있는 셀은 점수/포인트 추가 안 함
      if (!everWrongCellsRef.current.has(cellKey)) {
        setScore(s => s + 10);
        // ⚡ 포인트는 디바운스로 배치 처리 (딜레이 방지)
        pendingPointsRef.current += 1;
      }
    } else {
      // ⚡ 이미 칠한 셀이면 스킵
      if (filledCellsRef.current.has(cellKey)) return;

      // 잘못 칠한 셀: wrongCells와 filledCells 모두에 추가
      setWrongCells(prev => {
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });
      setFilledCells(prev => {
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });
      // 🚫 한 번이라도 틀린 적 있는 셀은 everWrongCells에 영구 기록
      if (!everWrongCellsRef.current.has(cellKey)) {
        setEverWrongCells(prev => {
          const newSet = new Set(prev);
          newSet.add(cellKey);
          return newSet;
        });
        // 🔻 첫 번째 오답만 -30점 감점
        setScore(s => Math.max(0, s - 30));
      }
    }

    // 🗺️ 미니맵 갱신 제거 - filledCells.size 변경 시 useEffect에서 처리
  }, [undoMode]);

  // 색상 선택 핸들러 (⚡ 최적화: 로그 제거)
  const handleColorSelect = useCallback((color) => {
    setSelectedColor(color);
  }, []);

  // ⚡ OOM 방지: filledCells/wrongCells는 초기 로딩 시에만 Native로 전달
  // Native가 색칠 상태를 자체 관리하므로, 매 렌더링마다 전달하면 메모리 폭발
  // hasUserPainted가 true가 되면 Native가 이 prop을 무시함
  const initialFilledCellsRef = useRef(null);
  const initialWrongCellsRef = useRef(null);

  // 최초 1회만 배열 생성 (isCanvasReady가 true가 되는 시점)
  if (initialFilledCellsRef.current === null && isCanvasReady) {
    initialFilledCellsRef.current = Array.from(filledCells);
    initialWrongCellsRef.current = Array.from(wrongCells);
  }

  // 초기값이 설정되면 그 값을 계속 사용 (불변)
  const filledCellsArray = initialFilledCellsRef.current || [];
  const wrongCellsArray = initialWrongCellsRef.current || [];

  // Gestures and rendering are now handled entirely by Native code
  // No JavaScript transform needed!

  // 툴바 버튼 렌더링 (태블릿 전용)
  const renderToolbar = useCallback(() => {
    const toolButtons = (
      <>
        <TouchableOpacity style={[styles.toolButton, styles.toolButtonActive]}>
          <Text style={styles.toolIcon}>🖌️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolButton}>
          <Text style={styles.toolIcon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolButton}>
          <Text style={styles.toolIcon}>✋</Text>
        </TouchableOpacity>
      </>
    );

    return (
      <ScrollView
        style={styles.toolbarVertical}
        contentContainerStyle={styles.toolbarVerticalContent}
        showsVerticalScrollIndicator={false}
      >
        {toolButtons}
      </ScrollView>
    );
  }, []);

  // ⚡ 최적화: luminance 미리 계산 및 캐싱 (actualColors 변경 시에만 재계산)
  const colorLuminanceMap = useMemo(() => {
    const map = new Map();
    actualColors.forEach(color => {
      const r = parseInt(color.hex.slice(1, 3), 16);
      const g = parseInt(color.hex.slice(3, 5), 16);
      const b = parseInt(color.hex.slice(5, 7), 16);
      map.set(color.id, 0.299 * r + 0.587 * g + 0.114 * b);
    });
    return map;
  }, [actualColors]);

  // ⚡ 최적화: 색상 선택 핸들러 캐싱 (각 색상별로 고정된 함수 사용)
  const colorSelectHandlers = useMemo(() => {
    const handlers = new Map();
    actualColors.forEach(color => {
      handlers.set(color.id, () => setSelectedColor(color));
    });
    return handlers;
  }, [actualColors]);

  // 🎨 완료된 색상 계산 (디바운스로 성능 최적화)
  // ⚡ 색칠 시마다 즉시 계산하면 딜레이 발생 → 2000ms 디바운스 + InteractionManager
  const [completedColors, setCompletedColors] = useState(new Set());
  const completedColorsTimerRef = useRef(null);
  // ⚡ 캐시: 라벨별 칠해진 셀 개수 (증분 업데이트용)
  const filledCountsCacheRef = useRef({});
  const lastFilledSizeRef = useRef(0);
  const lastWrongSizeRef = useRef(0);  // 🐛 버그 수정: wrongCells 크기 추적

  useEffect(() => {
    if (cells.length === 0 || Object.keys(colorCellCounts).length === 0) {
      return;
    }

    // 기존 타이머 취소
    if (completedColorsTimerRef.current) {
      clearTimeout(completedColorsTimerRef.current);
    }

    // ⚡ 2000ms 디바운스 (더 긴 간격으로 CPU 사용 감소)
    completedColorsTimerRef.current = setTimeout(() => {
      // ⚡ InteractionManager로 터치 이벤트 처리 후 실행
      InteractionManager.runAfterInteractions(() => {
        const currentSize = filledCells.size;
        const currentWrongSize = wrongCells.size;
        const lastSize = lastFilledSizeRef.current;

        // ⚡ 변경 없으면 스킵 (filledCells와 wrongCells 모두 확인)
        if (currentSize === lastSize && currentWrongSize === lastWrongSizeRef.current) {
          return;
        }

        // ⚡ 전체 재계산 (2000ms마다만 실행되므로 괜찮음)
        const filledCounts = {};
        for (const cellKey of filledCells) {
          if (wrongCells.has(cellKey)) continue; // 틀린 셀 제외
          const dashIdx = cellKey.indexOf('-');
          if (dashIdx === -1) continue;
          const row = parseInt(cellKey.substring(0, dashIdx), 10);
          const col = parseInt(cellKey.substring(dashIdx + 1), 10);
          const idx = row * gridSize + col;
          const cell = cells[idx];
          if (cell) {
            filledCounts[cell.label] = (filledCounts[cell.label] || 0) + 1;
          }
        }

        // 완료된 색상 판별
        const completed = new Set();
        for (const label in colorCellCounts) {
          if (filledCounts[label] >= colorCellCounts[label]) {
            completed.add(label);
          }
        }

        filledCountsCacheRef.current = filledCounts;
        lastFilledSizeRef.current = currentSize;
        lastWrongSizeRef.current = currentWrongSize;  // 🐛 버그 수정: wrongCells 크기 업데이트
        setCompletedColors(completed);
      });
    }, 2000); // ⚡ 1000ms → 2000ms

    return () => {
      if (completedColorsTimerRef.current) {
        clearTimeout(completedColorsTimerRef.current);
      }
    };
  }, [cells, colorCellCounts, filledCells.size, wrongCells.size, gridSize]);

  // 🎯 남은 셀 계산 (100개 이하일 때 힌트 표시용)
  // ⚡ 최적화: 힌트 패널이 열려있을 때만 상세 계산
  const remainingCellsInfo = useMemo(() => {
    if (!cells || cells.length === 0) return { count: 0, cells: [] };

    const totalCells = gridSize * gridSize;
    // ⚡ 정답 셀 개수 = filledCells - wrongCells
    const correctCount = filledCells.size - wrongCells.size;
    const remainingCount = totalCells - correctCount;

    // ⚡ 100개 초과면 빠른 반환 (상세 계산 스킵)
    if (remainingCount > 100 || !showRemainingHint) {
      return { count: remainingCount, cells: [] };
    }

    // ⚡ 힌트 패널 열렸을 때만 상세 목록 생성
    // correctFilledCells Set 생성
    const correctFilledCells = new Set();
    for (const cellKey of filledCells) {
      if (!wrongCells.has(cellKey)) {
        correctFilledCells.add(cellKey);
      }
    }

    // 남은 셀 목록 생성 (100개 이하)
    const remainingList = [];
    for (let idx = 0; idx < cells.length && remainingList.length < 100; idx++) {
      const cell = cells[idx];
      const cellKey = `${cell.row}-${cell.col}`;
      if (!correctFilledCells.has(cellKey)) {
        remainingList.push({
          row: cell.row,
          col: cell.col,
          label: cell.label,
          hex: cell.targetColorHex
        });
      }
    }

    // 색상별로 그룹화하여 정렬
    remainingList.sort((a, b) => a.label.localeCompare(b.label));

    return { count: remainingCount, cells: remainingList };
  }, [cells, filledCells, wrongCells, gridSize, showRemainingHint]);

  // 🎯 남은 셀 위치로 이동
  const handleMoveToCell = useCallback((row, col) => {
    // Native 캔버스의 setViewportPosition 호출
    const normalizedX = col / gridSize;
    const normalizedY = row / gridSize;
    setViewportPosition(normalizedX, normalizedY, 4.0); // 4배 줌으로 이동
    setShowRemainingHint(false);
  }, [gridSize]);

  // 색상 팔레트 렌더링 (⚡ 최적화: memo된 ColorButton 사용)
  const renderPalette = useCallback(() => {
    if (isTablet) {
      return (
        <ScrollView
          style={[styles.paletteContainerTablet, { width: TABLET_PALETTE_WIDTH }]}
          contentContainerStyle={styles.paletteTablet}
        >
          {actualColors.map((color) => (
            <ColorButton
              key={color.id}
              color={color}
              isSelected={selectedColor?.id === color.id}
              onSelect={colorSelectHandlers.get(color.id)}
              luminance={colorLuminanceMap.get(color.id)}
              isCompleted={completedColors.has(color.id)}
              tabletSize={TABLET_BUTTON_SIZE}
            />
          ))}
        </ScrollView>
      );
    }

    // 모바일: 고정 높이 View
    return (
      <View style={styles.paletteContainer}>
        <View style={styles.paletteWithUndo}>
          {/* 되돌리기 버튼 - 팔레트 왼쪽에 배치 */}
          <Animated.View style={{ opacity: undoPulseAnim }}>
            <TouchableOpacity
              style={[
                styles.undoButtonPalette,
                undoMode && styles.undoButtonActive,
                wrongCells.size === 0 && !undoMode && styles.undoButtonDisabled
              ]}
              onPress={() => {
                if (undoMode) {
                  setUndoMode(false);
                } else if (wrongCells.size > 0) {
                  setUndoMode(true);
                }
              }}
              disabled={wrongCells.size === 0 && !undoMode}
            >
              <Text style={styles.undoIcon}>↩</Text>
              <Text style={styles.undoCount}>{wrongCells.size}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* 색상 팔레트 */}
          <View style={styles.palette}>
            {actualColors.map((color) => (
              <ColorButton
                key={color.id}
                color={color}
                isSelected={selectedColor?.id === color.id}
                onSelect={colorSelectHandlers.get(color.id)}
                luminance={colorLuminanceMap.get(color.id)}
                isCompleted={completedColors.has(color.id)}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }, [isTablet, selectedColor?.id, actualColors, colorLuminanceMap, colorSelectHandlers, undoMode, wrongCells.size, undoPulseAnim, completedColors]);

  if (isTablet) {
    // 태블릿 레이아웃: 가로 3분할 (툴바 | 캔버스 | 팔레트)
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButtonContainer}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.scoreContainer}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.score}>{score}</Text>
            </View>

            {wrongCells.size > 0 && (
              <TouchableOpacity
                style={[styles.undoButton, undoMode && styles.undoButtonActive]}
                onPress={() => setUndoMode(!undoMode)}
              >
                <Text style={styles.undoIcon}>↩️</Text>
                <Text style={styles.undoCount}>{wrongCells.size}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.contentTablet}>
          {/* Left Toolbar */}
          {renderToolbar()}

          {/* Center Canvas */}
          <View style={styles.canvasContainerTablet}>
            <PaintCanvasView
              key="paint-canvas-view-tablet"
              style={styles.canvas}
              gridSize={gridSize}
              cells={cells}
              selectedColorHex={selectedColor?.hex || '#FFFFFF'}
              selectedLabel={selectedColor?.id || 'A'}
              imageUri={imageUri}
              textureUri={textureUri}
              gameId={gameId}
              filledCells={filledCellsArray}
              wrongCells={wrongCellsArray}
              undoMode={undoMode}
              viewSize={viewDimensions}
              completionMode={completionMode}
              clearProgress={isReset || false}
              onCellPainted={handleCellPainted}
              onCanvasReady={handleCanvasReady}
              onDebugLog={handleDebugLog}
              onNativeLog={handleNativeLog}
            />
          </View>

          {/* Right Palette */}
          {renderPalette()}
        </View>

        {/* 🔍 디버그 로그 패널 (태블릿) */}
        {showDebugPanel && debugLogs.length > 0 && (
          <View style={styles.debugPanel}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>Touch Debug Log (최근 50개)</Text>
              <TouchableOpacity onPress={() => setDebugLogs([])}>
                <Text style={styles.debugClear}>지우기</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDebugPanel(false)}>
                <Text style={styles.debugClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.debugLogContainer}>
              {debugLogs.map((log, index) => (
                <Text key={index} style={styles.debugLogText}>{log}</Text>
              ))}
            </ScrollView>
          </View>
        )}

      </SafeAreaView>
    );
  }

  // 모바일 레이아웃: 세로 구조 (툴바 제거)
  // 캔버스를 항상 렌더링하고 로딩 오버레이로 덮어서 백그라운드 초기화
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButtonContainer}>
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.scoreContainer}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.score}>{score}</Text>
          </View>
        </View>

        {/* 🎯 남은 셀 힌트 버튼 (100개 이하일 때만 표시) */}
        {remainingCellsInfo.count > 0 && remainingCellsInfo.count <= 100 && (
          <TouchableOpacity
            style={[styles.hintButton, showRemainingHint && styles.hintButtonActive]}
            onPress={() => setShowRemainingHint(!showRemainingHint)}
          >
            <Text style={styles.hintButtonText}>🎯{remainingCellsInfo.count}</Text>
          </TouchableOpacity>
        )}

        {/* 🗺️ 미니맵 토글 버튼 */}
        <TouchableOpacity
          style={[styles.minimapToggle, showMinimap && styles.minimapToggleActive]}
          onPress={() => setShowMinimap(!showMinimap)}
        >
          <Text style={styles.minimapToggleIcon}>🗺️</Text>
        </TouchableOpacity>
      </View>

      {/* Native Canvas with Zoom (Native handles gestures AND rendering) */}
      <View style={styles.canvasContainer}>
        {cells.length > 0 && (
          <>
            <PaintCanvasView
              key="paint-canvas-view"
            style={styles.canvas}
            gridSize={gridSize}
            cells={cells}
            selectedColorHex={selectedColor?.hex || '#FFFFFF'}
            selectedLabel={selectedColor?.id || 'A'}
            imageUri={imageUri}
            textureUri={textureUri}
            gameId={gameId}
            filledCells={filledCellsArray}
            wrongCells={wrongCellsArray}
            undoMode={undoMode}
            viewSize={viewDimensions}
            completionMode={completionMode}
            clearProgress={isReset || false}
            onCellPainted={handleCellPainted}
            onCanvasReady={handleCanvasReady}
            onDebugLog={handleDebugLog}
            onNativeLog={handleNativeLog}
            onViewportChange={handleViewportChange}
          />

          {/* 🗺️ 미니맵 - 오른쪽 하단에 색칠 맵 + 현재 위치 표시 */}
          {showMinimap && (
            <TouchableOpacity
              style={styles.minimapContainer}
              activeOpacity={0.9}
              onPress={(event) => {
                // 터치 위치 → 미니맵 내 비율 계산
                const { locationX, locationY } = event.nativeEvent;
                const minimapSize = 120; // styles.minimapContainer 크기
                const targetX = locationX / minimapSize;
                const targetY = locationY / minimapSize;
                // Native에 뷰포트 이동 요청 (4배 줌으로 이동)
                setViewportPosition(targetX, targetY, 4.0);
              }}
            >
              {/* 색칠 맵 이미지 (음영 + 색칠된 부분) */}
              {minimapImage ? (
                <Image
                  source={{ uri: minimapImage }}
                  style={styles.minimapImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.minimapImage, styles.minimapPlaceholder]}>
                  <ActivityIndicator size="small" color={SpotifyColors.primary} />
                </View>
              )}
              {/* 🚨 틀린 셀 위치 빨간 점 표시 (깜빡임) */}
              {wrongCells.size > 0 && Array.from(wrongCells).map((cellKey) => {
                const [row, col] = cellKey.split('-').map(Number);
                const minimapSize = 120;
                const cellSize = minimapSize / gridSize;
                return (
                  <Animated.View
                    key={cellKey}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: col * cellSize + cellSize / 2 - 4,
                      top: row * cellSize + cellSize / 2 - 4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#FF0000',
                      opacity: wrongCellFlashAnim,
                      shadowColor: '#FF0000',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 4,
                    }}
                  />
                );
              })}
              {/* 🎯 남은 셀 100개 이하일 때 초록 점 표시 */}
              {remainingCellsInfo.cells.length > 0 && remainingCellsInfo.cells.map((cell) => {
                const minimapSize = 120;
                const cellSize = minimapSize / gridSize;
                return (
                  <View
                    key={`remaining-${cell.row}-${cell.col}`}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: cell.col * cellSize + cellSize / 2 - 3,
                      top: cell.row * cellSize + cellSize / 2 - 3,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#00FF00',
                      borderWidth: 1,
                      borderColor: '#008800',
                    }}
                  />
                );
              })}
              {/* 현재 뷰포트 위치 표시 박스 */}
              <View
                style={[
                  styles.minimapViewport,
                  {
                    left: `${viewport.x * 100}%`,
                    top: `${viewport.y * 100}%`,
                    width: `${viewport.width * 100}%`,
                    height: `${viewport.height * 100}%`,
                  }
                ]}
                pointerEvents="none"
              />
              {/* 라벨 */}
              <View style={styles.minimapOverlay} pointerEvents="none">
                <Text style={styles.minimapLabel}>
                  {wrongCells.size > 0
                    ? `⚠️ ${wrongCells.size}개 오류`
                    : remainingCellsInfo.cells.length > 0
                      ? `🎯 ${remainingCellsInfo.count}개 남음`
                      : t('play.currentPosition')}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 🎯 남은 셀 힌트 패널 */}
          {showRemainingHint && remainingCellsInfo.cells.length > 0 && (
            <View style={styles.hintPanel}>
              <View style={styles.hintPanelHeader}>
                <Text style={styles.hintPanelTitle}>
                  🎯 {t('play.remainingCells', { count: remainingCellsInfo.count })}
                </Text>
                <TouchableOpacity onPress={() => setShowRemainingHint(false)}>
                  <Text style={styles.hintPanelClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.hintPanelScroll} showsVerticalScrollIndicator={true}>
                {remainingCellsInfo.cells.map((cell, index) => (
                  <TouchableOpacity
                    key={`${cell.row}-${cell.col}`}
                    style={styles.hintCellItem}
                    onPress={() => handleMoveToCell(cell.row, cell.col)}
                  >
                    <View style={[styles.hintCellColor, { backgroundColor: cell.hex }]}>
                      <Text style={[
                        styles.hintCellLabel,
                        { color: getLuminance(cell.hex) > 128 ? '#000' : '#FFF' }
                      ]}>
                        {cell.label}
                      </Text>
                    </View>
                    <Text style={styles.hintCellPosition}>
                      ({cell.row + 1}, {cell.col + 1})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          </>
        )}
      </View>

      {/* 색상 팔레트 */}
      {renderPalette()}

      {/* 📢 광고 배너 영역 (광고 ID가 있을 때만 표시) */}
      {adUnitId && (
        <View style={styles.adBannerContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View>
      )}

      {/* 🚀 로딩 오버레이 - Native 캔버스의 첫 렌더링 완료까지 표시 */}
      {/* ⚡ pointerEvents="none"으로 터치가 캔버스로 전달되도록 함 (로딩 중에도 조작 가능) */}
      {!isNativeReady && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
          <Image
            source={loadingImage}
            style={styles.loadingFullImage}
            resizeMode="contain"
          />
          <View style={styles.loadingStatusContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.loadingStatusText}>{t('play.preparing')}</Text>
          </View>
        </View>
      )}

      {/* 🔍 디버그 로그 패널 */}
      {showDebugPanel && debugLogs.length > 0 && (
        <View style={styles.debugPanel}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Touch Debug Log (최근 50개)</Text>
            <TouchableOpacity onPress={() => setDebugLogs([])}>
              <Text style={styles.debugClear}>지우기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDebugPanel(false)}>
              <Text style={styles.debugClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.debugLogContainer}>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugLogText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotifyColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SpotifySpacing.base,
    paddingVertical: SpotifySpacing.sm,
    backgroundColor: SpotifyColors.backgroundLight,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SpotifyColors.primary,
    paddingHorizontal: SpotifySpacing.base,
    paddingVertical: SpotifySpacing.sm,
    borderRadius: SpotifyRadius.full,
    gap: 6,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SpotifyColors.error,
    paddingHorizontal: SpotifySpacing.md,
    paddingVertical: SpotifySpacing.sm,
    borderRadius: SpotifyRadius.full,
    gap: 4,
  },
  undoButtonActive: {
    backgroundColor: SpotifyColors.primary,
  },
  undoButtonDisabled: {
    backgroundColor: SpotifyColors.backgroundElevated,
    opacity: 0.5,
  },
  undoIcon: {
    fontSize: 14,
  },
  undoCount: {
    fontSize: 10,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
  },
  coinIcon: {
    fontSize: 18,
  },
  score: {
    fontSize: SpotifyFonts.md,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.background,
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    backgroundColor: SpotifyColors.background,
    overflow: 'hidden',
    minHeight: 0,
  },
  canvas: {
    flex: 1,
    width: '100%',
    // Native code will center the 403x403 canvas within this full-screen view
  },
  canvasAnimatedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteContainer: {
    paddingHorizontal: SpotifySpacing.sm,
    paddingTop: SpotifySpacing.sm,
    paddingBottom: SpotifySpacing.base,
    backgroundColor: SpotifyColors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: SpotifyColors.divider,
  },
  paletteWithUndo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  undoButtonPalette: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SpotifyColors.error,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: SpotifyRadius.sm,
    minWidth: 34,
    height: COLOR_BUTTON_SIZE * 2 + BUTTON_GAP,
  },
  palette: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BUTTON_GAP,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  colorButton: {
    width: COLOR_BUTTON_SIZE,
    height: COLOR_BUTTON_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    position: 'relative',
  },
  colorButtonSelected: {
    borderColor: '#FFD700',
    borderWidth: 4,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  // 🔍 디버그 패널 스타일
  debugPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopWidth: 2,
    borderTopColor: '#40E0D0',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#1A3A4A',
    borderBottomWidth: 1,
    borderBottomColor: '#40E0D0',
  },
  debugTitle: {
    color: '#40E0D0',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
  },
  debugClear: {
    color: '#FF5757',
    fontSize: 12,
    marginRight: 12,
  },
  debugClose: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugLogContainer: {
    flex: 1,
    padding: 8,
  },
  debugLogText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  debugToggleButton: {
    position: 'absolute',
    bottom: 140,
    right: 8,
    backgroundColor: '#40E0D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  debugToggleText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    transform: [{ scale: 1.08 }],
  },
  colorButtonCompleted: {
    opacity: 0.6,
  },
  colorId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    textShadowColor: '#FFF',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  checkmark: {
    position: 'absolute',
    top: 1,
    right: 1,
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1C1C1E',
    gap: 8,
  },
  toolbarVertical: {
    width: 72,
    backgroundColor: '#163040',
    borderRightWidth: 2,
    borderRightColor: '#20B2AA',
  },
  toolbarVerticalContent: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 10,
    alignItems: 'center',
  },
  toolButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A3A4A',
    borderWidth: 2.5,
    borderColor: '#40E0D0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  toolButtonActive: {
    borderColor: '#FFD93D',
    borderWidth: 4,
    backgroundColor: '#20B2AA',
    shadowColor: '#FFD93D',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  toolIcon: {
    fontSize: 28,
  },
  contentTablet: {
    flex: 1,
    flexDirection: 'row',
  },
  canvasContainerTablet: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A3A4A',
    padding: 0,
  },
  paletteContainerTablet: {
    // width는 renderPalette에서 동적으로 설정 (TABLET_PALETTE_WIDTH)
    backgroundColor: '#163040',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#20B2AA',
  },
  paletteTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 100,
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
  // 🗺️ 미니맵 토글 버튼 스타일
  minimapToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SpotifyColors.backgroundElevated,
    borderRadius: SpotifyRadius.md,
    borderWidth: 2,
    borderColor: SpotifyColors.divider,
  },
  minimapToggleActive: {
    backgroundColor: SpotifyColors.primary,
    borderColor: SpotifyColors.primary,
  },
  minimapToggleIcon: {
    fontSize: 20,
  },
  // 🗺️ 미니맵 컨테이너 스타일
  minimapContainer: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 120,
    height: 120,
    borderRadius: SpotifyRadius.md,
    overflow: 'hidden',
    backgroundColor: SpotifyColors.background,
    borderWidth: 2,
    borderColor: SpotifyColors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  minimapImage: {
    width: '100%',
    height: '100%',
  },
  minimapPlaceholder: {
    backgroundColor: SpotifyColors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  minimapLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // 🗺️ 현재 뷰포트 위치 표시 박스
  minimapViewport: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
  },
  // 📢 광고 배너 스타일
  adBannerContainer: {
    width: '100%',
    minHeight: 50,
    backgroundColor: SpotifyColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 🎯 남은 셀 힌트 스타일
  hintButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderWidth: 1,
    borderColor: SpotifyColors.divider,
    marginRight: 8,
  },
  hintButtonActive: {
    backgroundColor: SpotifyColors.primary,
    borderColor: SpotifyColors.primary,
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hintPanel: {
    position: 'absolute',
    right: 12,
    top: 60,
    width: 160,
    maxHeight: 300,
    borderRadius: SpotifyRadius.md,
    backgroundColor: SpotifyColors.backgroundElevated,
    borderWidth: 1,
    borderColor: SpotifyColors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'hidden',
  },
  hintPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SpotifyColors.divider,
    backgroundColor: SpotifyColors.background,
  },
  hintPanelTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hintPanelClose: {
    fontSize: 18,
    color: SpotifyColors.textSecondary,
    paddingHorizontal: 4,
  },
  hintPanelScroll: {
    maxHeight: 250,
  },
  hintCellItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SpotifyColors.divider,
  },
  hintCellColor: {
    width: 28,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  hintCellLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  hintCellPosition: {
    fontSize: 12,
    color: SpotifyColors.textSecondary,
  },
});
