import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ImageBackground, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

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

// 셀 컴포넌트 (React.memo로 최적화)
const GridCell = React.memo(({ cell, cellSize, colorMap, filled, onPress }) => {
  const targetColorHex = colorMap.get(cell.targetColorId);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      style={[
        styles.gridCell,
        {
          width: cellSize,
          height: cellSize,
          left: cell.col * cellSize,
          top: cell.row * cellSize,
          backgroundColor: filled ? targetColorHex : 'transparent',
          borderWidth: 0.5,
          borderColor: '#E0E0E0',
        },
      ]}
    />
  );
}, (prev, next) => {
  // filled 상태가 변경되었을 때만 리렌더
  return prev.filled === next.filled;
});

export default function PlayScreenNative({ route, navigation }) {
  const { imageUri, colorCount = 36, gridColors } = route.params || {};
  const gridSize = 60; // 60x60 격자
  const gridPixelSize = 600; // 600x600px
  const cellSize = gridPixelSize / gridSize; // 10px per cell

  // 색상 ID → hex 매핑
  const colorMap = useMemo(() => {
    const map = new Map();
    COLOR_PALETTE.forEach(c => map.set(c.id, c.hex));
    return map;
  }, []);

  // 초기 격자 생성
  const initialGrid = useMemo(() => {
    const colors = COLOR_PALETTE.slice(0, colorCount);
    const grid = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        let targetColorId;
        if (gridColors && gridColors[row] && gridColors[row][col] !== undefined) {
          targetColorId = colors[gridColors[row][col] % colorCount]?.id || colors[0].id;
        } else {
          targetColorId = colors[Math.floor(Math.random() * colors.length)].id;
        }

        grid.push({
          id: `${row}-${col}`,
          row,
          col,
          targetColorId,
        });
      }
    }

    return grid;
  }, [gridSize, colorCount, gridColors]);

  // 채워진 셀 추적 (Set으로 빠른 조회)
  const [filledCells, setFilledCells] = useState(new Set());
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [score, setScore] = useState(100);

  // 터치 중복 방지
  const lastTouchedCell = useRef({ row: -1, col: -1 });

  // 셀 칠하기 핸들러 (즉시 반응)
  const paintCell = useCallback((cell) => {
    const cellKey = cell.id;

    // 이미 채워졌으면 스킵
    if (filledCells.has(cellKey)) return;

    // 색상 검증
    if (cell.targetColorId !== selectedColor.id) {
      // 틀린 색상 - 점수 감점
      setScore(prev => Math.max(0, prev - 5));
      return;
    }

    // 셀 채우기 (즉시 반영)
    setFilledCells(prev => {
      const newSet = new Set(prev);
      newSet.add(cellKey);
      return newSet;
    });

    // 점수 증가
    setScore(prev => prev + 10);
  }, [filledCells, selectedColor]);

  // 터치 좌표 → 셀 찾기
  const findCellAtPosition = useCallback((x, y) => {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
      return null;
    }

    const index = row * gridSize + col;
    return initialGrid[index];
  }, [cellSize, gridSize, initialGrid]);

  // Pan Gesture 핸들러 (worklet 함수)
  const handlePanBegin = useCallback((x, y) => {
    const cell = findCellAtPosition(x, y);
    if (cell) {
      lastTouchedCell.current = { row: cell.row, col: cell.col };
      paintCell(cell);
    }
  }, [findCellAtPosition, paintCell]);

  const handlePanUpdate = useCallback((x, y) => {
    const cell = findCellAtPosition(x, y);
    if (!cell) return;

    // 중복 터치 방지
    if (
      lastTouchedCell.current.row === cell.row &&
      lastTouchedCell.current.col === cell.col
    ) {
      return;
    }

    lastTouchedCell.current = { row: cell.row, col: cell.col };
    paintCell(cell);
  }, [findCellAtPosition, paintCell]);

  // Pan Gesture (runOnJS로 브리지 건너기)
  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      runOnJS(handlePanBegin)(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      runOnJS(handlePanUpdate)(event.x, event.y);
    })
    .minDistance(0);

  // 색상 선택 핸들러
  const handleColorSelect = useCallback((color) => {
    setSelectedColor(color);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.score}>점수: {score}</Text>
        </View>

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <GestureDetector gesture={panGesture}>
            <View style={{ width: gridPixelSize, height: gridPixelSize }}>
              {/* 배경 이미지 */}
              {imageUri && (
                <ImageBackground
                  source={{ uri: imageUri }}
                  style={[
                    StyleSheet.absoluteFill,
                    { width: gridPixelSize, height: gridPixelSize },
                  ]}
                  resizeMode="cover"
                />
              )}

              {/* 그리드 셀 (3600개) */}
              {initialGrid.map(cell => (
                <GridCell
                  key={cell.id}
                  cell={cell}
                  cellSize={cellSize}
                  colorMap={colorMap}
                  filled={filledCells.has(cell.id)}
                  onPress={() => paintCell(cell)}
                />
              ))}
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
  gridCell: {
    position: 'absolute',
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
