import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Canvas, Rect, Text as SkText, useFont, matchFont, useImage, Image as SkImage, Group, useValue as useSkiaValue } from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 색상 팔레트 (A-Z + 0-9 = 36가지)
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
  { id: 'R', hex: '#D2691E', name: '초콜릿' },
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
  { id: '7', hex: '#FA8072', name: '연어' },
  { id: '8', hex: '#DEB887', name: '버릴우드' },
  { id: '9', hex: '#5F9EA0', name: '카뎃블루' },
  { id: '0', hex: '#191970', name: '미드나잇블루' },
];

export default function PlayScreenSimple({ route, navigation }) {
  const { imageUri, colorCount = 36, gridColors } = route.params || {};
  const gridSize = 60; // 60x60 격자 (세밀한 그리기)

  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const selectedColorId = useSharedValue(COLOR_PALETTE[0].id); // worklet에서 접근 가능
  const [highlightedColor, setHighlightedColor] = useState(null); // 음영 표시할 색상
  const [grid, setGrid] = useState(() => {
    const newGrid = [];
    const colors = COLOR_PALETTE.slice(0, colorCount);

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // gridColors가 있으면 사용, 없으면 랜덤
        let targetColor;
        if (gridColors && gridColors[row] && gridColors[row][col] !== undefined) {
          targetColor = colors[gridColors[row][col] % colorCount]?.id || colors[0].id;
        } else {
          targetColor = colors[Math.floor(Math.random() * colors.length)].id;
        }

        newGrid.push({
          id: `${row}-${col}`,
          row,
          col,
          targetColor,
          filled: false
        });
      }
    }
    return newGrid;
  });

  const [score, setScore] = useState(100);
  const [isPainting, setIsPainting] = useState(false);

  // Grid를 ref로 추적 (worklet에서 즉시 접근용)
  const gridRef = useRef(grid);

  // grid 변경 시 gridRef도 업데이트 (동기화)
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // 즉시 렌더링을 위한 SharedValue (UI 스레드에서 직접 업데이트, 브리지 없음)
  const filledCellsMap = useSharedValue({});  // { "row-col": true }
  const renderVersion = useSharedValue(0);    // 강제 재렌더 트리거

  // Canvas가 읽을 수 있는 일반 state (renderVersion 변경 시 업데이트)
  const [reactiveFilledCells, setReactiveFilledCells] = useState({});

  // renderVersion 변경 감지해서 React state 동기화
  useAnimatedReaction(
    () => renderVersion.value,
    () => {
      runOnJS(setReactiveFilledCells)({ ...filledCellsMap.value });
    }
  );

  // Pinch-to-zoom values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const cellSize = 10; // 10px 셀 (60x60 격자용, 세밀한 그리기)
  const gridPixelSize = gridSize * cellSize; // 600px

  // Skia 폰트 생성 (시스템 폰트 사용)
  const font = matchFont({
    fontFamily: 'sans-serif',
    fontSize: 6,
    fontWeight: 'bold',
  });

  // File URI 이미지를 Skia로 로드
  const backgroundImage = useImage(imageUri);

  // 이미지 로딩 상태 디버깅
  useEffect(() => {
    console.log('=== 이미지 디버그 시작 ===');
    console.log('imageUri 존재 여부:', !!imageUri);
    if (imageUri) {
      console.log('imageUri 타입:', typeof imageUri);
      console.log('imageUri 값:', imageUri);
    }
    console.log('backgroundImage 존재 여부:', !!backgroundImage);
    if (backgroundImage) {
      console.log('backgroundImage width:', backgroundImage.width());
      console.log('backgroundImage height:', backgroundImage.height());
    }
    console.log('=== 이미지 디버그 끝 ===');
  }, [backgroundImage, imageUri]);

  // 캔버스 컨테이너의 위치를 추적
  const canvasLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });

  // 마지막 터치된 셀 추적 (중복 터치 방지 - Worklet에서 사용)
  const lastTouchedCell = useSharedValue({ row: -1, col: -1 });

  // 셀 칠하기 콜백 (worklet에서 runOnJS로 호출)
  const paintCell = useCallback((row, col) => {
    const cellIndex = row * gridSize + col;
    const currentCell = gridRef.current[cellIndex];

    if (currentCell && !currentCell.filled && currentCell.targetColor === selectedColor.id) {
      // gridRef 직접 수정
      currentCell.filled = true;

      // grid state도 업데이트 (Canvas가 자동으로 재렌더)
      setGrid(prev => {
        const newGrid = [...prev];
        newGrid[cellIndex] = { ...newGrid[cellIndex], filled: true };
        return newGrid;
      });

      // 스코어 증가
      setScore(prev => prev + 10);
      return true;
    }
    return false;
  }, [gridSize, selectedColor]);

  // 셀 터치 핸들러 (단일 셀 - 즉시 렌더링)
  const handleCellTouch = useCallback((row, col) => {
    const cellIndex = row * gridSize + col;
    const currentCell = gridRef.current[cellIndex];

    if (!currentCell || currentCell.filled) {
      return false; // 이미 칠해진 셀은 무시
    }

    // 색상 검증: 선택된 색상과 일치하는 셀만 칠하기
    if (currentCell.targetColor !== selectedColor.id) {
      return false; // 잘못된 색상은 칠하지 않음
    }

    // gridRef 직접 수정 (즉시 반영)
    currentCell.filled = true;

    // 스코어 업데이트 (올바른 색상만 +10점)
    setScore(prev => prev + 10);

    return true; // 칠하기 성공
  }, [selectedColor, gridSize]);

  // 배치 셀 칠하기 핸들러 (여러 셀을 한 번에 처리 - 즉시 렌더링)
  const handleBatchCellPaint = useCallback((cells) => {
    let paintedCount = 0;

    cells.forEach(({ row, col }) => {
      const cellIndex = row * gridSize + col;
      const currentCell = gridRef.current[cellIndex];

      // 색상 검증: 선택된 색상과 일치하는 셀만 칠하기
      if (currentCell && !currentCell.filled && currentCell.targetColor === selectedColor.id) {
        currentCell.filled = true;
        paintedCount++;
      }
    });

    if (paintedCount > 0) {
      setScore(prev => prev + (paintedCount * 10)); // 올바른 색상만 +10점씩
      setRenderCount(prev => prev + 1); // Canvas 즉시 재렌더 (딜레이 없음)
    }
  }, [selectedColor, gridSize]);

  // 하단 알파벳 버튼 터치 시 해당 부위 음영 표시 (토글)
  const handleColorButtonPress = useCallback((color) => {
    setSelectedColor(color);
    selectedColorId.value = color.id; // worklet용 SharedValue도 업데이트

    // 같은 색상을 다시 누르면 음영 해제, 다른 색상이면 음영 표시
    if (highlightedColor === color.id) {
      setHighlightedColor(null);
    } else {
      setHighlightedColor(color.id);
    }
  }, [highlightedColor, selectedColorId]);

  // 한 손가락 제스처 - 즉시 반응하는 칠하기 (runOnJS 제거)
  const paintGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      runOnJS(setIsPainting)(true);

      // 터치 좌표 변환
      const relativeX = e.absoluteX - canvasLayout.value.x;
      const relativeY = e.absoluteY - canvasLayout.value.y;
      const centerX = canvasLayout.value.width / 2;
      const centerY = canvasLayout.value.height / 2;
      const canvasX = (relativeX - centerX - translateX.value) / scale.value + gridPixelSize / 2;
      const canvasY = (relativeY - centerY - translateY.value) / scale.value + gridPixelSize / 2;
      const col = Math.floor(canvasX / cellSize);
      const row = Math.floor(canvasY / cellSize);

      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        const cellKey = `${row}-${col}`;
        lastTouchedCell.value = { row, col };

        // UI 스레드에서 즉시 업데이트 (브리지 없음 - 펜처럼 즉시 반응!)
        filledCellsMap.value = { ...filledCellsMap.value, [cellKey]: true };
        renderVersion.value += 1;

        // 스코어 업데이트 및 검증은 JS 스레드에서 처리
        runOnJS(paintCell)(row, col);
      }
    })
    .onUpdate((e) => {
      'worklet';

      // 터치 좌표 변환
      const relativeX = e.absoluteX - canvasLayout.value.x;
      const relativeY = e.absoluteY - canvasLayout.value.y;
      const centerX = canvasLayout.value.width / 2;
      const centerY = canvasLayout.value.height / 2;
      const canvasX = (relativeX - centerX - translateX.value) / scale.value + gridPixelSize / 2;
      const canvasY = (relativeY - centerY - translateY.value) / scale.value + gridPixelSize / 2;
      const col = Math.floor(canvasX / cellSize);
      const row = Math.floor(canvasY / cellSize);

      // 유효한 범위 내에서만 처리
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        // 새로운 셀로 이동했을 때만 칠하기
        if (row !== lastTouchedCell.value.row || col !== lastTouchedCell.value.col) {
          const cellKey = `${row}-${col}`;
          lastTouchedCell.value = { row, col };

          // UI 스레드에서 즉시 업데이트 (브리지 없음 - 펜처럼 즉시 반응!)
          filledCellsMap.value = { ...filledCellsMap.value, [cellKey]: true };
          renderVersion.value += 1;

          // 스코어 업데이트 및 검증은 JS 스레드에서 처리
          runOnJS(paintCell)(row, col);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      lastTouchedCell.value = { row: -1, col: -1 };
      runOnJS(setIsPainting)(false);
    })
    .onFinalize(() => {
      'worklet';
      lastTouchedCell.value = { row: -1, col: -1 };
      runOnJS(setIsPainting)(false);
    });

  // 두 손가락 제스처 - 팬 (이동) - 경계 제한 추가
  const panGesture = Gesture.Pan()
    .minPointers(2) // 두 손가락
    .minDistance(1) // 1px 이동부터 인식 (더 민감하게)
    .onStart(() => {
      runOnJS(setIsPainting)(false);
    })
    .onUpdate((e) => {
      // 확대 정도에 따른 이동 제한 계산
      const scaledWidth = gridPixelSize * scale.value;
      const scaledHeight = gridPixelSize * scale.value;
      const maxX = (scaledWidth - gridPixelSize) / 2 + 100; // 여백 100px
      const maxY = (scaledHeight - gridPixelSize) / 2 + 100;

      // 이동값 계산 후 경계 제한
      const newX = savedTranslateX.value + e.translationX;
      const newY = savedTranslateY.value + e.translationY;

      translateX.value = Math.max(-maxX, Math.min(maxX, newX));
      translateY.value = Math.max(-maxY, Math.min(maxY, newY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 두 손가락 제스처 - 핀치 줌 (더 부드럽게)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // 실시간 스케일 업데이트 (부드러운 줌)
      const newScale = savedScale.value * e.scale;

      // 실시간 제한 (0.5 ~ 4배)
      scale.value = Math.max(0.5, Math.min(4, newScale));
    })
    .onEnd(() => {
      // 최소/최대 스케일 제한 (부드러운 스프링 애니메이션)
      if (scale.value < 1) {
        scale.value = withSpring(1, {
          damping: 20,
          stiffness: 90,
        });
      } else if (scale.value > 3) {
        scale.value = withSpring(3, {
          damping: 20,
          stiffness: 90,
        });
      }
      savedScale.value = scale.value;
    });

  // 제스처 조합: Simultaneous로 동시 인식, 손가락 수로 자동 분리
  const composed = Gesture.Simultaneous(
    paintGesture, // 한 손가락: 칠하기
    panGesture,   // 두 손가락: 이동
    pinchGesture  // 두 손가락: 확대/축소
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreEmoji}>🪙</Text>
            <Text style={styles.scoreValue}>+{score}</Text>
          </View>
        </View>

        {/* Grid with Pinch Zoom */}
        <View
          style={styles.gridContainer}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            canvasLayout.value = { x, y, width, height };
          }}
        >
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.canvasWrapper, animatedStyle]}>
              <View style={styles.canvasContainer}>
                {/* Skia Canvas로 격자 렌더링 (하드웨어 가속) */}
                <Canvas style={{ width: gridPixelSize, height: gridPixelSize }}>
                  {/* 격자 셀들 렌더링 - filledCellsMap 변경 시 즉시 재렌더 */}
                  {grid.map((cell) => {
                    const x = cell.col * cellSize;
                    const y = cell.row * cellSize;
                    const cellKey = `${cell.row}-${cell.col}`;

                    // reactiveFilledCells에서 filled 상태 확인 (우선순위)
                    const isFilled = reactiveFilledCells[cellKey] || cell.filled;
                    const isHighlighted = highlightedColor === cell.targetColor && !isFilled;

                    return (
                      <React.Fragment key={cell.id}>
                        {/* 칠해진 셀 처리 */}
                        {isFilled ? (
                          backgroundImage ? (
                            // 이미지가 로드됨: 원본 이미지의 해당 부분만 크로핑하여 표시
                            <Group
                              transform={[{ translateX: x }, { translateY: y }]}
                              clip={{ x: 0, y: 0, width: cellSize, height: cellSize }}
                            >
                              <SkImage
                                image={backgroundImage}
                                x={-x}
                                y={-y}
                                width={gridPixelSize}
                                height={gridPixelSize}
                                fit="none"
                              />
                            </Group>
                          ) : (
                            // 이미지 없음: 해당 색상으로 표시 (폴백)
                            <Rect
                              x={x}
                              y={y}
                              width={cellSize}
                              height={cellSize}
                              color={COLOR_PALETTE.find(c => c.id === cell.targetColor)?.hex || '#CCCCCC'}
                              style="fill"
                            />
                          )
                        ) : (
                          // 빈 셀: 흰 배경
                          <Rect
                            x={x}
                            y={y}
                            width={cellSize}
                            height={cellSize}
                            color="#FFFFFF"
                            style="fill"
                          />
                        )}

                        {/* 셀 테두리 */}
                        <Rect
                          x={x}
                          y={y}
                          width={cellSize}
                          height={cellSize}
                          color="#999999"
                          style="stroke"
                          strokeWidth={0.5}
                        />

                        {/* 빈 셀에 알파벳 표시 */}
                        {!cell.filled && (
                          <SkText
                            x={x + cellSize / 2 - 2}
                            y={y + cellSize / 2 + 2}
                            text={cell.targetColor}
                            color="#333333"
                            font={font}
                          />
                        )}

                        {/* 하이라이트 오버레이 */}
                        {isHighlighted && (
                          <>
                            <Rect
                              x={x}
                              y={y}
                              width={cellSize}
                              height={cellSize}
                              color="rgba(255, 215, 0, 0.4)"
                              style="fill"
                            />
                            <Rect
                              x={x}
                              y={y}
                              width={cellSize}
                              height={cellSize}
                              color="#FFD700"
                              style="stroke"
                              strokeWidth={1}
                            />
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Canvas>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Color Palette */}
        <View style={styles.paletteContainer}>
          <Text style={styles.paletteTitle}>색상 선택 (탭하면 해당 부위 음영 표시)</Text>
          <View style={styles.palette}>
            {COLOR_PALETTE.slice(0, colorCount).map((color) => (
              <TouchableOpacity
                key={color.id}
                style={[
                  styles.colorButton,
                  { backgroundColor: color.hex },
                  selectedColor.id === color.id && styles.colorButtonSelected,
                ]}
                onPress={() => handleColorButtonPress(color)}
                activeOpacity={0.7}
              >
                <Text style={styles.colorLabel}>{color.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
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
    fontSize: 18,
    color: '#A255FF',
    fontWeight: 'bold',
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
  gridContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#999',
  },
  cellLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    lineHeight: 16,
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.4)', // 골드 음영 40% 투명도
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  paletteContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#1C1C1E',
    maxHeight: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  paletteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  colorButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  colorButtonSelected: {
    borderColor: '#FFD700',
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
