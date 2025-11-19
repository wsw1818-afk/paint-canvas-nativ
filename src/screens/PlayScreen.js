import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Image, useImage, Rect, Group, Text as SkiaText, matchFont } from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH;
const CANVAS_HEIGHT = SCREEN_HEIGHT - 250; // 헤더 + 팔레트 공간 제외

// 색상 팔레트 (A-Z + 1-6)
const COLOR_PALETTE = [
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
  { id: 'R', hex: '#8B4513', name: '새들브라운' },
  { id: 'S', hex: '#228B22', name: '포레스트그린' },
  { id: 'T', hex: '#40E0D0', name: '터키석' },
  { id: 'U', hex: '#EE82EE', name: '바이올렛' },
  { id: 'V', hex: '#C0C0C0', name: '실버' },
  { id: 'W', hex: '#FFFFFF', name: '흰색' },
  { id: 'X', hex: '#FFB6C1', name: '라이트핑크' },
  { id: 'Y', hex: '#FFFFE0', name: '라이트옐로우' },
  { id: 'Z', hex: '#98FB98', name: '페일그린' },
  { id: '1', hex: '#FFC0CB', name: '핑크' },
  { id: '2', hex: '#DDA0DD', name: '플럼' },
  { id: '3', hex: '#87CEEB', name: '스카이블루' },
  { id: '4', hex: '#F0E68C', name: '카키' },
  { id: '5', hex: '#E6E6FA', name: '라벤더' },
  { id: '6', hex: '#90EE90', name: '라이트그린' },
];

export default function PlayScreen({ route, navigation }) {
  const { imageUri, colorCount = 5, sourceType } = route.params || {};

  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [grid, setGrid] = useState([]);
  const [gridSize] = useState(60); // 60x60 격자 (성능과 품질 균형)
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(100); // 초기 점수 100점
  const [mistakes, setMistakes] = useState(0); // 실수 횟수

  // 실행 취소/다시 실행을 위한 히스토리
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 점수 애니메이션
  const [scorePopup, setScorePopup] = useState(null);

  // 줌/팬 상태
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastScale, setLastScale] = useState(1);
  const [lastTranslate, setLastTranslate] = useState({ x: 0, y: 0 });

  // 터치 정보 저장
  const touchInfo = useRef({ touches: [] });

  // Canvas 컨테이너의 레이아웃 정보 저장
  const canvasContainerRef = useRef(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Skia 이미지 로드 - imageUri가 있을 때만 로드 (없으면 null)
  const image = useImage(imageUri && sourceType !== 'sample' ? imageUri : null);

  // Skia Text용 Font 객체 생성 (HostObject)
  const font = matchFont({
    fontFamily: 'System',
    fontSize: 7, // 60x60 격자에 맞춤 - 알파벳이 잘 보이도록 키움
    fontWeight: 'bold',
  });

  // 초기 격자 생성
  useEffect(() => {
    console.log('PlayScreen useEffect:', { imageUri, sourceType, imageLoaded: !!image });
    if (imageUri && sourceType !== 'sample' && image) {
      console.log('Generating grid from image');
      generateGridFromImage();
    } else {
      console.log('Generating random grid');
      generateGrid();
    }
    setLoading(false);
  }, [gridSize, colorCount, imageUri, sourceType, image]);

  const generateGrid = () => {
    const newGrid = [];
    const colors = COLOR_PALETTE.slice(0, colorCount);

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        newGrid.push({
          id: `${row}-${col}`,
          row,
          col,
          targetColor: randomColor.id,
          currentColor: null,
          filled: false,
        });
      }
    }

    setGrid(newGrid);
  };

  const generateGridFromImage = async () => {
    try {
      if (!image) {
        console.log('No image loaded, falling back to random grid');
        generateGrid();
        return;
      }

      console.log('Generating grid from image with pixel sampling');

      const newGrid = [];
      const colors = COLOR_PALETTE.slice(0, colorCount);
      const cellWidth = CANVAS_WIDTH / gridSize;
      const cellHeight = CANVAS_HEIGHT / gridSize;

      // 이미지 크기 가져오기
      const imgWidth = image.width();
      const imgHeight = image.height();

      console.log(`Image: ${imgWidth}x${imgHeight}, Grid: ${gridSize}x${gridSize}, Cell: ${cellWidth}x${cellHeight}`);

      // Skia Image에서 픽셀 데이터 읽기 (RGBA format)
      const pixelData = image.readPixels();

      console.log('PixelData info:', {
        exists: !!pixelData,
        isArray: Array.isArray(pixelData),
        length: pixelData?.length,
        expectedLength: imgWidth * imgHeight * 4,
        firstPixels: pixelData ? `R:${pixelData[0]} G:${pixelData[1]} B:${pixelData[2]} A:${pixelData[3]}` : 'N/A'
      });

      if (!pixelData) {
        console.warn('Failed to read pixel data, using pattern fallback');
        // 픽셀 데이터를 읽을 수 없으면 기존 패턴 방식 사용
        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            const colorIndex = (row * 7 + col * 13) % colorCount;
            newGrid.push({
              id: `${row}-${col}`,
              row,
              col,
              targetColor: colors[colorIndex].id,
              currentColor: null,
              filled: false,
            });
          }
        }
        setGrid(newGrid);
        return;
      }

      // 각 셀의 평균 색상 추출
      let sampleCount = 0;
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          // 셀의 중심점 좌표 (캔버스 좌표)
          const cellCenterX = (col + 0.5) * cellWidth;
          const cellCenterY = (row + 0.5) * cellHeight;

          // 이미지 좌표로 변환 (캔버스를 이미지에 맞춰 스케일)
          const imgX = Math.floor((cellCenterX / CANVAS_WIDTH) * imgWidth);
          const imgY = Math.floor((cellCenterY / CANVAS_HEIGHT) * imgHeight);

          // 픽셀 인덱스 계산 (RGBA = 4 bytes per pixel)
          const pixelIndex = (imgY * imgWidth + imgX) * 4;

          // RGB 값 추출 (Alpha는 무시)
          const r = pixelData[pixelIndex] || 0;
          const g = pixelData[pixelIndex + 1] || 0;
          const b = pixelData[pixelIndex + 2] || 0;

          // 팔레트에서 가장 가까운 색상 찾기 (유클리드 거리)
          let minDistance = Infinity;
          let closestColor = colors[0];

          colors.forEach(paletteColor => {
            // Hex를 RGB로 변환
            const pR = parseInt(paletteColor.hex.slice(1, 3), 16);
            const pG = parseInt(paletteColor.hex.slice(3, 5), 16);
            const pB = parseInt(paletteColor.hex.slice(5, 7), 16);

            // 색상 거리 계산
            const distance = Math.sqrt(
              Math.pow(r - pR, 2) +
              Math.pow(g - pG, 2) +
              Math.pow(b - pB, 2)
            );

            if (distance < minDistance) {
              minDistance = distance;
              closestColor = paletteColor;
            }
          });

          // 처음 5개 셀의 샘플 로그 출력
          if (sampleCount < 5) {
            console.log(`Cell[${row},${col}]: imgPos(${imgX},${imgY}) RGB(${r},${g},${b}) -> ${closestColor.id}(${closestColor.hex}) dist=${minDistance.toFixed(1)}`);
            sampleCount++;
          }

          newGrid.push({
            id: `${row}-${col}`,
            row,
            col,
            targetColor: closestColor.id,
            currentColor: null,
            filled: false,
          });
        }
      }

      console.log(`Generated ${newGrid.length} cells with pixel-based color matching`);
      setGrid(newGrid);
    } catch (error) {
      console.error('Grid generation from image failed:', error);
      // 실패하면 랜덤 그리드로 폴백
      generateGrid();
    }
  };

  // 거리 계산 (핀치 줌용)
  const getDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [touch1, touch2] = touches;
    return Math.sqrt(
      Math.pow(touch2.pageX - touch1.pageX, 2) +
      Math.pow(touch2.pageY - touch1.pageY, 2)
    );
  };

  // 중심점 계산
  const getCenter = (touches) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    const sumX = touches.reduce((sum, t) => sum + t.pageX, 0);
    const sumY = touches.reduce((sum, t) => sum + t.pageY, 0);
    return {
      x: sumX / touches.length,
      y: sumY / touches.length,
    };
  };

  // 셀 좌표를 그리드 인덱스로 변환
  const getCellFromPosition = (x, y) => {
    const cellWidth = CANVAS_WIDTH / gridSize;
    const cellHeight = CANVAS_HEIGHT / gridSize;

    // 터치 좌표는 이미 캔버스 로컬 좌표이므로 줌/팬만 역변환
    // scale = 1, translate = 0일 때: touch(100, 100) = cell at (100, 100)
    // scale = 2, translate = 50일 때: touch(100, 100) = cell at ((100-50)/2) = 25
    const worldX = (x - translateX) / scale;
    const worldY = (y - translateY) / scale;

    const col = Math.floor(worldX / cellWidth);
    const row = Math.floor(worldY / cellHeight);

    console.log(`Touch: (${x.toFixed(0)}, ${y.toFixed(0)}) Scale: ${scale.toFixed(2)} Translate: (${translateX.toFixed(0)}, ${translateY.toFixed(0)}) -> World: (${worldX.toFixed(0)}, ${worldY.toFixed(0)}) -> Cell: (${row}, ${col})`);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      return { row, col };
    }
    return null;
  };

  // 히스토리에 그리드 저장
  const saveToHistory = (newGrid) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newGrid)));
    // 히스토리 크기 제한 (최대 50개)
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(prev => prev + 1);
    }
    setHistory(newHistory);
  };

  // 실행 취소
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setGrid(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  // 다시 실행
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setGrid(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // 셀 색칠 (알파벳 검증 방식)
  const fillCell = (row, col) => {
    const cellId = `${row}-${col}`;
    const targetCell = grid.find(cell => cell.id === cellId);

    if (!targetCell || targetCell.filled) {
      return; // 이미 채워진 셀은 무시
    }

    // 검증: 선택한 색상이 셀의 정답 색상과 일치하는가?
    if (targetCell.targetColor === selectedColor.id) {
      // 정답! 셀을 칠한다
      const newGrid = grid.map(cell =>
        cell.id === cellId
          ? { ...cell, currentColor: selectedColor.id, filled: true }
          : cell
      );
      setGrid(newGrid);
      saveToHistory(newGrid);

      // 점수 애니메이션
      setScorePopup('+10');
      setTimeout(() => setScorePopup(null), 1000);
      setScore(prev => prev + 10);

      console.log(`✅ 정답! Cell[${row},${col}] = ${selectedColor.id}`);
    } else {
      // 오답! 점수 감점 및 경고
      setMistakes(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
      Alert.alert(
        '❌ 틀렸습니다!',
        `이 셀은 '${targetCell.targetColor}'입니다.\n현재 선택: '${selectedColor.id}'\n\n점수 -5점`,
        [{ text: '확인' }]
      );
      console.log(`❌ 오답! Cell[${row},${col}] target=${targetCell.targetColor}, selected=${selectedColor.id}`);
    }
  };

  // PanResponder 설정 (터치/펜 입력)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        touchInfo.current.touches = touches;

        if (touches.length === 1) {
          // 단일 터치 - 색칠 모드
          // locationX/Y는 터치된 View 내부의 로컬 좌표
          const touch = touches[0];
          const localX = touch.locationX || 0;
          const localY = touch.locationY || 0;
          console.log(`Touch Grant: locationX=${localX.toFixed(0)}, locationY=${localY.toFixed(0)}, pageX=${touch.pageX.toFixed(0)}, pageY=${touch.pageY.toFixed(0)}`);
          const cell = getCellFromPosition(localX, localY);
          if (cell) {
            fillCell(cell.row, cell.col);
          }
        } else if (touches.length === 2) {
          // 두 손가락 - 줌/팬 모드
          touchInfo.current.initialDistance = getDistance(touches);
          touchInfo.current.initialCenter = getCenter(touches);
          setLastScale(scale);
          setLastTranslate({ x: translateX, y: translateY });
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 1 && !touchInfo.current.isPinching) {
          // 드래그하면서 색칠
          // locationX/Y는 터치된 View 내부의 로컬 좌표
          const touch = touches[0];
          const localX = touch.locationX || 0;
          const localY = touch.locationY || 0;
          const cell = getCellFromPosition(localX, localY);
          if (cell) {
            fillCell(cell.row, cell.col);
          }
        } else if (touches.length === 2) {
          touchInfo.current.isPinching = true;

          // 핀치 줌
          const currentDistance = getDistance(touches);
          const currentCenter = getCenter(touches);

          if (!touchInfo.current.initialDistance) {
            touchInfo.current.initialDistance = currentDistance;
            touchInfo.current.initialCenter = currentCenter;
            return;
          }

          const initialDistance = touchInfo.current.initialDistance;
          const initialCenter = touchInfo.current.initialCenter;

          // 스케일 계산
          const scaleChange = currentDistance / initialDistance;
          const newScale = Math.max(1, Math.min(5, lastScale * scaleChange));

          // 팬 계산
          const deltaX = currentCenter.x - initialCenter.x;
          const deltaY = currentCenter.y - initialCenter.y;

          setScale(newScale);
          setTranslateX(lastTranslate.x + deltaX);
          setTranslateY(lastTranslate.y + deltaY);
        }
      },

      onPanResponderRelease: () => {
        touchInfo.current.touches = [];
        touchInfo.current.isPinching = false;
        touchInfo.current.initialDistance = null;
        touchInfo.current.initialCenter = null;
      },
    })
  ).current;

  const cellWidth = CANVAS_WIDTH / gridSize;
  const cellHeight = CANVAS_HEIGHT / gridSize;

  const handleReset = () => {
    Alert.alert(
      '초기화',
      '모든 색칠을 지우시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: () => {
            setGrid(grid.map(cell => ({ ...cell, currentColor: null, filled: false })));
          },
        },
      ]
    );
  };

  const handleZoomReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  // 진행률 계산
  const progress = Math.round((grid.filter(c => c.filled).length / grid.length) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreEmoji}>🪙</Text>
            <Text style={styles.scoreValue}>+{score}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleUndo}
            style={[styles.iconButton, historyIndex <= 0 && styles.iconButtonDisabled]}
            disabled={historyIndex <= 0}
          >
            <Text style={[styles.iconButtonText, historyIndex <= 0 && styles.iconButtonTextDisabled]}>↶</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRedo}
            style={[styles.iconButton, historyIndex >= history.length - 1 && styles.iconButtonDisabled]}
            disabled={historyIndex >= history.length - 1}
          >
            <Text style={[styles.iconButtonText, historyIndex >= history.length - 1 && styles.iconButtonTextDisabled]}>↷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleZoomReset} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas Area */}
      <View
        style={styles.canvasContainer}
        ref={canvasContainerRef}
        onLayout={(event) => {
          canvasContainerRef.current?.measureInWindow((x, y) => {
            setCanvasOffset({ x, y });
          });
        }}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A255FF" />
            <Text style={styles.loadingText}>퍼즐 생성 중...</Text>
          </View>
        ) : (
          <>
            <Canvas style={styles.canvas}>
              <Group
                transform={[
                  { translateX },
                  { translateY },
                  { scale },
                ]}
              >
                {/* 배경 이미지 (옵션) */}
                {imageUri && sourceType !== 'sample' && image && (
                  <Image
                    image={image}
                    x={0}
                    y={0}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    fit="cover"
                    opacity={0.6}
                  />
                )}

              {/* 격자 셀 렌더링 */}
              {grid.map((cell) => {
                const x = cell.col * cellWidth;
                const y = cell.row * cellHeight;

                return (
                  <Group key={cell.id}>
                    {/* 셀 배경 - 채워진 경우만 색상 표시 */}
                    {cell.filled && (
                      <Rect
                        x={x}
                        y={y}
                        width={cellWidth}
                        height={cellHeight}
                        color={COLOR_PALETTE.find(c => c.id === cell.currentColor)?.hex || '#FFFFFF'}
                        style="fill"
                      />
                    )}

                    {/* 격자 테두리 */}
                    <Rect
                      x={x}
                      y={y}
                      width={cellWidth}
                      height={cellHeight}
                      color="#666666"
                      style="stroke"
                      strokeWidth={0.8}
                    />

                    {/* 색상 코드 레이블 (모든 셀에 항상 표시 - 중앙 배치) */}
                    <SkiaText
                      x={x + cellWidth * 0.2}
                      y={y + cellHeight * 0.7}
                      text={String(cell.targetColor)}
                      color={cell.filled ? "#FFFFFF" : "#000000"}
                      font={font}
                    />
                  </Group>
                );
              })}
            </Group>
          </Canvas>
          <View
            style={styles.touchOverlay}
            {...panResponder.panHandlers}
          />
          </>
        )}
      </View>

      {/* Score Popup Animation */}
      {scorePopup && (
        <View style={styles.scorePopupContainer}>
          <Text style={styles.scorePopupText}>{scorePopup}</Text>
        </View>
      )}

      {/* Zoom Info */}
      <View style={styles.zoomInfo}>
        <Text style={styles.zoomText}>
          줌: {scale.toFixed(1)}x | 탭하거나 드래그해서 색칠하세요
        </Text>
      </View>

      {/* Color Palette */}
      <View style={styles.paletteContainer}>
        <View style={styles.palette}>
          {COLOR_PALETTE.slice(0, colorCount).map((color) => {
            // 이 색상의 모든 셀이 칠해졌는지 확인
            const colorCells = grid.filter(cell => cell.targetColor === color.id);
            const isColorCompleted = colorCells.length > 0 && colorCells.every(cell => cell.filled);

            return (
              <TouchableOpacity
                key={color.id}
                style={[
                  styles.colorButton,
                  { backgroundColor: color.hex },
                  selectedColor.id === color.id && styles.colorButtonSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              >
                <Text style={styles.colorLabel}>{color.id}</Text>
                {isColorCompleted && (
                  <View style={styles.completionCheckmark}>
                    <Text style={styles.completionCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#A255FF',
    fontWeight: 'bold',
  },
  backIconButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#A255FF',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scoreEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1B1F',
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#A255FF',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CD964',
    marginTop: 2,
  },
  mistakesText: {
    fontSize: 12,
    color: '#FF5757',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 12,
    padding: 8,
  },
  iconButtonText: {
    fontSize: 20,
  },
  iconButtonDisabled: {
    opacity: 0.3,
  },
  iconButtonTextDisabled: {
    color: '#999',
  },
  scorePopupContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: '#4CD964',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scorePopupText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  zoomInfo: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  zoomText: {
    fontSize: 12,
    color: '#666',
  },
  paletteContainer: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginBottom: 12,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  colorButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    margin: 3,
  },
  colorButtonSelected: {
    borderColor: '#1C1B1F',
    borderWidth: 4,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  colorCheckmark: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CD964',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  completionCheckmark: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CD964',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  completionCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
