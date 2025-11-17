import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import GenerateScreen from './src/screens/GenerateScreen';
import PlayScreen from './src/screens/PlayScreen';
import GalleryScreen from './src/screens/GalleryScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [params, setParams] = useState({});

  const navigation = {
    navigate: (screen, screenParams = {}) => {
      setCurrentScreen(screen);
      setParams(screenParams);
    },
    goBack: () => {
      setCurrentScreen('Home');
      setParams({});
    },
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen navigation={navigation} />;
      case 'Generate':
        return <GenerateScreen navigation={navigation} route={{ params }} />;
      case 'Play':
        return <PlayScreen navigation={navigation} route={{ params }} />;
      case 'Gallery':
        return <GalleryScreen navigation={navigation} />;
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
