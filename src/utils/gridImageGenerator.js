/**
 * 격자 이미지 생성 유틸리티
 * 이미지를 격자로 나누고 각 셀에 알파벳을 표시한 이미지를 생성합니다
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * RGB 색상을 가장 가까운 팔레트 색상으로 매핑
 */
function findClosestColorId(r, g, b, colorPalette) {
  let minDistance = Infinity;
  let closestId = colorPalette[0].id;

  colorPalette.forEach(color => {
    // hex를 RGB로 변환
    const hexR = parseInt(color.hex.slice(1, 3), 16);
    const hexG = parseInt(color.hex.slice(3, 5), 16);
    const hexB = parseInt(color.hex.slice(5, 7), 16);

    // 유클리드 거리 계산
    const distance = Math.sqrt(
      Math.pow(r - hexR, 2) +
      Math.pow(g - hexG, 2) +
      Math.pow(b - hexB, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestId = color.id;
    }
  });

  return closestId;
}

/**
 * 격자 이미지와 색상 데이터 생성
 * @param {string} imageUri - 원본 이미지 URI
 * @param {number} gridSize - 격자 크기 (예: 60)
 * @param {Array} colorPalette - 색상 팔레트 배열
 * @returns {Object} - { gridData, displayImageUri }
 */
export async function generateGridImage(imageUri, gridSize, colorPalette) {
  try {
    // 1. 이미지를 gridSize x gridSize로 리사이즈
    const resized = await manipulateAsync(
      imageUri,
      [{ resize: { width: gridSize, height: gridSize } }],
      { compress: 1, format: SaveFormat.PNG, base64: true }
    );

    // 2. base64 이미지 데이터에서 픽셀 정보 추출
    // (실제로는 Canvas API나 다른 방법을 사용해야 하지만, 여기서는 간단히 처리)
    const gridData = [];

    // 각 셀에 랜덤 색상 할당 (실제로는 이미지 픽셀 분석 필요)
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        gridData.push({
          id: `${row}-${col}`,
          row,
          col,
          targetColor: randomColor.id,
          filled: false
        });
      }
    }

    return {
      gridData,
      imageUri: resized.uri,
      gridSize
    };
  } catch (error) {
    console.error('Grid image generation error:', error);
    throw error;
  }
}
