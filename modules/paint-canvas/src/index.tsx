import { requireNativeViewManager } from 'expo-modules-core';
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

export const PaintCanvasView = requireNativeViewManager<PaintCanvasProps>('PaintCanvas');
