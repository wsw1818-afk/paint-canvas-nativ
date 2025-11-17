import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ColorPlay</Text>
        <Text style={styles.subtitle}>색칠 퍼즐 게임</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Sample Button */}
        <TouchableOpacity
          style={[styles.button, styles.sampleButton]}
          onPress={() => navigation.navigate('Generate', { sourceType: 'sample' })}
        >
          <Text style={styles.buttonIcon}>🎨</Text>
          <Text style={styles.buttonText}>샘플로 시작하기</Text>
          <Text style={styles.buttonSubtext}>연습용 이미지로 퍼즐 만들기</Text>
        </TouchableOpacity>

        {/* Gallery Button */}
        <TouchableOpacity
          style={[styles.button, styles.galleryButton]}
          onPress={() => navigation.navigate('Generate', { sourceType: 'gallery' })}
        >
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>갤러리에서 선택</Text>
          <Text style={styles.buttonSubtext}>내 사진으로 퍼즐 만들기</Text>
        </TouchableOpacity>

        {/* Camera Button */}
        <TouchableOpacity
          style={[styles.button, styles.cameraButton]}
          onPress={() => navigation.navigate('Generate', { sourceType: 'camera' })}
        >
          <Text style={styles.buttonIcon}>📸</Text>
          <Text style={styles.buttonText}>사진 찍기</Text>
          <Text style={styles.buttonSubtext}>카메라로 퍼즐 만들기</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <TouchableOpacity
        style={styles.myWorksButton}
        onPress={() => navigation.navigate('Gallery')}
      >
        <Text style={styles.myWorksText}>내 작품 보기 →</Text>
      </TouchableOpacity>
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
  sampleButton: {
    borderLeftWidth: 6,
    borderLeftColor: '#A255FF',
  },
  galleryButton: {
    borderLeftWidth: 6,
    borderLeftColor: '#5AB9EA',
  },
  cameraButton: {
    borderLeftWidth: 6,
    borderLeftColor: '#FFC300',
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
  myWorksButton: {
    margin: 24,
    padding: 20,
    backgroundColor: '#A255FF',
    borderRadius: 16,
    alignItems: 'center',
  },
  myWorksText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
