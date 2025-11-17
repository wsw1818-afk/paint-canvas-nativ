import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Canvas, Image, useImage, Rect, Group, Text as SkiaText, useFont } from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH;
const CANVAS_HEIGHT = SCREEN_HEIGHT - 250; // 헤더 + 팔레트 공간 제외

// 색상 팔레트
const COLOR_PALETTE = [
  { id: 'A', hex: '#FF5757', name: '빨강' },
  { id: 'B', hex: '#FFC300', name: '노랑' },
  { id: 'C', hex: '#4CD964', name: '초록' },
  { id: 'D', hex: '#5AB9EA', name: '파랑' },
  { id: 'E', hex: '#A255FF', name: '보라' },
  { id: 'F', hex: '#FF6B9D', name: '분홍' },
  { id: 'G', hex: '#FF9500', name: '주황' },
  { id: 'H', hex: '#00D4AA', name: '청록' },
];

export default function PlayScreen({ route, navigation }) {
  const { imageUri, colorCount = 5, sourceType } = route.params || {};

  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [grid, setGrid] = useState([]);
  const [gridSize, setGridSize] = useState(30); // 30x30 격자
  const [loading, setLoading] = useState(true);

  // 줌/팬 상태
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastScale, setLastScale] = useState(1);
  const [lastTranslate, setLastTranslate] = useState({ x: 0, y: 0 });

  // 터치 정보 저장
  const touchInfo = useRef({ touches: [] });

  // Skia 이미지 로드 - sample 모드일 때는 이미지 없이 격자만 표시
  const image = useImage(imageUri);

  // 초기 격자 생성
  useEffect(() => {
    generateGrid();
    setLoading(false);
  }, [gridSize, colorCount]);

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

    // 줌/팬 역변환
    const worldX = (x - translateX) / scale;
    const worldY = (y - translateY) / scale;

    const col = Math.floor(worldX / cellWidth);
    const row = Math.floor(worldY / cellHeight);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      return { row, col };
    }
    return null;
  };

  // 셀 색칠
  const fillCell = (row, col) => {
    const cellId = `${row}-${col}`;
    setGrid(prevGrid =>
      prevGrid.map(cell =>
        cell.id === cellId
          ? { ...cell, currentColor: selectedColor.id, filled: true }
          : cell
      )
    );
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
          // 단일 터치 - 색칠 모드 (locationX/Y는 canvas 컨테이너 기준)
          const cell = getCellFromPosition(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
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

        if (touches.length === 1) {
          // 드래그하면서 색칠 (locationX/Y는 canvas 컨테이너 기준)
          const cell = getCellFromPosition(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          if (cell) {
            fillCell(cell.row, cell.col);
          }
        } else if (touches.length === 2) {
          // 핀치 줌
          const currentDistance = getDistance(touches);
          const currentCenter = getCenter(touches);
          const initialDistance = touchInfo.current.initialDistance || currentDistance;
          const initialCenter = touchInfo.current.initialCenter || currentCenter;

          // 스케일 계산
          const newScale = Math.max(1, Math.min(5, lastScale * (currentDistance / initialDistance)));

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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 나가기</Text>
        </TouchableOpacity>
        <Text style={styles.progressText}>{progress}%</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleZoomReset} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A255FF" />
            <Text style={styles.loadingText}>퍼즐 생성 중...</Text>
          </View>
        ) : (
          <Canvas style={styles.canvas}>
            <Group
              transform={[
                { translateX },
                { translateY },
                { scale },
              ]}
            >
              {/* 배경 이미지 (옵션) */}
              {image && (
                <Image
                  image={image}
                  x={0}
                  y={0}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  fit="cover"
                  opacity={0.3}
                />
              )}

              {/* 격자 셀 렌더링 */}
              {grid.map((cell) => {
                const x = cell.col * cellWidth;
                const y = cell.row * cellHeight;
                const color = cell.filled
                  ? COLOR_PALETTE.find(c => c.id === cell.currentColor)?.hex || '#FFFFFF'
                  : '#FFFFFF';

                return (
                  <Group key={cell.id}>
                    {/* 셀 배경 */}
                    <Rect
                      x={x}
                      y={y}
                      width={cellWidth}
                      height={cellHeight}
                      color={color}
                      style="fill"
                    />

                    {/* 셀 테두리 */}
                    <Rect
                      x={x}
                      y={y}
                      width={cellWidth}
                      height={cellHeight}
                      color="#E0E0E0"
                      style="stroke"
                      strokeWidth={0.5}
                    />

                    {/* 색상 코드 레이블 (채워지지 않은 경우만) */}
                    {!cell.filled && cellWidth > 10 && (
                      <SkiaText
                        x={x + cellWidth / 2}
                        y={y + cellHeight / 2 + (cellWidth * 0.15)}
                        text={cell.targetColor}
                        color="#666"
                        size={Math.max(6, Math.min(cellWidth * 0.4, 14))}
                      />
                    )}
                  </Group>
                );
              })}
            </Group>
          </Canvas>
        )}
      </View>

      {/* Zoom Info */}
      <View style={styles.zoomInfo}>
        <Text style={styles.zoomText}>
          줌: {scale.toFixed(1)}x | 탭하거나 드래그해서 색칠하세요
        </Text>
      </View>

      {/* Color Palette */}
      <View style={styles.paletteContainer}>
        <Text style={styles.paletteTitle}>색상 선택</Text>
        <View style={styles.palette}>
          {COLOR_PALETTE.slice(0, colorCount).map((color) => (
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
              {selectedColor.id === color.id && (
                <View style={styles.colorCheckmark}>
                  <Text style={styles.colorCheckmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
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
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#A255FF',
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
  canvasContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
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
    justifyContent: 'space-around',
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
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
});
