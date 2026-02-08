import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import GenerateScreen from './src/screens/GenerateScreen';
import PlayScreenNativeModule from './src/screens/PlayScreenNativeModule';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';
import { initializeInterstitialAd } from './src/utils/adManager';
import { loadLanguage } from './src/locales';
// Updated - Using PlayScreenNativeModule with native Android Canvas (zero latency)

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [params, setParams] = useState({});
  const [isReady, setIsReady] = useState(false);
  // 🔧 갤러리 새로고침용 키 (Date.now() 대신 명시적 카운터 사용)
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  // 🌐 앱 시작 시 언어 설정 및 광고 초기화
  useEffect(() => {
    const initialize = async () => {
      await loadLanguage();
      initializeInterstitialAd();
      setIsReady(true);
    };
    initialize();
  }, []);

  const navigation = {
    navigate: (screen, screenParams = {}) => {
      setCurrentScreen(screen);
      setParams(screenParams);
      // 🔧 갤러리 진입 시 refreshKey 증가 (새로고침 트리거)
      if (screen === 'Gallery') {
        setGalleryRefreshKey(prev => prev + 1);
      }
    },
    goBack: () => {
      setCurrentScreen('Home');
      setParams({});
    },
  };

  const renderScreen = () => {
    if (!isReady) return null; // 초기화 완료 전 빈 화면

    switch (currentScreen) {
      case 'Home':
        return <HomeScreen navigation={navigation} />;
      case 'Generate':
        return <GenerateScreen navigation={navigation} route={{ params }} />;
      case 'Play':
        return <PlayScreenNativeModule navigation={navigation} route={{ params }} />;
      case 'Gallery':
        return <GalleryScreen key={galleryRefreshKey} navigation={navigation} />;
      case 'Settings':
        return <SettingsScreen navigation={navigation} />;
      case 'Help':
        return <HelpScreen navigation={navigation} />;
      default:
        return <HomeScreen navigation={navigation} />;
    }
  };

  return (
    <SafeAreaProvider>
      {renderScreen()}
    </SafeAreaProvider>
  );
}
