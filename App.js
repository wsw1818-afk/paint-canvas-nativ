import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import GenerateScreen from './src/screens/GenerateScreen';
import PlayScreenNativeModule from './src/screens/PlayScreenNativeModule';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';
import { initializeInterstitialAd } from './src/utils/adManager';
import { loadLanguage } from './src/locales';
import { migratePuzzles } from './src/utils/puzzleStorage';
import { createDefaultPuzzles, DEFAULT_PUZZLES_COUNT } from './src/utils/defaultPuzzles';

// 🎨 Gallery가 홈(첫 화면), HomeScreen 제거됨
// 앱 시작 시 SplashScreen에서 migrate + defaultPuzzles 초기화 대기

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Gallery');
  const [params, setParams] = useState({});
  const [initReady, setInitReady] = useState(false);
  const [initProgress, setInitProgress] = useState({
    current: 0,
    total: 0,
    phase: 'start', // 'start' | 'lang' | 'migrate' | 'defaultPuzzles' | 'done'
    message: '준비 중...',
  });
  // 🔧 갤러리 새로고침용 키
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  // 🌐 앱 시작 시 초기화 (진행률 표시)
  useEffect(() => {
    const initialize = async () => {
      // 1. 언어 로드 (< 100ms)
      setInitProgress({ current: 0, total: 100, phase: 'lang', message: '언어 설정을 불러오고 있어요' });
      await loadLanguage();

      // 2. 광고 초기화 (빠름)
      initializeInterstitialAd();

      // 3. 퍼즐 마이그레이션 (기존 사용자)
      setInitProgress({ current: 10, total: 100, phase: 'migrate', message: '퍼즐 데이터를 확인하고 있어요' });
      try {
        await migratePuzzles();
      } catch (e) {
        console.warn('마이그레이션 오류:', e);
      }

      // 4. 기본 퍼즐 등록 (신규 사용자, 10-30초)
      setInitProgress({
        current: 0,
        total: DEFAULT_PUZZLES_COUNT,
        phase: 'defaultPuzzles',
        message: '퍼즐을 준비하고 있어요',
      });

      try {
        await createDefaultPuzzles((current, total) => {
          setInitProgress({
            current,
            total,
            phase: 'defaultPuzzles',
            message: '퍼즐을 준비하고 있어요',
          });
        });
      } catch (e) {
        console.warn('기본 퍼즐 생성 오류:', e);
      }

      // 5. 완료
      setInitProgress({ current: 100, total: 100, phase: 'done', message: '준비 완료!' });
      // 짧은 지연으로 100% 표시 후 전환
      setTimeout(() => setInitReady(true), 300);
    };
    initialize();
  }, []);

  const navigation = {
    navigate: (screen, screenParams = {}) => {
      setCurrentScreen(screen);
      setParams(screenParams);
      if (screen === 'Gallery') {
        setGalleryRefreshKey((prev) => prev + 1);
      }
    },
    goBack: () => {
      // HomeScreen 제거 → Gallery로 돌아가기
      setCurrentScreen('Gallery');
      setParams({});
      setGalleryRefreshKey((prev) => prev + 1);
    },
    addListener: (event, callback) => {
      // Stub: GalleryScreen의 'focus' 이벤트 호환 (실제 리스너 등록 안 함)
      // 별도 스택 네비게이션 라이브러리 미사용
      return () => {};
    },
  };

  // 진행률 계산 (0-100)
  const progressPercent = (() => {
    if (initProgress.phase === 'done') return 100;
    if (initProgress.phase === 'defaultPuzzles' && initProgress.total > 0) {
      // 전체 진행률 = 언어(10%) + 마이그레이션(10%) + 기본퍼즐(80%)
      return 20 + (initProgress.current / initProgress.total) * 80;
    }
    return (initProgress.current / Math.max(1, initProgress.total)) * 100 * 0.2;
  })();

  const renderScreen = () => {
    if (!initReady) {
      return (
        <SplashScreen
          progress={progressPercent}
          current={initProgress.phase === 'defaultPuzzles' ? initProgress.current : undefined}
          total={initProgress.phase === 'defaultPuzzles' ? initProgress.total : undefined}
          message={initProgress.message}
        />
      );
    }

    switch (currentScreen) {
      case 'Generate':
        return <GenerateScreen navigation={navigation} route={{ params }} />;
      case 'Play':
        return <PlayScreenNativeModule navigation={navigation} route={{ params }} />;
      case 'Settings':
        return <SettingsScreen navigation={navigation} />;
      case 'Help':
        return <HelpScreen navigation={navigation} />;
      case 'Gallery':
      default:
        return <GalleryScreen key={galleryRefreshKey} navigation={navigation} />;
    }
  };

  return <SafeAreaProvider>{renderScreen()}</SafeAreaProvider>;
}
