import { requireNativeComponent, ViewStyle } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';

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

export interface PaintCanvasProps {
  style?: ViewStyle;
  gridSize: number;
  cells: PaintCanvasCell[];
  selectedColorHex: string;
  imageUri: string;
  onCellPainted?: (event: NativeSyntheticEvent<PaintCanvasPaintedEvent>) => void;
}

export const PaintCanvasView = requireNativeComponent<PaintCanvasProps>('PaintCanvasView');
