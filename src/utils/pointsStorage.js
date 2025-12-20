/**
 * 포인트 저장소 유틸리티
 * - 색칠로 포인트 획득
 * - 포인트로 새 퍼즐 제작
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const POINTS_KEY = '@points';
const INITIAL_POINTS = 30000; // 초기 포인트 (기본 퍼즐 2개 생성 가능)

/**
 * 현재 포인트 가져오기
 */
export const getPoints = async () => {
  try {
    const points = await AsyncStorage.getItem(POINTS_KEY);
    return points ? parseInt(points, 10) : INITIAL_POINTS;
  } catch (error) {
    console.error('[포인트] 가져오기 실패:', error);
    return INITIAL_POINTS;
  }
};

/**
 * 포인트 설정
 */
export const setPoints = async (points) => {
  try {
    await AsyncStorage.setItem(POINTS_KEY, String(points));
    return true;
  } catch (error) {
    console.error('[포인트] 저장 실패:', error);
    return false;
  }
};

/**
 * 포인트 추가 (색칠 완료 시)
 */
export const addPoints = async (amount) => {
  try {
    const currentPoints = await getPoints();
    const newPoints = currentPoints + amount;
    await setPoints(newPoints);
    console.log(`[포인트] +${amount} (${currentPoints} → ${newPoints})`);
    return newPoints;
  } catch (error) {
    console.error('[포인트] 추가 실패:', error);
    return null;
  }
};

/**
 * 포인트 차감 (퍼즐 제작 시)
 */
export const deductPoints = async (amount) => {
  try {
    const currentPoints = await getPoints();
    if (currentPoints < amount) {
      console.warn(`[포인트] 부족: ${currentPoints} < ${amount}`);
      return { success: false, currentPoints };
    }
    const newPoints = currentPoints - amount;
    await setPoints(newPoints);
    console.log(`[포인트] -${amount} (${currentPoints} → ${newPoints})`);
    return { success: true, newPoints };
  } catch (error) {
    console.error('[포인트] 차감 실패:', error);
    return { success: false, error };
  }
};

/**
 * 난이도별 퍼즐 제작 비용
 */
export const PUZZLE_COSTS = {
  EASY: 10000,    // 쉬움: 10,000 포인트
  NORMAL: 15000,  // 보통: 15,000 포인트
  HARD: 20000,    // 어려움: 20,000 포인트
};

/**
 * 난이도별 비용 가져오기
 */
export const getPuzzleCost = (colorCount) => {
  if (colorCount <= 16) return PUZZLE_COSTS.EASY;
  if (colorCount <= 36) return PUZZLE_COSTS.NORMAL;
  return PUZZLE_COSTS.HARD;
};

/**
 * 퍼즐 제작 가능 여부 확인
 */
export const canCreatePuzzle = async (colorCount) => {
  const currentPoints = await getPoints();
  const cost = getPuzzleCost(colorCount);
  return {
    canCreate: currentPoints >= cost,
    currentPoints,
    cost,
    shortfall: Math.max(0, cost - currentPoints),
  };
};
