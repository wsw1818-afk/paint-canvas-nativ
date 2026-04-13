/**
 * 기본 퍼즐 생성 유틸리티
 * - 앱 최초 실행 시 기본 갤러리 퍼즐 등록 (이미지만 복사, 격자 처리 안 함)
 * - 퍼즐 선택 시 이미지 처리 수행 (지연 처리)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { savePuzzle } from './puzzleStorage';

const DEFAULT_PUZZLES_KEY = '@defaultPuzzlesCreated_v10'; // v10: 57개 퍼즐 (v9 47개 + 신규 10개)
// 이전 버전 키들 (기존 사용자 호환 - 이미 처리한 퍼즐은 스킵)
const PREVIOUS_VERSION_KEYS = [
  '@defaultPuzzlesCreated_v9',  // 1~47
  '@defaultPuzzlesCreated_v8',  // 1~27
];

// 정적 import
const ASSET_MODULES = {
  'puzzle_01.jpg': require('../../assets/puzzles/puzzle_01.jpg'),
  'puzzle_02.jpg': require('../../assets/puzzles/puzzle_02.jpg'),
  'puzzle_03.jpg': require('../../assets/puzzles/puzzle_03.jpg'),
  'puzzle_04.jpg': require('../../assets/puzzles/puzzle_04.jpg'),
  'puzzle_05.jpg': require('../../assets/puzzles/puzzle_05.jpg'),
  'puzzle_06.jpg': require('../../assets/puzzles/puzzle_06.jpg'),
  'puzzle_07.jpg': require('../../assets/puzzles/puzzle_07.jpg'),
  'puzzle_08.jpg': require('../../assets/puzzles/puzzle_08.jpg'),
  'puzzle_09.jpg': require('../../assets/puzzles/puzzle_09.jpg'),
  'puzzle_10.jpg': require('../../assets/puzzles/puzzle_10.jpg'),
  'puzzle_11.jpg': require('../../assets/puzzles/puzzle_11.jpg'),
  'puzzle_12.jpg': require('../../assets/puzzles/puzzle_12.jpg'),
  'puzzle_13.jpg': require('../../assets/puzzles/puzzle_13.jpg'),
  'puzzle_14.jpg': require('../../assets/puzzles/puzzle_14.jpg'),
  'puzzle_15.jpg': require('../../assets/puzzles/puzzle_15.jpg'),
  'puzzle_16.jpg': require('../../assets/puzzles/puzzle_16.jpg'),
  'puzzle_17.jpg': require('../../assets/puzzles/puzzle_17.jpg'),
  'puzzle_18.jpg': require('../../assets/puzzles/puzzle_18.jpg'),
  'puzzle_19.jpg': require('../../assets/puzzles/puzzle_19.jpg'),
  'puzzle_20.jpg': require('../../assets/puzzles/puzzle_20.jpg'),
  'puzzle_21.jpg': require('../../assets/puzzles/puzzle_21.jpg'),
  'puzzle_22.jpg': require('../../assets/puzzles/puzzle_22.jpg'),
  'puzzle_23.jpg': require('../../assets/puzzles/puzzle_23.jpg'),
  'puzzle_24.jpg': require('../../assets/puzzles/puzzle_24.jpg'),
  'puzzle_25.jpg': require('../../assets/puzzles/puzzle_25.jpg'),
  'puzzle_26.jpg': require('../../assets/puzzles/puzzle_26.jpg'),
  'puzzle_27.jpg': require('../../assets/puzzles/puzzle_27.jpg'),
  'puzzle_28.jpg': require('../../assets/puzzles/puzzle_28.jpg'),
  'puzzle_29.jpg': require('../../assets/puzzles/puzzle_29.jpg'),
  'puzzle_30.jpg': require('../../assets/puzzles/puzzle_30.jpg'),
  'puzzle_31.jpg': require('../../assets/puzzles/puzzle_31.jpg'),
  'puzzle_32.jpg': require('../../assets/puzzles/puzzle_32.jpg'),
  'puzzle_33.jpg': require('../../assets/puzzles/puzzle_33.jpg'),
  'puzzle_34.jpg': require('../../assets/puzzles/puzzle_34.jpg'),
  'puzzle_35.jpg': require('../../assets/puzzles/puzzle_35.jpg'),
  'puzzle_36.jpg': require('../../assets/puzzles/puzzle_36.jpg'),
  'puzzle_37.jpg': require('../../assets/puzzles/puzzle_37.jpg'),
  'puzzle_38.jpg': require('../../assets/puzzles/puzzle_38.jpg'),
  'puzzle_39.jpg': require('../../assets/puzzles/puzzle_39.jpg'),
  'puzzle_40.jpg': require('../../assets/puzzles/puzzle_40.jpg'),
  'puzzle_41.jpg': require('../../assets/puzzles/puzzle_41.jpg'),
  'puzzle_42.jpg': require('../../assets/puzzles/puzzle_42.jpg'),
  'puzzle_43.jpg': require('../../assets/puzzles/puzzle_43.jpg'),
  'puzzle_44.jpg': require('../../assets/puzzles/puzzle_44.jpg'),
  'puzzle_45.jpg': require('../../assets/puzzles/puzzle_45.jpg'),
  'puzzle_46.jpg': require('../../assets/puzzles/puzzle_46.jpg'),
  'puzzle_47.jpg': require('../../assets/puzzles/puzzle_47.jpg'),
  'puzzle_48.jpg': require('../../assets/puzzles/puzzle_48.jpg'),
  'puzzle_49.jpg': require('../../assets/puzzles/puzzle_49.jpg'),
  'puzzle_50.jpg': require('../../assets/puzzles/puzzle_50.jpg'),
  'puzzle_51.jpg': require('../../assets/puzzles/puzzle_51.jpg'),
  'puzzle_52.jpg': require('../../assets/puzzles/puzzle_52.jpg'),
  'puzzle_53.jpg': require('../../assets/puzzles/puzzle_53.jpg'),
  'puzzle_54.jpg': require('../../assets/puzzles/puzzle_54.jpg'),
  'puzzle_55.jpg': require('../../assets/puzzles/puzzle_55.jpg'),
  'puzzle_56.jpg': require('../../assets/puzzles/puzzle_56.jpg'),
  'puzzle_57.jpg': require('../../assets/puzzles/puzzle_57.jpg'),
};

// 중간 난이도: 36색, 160x160 격자
const NORMAL = { colorCount: 36, gridSize: 160 };

const DEFAULT_PUZZLES = [
  { assetName: 'puzzle_01.jpg', title: '퍼즐 01', ...NORMAL },
  { assetName: 'puzzle_02.jpg', title: '퍼즐 02', ...NORMAL },
  { assetName: 'puzzle_03.jpg', title: '퍼즐 03', ...NORMAL },
  { assetName: 'puzzle_04.jpg', title: '퍼즐 04', ...NORMAL },
  { assetName: 'puzzle_05.jpg', title: '퍼즐 05', ...NORMAL },
  { assetName: 'puzzle_06.jpg', title: '퍼즐 06', ...NORMAL },
  { assetName: 'puzzle_07.jpg', title: '퍼즐 07', ...NORMAL },
  { assetName: 'puzzle_08.jpg', title: '퍼즐 08', ...NORMAL },
  { assetName: 'puzzle_09.jpg', title: '퍼즐 09', ...NORMAL },
  { assetName: 'puzzle_10.jpg', title: '퍼즐 10', ...NORMAL },
  { assetName: 'puzzle_11.jpg', title: '퍼즐 11', ...NORMAL },
  { assetName: 'puzzle_12.jpg', title: '퍼즐 12', ...NORMAL },
  { assetName: 'puzzle_13.jpg', title: '퍼즐 13', ...NORMAL },
  { assetName: 'puzzle_14.jpg', title: '퍼즐 14', ...NORMAL },
  { assetName: 'puzzle_15.jpg', title: '퍼즐 15', ...NORMAL },
  { assetName: 'puzzle_16.jpg', title: '퍼즐 16', ...NORMAL },
  { assetName: 'puzzle_17.jpg', title: '퍼즐 17', ...NORMAL },
  { assetName: 'puzzle_18.jpg', title: '퍼즐 18', ...NORMAL },
  { assetName: 'puzzle_19.jpg', title: '퍼즐 19', ...NORMAL },
  { assetName: 'puzzle_20.jpg', title: '퍼즐 20', ...NORMAL },
  { assetName: 'puzzle_21.jpg', title: '퍼즐 21', ...NORMAL },
  { assetName: 'puzzle_22.jpg', title: '퍼즐 22', ...NORMAL },
  { assetName: 'puzzle_23.jpg', title: '퍼즐 23', ...NORMAL },
  { assetName: 'puzzle_24.jpg', title: '퍼즐 24', ...NORMAL },
  { assetName: 'puzzle_25.jpg', title: '퍼즐 25', ...NORMAL },
  { assetName: 'puzzle_26.jpg', title: '퍼즐 26', ...NORMAL },
  { assetName: 'puzzle_27.jpg', title: '퍼즐 27', ...NORMAL },
  { assetName: 'puzzle_28.jpg', title: '퍼즐 28', ...NORMAL },
  { assetName: 'puzzle_29.jpg', title: '퍼즐 29', ...NORMAL },
  { assetName: 'puzzle_30.jpg', title: '퍼즐 30', ...NORMAL },
  { assetName: 'puzzle_31.jpg', title: '퍼즐 31', ...NORMAL },
  { assetName: 'puzzle_32.jpg', title: '퍼즐 32', ...NORMAL },
  { assetName: 'puzzle_33.jpg', title: '퍼즐 33', ...NORMAL },
  { assetName: 'puzzle_34.jpg', title: '퍼즐 34', ...NORMAL },
  { assetName: 'puzzle_35.jpg', title: '퍼즐 35', ...NORMAL },
  { assetName: 'puzzle_36.jpg', title: '퍼즐 36', ...NORMAL },
  { assetName: 'puzzle_37.jpg', title: '퍼즐 37', ...NORMAL },
  { assetName: 'puzzle_38.jpg', title: '퍼즐 38', ...NORMAL },
  { assetName: 'puzzle_39.jpg', title: '퍼즐 39', ...NORMAL },
  { assetName: 'puzzle_40.jpg', title: '퍼즐 40', ...NORMAL },
  { assetName: 'puzzle_41.jpg', title: '퍼즐 41', ...NORMAL },
  { assetName: 'puzzle_42.jpg', title: '퍼즐 42', ...NORMAL },
  { assetName: 'puzzle_43.jpg', title: '퍼즐 43', ...NORMAL },
  { assetName: 'puzzle_44.jpg', title: '퍼즐 44', ...NORMAL },
  { assetName: 'puzzle_45.jpg', title: '퍼즐 45', ...NORMAL },
  { assetName: 'puzzle_46.jpg', title: '퍼즐 46', ...NORMAL },
  { assetName: 'puzzle_47.jpg', title: '퍼즐 47', ...NORMAL },
  { assetName: 'puzzle_48.jpg', title: '퍼즐 48', ...NORMAL },
  { assetName: 'puzzle_49.jpg', title: '퍼즐 49', ...NORMAL },
  { assetName: 'puzzle_50.jpg', title: '퍼즐 50', ...NORMAL },
  { assetName: 'puzzle_51.jpg', title: '퍼즐 51', ...NORMAL },
  { assetName: 'puzzle_52.jpg', title: '퍼즐 52', ...NORMAL },
  { assetName: 'puzzle_53.jpg', title: '퍼즐 53', ...NORMAL },
  { assetName: 'puzzle_54.jpg', title: '퍼즐 54', ...NORMAL },
  { assetName: 'puzzle_55.jpg', title: '퍼즐 55', ...NORMAL },
  { assetName: 'puzzle_56.jpg', title: '퍼즐 56', ...NORMAL },
  { assetName: 'puzzle_57.jpg', title: '퍼즐 57', ...NORMAL },
];

/**
 * 전체 기본 퍼즐 개수 (스플래시 진행률 계산용)
 */
export const DEFAULT_PUZZLES_COUNT = DEFAULT_PUZZLES.length;

/**
 * 기본 퍼즐 등록 (최초 1회만)
 * 이미지 복사 + 썸네일만 등록, 격자 처리는 퍼즐 선택 시 수행
 *
 * @param {(current:number, total:number) => void} onProgress
 *   진행률 콜백 (스플래시에서 사용)
 */
// 이전 버전 키 → 이미 생성된 퍼즐 개수
const PREVIOUS_VERSION_COUNTS = {
  '@defaultPuzzlesCreated_v9': 47,
  '@defaultPuzzlesCreated_v8': 27,
};

export const createDefaultPuzzles = async (onProgress) => {
  try {
    const alreadyCreated = await AsyncStorage.getItem(DEFAULT_PUZZLES_KEY);
    if (alreadyCreated === 'true') {
      return { created: false, count: 0 };
    }

    // 이전 버전 완료 여부 확인 → delta만 추가
    let startIndex = 0;
    for (const prevKey of PREVIOUS_VERSION_KEYS) {
      const prevDone = await AsyncStorage.getItem(prevKey);
      if (prevDone === 'true') {
        startIndex = PREVIOUS_VERSION_COUNTS[prevKey] || 0;
        console.log(`[기본 퍼즐] 기존 사용자 감지 (${prevKey}) → 신규 ${DEFAULT_PUZZLES.length - startIndex}개만 추가`);
        break;
      }
    }

    const puzzlesToAdd = DEFAULT_PUZZLES.slice(startIndex);
    const total = puzzlesToAdd.length;

    if (total === 0) {
      // 이미 모두 있음 → v10 플래그만 세팅
      await AsyncStorage.setItem(DEFAULT_PUZZLES_KEY, 'true');
      return { created: false, count: 0 };
    }

    console.log(`[기본 퍼즐] 등록 시작... (총 ${total}개, 이미지 복사만)`);
    let createdCount = 0;
    let failedCount = 0;

    // 초기 진행률 (0)
    if (typeof onProgress === 'function') {
      onProgress(0, total);
    }

    for (const puzzle of puzzlesToAdd) {
      try {
        const assetModule = ASSET_MODULES[puzzle.assetName];
        if (!assetModule) continue;

        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        // 파일 시스템으로 복사
        const timestamp = Date.now();
        const fileName = `default_${puzzle.assetName.replace('.jpg', '')}_${timestamp}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.copyAsync({
          from: asset.localUri || asset.uri,
          to: destUri,
        });

        // 퍼즐 저장 (gridColors/dominantColors 없이 - 선택 시 처리)
        await savePuzzle({
          title: puzzle.title,
          imageUri: destUri,
          thumbnailUri: destUri, // 원본을 썸네일로 사용
          colorCount: puzzle.colorCount,
          gridSize: puzzle.gridSize,
          difficulty: 'NORMAL',
          completionMode: 'WEAVE',
          needsProcessing: true, // 격자 처리 필요 플래그
          progress: 0,
          completed: false,
        });

        createdCount++;
        // 진행률 콜백
        if (typeof onProgress === 'function') {
          onProgress(createdCount, total);
        }
      } catch (error) {
        failedCount++;
        console.error(`❌ [기본 퍼즐] "${puzzle.title}" 등록 실패:`, error.message);
      }
    }

    // 📌 모든 퍼즐이 성공한 경우에만 완료 플래그 저장 (부분 실패 시 다음 실행에서 재시도)
    if (failedCount === 0) {
      await AsyncStorage.setItem(DEFAULT_PUZZLES_KEY, 'true');
      console.log(`🎉 [기본 퍼즐] ${createdCount}개 등록 완료 (이미지만, 격자 처리 대기)`);
    } else {
      console.warn(`⚠️ [기본 퍼즐] ${createdCount}개 성공, ${failedCount}개 실패 - 다음 실행에서 재시도`);
    }
    return { created: true, count: createdCount, failed: failedCount };
  } catch (error) {
    console.error('❌ [기본 퍼즐] 등록 오류:', error);
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
