/**
 * 📢 AdManager - 전면 광고 관리 유틸리티
 *
 * Google 정책 준수 타이밍:
 * ✅ 허용: 화면 전환 중, 작업 완료 후, 자연스러운 인터랙션 후
 * ❌ 금지: 앱 시작 시, 입력 중, 무작위 팝업, 뒤로가기 반복
 */

import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🎯 전면 광고 ID 설정
// - 정식 ID (플레이스토어): 'ca-app-pub-8246295829048098/8178709623'
// - 테스트 ID: 'ca-app-pub-3940256099942544/1033173712'
// - 비활성화: null
const INTERSTITIAL_AD_UNIT_ID = null;  // 개발자 테스트용 - 광고 비활성화

// 📊 광고 노출 카운터 키
const AD_COUNTER_KEY = '@ad_interaction_count';
const LAST_AD_TIME_KEY = '@last_ad_shown_time';

// ⚙️ 광고 설정
const AD_CONFIG = {
  // 퍼즐 완료 시 광고 (매번)
  PUZZLE_COMPLETE: {
    enabled: true,
    frequency: 1, // 매번
  },
  // 뒤로가기 시 광고 (5회마다)
  BACK_NAVIGATION: {
    enabled: true,
    frequency: 5,
  },
  // 퍼즐 선택 시 광고 (3회마다)
  PUZZLE_SELECT: {
    enabled: true,
    frequency: 3,
  },
  // 최소 광고 간격 (초)
  MIN_AD_INTERVAL_SECONDS: 60,
};

// 전면 광고 인스턴스
let interstitialAd = null;
let isAdLoaded = false;
let isAdLoading = false;

// 🔧 리스너 구독 해제 함수들 (메모리 누수 방지)
let unsubscribeLoaded = null;
let unsubscribeError = null;
let unsubscribeClosed = null;

// 인터랙션 카운터 (메모리)
let interactionCounts = {
  backNavigation: 0,
  puzzleSelect: 0,
};

/**
 * 전면 광고 초기화 및 로드
 */
export const initializeInterstitialAd = () => {
  // 광고 ID가 null이면 초기화하지 않음 (개발자 테스트 모드)
  if (!INTERSTITIAL_AD_UNIT_ID) {
    console.log('📢 전면 광고 비활성화됨 (개발자 테스트 모드)');
    return;
  }

  if (interstitialAd) {
    return; // 이미 초기화됨
  }

  interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });

  // 🔧 기존 리스너 정리 (재초기화 시 메모리 누수 방지)
  cleanupAdListeners();

  // 광고 이벤트 리스너 (구독 해제 함수 저장)
  unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    console.log('📢 전면 광고 로드 완료');
    isAdLoaded = true;
    isAdLoading = false;
  });

  unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    console.log('📢 전면 광고 로드 실패:', error);
    isAdLoaded = false;
    isAdLoading = false;
  });

  unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    console.log('📢 전면 광고 닫힘');
    isAdLoaded = false;
    // 다음 광고 미리 로드
    loadInterstitialAd();
  });

  // 첫 광고 로드
  loadInterstitialAd();
};

/**
 * 전면 광고 로드
 */
export const loadInterstitialAd = () => {
  if (isAdLoading || isAdLoaded) {
    return;
  }

  if (!interstitialAd) {
    initializeInterstitialAd();
    return;
  }

  isAdLoading = true;
  interstitialAd.load();
};

/**
 * 최소 광고 간격 체크
 */
const checkMinAdInterval = async () => {
  try {
    const lastAdTime = await AsyncStorage.getItem(LAST_AD_TIME_KEY);
    if (!lastAdTime) return true;

    const elapsed = (Date.now() - parseInt(lastAdTime)) / 1000;
    return elapsed >= AD_CONFIG.MIN_AD_INTERVAL_SECONDS;
  } catch {
    return true;
  }
};

/**
 * 광고 노출 시간 기록
 */
const recordAdShown = async () => {
  try {
    await AsyncStorage.setItem(LAST_AD_TIME_KEY, Date.now().toString());
  } catch (error) {
    console.log('광고 시간 기록 실패:', error);
  }
};

/**
 * 전면 광고 표시 (조건 체크 후)
 * @param {string} trigger - 광고 트리거 타입
 * @param {function} onAdClosed - 광고 닫힌 후 콜백
 * @returns {Promise<boolean>} - 광고 표시 여부
 */
export const showInterstitialAd = async (trigger, onAdClosed = null) => {
  // 광고가 로드되지 않았으면 로드 시도 후 false 반환
  if (!isAdLoaded || !interstitialAd) {
    loadInterstitialAd();
    if (onAdClosed) onAdClosed();
    return false;
  }

  // 최소 간격 체크
  const canShowByInterval = await checkMinAdInterval();
  if (!canShowByInterval) {
    console.log('📢 최소 광고 간격 미충족, 스킵');
    if (onAdClosed) onAdClosed();
    return false;
  }

  // 트리거별 빈도 체크
  let shouldShow = false;

  switch (trigger) {
    case 'PUZZLE_COMPLETE':
      // 퍼즐 완료 시 항상 표시
      shouldShow = AD_CONFIG.PUZZLE_COMPLETE.enabled;
      break;

    case 'BACK_NAVIGATION':
      interactionCounts.backNavigation++;
      shouldShow = AD_CONFIG.BACK_NAVIGATION.enabled &&
        (interactionCounts.backNavigation % AD_CONFIG.BACK_NAVIGATION.frequency === 0);
      break;

    case 'PUZZLE_SELECT':
      interactionCounts.puzzleSelect++;
      shouldShow = AD_CONFIG.PUZZLE_SELECT.enabled &&
        (interactionCounts.puzzleSelect % AD_CONFIG.PUZZLE_SELECT.frequency === 0);
      break;

    default:
      shouldShow = false;
  }

  if (!shouldShow) {
    console.log(`📢 ${trigger} 광고 조건 미충족, 스킵`);
    if (onAdClosed) onAdClosed();
    return false;
  }

  // 광고 닫힘 콜백 등록
  if (onAdClosed) {
    const closeListener = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      onAdClosed();
      closeListener(); // 리스너 제거
    });
  }

  try {
    console.log(`📢 ${trigger} 전면 광고 표시`);
    await interstitialAd.show();
    await recordAdShown();
    return true;
  } catch (error) {
    console.log('📢 전면 광고 표시 실패:', error);
    if (onAdClosed) onAdClosed();
    return false;
  }
};

/**
 * 퍼즐 완료 시 전면 광고
 * @param {function} onComplete - 광고 후 실행할 콜백
 */
export const showPuzzleCompleteAd = (onComplete) => {
  return showInterstitialAd('PUZZLE_COMPLETE', onComplete);
};

/**
 * 뒤로가기 시 전면 광고 (5회마다)
 * @param {function} onComplete - 광고 후 실행할 콜백
 */
export const showBackNavigationAd = (onComplete) => {
  return showInterstitialAd('BACK_NAVIGATION', onComplete);
};

/**
 * 퍼즐 선택 시 전면 광고 (3회마다)
 * @param {function} onComplete - 광고 후 실행할 콜백
 */
export const showPuzzleSelectAd = (onComplete) => {
  return showInterstitialAd('PUZZLE_SELECT', onComplete);
};

/**
 * 카운터 리셋 (앱 재시작 시)
 */
export const resetAdCounters = () => {
  interactionCounts = {
    backNavigation: 0,
    puzzleSelect: 0,
  };
};

/**
 * 🔧 광고 리스너 정리 (메모리 누수 방지)
 * 앱 종료 시 또는 광고 모듈 재초기화 전에 호출
 */
export const cleanupAdListeners = () => {
  if (unsubscribeLoaded) {
    unsubscribeLoaded();
    unsubscribeLoaded = null;
  }
  if (unsubscribeError) {
    unsubscribeError();
    unsubscribeError = null;
  }
  if (unsubscribeClosed) {
    unsubscribeClosed();
    unsubscribeClosed = null;
  }
};

/**
 * 광고 설정 업데이트
 */
export const updateAdConfig = (newConfig) => {
  Object.assign(AD_CONFIG, newConfig);
};

export default {
  initializeInterstitialAd,
  loadInterstitialAd,
  showInterstitialAd,
  showPuzzleCompleteAd,
  showBackNavigationAd,
  showPuzzleSelectAd,
  resetAdCounters,
  updateAdConfig,
  cleanupAdListeners,
};
