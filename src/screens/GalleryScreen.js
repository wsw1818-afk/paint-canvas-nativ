import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadPuzzles, deletePuzzle } from '../utils/puzzleStorage';

export default function GalleryScreen({ navigation }) {
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedPuzzles();
  }, []);

  const loadSavedPuzzles = async () => {
    try {
      const savedPuzzles = await loadPuzzles();
      setPuzzles(savedPuzzles);
    } catch (error) {
      console.error('퍼즐 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePuzzle = async (puzzleId) => {
    try {
      await deletePuzzle(puzzleId);
      await loadSavedPuzzles();
    } catch (error) {
      console.error('퍼즐 삭제 실패:', error);
    }
  };

  const getDifficultyInfo = (colors) => {
    if (colors <= 12) return { name: '쉬움', color: '#4CD964' };
    if (colors <= 24) return { name: '보통', color: '#5AB9EA' };
    return { name: '어려움', color: '#FF5757' };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>갤러리</Text>
      </View>

      {/* Puzzle List */}
      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A255FF" />
            <Text style={styles.loadingText}>불러오는 중...</Text>
          </View>
        ) : puzzles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyTitle}>완료된 작품이 없습니다</Text>
            <Text style={styles.emptyDesc}>격자 적용된 퍼즐에서 작업을 완료하면 여기에 저장됩니다</Text>
          </View>
        ) : (
          puzzles.map((puzzle) => {
            const difficultyInfo = getDifficultyInfo(puzzle.colorCount || 12);
            return (
              <View key={puzzle.id} style={styles.puzzleCard}>
                <TouchableOpacity
                  style={styles.puzzleCardContent}
                  onPress={() => navigation.navigate('Play', {
                    imageUri: puzzle.imageUri || puzzle.imageBase64,  // file:// URI 전달 (하위 호환성 유지)
                    colorCount: puzzle.colorCount,
                    gridColors: puzzle.gridColors
                  })}
                >
                  <View style={[styles.difficultyBadge, { backgroundColor: difficultyInfo.color }]}>
                    <Text style={styles.difficultyText}>{difficultyInfo.name}</Text>
                  </View>

                  <View style={styles.puzzleInfo}>
                    <Text style={styles.puzzleTitle}>{puzzle.title || '제목 없음'}</Text>
                    <Text style={styles.puzzleSubtext}>{puzzle.colorCount}가지 색상</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePuzzle(puzzle.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#A255FF',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1B1F',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 16,
    color: '#999',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  puzzleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  puzzleCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 24,
  },
  difficultyBadge: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  puzzleInfo: {
    flex: 1,
  },
  puzzleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginBottom: 4,
  },
  puzzleSubtext: {
    fontSize: 13,
    color: '#666',
  },
});
