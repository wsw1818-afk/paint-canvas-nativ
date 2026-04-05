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
