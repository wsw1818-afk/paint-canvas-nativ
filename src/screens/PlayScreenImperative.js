import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnUI, useSharedValue } from 'react-native-reanimated';
import {
  Canvas,
  useCanvasRef,
  Skia,
  Paint,
  useImage
} from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 색상 팔레트
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

export default function PlayScreenImperative({ route, navigation }) {
  const { imageUri, colorCount = 36, gridColors } = route.params || {};
  const gridSize = 60; // 60x60 격자 (세밀한 그리기)
  const gridPixelSize = 600; // 600x600px Canvas
  const cellSize = gridPixelSize / gridSize; // 10px per cell

  const canvasRef = useCanvasRef();
  const image = useImage(imageUri);

  // 격자 데이터 (UI 스레드에서 접근 가능)
  const gridDataRef = useRef(null);
  const filledCellsRef = useRef(new Set()); // 채워진 셀 추적

  // 색상 매핑 (id -> hex)
  const colorMapRef = useRef(new Map());
  useEffect(() => {
    COLOR_PALETTE.forEach(c => colorMapRef.current.set(c.id, c.hex));
  }, []);

  // 초기 격자 생성
  useEffect(() => {
    const colors = COLOR_PALETTE.slice(0, colorCount);
    const grid = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        let targetColor;
        if (gridColors && gridColors[row] && gridColors[row][col] !== undefined) {
          targetColor = colors[gridColors[row][col] % colorCount]?.id || colors[0].id;
        } else {
          targetColor = colors[Math.floor(Math.random() * colors.length)].id;
        }

        grid.push({
          row,
          col,
          targetColorId: targetColor,
        });
      }
    }

    gridDataRef.current = grid;

    // 초기 Canvas 렌더링
    if (canvasRef.current && image) {
      renderCanvas();
    }
  }, [gridSize, colorCount, gridColors, image]);

  // 선택된 색상
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const selectedColorHex = useSharedValue(COLOR_PALETTE[0].hex);
  const selectedColorId = useSharedValue(COLOR_PALETTE[0].id);

  const handleColorSelect = useCallback((color) => {
    setSelectedColor(color);
    selectedColorHex.value = color.hex;
    selectedColorId.value = color.id;
  }, []);

  // Canvas 렌더링 (명령형 API)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Canvas 지우기
    const surface = Skia.Surface.MakeOffscreen(gridPixelSize, gridPixelSize);
    if (!surface) return;

    const skCanvas = surface.getCanvas();

    // 1. 배경 이미지 그리기
    const srcRect = Skia.XYWHRect(0, 0, image.width(), image.height());
    const destRect = Skia.XYWHRect(0, 0, gridPixelSize, gridPixelSize);
    skCanvas.drawImageRect(image, srcRect, destRect, Skia.Paint());

    // 2. 격자 그리기
    const gridPaint = Skia.Paint();
    gridPaint.setColor(Skia.Color('#E0E0E0'));
    gridPaint.setStyle(0); // Stroke
    gridPaint.setStrokeWidth(0.5);

    for (let i = 0; i <= gridSize; i++) {
      const pos = i * cellSize;
      skCanvas.drawLine(pos, 0, pos, gridPixelSize, gridPaint);
      skCanvas.drawLine(0, pos, gridPixelSize, pos, gridPaint);
    }

    // 3. 채워진 셀 그리기
    gridDataRef.current?.forEach(cell => {
      const cellKey = `${cell.row}-${cell.col}`;
      if (filledCellsRef.current.has(cellKey)) {
        const x = cell.col * cellSize;
        const y = cell.row * cellSize;

        const fillPaint = Skia.Paint();
        const hex = colorMapRef.current.get(cell.targetColorId) || '#FFFFFF';
        fillPaint.setColor(Skia.Color(hex));
        fillPaint.setStyle(1); // Fill

        skCanvas.drawRect(Skia.XYWHRect(x, y, cellSize, cellSize), fillPaint);
      }
    });

    // Canvas에 그리기
    const snapshot = surface.makeImageSnapshot();
    canvas.drawImage(snapshot, 0, 0);
  }, [canvasRef, image, gridSize, cellSize, gridPixelSize]);

  // 터치로 셀 채우기 (UI 스레드에서 즉시 실행)
  const paintCellImmediate = useCallback((x, y) => {
    'worklet';

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return;

    const cellKey = `${row}-${col}`;
    const cellIndex = row * gridSize + col;

    if (!gridDataRef.current || !gridDataRef.current[cellIndex]) return;

    const cell = gridDataRef.current[cellIndex];

    // 이미 채워졌으면 스킵
    if (filledCellsRef.current.has(cellKey)) return;

    // 색상이 맞는지 확인
    if (cell.targetColorId !== selectedColorId.value) {
      // 틀린 색상 - 점수 감점 로직 (나중에 추가)
      return;
    }

    // 셀 채우기
    filledCellsRef.current.add(cellKey);

    // 즉시 Canvas에 그리기
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x_pos = col * cellSize;
    const y_pos = row * cellSize;

    const fillPaint = Skia.Paint();
    const hex = colorMapRef.current.get(cell.targetColorId) || '#FFFFFF';
    fillPaint.setColor(Skia.Color(hex));
    fillPaint.setStyle(1); // Fill

    canvas.drawRect(
      Skia.XYWHRect(x_pos, y_pos, cellSize, cellSize),
      fillPaint
    );
  }, [canvasRef, cellSize, gridSize, selectedColorId]);

  // 제스처 핸들러
  const lastTouchedCell = useSharedValue({ row: -1, col: -1 });

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      const x = event.x;
      const y = event.y;

      runOnUI(() => {
        paintCellImmediate(x, y);
      })();
    })
    .onUpdate((event) => {
      const x = event.x;
      const y = event.y;

      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);

      // 같은 셀 중복 터치 방지
      if (lastTouchedCell.value.row === row && lastTouchedCell.value.col === col) {
        return;
      }

      lastTouchedCell.value = { row, col };

      runOnUI(() => {
        paintCellImmediate(x, y);
      })();
    })
    .minDistance(0)
    .failOffsetX([-1000, 1000]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.score}>점수: {100}</Text>
        </View>

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <GestureDetector gesture={panGesture}>
            <View style={{ width: gridPixelSize, height: gridPixelSize }}>
              <Canvas
                ref={canvasRef}
                style={{ width: gridPixelSize, height: gridPixelSize }}
              />
            </View>
          </GestureDetector>
        </View>

        {/* 색상 팔레트 */}
        <View style={styles.paletteContainer}>
          <Text style={styles.paletteTitle}>색상 선택</Text>
          <View style={styles.palette}>
            {COLOR_PALETTE.slice(0, colorCount).map((color) => (
              <TouchableOpacity
                key={color.id}
                style={[
                  styles.colorButton,
                  { backgroundColor: color.hex },
                  selectedColor.id === color.id && styles.colorButtonSelected
                ]}
                onPress={() => handleColorSelect(color)}
              >
                <Text style={styles.colorId}>{color.id}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#A255FF',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1B1F',
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  paletteContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paletteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1C1B1F',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#000',
    borderWidth: 3,
  },
  colorId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
