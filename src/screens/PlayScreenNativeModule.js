import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, useWindowDimensions, ActivityIndicator, PixelRatio, InteractionManager, Alert, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaintCanvasView, captureCanvas, captureThumbnail } from 'paint-canvas-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { updatePuzzle } from '../utils/puzzleStorage';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 🖼️ 로딩 화면 이미지
const loadingImage = require('../../assets/loading-image.png');

// ⚡ 최적화: 색상 버튼 컴포넌트 분리 (memo로 불필요한 리렌더링 방지)
const ColorButton = memo(({ color, isSelected, onSelect, luminance }) => {
  const textColor = luminance > 128 ? '#000' : '#FFF';
  const shadowColor = luminance > 128 ? '#FFF' : '#000';

  return (
    <TouchableOpacity
      style={[
        colorButtonStyles.button,
        { backgroundColor: color.hex },
        isSelected && colorButtonStyles.selected
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <Text style={[colorButtonStyles.id, { color: textColor, textShadowColor: shadowColor }]}>
        {color.id}
      </Text>
    </TouchableOpacity>
  );
}, (prev, next) => {
  // isSelected 변경 시에만 리렌더링
  return prev.isSelected === next.isSelected && prev.color.id === next.color.id;
});

const colorButtonStyles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  id: {
    fontSize: 12,
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
  const { puzzleId, imageUri, colorCount = 36, gridSize: paramGridSize, gridColors, dominantColors: paramDominantColors, completionMode: paramCompletionMode } = route.params || {};
  const gridSize = paramGridSize || 250; // 기본 250x250 격자 (높은 난이도, 많은 셀)
  const completionMode = paramCompletionMode || 'ORIGINAL'; // 완성 모드 (ORIGINAL: 원본 이미지, WEAVE: 위빙 텍스처)
  const { width, height } = useWindowDimensions();

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
  const [undoMode, setUndoMode] = useState(false); // 고치기 모드
  const [viewDimensions, setViewDimensions] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }); // 전체 화면 크기 (dp)
  // 🔍 디버그 로그 상태 (프로덕션에서는 비활성화)
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(__DEV__ ? false : false); // 기본 비활성화 (성능)

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

  // 폴드7 접힘/펼침 감지
  // 접힘: 884 x 2208 (가로)
  // 펼침: 1768 x 2208 (가로)
  // 가로가 1200 이상이면 태블릿 모드
  const isTablet = width >= 1200;

  // 캔버스 크기 계산 - 최대화
  // 태블릿: 높이 우선 (헤더 제외), 너비는 툴바+팔레트 제외
  // 모바일: 헤더 + 팔레트 제외, 최소 여백으로 최대 크기 확보
  const HEADER_HEIGHT = 44; // 헤더 높이 (패딩 6×2 + 테두리 + 내용)
  const PALETTE_AREA_HEIGHT = 132; // 팔레트 영역 전체 (버튼 32×3 + 간격 4×2 + 패딩 6+18 + 테두리 1)

  const canvasSize = isTablet
    ? Math.min(height - HEADER_HEIGHT - 8, width - 210) // 태블릿: 여백 더 최소화
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
        cellList[idx] = {
          row,
          col,
          targetColorHex: color?.hex || '#FFFFFF',
          label: color?.id || 'A',
        };
      }

      if (__DEV__) {
        console.log('[셀생성] 완료:', totalCells, '개 셀,', Date.now() - startTime, 'ms');
      }

      setCells(cellList);
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
            const { filledCells: saved, score: savedScore, wrongCells: savedWrong } = JSON.parse(savedData);
            setFilledCells(new Set(saved));
            setWrongCells(new Set(savedWrong || []));
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
  const scoreRef = useRef(score);

  // Ref 업데이트 (리렌더링 없이)
  useEffect(() => {
    filledCellsRef.current = filledCells;
    wrongCellsRef.current = wrongCells;
    scoreRef.current = score;
  }, [filledCells, wrongCells, score]);

  // 🖼️ 100% 완성 시 캡처 및 저장 (한 번만 실행)
  const hasCompletedRef = useRef(false);

  const captureAndSaveCompletion = useCallback(async () => {
    if (hasCompletedRef.current || !puzzleId) return;
    hasCompletedRef.current = true;

    console.log('🎉 100% 완성! 캔버스 캡처 시작...');

    try {
      // Native 캡처 호출 (512x512 PNG)
      const base64Image = captureCanvas(512);

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

        // 완성 알림
        Alert.alert(
          '🎉 축하합니다!',
          '퍼즐을 완성했습니다!\n갤러리에서 작품을 확인하세요.',
          [{ text: '확인', style: 'default' }]
        );
      } else {
        console.warn('⚠️ 캔버스 캡처 실패 (null 반환)');
      }
    } catch (error) {
      console.error('❌ 완성 이미지 캡처/저장 실패:', error);
      hasCompletedRef.current = false; // 재시도 가능하도록
    }
  }, [puzzleId]);

  // 🖼️ 진행 썸네일 캡처 (갤러리에서 진행 상황 표시용)
  // 원본 이미지 위에 색칠된 부분만 오버레이 (참조 앱 스타일)
  const lastThumbnailCaptureRef = useRef(0);
  const THUMBNAIL_CAPTURE_INTERVAL = 10000; // 10초마다 썸네일 갱신

  const captureProgressThumbnail = useCallback(async (progress) => {
    if (!puzzleId) return;

    // 10초 내 중복 캡처 방지
    const now = Date.now();
    if (now - lastThumbnailCaptureRef.current < THUMBNAIL_CAPTURE_INTERVAL) return;
    lastThumbnailCaptureRef.current = now;

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

        console.log('📸 진행 썸네일 저장:', Math.round(progress) + '%');
      }
    } catch (error) {
      console.error('진행 썸네일 캡처 실패:', error);
    }
  }, [puzzleId]);

  // 저장 함수 (Ref 사용으로 의존성 제거)
  const saveProgress = useCallback(() => {
    if (!gameId) return;

    if (saveProgressRef.current) {
      clearTimeout(saveProgressRef.current);
    }

    saveProgressRef.current = setTimeout(async () => {
      try {
        const data = {
          filledCells: Array.from(filledCellsRef.current),
          wrongCells: Array.from(wrongCellsRef.current),
          score: scoreRef.current,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem(gameId, JSON.stringify(data));

        // 퍼즐 완성도 업데이트 (puzzleStorage에 저장)
        if (puzzleId) {
          const totalCells = gridSize * gridSize;
          const correctCells = filledCellsRef.current.size - wrongCellsRef.current.size;
          const progress = Math.max(0, Math.min(100, (correctCells / totalCells) * 100));

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
        console.error('Failed to save progress:', error);
      }
    }, 2000); // 2초 디바운스 (성능 최적화)
  }, [gameId, puzzleId, gridSize, captureAndSaveCompletion, captureProgressThumbnail]);

  // filledCells 변경 시 자동 저장 (score는 제외 - 너무 자주 변경됨)
  useEffect(() => {
    if (isCanvasReady && filledCells.size > 0) {
      saveProgress();
    }
  }, [filledCells.size, isCanvasReady, saveProgress]);

  // 🚀 Native 캔버스 초기화 완료 핸들러
  const handleCanvasReady = useCallback((event) => {
    const { ready, filledCells: nativeFilledCells, wrongCells: nativeWrongCells } = event.nativeEvent;
    console.log('[PlayScreen] 🚀 Native Canvas Ready:', { ready, filledCells: nativeFilledCells, wrongCells: nativeWrongCells });
    setIsNativeReady(true);
  }, []);

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
      // ⚡ 이미 있으면 빠른 반환
      setFilledCells(prev => {
        if (prev.has(cellKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });

      setScore(prev => prev + 10);
    } else {
      // 잘못 칠한 셀: wrongCells와 filledCells 모두에 추가
      setWrongCells(prev => {
        if (prev.has(cellKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });
      setFilledCells(prev => {
        if (prev.has(cellKey)) return prev;
        const newSet = new Set(prev);
        newSet.add(cellKey);
        return newSet;
      });
      setScore(prev => Math.max(0, prev - 5));
    }
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

  // 색상 팔레트 렌더링 (⚡ 최적화: memo된 ColorButton 사용)
  const renderPalette = useCallback(() => {
    if (isTablet) {
      return (
        <ScrollView
          style={styles.paletteContainerTablet}
          contentContainerStyle={styles.paletteTablet}
        >
          {actualColors.map((color) => (
            <ColorButton
              key={color.id}
              color={color}
              isSelected={selectedColor?.id === color.id}
              onSelect={colorSelectHandlers.get(color.id)}
              luminance={colorLuminanceMap.get(color.id)}
            />
          ))}
        </ScrollView>
      );
    }

    // 모바일: 고정 높이 View
    return (
      <View style={styles.paletteContainer}>
        <View style={styles.palette}>
          {actualColors.map((color) => (
            <ColorButton
              key={color.id}
              color={color}
              isSelected={selectedColor?.id === color.id}
              onSelect={colorSelectHandlers.get(color.id)}
              luminance={colorLuminanceMap.get(color.id)}
            />
          ))}
        </View>
      </View>
    );
  }, [isTablet, selectedColor?.id, actualColors, colorLuminanceMap, colorSelectHandlers]);

  if (isTablet) {
    // 태블릿 레이아웃: 가로 3분할 (툴바 | 캔버스 | 팔레트)
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
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
              gameId={gameId}
              filledCells={filledCellsArray}
              wrongCells={wrongCellsArray}
              undoMode={undoMode}
              viewSize={viewDimensions}
              completionMode={completionMode}
              onCellPainted={handleCellPainted}
              onCanvasReady={handleCanvasReady}
              onDebugLog={handleDebugLog}
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.scoreContainer}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.score}>{score}</Text>
          </View>

          {/* 되돌리기 버튼 - 항상 표시 */}
          <TouchableOpacity
            style={[
              styles.undoButton,
              undoMode && styles.undoButtonActive,
              wrongCells.size === 0 && !undoMode && styles.undoButtonDisabled
            ]}
            onPress={() => {
              // undoMode가 켜져 있으면 항상 끌 수 있음
              // wrongCells가 있을 때만 켤 수 있음
              if (undoMode) {
                setUndoMode(false);
              } else if (wrongCells.size > 0) {
                setUndoMode(true);
              }
            }}
            disabled={wrongCells.size === 0 && !undoMode}
          >
            <Text style={styles.undoIcon}>↩️</Text>
            <Text style={styles.undoCount}>{wrongCells.size}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Native Canvas with Zoom (Native handles gestures AND rendering) */}
      <View style={styles.canvasContainer}>
        {cells.length > 0 && (
          <PaintCanvasView
            key="paint-canvas-view"
            style={styles.canvas}
            gridSize={gridSize}
            cells={cells}
            selectedColorHex={selectedColor?.hex || '#FFFFFF'}
            selectedLabel={selectedColor?.id || 'A'}
            imageUri={imageUri}
            gameId={gameId}
            filledCells={filledCellsArray}
            wrongCells={wrongCellsArray}
            undoMode={undoMode}
            viewSize={viewDimensions}
            completionMode={completionMode}
            onCellPainted={handleCellPainted}
            onCanvasReady={handleCanvasReady}
            onDebugLog={handleDebugLog}
          />
        )}
      </View>

      {/* 색상 팔레트 */}
      {renderPalette()}

      {/* 🚀 로딩 오버레이 - Native 캔버스의 첫 렌더링 완료까지 표시 */}
      {!isNativeReady && (
        <View style={styles.loadingOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
          <Image
            source={loadingImage}
            style={styles.loadingFullImage}
            resizeMode="contain"
          />
          <View style={styles.loadingStatusContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.loadingStatusText}>캔버스 준비 중...</Text>
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
    fontSize: 18,
  },
  undoCount: {
    fontSize: SpotifyFonts.base,
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
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    width: 130,
    backgroundColor: '#163040',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#20B2AA',
  },
  paletteTablet: {
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
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
});
