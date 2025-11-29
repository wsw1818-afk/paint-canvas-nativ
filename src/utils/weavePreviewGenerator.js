/**
 * 위빙 텍스처 미리보기 이미지 생성 유틸리티
 * 퍼즐 생성 시 WEAVE 모드 선택 시 완성 미리보기 이미지를 생성합니다
 *
 * 방식: gridColors + dominantColors를 사용하여 각 셀에 색상을 채운 이미지 생성
 * React Native 환경에서는 Buffer가 없어서 jpeg-js encode 사용 불가
 * 대신 Skia Canvas를 사용하여 이미지 생성
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Skia, AlphaType, ColorType } from '@shopify/react-native-skia';

/**
 * 위빙 텍스처가 적용된 미리보기 이미지 생성
 * Skia를 사용하여 각 셀에 색상을 채운 이미지 생성
 * @param {string} imageUri - 원본 이미지 URI
 * @param {Array} dominantColors - 추출된 주요 색상 배열
 * @param {Array<Array<number>>} gridColors - 격자별 색상 인덱스
 * @param {number} gridSize - 격자 크기
 * @returns {Promise<string>} - 생성된 미리보기 이미지 URI
 */
export async function generateWeavePreviewImage(imageUri, dominantColors, gridColors, gridSize) {
  try {
    console.log('🧶 위빙 미리보기 이미지 생성 시작 (Skia)...');

    // 1. 미리보기 크기 설정 (256x256로 생성 - 썸네일용)
    const previewSize = 256;

    // ⚡ 성능 최적화: 미리보기용 gridSize 제한
    // 256x256 이미지에서 250 그리드 = 1픽셀당 1셀 (과잉)
    // 64 그리드로 제한 = 4픽셀당 1셀 (시각적 차이 없음, 62500→4096 drawRect 호출)
    const maxPreviewGrid = 64;
    const effectiveGridSize = Math.min(gridSize, maxPreviewGrid);
    const skipFactor = Math.ceil(gridSize / effectiveGridSize);

    console.log(`⚡ 미리보기 최적화: ${gridSize}→${effectiveGridSize} 그리드 (${skipFactor}x 스킵)`);

    const cellSize = previewSize / effectiveGridSize;

    // 2. Skia Surface 생성
    const surface = Skia.Surface.Make(previewSize, previewSize);
    if (!surface) {
      console.error('Skia Surface 생성 실패');
      return imageUri;
    }

    const canvas = surface.getCanvas();
    const paint = Skia.Paint();

    // ⚡ 색상 캐싱: 동일 색상 Skia.Color 재사용
    const colorCache = new Map();

    // 3. 각 셀에 색상 채우기 (다운샘플링 적용)
    for (let previewRow = 0; previewRow < effectiveGridSize; previewRow++) {
      for (let previewCol = 0; previewCol < effectiveGridSize; previewCol++) {
        // 원본 그리드에서 대표 셀 선택
        const srcRow = Math.min(previewRow * skipFactor, gridSize - 1);
        const srcCol = Math.min(previewCol * skipFactor, gridSize - 1);

        const colorIndex = gridColors[srcRow]?.[srcCol] ?? 0;
        const color = dominantColors[colorIndex] || { r: 128, g: 128, b: 128 };

        // ⚡ Skia 색상 캐싱
        const colorKey = `${color.r},${color.g},${color.b}`;
        let skiaColor = colorCache.get(colorKey);
        if (!skiaColor) {
          skiaColor = Skia.Color(`rgb(${color.r}, ${color.g}, ${color.b})`);
          colorCache.set(colorKey, skiaColor);
        }
        paint.setColor(skiaColor);

        // 셀 위치 계산
        const left = previewCol * cellSize;
        const top = previewRow * cellSize;
        const right = left + cellSize + 0.5; // 틈새 방지
        const bottom = top + cellSize + 0.5;

        // 셀 그리기
        canvas.drawRect(Skia.XYWHRect(left, top, right - left, bottom - top), paint);
      }
    }

    // 4. 이미지 데이터 추출 및 저장
    const image = surface.makeImageSnapshot();
    const data = image.encodeToBase64();

    if (!data) {
      console.error('Skia 이미지 인코딩 실패');
      return imageUri;
    }

    // 5. base64를 파일로 저장
    const timestamp = Date.now();
    const fileName = `weave_preview_${timestamp}.png`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, data, {
      encoding: FileSystem.EncodingType.Base64
    });

    console.log('✅ 위빙 미리보기 이미지 생성 완료:', fileUri);
    return fileUri;

  } catch (error) {
    console.error('위빙 미리보기 생성 실패:', error);
    // 실패 시 원본 이미지 반환
    return imageUri;
  }
}

/**
 * 간단한 위빙 미리보기 생성 (빠른 버전)
 * Skia를 사용하여 원본 이미지 기반 미리보기 생성
 */
export async function generateSimpleWeavePreview(imageUri, dominantColors, gridColors, gridSize) {
  // Skia 버전의 generateWeavePreviewImage 호출
  return generateWeavePreviewImage(imageUri, dominantColors, gridColors, gridSize);
}
