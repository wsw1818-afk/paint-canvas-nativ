/**
 * 기본 퍼즐 생성 유틸리티
 * - 앱 최초 실행 시 기본 갤러리 퍼즐 2개 자동 생성
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { savePuzzle } from './puzzleStorage';
import { processImage } from './imageProcessor';

const DEFAULT_PUZZLES_KEY = '@defaultPuzzlesCreated';

// 정적 import (동적 require는 Release 빌드에서 에러)
const ASSET_MODULES = {
  'basic1.png': require('../../assets/basic1.png'),
  'basic2.png': require('../../assets/basic2.png'),
};

const DEFAULT_PUZZLES = [
  {
    assetName: 'basic1.png',
    title: '기본 퍼즐 1',
    difficulty: 'EASY',
    colorCount: 16,
    gridSize: 120,
  },
  {
    assetName: 'basic2.png',
    title: '기본 퍼즐 2',
    difficulty: 'NORMAL',
    colorCount: 36,
    gridSize: 160,
  },
];

/**
 * 기본 퍼즐 생성 (최초 1회만)
 */
export const createDefaultPuzzles = async () => {
  try {
    // 이미 생성됐는지 확인
    const alreadyCreated = await AsyncStorage.getItem(DEFAULT_PUZZLES_KEY);
    if (alreadyCreated === 'true') {
      console.log('[기본 퍼즐] 이미 생성됨, 스킵');
      return { created: false, count: 0 };
    }

    console.log('[기본 퍼즐] 생성 시작...');
    let createdCount = 0;

    for (const puzzle of DEFAULT_PUZZLES) {
      try {
        // 1. Asset에서 이미지 로드 (정적 참조)
        const assetModule = ASSET_MODULES[puzzle.assetName];
        if (!assetModule) {
          console.error(`[기본 퍼즐] Asset을 찾을 수 없음: ${puzzle.assetName}`);
          continue;
        }
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        // 2. 파일 시스템으로 복사 (앱 재시작 후에도 유지)
        const timestamp = Date.now();
        const fileName = `default_${puzzle.assetName.replace('.png', '')}_${timestamp}.png`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.copyAsync({
          from: asset.localUri || asset.uri,
          to: destUri,
        });

        console.log(`[기본 퍼즐] 이미지 복사 완료: ${destUri}`);

        // 3. 이미지 처리 (격자 생성)
        const optimizedSize = puzzle.gridSize >= 100 ? 256 : 1024;
        const result = await processImage(
          destUri,
          puzzle.gridSize,
          puzzle.colorCount,
          optimizedSize
        );

        console.log(`[기본 퍼즐] 이미지 처리 완료: ${puzzle.title}`);

        // 4. 퍼즐 저장
        await savePuzzle({
          title: puzzle.title,
          imageUri: result.uri,
          thumbnailUri: result.thumbnailUri,
          gridColors: result.gridColors,
          dominantColors: result.dominantColors,
          colorCount: puzzle.colorCount,
          gridSize: puzzle.gridSize,
          difficulty: puzzle.difficulty,
          completionMode: 'WEAVE', // 기본값: 위빙 텍스처
          progress: 0,
          completed: false,
        });

        console.log(`✅ [기본 퍼즐] "${puzzle.title}" 생성 완료`);
        createdCount++;
      } catch (error) {
        console.error(`❌ [기본 퍼즐] "${puzzle.title}" 생성 실패:`, error);
      }
    }

    // 생성 완료 플래그 저장
    await AsyncStorage.setItem(DEFAULT_PUZZLES_KEY, 'true');
    console.log(`🎉 [기본 퍼즐] ${createdCount}개 생성 완료`);

    return { created: true, count: createdCount };
  } catch (error) {
    console.error('❌ [기본 퍼즐] 생성 오류:', error);
    return { created: false, count: 0, error };
  }
};

/**
 * 기본 퍼즐 생성 플래그 초기화 (테스트용)
 */
export const resetDefaultPuzzlesFlag = async () => {
  await AsyncStorage.removeItem(DEFAULT_PUZZLES_KEY);
  console.log('[기본 퍼즐] 플래그 초기화됨');
};
