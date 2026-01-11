/**
 * 텍스처 저장/불러오기 유틸리티
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TEXTURE_KEY = '@selected_texture';

// 사용 가능한 텍스처 목록 (static require로 번들에 포함)
// 동물 15개 + 꽃 15개 + 과일 15개 = 총 45개 텍스처
export const TEXTURES = [
  { id: 'none', name: '없음', image: null },
  // ===== 동물 텍스처 (15개) =====
  { id: 'cat', name: '고양이', image: require('../../assets/textures/animal_01_cat.png') },
  { id: 'dog', name: '강아지', image: require('../../assets/textures/animal_02_dog.png') },
  { id: 'bunny', name: '토끼', image: require('../../assets/textures/animal_03_bunny.png') },
  { id: 'bear', name: '곰', image: require('../../assets/textures/animal_04_bear.png') },
  { id: 'fox', name: '여우', image: require('../../assets/textures/animal_05_fox.png') },
  { id: 'panda', name: '판다', image: require('../../assets/textures/animal_06_panda.png') },
  { id: 'tiger', name: '호랑이', image: require('../../assets/textures/animal_07_tiger.png') },
  { id: 'lion', name: '사자', image: require('../../assets/textures/animal_08_lion.png') },
  { id: 'elephant', name: '코끼리', image: require('../../assets/textures/animal_09_elephant.png') },
  { id: 'giraffe', name: '기린', image: require('../../assets/textures/animal_10_giraffe.png') },
  { id: 'penguin', name: '펭귄', image: require('../../assets/textures/animal_11_penguin.png') },
  { id: 'frog', name: '개구리', image: require('../../assets/textures/animal_12_frog.png') },
  { id: 'koala', name: '코알라', image: require('../../assets/textures/animal_13_koala.png') },
  { id: 'dolphin', name: '돌고래', image: require('../../assets/textures/animal_14_dolphin.png') },
  { id: 'chick', name: '병아리', image: require('../../assets/textures/animal_15_chick.png') },
  // ===== 꽃 텍스처 (15개) =====
  { id: 'rose', name: '장미', image: require('../../assets/textures/flower_01_rose.png') },
  { id: 'tulip', name: '튤립', image: require('../../assets/textures/flower_02_tulip.png') },
  { id: 'sunflower', name: '해바라기', image: require('../../assets/textures/flower_03_sunflower.png') },
  { id: 'daisy', name: '데이지', image: require('../../assets/textures/flower_04_daisy.png') },
  { id: 'lavender', name: '라벤더', image: require('../../assets/textures/flower_05_lavender.png') },
  { id: 'lily', name: '백합', image: require('../../assets/textures/flower_06_lily.png') },
  { id: 'orchid', name: '난초', image: require('../../assets/textures/flower_07_orchid.png') },
  { id: 'hibiscus', name: '히비스커스', image: require('../../assets/textures/flower_08_hibiscus.png') },
  { id: 'cherryBlossom', name: '벚꽃', image: require('../../assets/textures/flower_09_cherry_blossom.png') },
  { id: 'peony', name: '모란', image: require('../../assets/textures/flower_10_peony.png') },
  { id: 'lotus', name: '연꽃', image: require('../../assets/textures/flower_11_lotus.png') },
  { id: 'camellia', name: '동백', image: require('../../assets/textures/flower_12_camellia.png') },
  { id: 'poppy', name: '양귀비', image: require('../../assets/textures/flower_13_poppy.png') },
  { id: 'marigold', name: '금잔화', image: require('../../assets/textures/flower_14_marigold.png') },
  { id: 'hydrangea', name: '수국', image: require('../../assets/textures/flower_15_hydrangea.png') },
  // ===== 과일 텍스처 (15개) =====
  { id: 'apple', name: '사과', image: require('../../assets/textures/fruit_01_apple.png') },
  { id: 'banana', name: '바나나', image: require('../../assets/textures/fruit_02_banana.png') },
  { id: 'strawberry', name: '딸기', image: require('../../assets/textures/fruit_03_strawberry.png') },
  { id: 'grapes', name: '포도', image: require('../../assets/textures/fruit_04_grapes.png') },
  { id: 'orange', name: '오렌지', image: require('../../assets/textures/fruit_05_orange.png') },
  { id: 'lemon', name: '레몬', image: require('../../assets/textures/fruit_06_lemon.png') },
  { id: 'watermelon', name: '수박', image: require('../../assets/textures/fruit_07_watermelon.png') },
  { id: 'cherries', name: '체리', image: require('../../assets/textures/fruit_08_cherries.png') },
  { id: 'pear', name: '배', image: require('../../assets/textures/fruit_09_pear.png') },
  { id: 'peach', name: '복숭아', image: require('../../assets/textures/fruit_10_peach.png') },
  { id: 'pineapple', name: '파인애플', image: require('../../assets/textures/fruit_11_pineapple.png') },
  { id: 'kiwi', name: '키위', image: require('../../assets/textures/fruit_12_kiwi.png') },
  { id: 'blueberries', name: '블루베리', image: require('../../assets/textures/fruit_13_blueberries.png') },
  { id: 'mango', name: '망고', image: require('../../assets/textures/fruit_14_mango.png') },
  { id: 'pomegranate', name: '석류', image: require('../../assets/textures/fruit_15_pomegranate.png') },
];

/**
 * 현재 선택된 텍스처 ID 불러오기
 */
export async function getSelectedTextureId() {
  try {
    const textureId = await AsyncStorage.getItem(TEXTURE_KEY);
    return textureId || 'none';
  } catch (error) {
    console.error('Error loading texture:', error);
    return 'none';
  }
}

/**
 * 텍스처 ID로 텍스처 객체 가져오기
 */
export function getTextureById(textureId) {
  return TEXTURES.find(t => t.id === textureId) || TEXTURES[0];
}

/**
 * 현재 선택된 텍스처 객체 불러오기
 */
export async function getSelectedTexture() {
  const textureId = await getSelectedTextureId();
  return getTextureById(textureId);
}

/**
 * 텍스처 저장하기
 */
export async function saveSelectedTexture(textureId) {
  try {
    await AsyncStorage.setItem(TEXTURE_KEY, textureId);
    return true;
  } catch (error) {
    console.error('Error saving texture:', error);
    return false;
  }
}
