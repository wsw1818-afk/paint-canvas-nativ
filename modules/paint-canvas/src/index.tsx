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
  gameId?: string;  // 🔄 저장/복원용 고유 ID (puzzleId 기반)
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

/**
 * 갤러리 썸네일 캡처 - 원본 이미지 위에 색칠된 부분만 오버레이
 * @param size 출력 이미지 크기 (기본 256)
 * @returns Base64 인코딩된 PNG 문자열 또는 null
 */
export function captureThumbnail(size: number = 256): string | null {
  return PaintCanvasModule.captureThumbnail(size);
}

/**
 * 🗺️ 미니맵 이미지 캡처 - 음영 + 색칠된 부분 표시
 * @param size 출력 이미지 크기 (기본 120)
 * @returns Base64 인코딩된 PNG 문자열 또는 null
 */
export function getMinimapImage(size: number = 120): string | null {
  return PaintCanvasModule.getMinimapImage(size);
}

/**
 * 🗺️ 미니맵 터치로 뷰포트 이동
 * @param x 목표 X 위치 (0~1 비율)
 * @param y 목표 Y 위치 (0~1 비율)
 * @param zoom 목표 줌 레벨 (옵션, 미지정 시 현재 줌 유지)
 */
export function setViewportPosition(x: number, y: number, zoom?: number): void {
  PaintCanvasModule.setViewportPosition(x, y, zoom ?? null);
}

/**
 * 🗑️ 특정 gameId의 진행 상황 삭제 (갤러리 리셋 시 사용)
 * @param gameId 삭제할 게임 ID
 */
export function clearProgressForGame(gameId: string): void {
  PaintCanvasModule.clearProgressForGame(gameId);
}

/**
 * 📱 줌 배율 즉시 적용 (UI 버튼용)
 * @param level 목표 줌 배율 (예: 5, 9, 14)
 */
export function setZoomLevel(level: number): void {
  PaintCanvasModule.setZoomLevel(level);
}

export const PaintCanvasView = requireNativeViewManager<PaintCanvasProps>('PaintCanvas');
