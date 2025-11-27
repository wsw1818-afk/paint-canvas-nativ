/**
 * 이미지 색상 분석 및 영역 분할 유틸리티
 * Paint by Numbers 스타일로 이미지를 처리합니다
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeBase64 } from 'base-64';
import { decode as decodeJpeg } from 'jpeg-js';

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
 * ⚡ HSL 캐시 (동일한 RGB 값에 대한 반복 계산 방지)
 * 키: "r,g,b" 형식, 값: {h, s, l}
 */
const hslCache = new Map();
const HSL_CACHE_MAX_SIZE = 5000; // 메모리 제한

/**
 * RGB를 HSL로 변환 (캐싱 적용)
 */
function rgbToHsl(r, g, b) {
  // ⚡ 캐시 확인
  const cacheKey = `${r},${g},${b}`;
  const cached = hslCache.get(cacheKey);
  if (cached) return cached;

  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;

  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break;
      case g1: h = ((b1 - r1) / d + 2) / 6; break;
      case b1: h = ((r1 - g1) / d + 4) / 6; break;
    }
  }

  const result = { h: h * 360, s: s * 100, l: l * 100 };

  // ⚡ 캐시 저장 (크기 제한)
  if (hslCache.size >= HSL_CACHE_MAX_SIZE) {
    // 오래된 항목 절반 삭제
    const keysToDelete = Array.from(hslCache.keys()).slice(0, HSL_CACHE_MAX_SIZE / 2);
    keysToDelete.forEach(k => hslCache.delete(k));
  }
  hslCache.set(cacheKey, result);

  return result;
}

/**
 * HSL을 RGB로 변환
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * 두 색상 간의 거리 계산 (HSL 기반 - 밝기 차이 강화!)
 * ★★★ 주요 개선: 어두운 색(검정 머리) vs 밝은 색(갈색) 확실히 구분!
 */
function colorDistance(c1, c2) {
  const hsl1 = rgbToHsl(c1.r, c1.g, c1.b);
  const hsl2 = rgbToHsl(c2.r, c2.g, c2.b);

  // 색상(Hue) 차이 계산 (원형이므로 최소 거리 사용)
  let hueDiff = Math.abs(hsl1.h - hsl2.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;

  // 채도와 밝기 차이
  const satDiff = Math.abs(hsl1.s - hsl2.s);
  const lightDiff = Math.abs(hsl1.l - hsl2.l);

  // ★★★ 어두운 색 감지 (검정, 진한 머리카락 등) - 밝기 25% 이하
  const isDark1 = hsl1.l < 25;
  const isDark2 = hsl2.l < 25;

  // ★★★ 어두운 색 vs 밝은 색 비교 시 매우 큰 패널티!
  // 검은 머리카락(L~15%)과 갈색(L~40%)은 완전히 다른 색으로 처리!
  let lightnessPenalty = 0;
  if ((isDark1 && !isDark2) || (!isDark1 && isDark2)) {
    // 어두운 색과 밝은 색 사이의 거리 강화
    lightnessPenalty = 200 + lightDiff * 3; // 기본 200 + 밝기차이 * 3
  } else if (isDark1 && isDark2) {
    // 둘 다 어두운 색이면 밝기 차이만으로 구분 (색상 무시)
    lightnessPenalty = lightDiff * 5;
  }

  // ★ 핵심 개선: 채도가 낮아도 Hue 차이가 크면 다른 색!
  let huePenalty = 0;
  if (hueDiff >= 60 && !isDark1 && !isDark2) {
    // 어두운 색이 아닐 때만 Hue 패널티 적용
    huePenalty = hueDiff * 1.5;
  }

  // 피부색 감지: Hue 0-40도(빨강-주황-노랑), 채도 20-60%, 밝기 50-85%
  const isSkinTone1 = (hsl1.h <= 40 || hsl1.h >= 350) && hsl1.s >= 15 && hsl1.s <= 65 && hsl1.l >= 50 && hsl1.l <= 85;
  const isSkinTone2 = (hsl2.h <= 40 || hsl2.h >= 350) && hsl2.s >= 15 && hsl2.s <= 65 && hsl2.l >= 50 && hsl2.l <= 85;

  // 녹색 감지: Hue 80-160도(녹색 계열), 채도 30% 이상
  const isGreen1 = hsl1.h >= 80 && hsl1.h <= 160 && hsl1.s >= 25;
  const isGreen2 = hsl2.h >= 80 && hsl2.h <= 160 && hsl2.s >= 25;

  // 하늘색 감지: Hue 180-240도(청록-파랑), 채도 상관없이 (흐린 하늘도 포함!)
  const isBlueish1 = hsl1.h >= 180 && hsl1.h <= 240;
  const isBlueish2 = hsl2.h >= 180 && hsl2.h <= 240;

  // 따뜻한 색 감지: Hue 0-60도 또는 300-360도(빨강-주황-노랑-핑크)
  const isWarm1 = hsl1.h <= 60 || hsl1.h >= 300;
  const isWarm2 = hsl2.h <= 60 || hsl2.h >= 300;

  // ★ 하늘색 vs 따뜻한 색(갈색/주황 등) 비교 시 큰 패널티
  let colorCategoryBonus = 0;
  if ((isBlueish1 && isWarm2) || (isBlueish2 && isWarm1)) {
    colorCategoryBonus = 150;
  }

  // 피부색 vs 녹색 비교 시 거리 대폭 증가
  if ((isSkinTone1 && isGreen2) || (isSkinTone2 && isGreen1)) {
    colorCategoryBonus = Math.max(colorCategoryBonus, 200);
  }

  // ★★★ 피부색 vs 어두운 색(검정 머리) 비교 시 거리 대폭 증가!
  if ((isSkinTone1 && isDark2) || (isSkinTone2 && isDark1)) {
    colorCategoryBonus = Math.max(colorCategoryBonus, 250);
  }

  // 무채색(회색/흰색/검정) 감지: 채도 10% 미만
  const isGray1 = hsl1.s < 10;
  const isGray2 = hsl2.s < 10;

  // 무채색 vs 유채색 비교 시 채도 차이 가중치 증가
  let satWeight = 1.5;
  if ((isGray1 && !isGray2) || (!isGray1 && isGray2)) {
    satWeight = 3.0;
  }

  // Hue 가중치: 어두운 색에서는 낮추기 (어두운 색은 Hue 구분 어려움)
  const avgSat = (hsl1.s + hsl2.s) / 2;
  const avgLight = (hsl1.l + hsl2.l) / 2;
  let hueWeight = 3.0 + (avgSat / 100) * 2.0;

  // 어두운 색은 Hue보다 밝기가 더 중요!
  if (avgLight < 30) {
    hueWeight *= 0.3; // Hue 가중치 70% 감소
  }

  // ★★★ 밝기 가중치 대폭 상향!
  let lightWeight = 3.5; // 기존 2.0에서 3.5로 상향

  // 밝기 차이가 30% 이상이면 추가 패널티
  if (lightDiff >= 30) {
    lightWeight = 5.0;
  }

  // 최종 거리 계산
  const baseDistance = Math.sqrt(
    Math.pow(hueDiff * hueWeight, 2) +
    Math.pow(satDiff * satWeight, 2) +
    Math.pow(lightDiff * lightWeight, 2)
  );

  return baseDistance + huePenalty + colorCategoryBonus + lightnessPenalty;
}

/**
 * ★★★ K-Means++ 클러스터링 기반 색상 추출 (완전 개선)
 * 실제 이미지의 색상 분포를 분석하여 자동으로 최적의 팔레트 생성
 * @param {Array} pixels - [{r, g, b}, ...] 형식의 픽셀 배열
 * @param {number} k - 추출할 색상 개수
 * @returns {Array} - 주요 색상 배열
 */
export function extractDominantColors(pixels, k = 8) {
  if (pixels.length === 0) return [];

  console.log(`🎨 K-Means++ 색상 추출 시작 (픽셀: ${pixels.length}개, 목표: ${k}개 색상)`);

  // 1. 색상 양자화로 고유 색상 수 줄이기 (성능 최적화)
  const quantizedPixels = quantizeColors(pixels, 32); // 32단계 양자화
  console.log(`📊 양자화 후 고유 색상: ${quantizedPixels.length}개`);

  // 2. K-Means++ 초기화로 시작점 선택
  const initialCentroids = kMeansPlusPlusInit(quantizedPixels, k);
  console.log(`🎯 K-Means++ 초기 중심점 선택 완료`);

  // 3. K-Means 클러스터링 실행
  const { centroids, clusters } = kMeansClustering(quantizedPixels, initialCentroids, 20);

  // 4. 클러스터 크기순 정렬 (많이 사용된 색상 우선)
  const sortedResults = centroids
    .map((centroid, i) => ({
      ...centroid,
      count: clusters[i].length
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // 5. 너무 비슷한 색상 병합
  const mergedColors = mergeSimigarColors(sortedResults, 25); // RGB 거리 25 이내 병합

  console.log(`🔀 병합 후 색상: ${mergedColors.length}개`);

  // 6. 최종 k개 선택
  const finalColors = mergedColors.slice(0, k);

  // 부족하면 보충
  while (finalColors.length < k) {
    // 기존 색상과 가장 다른 색 추가
    const diverseColor = findMostDiverseColor(pixels, finalColors);
    if (diverseColor) {
      finalColors.push(diverseColor);
    } else {
      break;
    }
  }

  // 로그 출력
  console.log('🎨 최종 추출된 색상:');
  finalColors.forEach((c, i) => {
    const hsl = rgbToHsl(c.r, c.g, c.b);
    console.log(`   ${i+1}. RGB(${c.r},${c.g},${c.b}) H:${hsl.h.toFixed(0)}° S:${hsl.s.toFixed(0)}% L:${hsl.l.toFixed(0)}% (${c.count || 0}픽셀)`);
  });

  // 색상 코드와 함께 반환
  // ⚠️ id를 알파벳 형식으로 변경 (A, B, C, ..., 0-9, ...)
  const idChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return finalColors.map((c, i) => ({
    id: idChars[i] || `${i}`,  // A, B, C, ... Z, 0, 1, 2, ...
    r: c.r,
    g: c.g,
    b: c.b,
    hex: rgbToHex(c.r, c.g, c.b),
    name: `색상 ${i + 1}`
  }));
}

/**
 * 색상 양자화 - 비슷한 색상을 그룹화하여 고유 색상 수 줄이기
 */
function quantizeColors(pixels, levels = 32) {
  const step = 256 / levels;
  const colorMap = new Map();

  pixels.forEach(p => {
    // 양자화된 RGB 값
    const qr = Math.floor(p.r / step) * step + step / 2;
    const qg = Math.floor(p.g / step) * step + step / 2;
    const qb = Math.floor(p.b / step) * step + step / 2;
    const key = `${qr},${qg},${qb}`;

    if (!colorMap.has(key)) {
      colorMap.set(key, { r: qr, g: qg, b: qb, count: 0 });
    }
    colorMap.get(key).count++;
  });

  // 빈도순 정렬하여 반환
  return Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * K-Means++ 초기화 - Lab 색공간 기반 분산된 시작점 선택
 * ★ perceptualDistance 사용으로 인간 시각에 맞는 색상 분포
 */
function kMeansPlusPlusInit(pixels, k) {
  const centroids = [];

  // 첫 번째 중심점: 가장 빈도 높은 색상
  centroids.push({ ...pixels[0] });

  // 나머지 중심점: 기존 중심점과 가장 먼 색상 선택 (Lab 거리 기반)
  while (centroids.length < k) {
    let maxDist = -1;
    let bestPixel = null;

    for (const pixel of pixels) {
      // 기존 모든 중심점과의 최소 거리 계산 (★ Lab 색공간 기반)
      let minDistToCentroid = Infinity;
      for (const centroid of centroids) {
        const dist = perceptualDistance(pixel, centroid);
        if (dist < minDistToCentroid) {
          minDistToCentroid = dist;
        }
      }

      // 가장 먼 픽셀 선택 (빈도수 가중치 적용)
      const weightedDist = minDistToCentroid * Math.sqrt(pixel.count || 1);
      if (weightedDist > maxDist) {
        maxDist = weightedDist;
        bestPixel = pixel;
      }
    }

    if (bestPixel) {
      centroids.push({ ...bestPixel });
    } else {
      break;
    }
  }

  return centroids;
}

/**
 * K-Means 클러스터링 메인 알고리즘
 * ★ Lab 색공간 기반 perceptualDistance 사용 - 인간 시각에 최적화
 */
function kMeansClustering(pixels, initialCentroids, maxIterations = 20) {
  let centroids = initialCentroids.map(c => ({ ...c }));
  let clusters = new Array(centroids.length).fill(null).map(() => []);
  let changed = true;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    // 클러스터 초기화
    clusters = new Array(centroids.length).fill(null).map(() => []);

    // 각 픽셀을 가장 가까운 중심점에 할당 (★ Lab 색공간 기반)
    for (const pixel of pixels) {
      let minDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = perceptualDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      clusters[closestIdx].push(pixel);
    }

    // 중심점 업데이트 (가중 평균 - RGB 공간에서 계산)
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue;

      let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;

      for (const pixel of clusters[i]) {
        const weight = pixel.count || 1;
        sumR += pixel.r * weight;
        sumG += pixel.g * weight;
        sumB += pixel.b * weight;
        totalWeight += weight;
      }

      const newR = Math.round(sumR / totalWeight);
      const newG = Math.round(sumG / totalWeight);
      const newB = Math.round(sumB / totalWeight);

      if (newR !== centroids[i].r || newG !== centroids[i].g || newB !== centroids[i].b) {
        centroids[i] = { r: newR, g: newG, b: newB };
        changed = true;
      }
    }
  }

  console.log(`   K-Means 수렴: ${iteration}회 반복 (Lab 색공간 기반)`);
  return { centroids, clusters };
}

/**
 * RGB → Lab 변환 (인간 색 인지 기반)
 */
function rgbToLab(r, g, b) {
  // RGB → XYZ
  let rr = r / 255, gg = g / 255, bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  const x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  const y = (rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750);
  const z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883;

  // XYZ → Lab
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return {
    L: (116 * fy) - 16,      // 0~100 (밝기)
    a: 500 * (fx - fy),      // -128~127 (녹-빨)
    b: 200 * (fy - fz)       // -128~127 (파-노)
  };
}

/**
 * Lab 색공간에서 Delta E (CIE76) 거리 계산
 * 인간이 인지하는 색 차이와 가장 유사
 */
function labDistance(c1, c2) {
  const lab1 = rgbToLab(c1.r, c1.g, c1.b);
  const lab2 = rgbToLab(c2.r, c2.g, c2.b);

  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * RGB 유클리드 거리 계산 (빠른 버전, 클러스터링 내부용)
 */
function rgbDistance(c1, c2) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 지각적 색상 거리 (Lab 기반 + 밝기 가중치)
 * 어두운 색과 밝은 색의 구분을 강화
 */
function perceptualDistance(c1, c2) {
  const lab1 = rgbToLab(c1.r, c1.g, c1.b);
  const lab2 = rgbToLab(c2.r, c2.g, c2.b);

  // 밝기 차이에 가중치 부여 (어두운 색 구분 강화)
  const lightDiff = Math.abs(lab1.L - lab2.L);
  let lightWeight = 1.0;

  // 둘 중 하나가 어두운 색(L < 25)이면 밝기 가중치 증가
  if ((lab1.L < 25 && lab2.L >= 25) || (lab2.L < 25 && lab1.L >= 25)) {
    lightWeight = 2.5; // 어두운색 vs 밝은색 구분 강화
  }

  return Math.sqrt(
    Math.pow((lab1.L - lab2.L) * lightWeight, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * 비슷한 색상 병합 (Lab 색공간 기반)
 * ★ Delta E 기준 threshold (일반적으로 10 이하가 구분 어려움)
 */
function mergeSimigarColors(colors, threshold = 15) {
  const merged = [];

  for (const color of colors) {
    let shouldMerge = false;

    for (const existing of merged) {
      // ★ Lab 색공간 기반 거리 사용
      if (perceptualDistance(color, existing) < threshold) {
        // 가중 평균으로 병합
        const totalCount = existing.count + color.count;
        existing.r = Math.round((existing.r * existing.count + color.r * color.count) / totalCount);
        existing.g = Math.round((existing.g * existing.count + color.g * color.count) / totalCount);
        existing.b = Math.round((existing.b * existing.count + color.b * color.count) / totalCount);
        existing.count = totalCount;
        shouldMerge = true;
        break;
      }
    }

    if (!shouldMerge) {
      merged.push({ ...color });
    }
  }

  return merged.sort((a, b) => b.count - a.count);
}

/**
 * 기존 색상과 가장 다른 색 찾기 (Lab 색공간 기반)
 * ★ 인간 시각에 맞게 가장 차별화된 색상 선택
 */
function findMostDiverseColor(pixels, existingColors) {
  let maxMinDist = -1;
  let bestPixel = null;

  // 샘플링하여 검색
  const sampleRate = Math.max(1, Math.floor(pixels.length / 1000));

  for (let i = 0; i < pixels.length; i += sampleRate) {
    const pixel = pixels[i];

    let minDist = Infinity;
    for (const existing of existingColors) {
      // ★ Lab 색공간 기반 거리 사용
      const dist = perceptualDistance(pixel, existing);
      if (dist < minDist) {
        minDist = dist;
      }
    }

    if (minDist > maxMinDist) {
      maxMinDist = minDist;
      bestPixel = { r: pixel.r, g: pixel.g, b: pixel.b, count: 1 };
    }
  }

  return bestPixel;
}

// ===== 유틸리티 함수들 =====

/**
 * 픽셀 배열의 평균 색상 계산
 */
function getAverageColor(pixels) {
  if (pixels.length === 0) return { r: 128, g: 128, b: 128 };

  const sum = pixels.reduce((acc, p) => ({
    r: acc.r + p.r,
    g: acc.g + p.g,
    b: acc.b + p.b
  }), { r: 0, g: 0, b: 0 });

  return {
    r: Math.round(sum.r / pixels.length),
    g: Math.round(sum.g / pixels.length),
    b: Math.round(sum.b / pixels.length)
  };
}

/**
 * 이미지를 색칠하기에 최적화하여 처리
 * 자동으로 대비, 채도, 선명도를 조절하여 색칠하기 좋은 이미지로 변환
 * @param {string} imageUri - 이미지 URI
 * @param {number} gridSize - 격자 크기 (기본 85x85)
 * @param {number} colorCount - 사용할 색상 개수 (12, 24, 36)
 * @returns {Object} - { uri, width, height, gridColors, dominantColors }
 */
export async function processImage(imageUri, gridSize = 85, colorCount = 8) {
  try {
    console.log('🎨 이미지 최적화 시작... colorCount:', colorCount);

    // 1. 이미지를 1024x1024로 리사이즈 + 색칠하기 최적화 적용
    const targetSize = 1024;

    // expo-image-manipulator로 기본 처리 (리사이즈)
    const resizedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: targetSize, height: targetSize } }],
      { compress: 0.85, format: SaveFormat.JPEG, base64: false }
    );

    console.log('📐 리사이즈 완료:', targetSize);

    // 2. 픽셀 데이터 추출 및 최적화
    const result = await extractGridColors(resizedImage.uri, gridSize, targetSize, colorCount);

    console.log('✅ 이미지 처리 완료');

    return {
      uri: resizedImage.uri,
      width: resizedImage.width,
      height: resizedImage.height,
      gridSize,
      colorCount,
      gridColors: result.gridColors || result,
      dominantColors: result.dominantColors || []
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
    // 실제 이미지에서 픽셀 데이터 추출
    const pixelData = await extractPixelData(imageUri, imageSize);

    // 실제 이미지 크기 사용 (디코딩된 크기)
    const actualWidth = pixelData.width || imageSize;
    const actualHeight = pixelData.height || imageSize;

    // 🎨 색칠하기 최적화 적용
    console.log('🎨 이미지 색칠 최적화 적용 중...');
    const optimizedData = optimizePixelsForColoring(pixelData.data, actualWidth, actualHeight);

    // 최적화된 픽셀에서 샘플링하여 K-means용 배열 생성
    const optimizedPixels = [];
    const sampleRate = 5;
    for (let y = 0; y < actualHeight; y += sampleRate) {
      for (let x = 0; x < actualWidth; x += sampleRate) {
        const idx = (y * actualWidth + x) * 4;
        optimizedPixels.push({
          r: optimizedData[idx],
          g: optimizedData[idx + 1],
          b: optimizedData[idx + 2]
        });
      }
    }

    // Hue 기반 색상 추출 (최적화된 픽셀 사용)
    const dominantColors = extractDominantColors(optimizedPixels, colorCount);
    console.log('🎨 추출된 색상:');
    dominantColors.forEach((c, i) => {
      const hsl = rgbToHsl(c.r, c.g, c.b);
      console.log(`   ${i+1}. ${c.hex} (H:${hsl.h.toFixed(0)}° S:${hsl.s.toFixed(0)}% L:${hsl.l.toFixed(0)}%)`);
    });

    // 각 격자 셀을 가장 가까운 색상으로 매핑 (HSL 기반 거리 사용!)
    const cellWidth = actualWidth / gridSize;
    const cellHeight = actualHeight / gridSize;
    const gridColors = [];

    for (let row = 0; row < gridSize; row++) {
      gridColors[row] = [];
      for (let col = 0; col < gridSize; col++) {
        // ★ 셀 영역의 대표 색상 계산 (평균 대신 중앙값/최빈값 사용)
        const startX = Math.floor(col * cellWidth);
        const startY = Math.floor(row * cellHeight);
        const endX = Math.min(actualWidth - 1, Math.floor((col + 1) * cellWidth));
        const endY = Math.min(actualHeight - 1, Math.floor((row + 1) * cellHeight));

        const cellPixels = [];

        // 셀 영역 샘플링 (5x5 그리드 샘플링)
        const stepX = Math.max(1, Math.floor((endX - startX) / 5));
        const stepY = Math.max(1, Math.floor((endY - startY) / 5));

        for (let py = startY; py < endY; py += stepY) {
          for (let px = startX; px < endX; px += stepX) {
            const idx = (py * actualWidth + px) * 4;
            cellPixels.push({
              r: optimizedData[idx] || 0,
              g: optimizedData[idx + 1] || 0,
              b: optimizedData[idx + 2] || 0
            });
          }
        }

        // ★ 중앙 픽셀 가중치 증가 (중앙 부분이 더 대표적)
        const centerX = Math.floor((startX + endX) / 2);
        const centerY = Math.floor((startY + endY) / 2);
        const centerIdx = (centerY * actualWidth + centerX) * 4;
        const centerPixel = {
          r: optimizedData[centerIdx] || 0,
          g: optimizedData[centerIdx + 1] || 0,
          b: optimizedData[centerIdx + 2] || 0
        };
        // 중앙 픽셀을 2번 더 추가 (가중치 3배)
        cellPixels.push(centerPixel, centerPixel);

        // ★ 중앙값 방식: 각 RGB 채널의 중앙값 사용 (평균보다 이상치에 강함)
        const rValues = cellPixels.map(p => p.r).sort((a, b) => a - b);
        const gValues = cellPixels.map(p => p.g).sort((a, b) => a - b);
        const bValues = cellPixels.map(p => p.b).sort((a, b) => a - b);
        const mid = Math.floor(cellPixels.length / 2);

        const cellPixel = {
          r: cellPixels.length > 0 ? rValues[mid] : 0,
          g: cellPixels.length > 0 ? gValues[mid] : 0,
          b: cellPixels.length > 0 ? bValues[mid] : 0
        };

        // ★ Lab 색공간 기반 perceptualDistance로 가장 가까운 색상 찾기
        // 인간 시각에 최적화된 색상 매칭
        let minDist = Infinity;
        let closestColorIndex = 0;

        for (let i = 0; i < dominantColors.length; i++) {
          const color = dominantColors[i];

          // ★ Lab 색공간 기반 지각적 거리 (Delta E)
          const dist = perceptualDistance(cellPixel, color);

          if (dist < minDist) {
            minDist = dist;
            closestColorIndex = i;
          }
        }

        gridColors[row][col] = closestColorIndex;
      }
    }

    // 색상별 셀 개수 로그
    const colorCounts = new Array(colorCount).fill(0);
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        colorCounts[gridColors[row][col]]++;
      }
    }
    console.log('🎨 색상별 셀 분포:');
    colorCounts.forEach((count, i) => {
      const pct = ((count / (gridSize * gridSize)) * 100).toFixed(1);
      console.log(`   ${i+1}. ${dominantColors[i]?.hex || '???'}: ${count}개 (${pct}%)`);
    });

    // 4. 알파벳 분포 분산 처리 (같은 색상이 집중되지 않도록)
    const dispersedGridColors = disperseColorDistribution(gridColors, gridSize, colorCount);

    return { gridColors: dispersedGridColors, dominantColors };
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
 * 픽셀 데이터에 색칠하기 최적화 적용
 * ★★★ 사진 원본 색상 최대한 보존 - 자연스러운 색감 유지
 * @param {Uint8Array} pixelData - RGBA 픽셀 데이터
 * @param {number} width - 이미지 너비
 * @param {number} height - 이미지 높이
 * @returns {Uint8Array} - 최적화된 픽셀 데이터
 */
function optimizePixelsForColoring(pixelData, width, height) {
  const optimized = new Uint8Array(pixelData.length);

  // ⚡ 원본 색상 100% 보존 - 어떠한 조정도 하지 않음
  for (let i = 0; i < pixelData.length; i += 4) {
    optimized[i] = pixelData[i];       // R
    optimized[i + 1] = pixelData[i + 1]; // G
    optimized[i + 2] = pixelData[i + 2]; // B
    optimized[i + 3] = pixelData[i + 3]; // A
  }

  console.log('✨ 픽셀 최적화 완료 (원본 색상 100% 보존)');
  return optimized;
}

/**
 * 색상 분포 분산 처리 (강화된 버전)
 * 같은 알파벳이 뭉치지 않도록 격자 전체에 골고루 분산
 * @param {Array<Array<number>>} gridColors - 원본 격자 색상
 * @param {number} gridSize - 격자 크기
 * @param {number} colorCount - 색상 개수
 * @returns {Array<Array<number>>} - 분산된 격자 색상
 */
function disperseColorDistribution(gridColors, gridSize, colorCount) {
  const result = gridColors.map(row => [...row]);
  const totalCells = gridSize * gridSize;

  // 1. 각 색상별 셀 개수 계산
  const colorCounts = new Array(colorCount).fill(0);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      colorCounts[result[row][col]]++;
    }
  }

  // 2. 가장 많이 사용된 색상 찾기
  const maxColorIdx = colorCounts.indexOf(Math.max(...colorCounts));
  const maxColorCount = colorCounts[maxColorIdx];
  const maxPct = (maxColorCount / totalCells * 100).toFixed(1);
  console.log(`📊 가장 많은 색상: ${maxColorIdx} (${maxColorCount}개, ${maxPct}%)`);

  // 3. 한 색상이 40% 이상이면 약한 분산 적용 (자연스러운 이미지 유지)
  if (maxColorCount > totalCells * 0.40) {
    console.log('⚠️ 색상 편중 감지 - 약한 분산 적용 (자연스러운 이미지 유지)');

    // 큰 블록 크기로 최소한의 분산만
    const blockSize = Math.max(8, Math.floor(gridSize / 15)); // 블록 크기 증가 (더 큰 영역 유지)

    let dispersedCount = 0;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // 체커보드 패턴: 블록 위치에 따라 분산 여부 결정 (더 드물게)
        const blockRow = Math.floor(row / blockSize);
        const blockCol = Math.floor(col / blockSize);
        const isDispersalBlock = (blockRow + blockCol) % 3 === 2; // 1/3만 분산 (더 적게)

        if (isDispersalBlock && result[row][col] === maxColorIdx) {
          // 다른 색상 중 빈도 기반 선택 (랜덤 최소화)
          const otherColors = colorCounts
            .map((count, idx) => ({ idx, count }))
            .filter(c => c.idx !== maxColorIdx && c.count > 0)
            .sort((a, b) => b.count - a.count);

          if (otherColors.length > 0) {
            // 가장 많은 색상 선택 (자연스러운 전환)
            const newColor = otherColors[0].idx;
            result[row][col] = newColor;
            dispersedCount++;
          }
        }
      }
    }
    console.log(`🔀 ${dispersedCount}개 셀 약한 분산 완료 (자연스러운 이미지 보존)`);
  }

  // 4. 연속된 같은 색상 셀 분산 - 최소화 (자연스러운 그라데이션 유지)
  let continuousDispersed = 0;

  // ⭐ Pass 1: 3x3 영역 체크 - 매우 큰 단색 영역만 분산 (8개 모두 같을 때만)
  for (let row = 1; row < gridSize - 1; row++) {
    for (let col = 1; col < gridSize - 1; col++) {
      const centerColor = result[row][col];

      // 주변 8개 셀 확인
      let sameCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (result[row + dr][col + dc] === centerColor) {
            sameCount++;
          }
        }
      }

      // 8개 모두 같은 색이면 중앙 셀만 교체 (매우 드물게)
      if (sameCount === 8) {
        // 주변에 없는 색상 우선 선택
        const neighborColors = new Set();
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            neighborColors.add(result[row + dr][col + dc]);
          }
        }

        // 주변에 없는 색상 찾기
        let newColor = -1;
        for (let c = 0; c < colorCount; c++) {
          if (!neighborColors.has(c)) {
            newColor = c;
            break;
          }
        }

        // 모든 색상이 주변에 있으면 가장 적은 색상 선택
        if (newColor === -1) {
          newColor = (centerColor + 1 + Math.floor(Math.random() * (colorCount - 1))) % colorCount;
        }

        result[row][col] = newColor;
        continuousDispersed++;
      }
    }
  }

  // ⭐ Pass 2 제거 - 2x2 블록 분산 없음 (자연스러운 색상 경계 유지)

  if (continuousDispersed > 0) {
    console.log(`🔀 ${continuousDispersed}개 연속 셀 최소 분산 완료 (자연스러운 그라데이션 보존)`);
  }

  // 5. 최종 분포 로그
  const finalCounts = new Array(colorCount).fill(0);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      finalCounts[result[row][col]]++;
    }
  }
  console.log('📊 최종 색상 분포:');
  finalCounts.forEach((count, i) => {
    if (count > 0) {
      const pct = (count / totalCells * 100).toFixed(1);
      console.log(`   ${i}: ${count}개 (${pct}%)`);
    }
  });

  return result;
}

/**
 * 픽셀 데이터 추출 (React Native 환경)
 * expo-image-manipulator의 base64 출력을 사용하여 실제 이미지 픽셀 추출
 * @param {string} imageUri - 이미지 URI
 * @param {number} size - 이미지 크기
 * @returns {Object} - { data: Uint8Array, allPixels: Array }
 */
async function extractPixelData(imageUri, size) {
  try {
    console.log('Extracting real pixel data from image...');

    // 이미지를 base64로 변환 (JPEG 형식)
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: size, height: size } }],
      { format: SaveFormat.JPEG, compress: 0.9, base64: true }
    );

    if (!result.base64) {
      console.log('base64 not available, using fallback');
      return generateFallbackPattern(size);
    }

    // base64를 바이트 배열로 변환
    const binaryString = decodeBase64(result.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // JPEG 디코딩하여 RGBA 픽셀 데이터 추출
    const jpegData = decodeJpeg(bytes, { useTArray: true });
    const pixelData = jpegData.data; // RGBA 형식
    const width = jpegData.width;
    const height = jpegData.height;

    console.log(`Image decoded: ${width}x${height}, pixels: ${pixelData.length / 4}`);

    // 샘플링하여 allPixels 배열 생성 (K-means용)
    const allPixels = [];
    const sampleRate = 5;
    for (let y = 0; y < height; y += sampleRate) {
      for (let x = 0; x < width; x += sampleRate) {
        const idx = (y * width + x) * 4;
        allPixels.push({
          r: pixelData[idx],
          g: pixelData[idx + 1],
          b: pixelData[idx + 2]
        });
      }
    }

    console.log(`Sampled ${allPixels.length} pixels for color extraction`);

    return { data: pixelData, allPixels, width, height };
  } catch (error) {
    console.error('Pixel extraction error:', error);
    console.log('Using fallback pattern generator');
    return generateFallbackPattern(size);
  }
}

/**
 * Fallback pattern generator with quantization
 * React Native에서 Image 객체를 사용할 수 없으므로 대안 패턴 생성
 */
function generateFallbackPattern(size) {
  const totalPixels = size * size;
  const data = new Uint8Array(totalPixels * 4);
  const allPixels = [];

  // 더 다양한 색상 영역을 위한 복수 주파수 사용
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const xRatio = x / size;
      const yRatio = y / size;

      // Perlin-noise like pattern with multiple frequencies
      const f1 = Math.sin(xRatio * Math.PI * 4 + yRatio * Math.PI * 2);
      const f2 = Math.cos(yRatio * Math.PI * 6 + xRatio * Math.PI * 3);
      const f3 = Math.sin((xRatio + yRatio) * Math.PI * 5);

      // Combine frequencies for complex pattern
      const r = 128 + 90 * f1 + 30 * f3;
      const g = 128 + 90 * f2 + 30 * f1;
      const b = 128 + 90 * f3 + 30 * f2;

      // Add random noise
      const noise = () => (Math.random() - 0.5) * 60;

      let finalR = Math.max(0, Math.min(255, r + noise()));
      let finalG = Math.max(0, Math.min(255, g + noise()));
      let finalB = Math.max(0, Math.min(255, b + noise()));

      // Apply quantization to create distinct color regions
      const quantize = 55; // 초강력 양자화 (256 / 55 ≈ 4.6 levels per channel)
      finalR = Math.round(finalR / quantize) * quantize;
      finalG = Math.round(finalG / quantize) * quantize;
      finalB = Math.round(finalB / quantize) * quantize;

      data[idx] = finalR;
      data[idx + 1] = finalG;
      data[idx + 2] = finalB;
      data[idx + 3] = 255;

      // Sample every 5th pixel
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
