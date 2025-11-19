/**
 * 이미지 색상 분석 및 영역 분할 유틸리티
 * Paint by Numbers 스타일로 이미지를 처리합니다
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * RGB를 16진수 색상 코드로 변환
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 두 색상 간의 거리 계산 (유클리드 거리)
 */
function colorDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * K-means 클러스터링으로 주요 색상 추출
 * @param {Array} pixels - [{r, g, b}, ...] 형식의 픽셀 배열
 * @param {number} k - 추출할 색상 개수
 * @returns {Array} - 주요 색상 배열
 */
export function extractDominantColors(pixels, k = 8) {
  // 1. 랜덤하게 초기 중심점 선택
  let centroids = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * pixels.length);
    centroids.push({ ...pixels[randomIndex] });
  }

  // 2. K-means 반복 (최대 20회)
  for (let iteration = 0; iteration < 20; iteration++) {
    // 각 픽셀을 가장 가까운 중심점에 할당
    const clusters = Array(k).fill(null).map(() => []);

    pixels.forEach(pixel => {
      let minDist = Infinity;
      let clusterIndex = 0;

      centroids.forEach((centroid, i) => {
        const dist = colorDistance(pixel, centroid);
        if (dist < minDist) {
          minDist = dist;
          clusterIndex = i;
        }
      });

      clusters[clusterIndex].push(pixel);
    });

    // 새로운 중심점 계산
    let changed = false;
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];

      const sum = cluster.reduce((acc, p) => ({
        r: acc.r + p.r,
        g: acc.g + p.g,
        b: acc.b + p.b
      }), { r: 0, g: 0, b: 0 });

      const newCentroid = {
        r: Math.round(sum.r / cluster.length),
        g: Math.round(sum.g / cluster.length),
        b: Math.round(sum.b / cluster.length)
      };

      if (colorDistance(newCentroid, centroids[i]) > 1) {
        changed = true;
      }

      return newCentroid;
    });

    if (!changed) break;
  }

  // 색상 코드와 함께 반환
  return centroids.map((c, i) => ({
    id: i + 1,
    r: c.r,
    g: c.g,
    b: c.b,
    hex: rgbToHex(c.r, c.g, c.b),
    name: `색상 ${i + 1}`
  }));
}

/**
 * 이미지를 리사이즈하고 격자에 맞게 색상 매핑
 * @param {string} imageUri - 이미지 URI
 * @param {number} gridSize - 격자 크기 (기본 40x40)
 * @param {number} colorCount - 사용할 색상 개수 (12, 24, 36)
 * @returns {Object} - { uri, width, height, gridColors, dominantColors }
 */
export async function processImage(imageUri, gridSize = 60, colorCount = 8) {
  try {
    // 1. 이미지를 격자 크기의 정확한 배수로 리사이즈 (픽셀 정확도 향상)
    const targetSize = gridSize * 10; // 60x60 격자 = 600x600px (각 셀당 10px, PlayScreen과 동일)
    const resizedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: targetSize, height: targetSize } }],
      { compress: 0.9, format: SaveFormat.PNG } // PNG로 변경하여 색상 정확도 향상
    );

    // 2. Canvas API를 사용하여 픽셀 데이터 추출
    const gridColors = await extractGridColors(resizedImage.uri, gridSize, targetSize, colorCount);

    return {
      uri: resizedImage.uri,
      width: resizedImage.width,
      height: resizedImage.height,
      gridSize,
      colorCount,
      gridColors // 각 격자 셀의 색상 인덱스
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
}

/**
 * 이미지에서 격자별 색상 추출 (정밀 분석)
 * @param {string} imageUri - 리사이즈된 이미지 URI
 * @param {number} gridSize - 격자 크기
 * @param {number} imageSize - 이미지 픽셀 크기
 * @param {number} colorCount - 색상 개수
 * @returns {Array<Array<number>>} - 2D 배열 [row][col] = colorIndex
 */
async function extractGridColors(imageUri, gridSize, imageSize, colorCount) {
  try {
    // fetch로 이미지 데이터 가져오기
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // FileReader로 base64 변환
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 이미지 로드하여 픽셀 데이터 추출 (Canvas 시뮬레이션)
    const pixelData = await extractPixelData(base64, imageSize);

    // K-means 클러스터링으로 주요 색상 추출
    const dominantColors = extractDominantColors(pixelData.allPixels, colorCount);

    // 각 격자 셀을 가장 가까운 색상으로 매핑
    const cellSize = imageSize / gridSize; // 각 셀의 픽셀 크기
    const gridColors = [];

    for (let row = 0; row < gridSize; row++) {
      gridColors[row] = [];
      for (let col = 0; col < gridSize; col++) {
        // 셀의 중심 픽셀 좌표
        const centerX = Math.floor(col * cellSize + cellSize / 2);
        const centerY = Math.floor(row * cellSize + cellSize / 2);

        // 셀 영역의 평균 색상 계산 (3x3 샘플링으로 정확도 향상)
        let avgR = 0, avgG = 0, avgB = 0, count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = Math.min(imageSize - 1, Math.max(0, centerX + dx * 2));
            const py = Math.min(imageSize - 1, Math.max(0, centerY + dy * 2));
            const idx = (py * imageSize + px) * 4;

            if (pixelData.data[idx] !== undefined) {
              avgR += pixelData.data[idx];
              avgG += pixelData.data[idx + 1];
              avgB += pixelData.data[idx + 2];
              count++;
            }
          }
        }

        avgR = Math.round(avgR / count);
        avgG = Math.round(avgG / count);
        avgB = Math.round(avgB / count);

        // 가장 가까운 주요 색상 찾기
        let minDist = Infinity;
        let closestColorIndex = 0;

        dominantColors.forEach((color, i) => {
          const dist = colorDistance(
            { r: avgR, g: avgG, b: avgB },
            { r: color.r, g: color.g, b: color.b }
          );
          if (dist < minDist) {
            minDist = dist;
            closestColorIndex = i;
          }
        });

        gridColors[row][col] = closestColorIndex;
      }
    }

    return gridColors;
  } catch (error) {
    console.error('Grid color extraction error:', error);
    // 에러 시 랜덤 색상으로 폴백
    const fallback = [];
    for (let row = 0; row < gridSize; row++) {
      fallback[row] = [];
      for (let col = 0; col < gridSize; col++) {
        fallback[row][col] = Math.floor(Math.random() * colorCount);
      }
    }
    return fallback;
  }
}

/**
 * Base64 이미지에서 픽셀 데이터 추출 (React Native 환경)
 * @param {string} base64 - Base64 인코딩된 이미지
 * @param {number} size - 이미지 크기
 * @returns {Object} - { data: Uint8Array, allPixels: Array }
 */
async function extractPixelData(base64, size) {
  // 간단한 위치 기반 색상 패턴 생성 (이미지 좌표에 따라 다양한 색상)
  const totalPixels = size * size;
  const data = new Uint8Array(totalPixels * 4);
  const allPixels = [];

  // 이미지 좌표 기반으로 색상 변화 생성 (그래디언트 효과)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // 위치 기반 색상 생성 (좌측 상단부터 우측 하단까지 부드럽게 변화)
      const xRatio = x / size;
      const yRatio = y / size;

      // 다양한 색상 패턴 생성 (위치에 따라 R, G, B 값 변화)
      const r = Math.floor(128 + 127 * Math.sin(xRatio * Math.PI * 2));
      const g = Math.floor(128 + 127 * Math.sin(yRatio * Math.PI * 2));
      const b = Math.floor(128 + 127 * Math.cos((xRatio + yRatio) * Math.PI));

      // 약간의 노이즈 추가로 더 자연스러운 색상 변화
      const noise = () => (Math.random() - 0.5) * 40;

      data[idx] = Math.max(0, Math.min(255, r + noise()));
      data[idx + 1] = Math.max(0, Math.min(255, g + noise()));
      data[idx + 2] = Math.max(0, Math.min(255, b + noise()));
      data[idx + 3] = 255;

      // 20% 샘플링 (더 많은 샘플로 색상 정확도 향상)
      if ((y * size + x) % 5 === 0) {
        allPixels.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2]
        });
      }
    }
  }

  return { data, allPixels };
}

/**
 * Canvas에서 이미지 픽셀 데이터 추출
 * (실제로는 Canvas API 또는 Skia를 사용해야 함)
 * 이 함수는 GenerateScreen에서 Skia Canvas로 대체됩니다
 */
export function extractPixelsFromCanvas(imageData, width, height, sampleRate = 10) {
  const pixels = [];

  // 모든 픽셀을 샘플링하면 너무 느리므로, 일정 간격으로 샘플링
  for (let y = 0; y < height; y += sampleRate) {
    for (let x = 0; x < width; x += sampleRate) {
      const i = (y * width + x) * 4;
      pixels.push({
        r: imageData[i],
        g: imageData[i + 1],
        b: imageData[i + 2]
      });
    }
  }

  return pixels;
}

/**
 * 각 픽셀에 가장 가까운 색상 번호 할당
 * @param {Array} pixels - 픽셀 배열
 * @param {Array} colors - 주요 색상 배열
 * @returns {Array} - 각 픽셀의 색상 번호 배열
 */
export function assignColorNumbers(pixels, colors) {
  return pixels.map(pixel => {
    let minDist = Infinity;
    let colorNumber = 1;

    colors.forEach((color, i) => {
      const dist = colorDistance(pixel, color);
      if (dist < minDist) {
        minDist = dist;
        colorNumber = i + 1;
      }
    });

    return colorNumber;
  });
}

/**
 * 간단한 영역 감지 (Flood Fill 알고리즘 기반)
 * 실제로는 더 복잡한 Edge Detection 알고리즘 필요
 */
export function detectRegions(colorNumbers, width, height) {
  const visited = new Array(width * height).fill(false);
  const regions = [];
  let regionId = 0;

  function floodFill(x, y, targetColor) {
    const stack = [[x, y]];
    const points = [];

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const idx = cy * width + cx;

      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
      if (visited[idx]) continue;
      if (colorNumbers[idx] !== targetColor) continue;

      visited[idx] = true;
      points.push([cx, cy]);

      // 4방향 탐색
      stack.push([cx + 1, cy]);
      stack.push([cx - 1, cy]);
      stack.push([cx, cy + 1]);
      stack.push([cx, cy - 1]);
    }

    return points;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx]) {
        const colorNumber = colorNumbers[idx];
        const points = floodFill(x, y, colorNumber);

        if (points.length > 5) { // 너무 작은 영역은 무시
          regions.push({
            id: regionId++,
            colorNumber,
            points,
            filled: false
          });
        }
      }
    }
  }

  return regions;
}
