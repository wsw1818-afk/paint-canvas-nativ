import AsyncStorage from '@react-native-async-storage/async-storage';

const ZOOM_SETTINGS_KEY = '@zoom_settings';

// 줌 프리셋 정의
export const ZOOM_PRESETS = [
  { id: 'x5', label: '5x', maxZoom: 5 },
  { id: 'x7', label: '7x', maxZoom: 7 },
  { id: 'x9', label: '9x', maxZoom: 9 },
  { id: 'x11', label: '11x', maxZoom: 11 },
  { id: 'x14', label: '14x', maxZoom: 14 },
  { id: 'x16', label: '16x', maxZoom: 16 },
];

const DEFAULT_PRESET_ID = 'x9';

export async function getZoomPresetId() {
  try {
    const id = await AsyncStorage.getItem(ZOOM_SETTINGS_KEY);
    return id || DEFAULT_PRESET_ID;
  } catch {
    return DEFAULT_PRESET_ID;
  }
}

export async function setZoomPresetId(presetId) {
  try {
    await AsyncStorage.setItem(ZOOM_SETTINGS_KEY, presetId);
  } catch (e) {
    console.error('줌 설정 저장 실패:', e);
  }
}

export function getZoomPreset(presetId) {
  return ZOOM_PRESETS.find(p => p.id === presetId) || ZOOM_PRESETS[1];
}

// 갤러리 이미지 모드 (원본/진행중)
const GALLERY_IMAGE_MODE_KEY = '@gallery_image_mode';

export const GALLERY_IMAGE_MODES = [
  { id: 'original', label: '원본 이미지' },
  { id: 'progress', label: '진행중 이미지' },
];

export async function getGalleryImageMode() {
  try {
    const mode = await AsyncStorage.getItem(GALLERY_IMAGE_MODE_KEY);
    return mode || 'original';
  } catch {
    return 'original';
  }
}

export async function setGalleryImageMode(mode) {
  try {
    await AsyncStorage.setItem(GALLERY_IMAGE_MODE_KEY, mode);
  } catch (e) {
    // 저장 실패 무시
  }
}

// 격자선 표시 설정
const GRID_LINES_KEY = '@grid_lines_enabled';

export async function getGridLinesEnabled() {
  try {
    const val = await AsyncStorage.getItem(GRID_LINES_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setGridLinesEnabled(enabled) {
  try {
    await AsyncStorage.setItem(GRID_LINES_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    // 저장 실패 무시
  }
}
