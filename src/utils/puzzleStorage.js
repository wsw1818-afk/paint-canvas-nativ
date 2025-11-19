/**
 * 퍼즐 데이터 저장/불러오기 유틸리티
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PUZZLES_KEY = '@puzzles';

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
 * 퍼즐 저장하기
 */
export async function savePuzzle(puzzle) {
  try {
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
  } catch (error) {
    console.error('Error saving puzzle:', error);
    throw error;
  }
}

/**
 * 퍼즐 업데이트
 */
export async function updatePuzzle(puzzleId, updates) {
  try {
    const puzzles = await loadPuzzles();
    const index = puzzles.findIndex(p => p.id === puzzleId);
    if (index !== -1) {
      puzzles[index] = { ...puzzles[index], ...updates };
      await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
      return puzzles[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating puzzle:', error);
    throw error;
  }
}

/**
 * 퍼즐 삭제
 */
export async function deletePuzzle(puzzleId) {
  try {
    const puzzles = await loadPuzzles();
    const filtered = puzzles.filter(p => p.id !== puzzleId);
    await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting puzzle:', error);
    throw error;
  }
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
