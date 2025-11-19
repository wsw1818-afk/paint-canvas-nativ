import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 샘플 저장된 퍼즐 데이터
const SAVED_PUZZLES = [
  { id: 1, title: '샘플 퍼즐 1', difficulty: '쉬움', progress: 100, completed: true, color: '#4CD964' },
  { id: 2, title: '샘플 퍼즐 2', difficulty: '보통', progress: 65, completed: false, color: '#5AB9EA' },
  { id: 3, title: '샘플 퍼즐 3', difficulty: '어려움', progress: 30, completed: false, color: '#FF5757' },
];

export default function GalleryScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>내 작품</Text>
      </View>

      {/* Puzzle List */}
      <ScrollView style={styles.content}>
        {SAVED_PUZZLES.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyTitle}>아직 퍼즐이 없습니다</Text>
            <Text style={styles.emptyDesc}>홈 화면에서 퍼즐을 만들어보세요!</Text>
          </View>
        ) : (
          SAVED_PUZZLES.map((puzzle) => (
            <TouchableOpacity
              key={puzzle.id}
              style={styles.puzzleCard}
              onPress={() => navigation.navigate('Play', { puzzleId: puzzle.id })}
            >
              <View style={[styles.difficultyBadge, { backgroundColor: puzzle.color }]}>
                <Text style={styles.difficultyText}>{puzzle.difficulty}</Text>
              </View>

              <View style={styles.puzzleInfo}>
                <Text style={styles.puzzleTitle}>{puzzle.title}</Text>
                <Text style={styles.puzzleProgress}>{puzzle.progress}% 완성</Text>
                {!puzzle.completed && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { flex: puzzle.progress / 100, backgroundColor: puzzle.color }]} />
                    <View style={{ flex: (100 - puzzle.progress) / 100 }} />
                  </View>
                )}
              </View>

              <View style={[styles.statusBadge, { backgroundColor: puzzle.completed ? '#4CD964' : '#5AB9EA' }]}>
                <Text style={styles.statusText}>
                  {puzzle.completed ? '완성' : `${puzzle.progress}%`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
  puzzleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  puzzleProgress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    flexDirection: 'row',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
