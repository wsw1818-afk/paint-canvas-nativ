/**
 * 텍스처 선택 모달 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SpotifyColors, SpotifyFonts, SpotifySpacing, SpotifyRadius } from '../theme/spotify';
import { TEXTURES, getSelectedTextureId, saveSelectedTexture } from '../utils/textureStorage';
import { t } from '../locales';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 60) / 4; // 4열 그리드

export default function TexturePickerModal({ visible, onClose, onSelect }) {
  const [selectedId, setSelectedId] = useState('none');

  useEffect(() => {
    if (visible) {
      loadCurrentTexture();
    }
  }, [visible]);

  const loadCurrentTexture = async () => {
    const textureId = await getSelectedTextureId();
    setSelectedId(textureId);
  };

  const handleSelect = async (texture) => {
    setSelectedId(texture.id);
    await saveSelectedTexture(texture.id);
    // 텍스처 클릭 시에는 선택만 하고, 확인 버튼에서 onSelect 호출
  };

  // 확인 버튼: 현재 선택된 텍스처로 onSelect 호출
  const handleConfirm = () => {
    const selectedTexture = TEXTURES.find(t => t.id === selectedId) || TEXTURES[0];
    console.log('[TexturePickerModal] 🎨 확인 버튼 - 선택된 텍스처:', selectedTexture.id, selectedTexture.name);
    if (onSelect) {
      onSelect(selectedTexture);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>🎨 텍스처 선택</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 텍스처 그리드 */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={true}
          >
            {TEXTURES.map((texture) => (
              <TouchableOpacity
                key={texture.id}
                style={[
                  styles.textureItem,
                  selectedId === texture.id && styles.textureItemSelected,
                ]}
                onPress={() => handleSelect(texture)}
                activeOpacity={0.7}
              >
                {texture.image ? (
                  <Image
                    source={texture.image}
                    style={styles.textureImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noTextureBox}>
                    <Text style={styles.noTextureText}>없음</Text>
                  </View>
                )}
                <Text style={styles.textureName} numberOfLines={1}>
                  {texture.name}
                </Text>
                {selectedId === texture.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 확인 버튼 */}
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
    backgroundColor: SpotifyColors.backgroundLight,
    borderRadius: SpotifyRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SpotifySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SpotifyColors.divider,
  },
  title: {
    fontSize: 18,
    fontWeight: SpotifyFonts.bold,
    color: SpotifyColors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 20,
    color: SpotifyColors.textSecondary,
  },
  scrollView: {
    maxHeight: 400,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SpotifySpacing.sm,
    justifyContent: 'flex-start',
  },
  textureItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE + 24,
    margin: 4,
    borderRadius: SpotifyRadius.md,
    backgroundColor: SpotifyColors.backgroundElevated,
    overflow: 'hidden',
    alignItems: 'center',
  },
  textureItemSelected: {
    borderWidth: 3,
    borderColor: SpotifyColors.primary,
  },
  textureImage: {
    width: ITEM_SIZE - 8,
    height: ITEM_SIZE - 8,
    margin: 4,
    borderRadius: SpotifyRadius.sm,
  },
  noTextureBox: {
    width: ITEM_SIZE - 8,
    height: ITEM_SIZE - 8,
    margin: 4,
    borderRadius: SpotifyRadius.sm,
    backgroundColor: SpotifyColors.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTextureText: {
    fontSize: 12,
    color: SpotifyColors.textSecondary,
  },
  textureName: {
    fontSize: 11,
    color: SpotifyColors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SpotifyColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 12,
    color: '#000',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: SpotifyColors.primary,
    padding: SpotifySpacing.md,
    margin: SpotifySpacing.md,
    borderRadius: SpotifyRadius.md,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: SpotifyFonts.bold,
    color: '#000',
  },
});
