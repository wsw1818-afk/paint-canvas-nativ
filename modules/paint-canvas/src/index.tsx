import { requireNativeViewManager, requireNativeModule } from 'expo-modules-core';
import type { ViewProps } from 'react-native';

export interface PaintCanvasCell {
  row: number;
  col: number;
  targetColorHex: string;
}

export interface PaintCanvasPaintedEvent {
  row: number;
  col: number;
  correct: boolean;
}

export interface PaintCanvasProps extends ViewProps {
  gridSize: number;
  cells: PaintCanvasCell[];
  selectedColorHex: string;
  imageUri: string;
  onCellPainted?: (event: PaintCanvasPaintedEvent) => void;
}

// Native Module (함수 호출용)
const PaintCanvasModule = requireNativeModule('PaintCanvas');

/**
 * 캔버스를 캡처하여 Base64 PNG 문자열로 반환
 * @param size 출력 이미지 크기 (기본 512)
 * @returns Base64 인코딩된 PNG 문자열 또는 null
 */
export function captureCanvas(size: number = 512): string | null {
  return PaintCanvasModule.captureCanvas(size);
}

export const PaintCanvasView = requireNativeViewManager<PaintCanvasProps>('PaintCanvas');
