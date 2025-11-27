import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#87CEEB', '#40E0D0', '#20B2AA']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
              activeOpacity={0.8}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonIcon}>🖼️</Text>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonText}>갤러리</Text>
                  <Text style={styles.buttonSubtext}>격자 적용된 사진 보기</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Create Puzzle Button */}
            <TouchableOpacity
              style={[styles.button, styles.savedButton]}
              onPress={() => navigation.navigate('Generate', { sourceType: 'gallery' })}
              activeOpacity={0.8}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonIcon}>📂</Text>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonText}>새 퍼즐 만들기</Text>
                  <Text style={styles.buttonSubtext}>사진을 격자로 변환하기</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom decoration */}
          <View style={styles.bottomDecoration}>
            <Text style={styles.decorationText}>🏖️ 🌴 🍹</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  button: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  galleryButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#FF6B6B',
  },
  savedButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#FFD93D',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 44,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  bottomDecoration: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  decorationText: {
    fontSize: 32,
    letterSpacing: 8,
  },
});
