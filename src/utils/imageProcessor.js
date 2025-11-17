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
 * 이미지를 리사이즈하고 픽셀 데이터 추출
 * @param {string} imageUri - 이미지 URI
 * @param {number} maxSize - 최대 크기 (성능 최적화용)
 * @returns {Object} - { uri, width, height, pixels }
 */
export async function processImage(imageUri, maxSize = 400) {
  try {
    // 1. 이미지 리사이즈 (성능 최적화)
    const resizedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: maxSize } }],
      { compress: 0.8, format: SaveFormat.PNG }
    );

    return {
      uri: resizedImage.uri,
      width: resizedImage.width,
      height: resizedImage.height
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
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
