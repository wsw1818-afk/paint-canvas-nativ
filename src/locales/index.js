/**
 * 🌐 다국어 지원 시스템 (i18n)
 *
 * 지원 언어:
 * - ko: 한국어 (기본)
 * - en: English
 * - ja: 日本語
 * - zh: 中文
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ko from './ko';
import en from './en';
import ja from './ja';
import zh from './zh';

// 지원 언어 목록
export const LANGUAGES = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

// 번역 데이터
const translations = {
  ko,
  en,
  ja,
  zh,
};

// 현재 언어 (기본: 한국어)
let currentLanguage = 'ko';

// 언어 변경 리스너
let languageChangeListeners = [];

// 저장소 키
const LANGUAGE_STORAGE_KEY = '@app_language';

/**
 * 저장된 언어 설정 로드
 */
export const loadLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && translations[savedLanguage]) {
      currentLanguage = savedLanguage;
    }
    return currentLanguage;
  } catch (error) {
    console.log('언어 설정 로드 실패:', error);
    return currentLanguage;
  }
};

/**
 * 언어 설정 저장 및 변경
 */
export const setLanguage = async (languageCode) => {
  if (!translations[languageCode]) {
    console.warn(`지원하지 않는 언어: ${languageCode}`);
    return false;
  }

  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    currentLanguage = languageCode;

    // 리스너에게 알림
    languageChangeListeners.forEach((listener) => listener(languageCode));

    return true;
  } catch (error) {
    console.log('언어 설정 저장 실패:', error);
    return false;
  }
};

/**
 * 현재 언어 코드 반환
 */
export const getLanguage = () => currentLanguage;

/**
 * 현재 언어의 번역 데이터 반환
 */
export const getTranslations = () => translations[currentLanguage] || translations.ko;

/**
 * 번역 문자열 가져오기
 * @param {string} key - 점(.)으로 구분된 키 (예: 'home.title')
 * @param {object} params - 치환 파라미터 (예: { count: 5 })
 */
export const t = (key, params = {}) => {
  const keys = key.split('.');
  let value = translations[currentLanguage] || translations.ko;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 키를 찾지 못하면 기본 언어(한국어)에서 시도
      value = translations.ko;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // 기본 언어에서도 못 찾으면 키 반환
        }
      }
      break;
    }
  }

  // 문자열이 아니면 키 반환
  if (typeof value !== 'string') {
    return key;
  }

  // 파라미터 치환 ({{param}} 형식)
  return value.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? params[paramName] : match;
  });
};

/**
 * 언어 변경 리스너 등록
 */
export const addLanguageChangeListener = (listener) => {
  languageChangeListeners.push(listener);
  return () => {
    languageChangeListeners = languageChangeListeners.filter((l) => l !== listener);
  };
};

/**
 * 모든 리스너 제거
 */
export const removeAllListeners = () => {
  languageChangeListeners = [];
};

export default {
  LANGUAGES,
  loadLanguage,
  setLanguage,
  getLanguage,
  getTranslations,
  t,
  addLanguageChangeListener,
  removeAllListeners,
};
