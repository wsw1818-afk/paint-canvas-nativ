/**
 * 퍼즐 데이터 저장/불러오기 유틸리티
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const PUZZLES_KEY = '@puzzles';
const MIGRATION_VERSION_KEY = '@puzzle_migration_version';
const CURRENT_MIGRATION_VERSION = 1;  // 마이그레이션 버전

// 🔒 쓰기 직렬화: 동시 read-modify-write 경쟁 조건 방지
let writeQueue = Promise.resolve();

/**
 * 모든 저장된 퍼즐 불러오기
 */
export async function loadPuzzles() {
  try {
    const jsonValue = await AsyncStorage.getItem(PUZZLES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error loading puzzles:', error);
    return [];
  }
}

/**
 * 퍼즐 저장하기 (직렬화)
 */
export function savePuzzle(puzzle) {
  writeQueue = writeQueue.then(async () => {
    const puzzles = await loadPuzzles();
    const newPuzzle = {
      ...puzzle,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      progress: 0,
      completed: false,
    };
    puzzles.push(newPuzzle);
    await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
    return newPuzzle;
  }).catch(error => {
    console.error('Error saving puzzle:', error);
    throw error;
  });
  return writeQueue;
}

/**
 * 퍼즐 업데이트 (직렬화)
 */
export function updatePuzzle(puzzleId, updates) {
  writeQueue = writeQueue.then(async () => {
    const puzzles = await loadPuzzles();
    const index = puzzles.findIndex(p => p.id === puzzleId);
    if (index !== -1) {
      puzzles[index] = { ...puzzles[index], ...updates };
      await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
      return puzzles[index];
    }
    return null;
  }).catch(error => {
    console.error('Error updating puzzle:', error);
    throw error;
  });
  return writeQueue;
}

/**
 * 퍼즐 삭제 (직렬화)
 */
export function deletePuzzle(puzzleId) {
  writeQueue = writeQueue.then(async () => {
    const puzzles = await loadPuzzles();
    const filtered = puzzles.filter(p => p.id !== puzzleId);
    await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(filtered));
  }).catch(error => {
    console.error('Error deleting puzzle:', error);
    throw error;
  });
  return writeQueue;
}

/**
 * ID로 퍼즐 찾기
 */
export async function getPuzzleById(puzzleId) {
  try {
    const puzzles = await loadPuzzles();
    return puzzles.find(p => p.id === puzzleId) || null;
  } catch (error) {
    console.error('Error getting puzzle:', error);
    return null;
  }
}

/**
 * 기존 퍼즐 마이그레이션 (썸네일 생성 + 이미지 최적화)
 * 앱 시작 시 백그라운드에서 실행
 * @returns {Object} - { migrated: number, skipped: number, failed: number }
 */
export async function migratePuzzles() {
  try {
    // 마이그레이션 버전 체크
    const storedVersion = await AsyncStorage.getItem(MIGRATION_VERSION_KEY);
    if (storedVersion && parseInt(storedVersion) >= CURRENT_MIGRATION_VERSION) {
      console.log('⚡ 마이그레이션 이미 완료됨, 스킵');
      return { migrated: 0, skipped: 0, failed: 0, alreadyDone: true };
    }

    console.log('🔄 퍼즐 마이그레이션 시작...');
    const puzzles = await loadPuzzles();
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const puzzle of puzzles) {
      try {
        // 이미 최적화된 퍼즐은 스킵
        if (puzzle.optimizedAt && puzzle.thumbnailUri) {
          skipped++;
          continue;
        }

        const imageUri = puzzle.imageUri || puzzle.imageBase64;
        if (!imageUri) {
          skipped++;
          continue;
        }

        console.log(`📐 마이그레이션 중: ${puzzle.id}`);

        // 썸네일 생성 (없는 경우만)
        if (!puzzle.thumbnailUri) {
          const thumbnailImage = await manipulateAsync(
            imageUri,
            [{ resize: { width: 200, height: 200 } }],
            { compress: 0.7, format: SaveFormat.JPEG, base64: false }
          );

          const thumbnailFileName = `puzzle_${puzzle.id}_thumb.jpg`;
          const thumbnailUri = `${FileSystem.documentDirectory}${thumbnailFileName}`;

          await FileSystem.copyAsync({
            from: thumbnailImage.uri,
            to: thumbnailUri
          });

          puzzle.thumbnailUri = thumbnailUri;
        }

        // 최적화 시점 기록
        puzzle.optimizedAt = Date.now();

        // 최적화된 이미지 크기 기록 (기존 퍼즐은 1024로 가정)
        if (!puzzle.optimizedSize) {
          puzzle.optimizedSize = 1024;
        }

        migrated++;
      } catch (e) {
        console.warn(`마이그레이션 실패 (${puzzle.id}):`, e.message);
        failed++;
      }
    }

    // 변경된 퍼즐 저장
    if (migrated > 0) {
      await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
    }

    // 마이그레이션 버전 저장
    await AsyncStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());

    console.log(`✅ 마이그레이션 완료: ${migrated}개 성공, ${skipped}개 스킵, ${failed}개 실패`);
    return { migrated, skipped, failed, alreadyDone: false };
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return { migrated: 0, skipped: 0, failed: 0, error: error.message };
  }
}
