import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ColorPlay</Text>
        <Text style={styles.subtitle}>색칠 퍼즐 게임</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Gallery View Button */}
        <TouchableOpacity
          style={[styles.button, styles.galleryButton]}
          onPress={() => navigation.navigate('Gallery')}
        >
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>갤러리</Text>
          <Text style={styles.buttonSubtext}>격자 적용된 사진 보기</Text>
        </TouchableOpacity>

        {/* Create Puzzle Button */}
        <TouchableOpacity
          style={[styles.button, styles.savedButton]}
          onPress={() => navigation.navigate('Generate', { sourceType: 'gallery' })}
        >
          <Text style={styles.buttonIcon}>📂</Text>
          <Text style={styles.buttonText}>격자 적용된 퍼즐</Text>
          <Text style={styles.buttonSubtext}>사진을 격자로 변환하기</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: '#A255FF',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  button: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  galleryButton: {
    borderLeftWidth: 6,
    borderLeftColor: '#5AB9EA',
  },
  savedButton: {
    borderLeftWidth: 6,
    borderLeftColor: '#FFD700',
  },
  buttonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#666',
  },
});
