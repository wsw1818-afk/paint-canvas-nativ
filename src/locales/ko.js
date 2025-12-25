/**
 * 🇰🇷 한국어 번역
 */
export default {
  // 언어 정보
  languageName: '한국어',
  languageCode: 'ko',

  // 공통
  common: {
    confirm: '확인',
    cancel: '취소',
    delete: '삭제',
    reset: '초기화',
    save: '저장',
    back: '뒤로',
    loading: '로딩 중...',
    error: '오류',
    success: '성공',
  },

  // 홈 화면
  home: {
    title: 'Photo Color',
    subtitle: '사진을 색칠 퍼즐로',
    newPuzzle: '새 퍼즐 만들기',
    gallery: '갤러리',
    settings: '설정',
  },

  // 갤러리 화면
  gallery: {
    title: '갤러리',
    itemCount: '{{count}}개의 작품',
    emptyTitle: '완료된 작품이 없습니다',
    emptyDesc: '격자 적용된 퍼즐에서 작업을 완료하면 여기에 저장됩니다',
    difficultyEasy: '쉬움',
    difficultyMedium: '보통',
    difficultyHard: '어려움',
    colorCount: '{{count}}가지 색상',
    progress: '완성도: {{percent}}%',
    modeOriginal: '원본 이미지',
    modeWeave: '위빙 텍스처',
    deleteTitle: '퍼즐 삭제',
    deleteMessage: '"{{title}}"을(를) 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 진행 상황이 함께 삭제됩니다.',
    deleteSuccess: '퍼즐이 삭제되었습니다.',
    resetTitle: '진행 상황 초기화',
    resetMessage: '"{{title}}"의 모든 진행 상황을 초기화하시겠습니까?\n\n현재 완성도: {{progress}}%\n\n이 작업은 되돌릴 수 없습니다.',
    resetSuccess: '진행 상황이 초기화되었습니다.',
    resetFailed: '초기화에 실패했습니다.',
    reset: '초기화',
    untitled: '제목 없음',
  },

  // 생성 화면
  generate: {
    title: '새 퍼즐 만들기',
    selectImage: '이미지 선택',
    takePhoto: '카메라',
    takePhotoDesc: '카메라로 사진을 찍어주세요',
    fromGallery: '갤러리',
    selectFromGallery: '사진 앨범에서 이미지를 선택해주세요',
    sample: '샘플',
    sampleDesc: '연습용 샘플 이미지로 시작합니다',
    difficulty: '난이도 선택 (색상 개수)',
    easyName: '쉬움 (빠른 플레이)',
    normalName: '보통 (균형잡힌)',
    hardName: '어려움 (사진처럼)',
    colorGrid: '{{colors}}가지 색상 · {{gridSize}}×{{gridSize}} 격자',
    completionMode: '완성 모드 선택',
    originalMode: '원본 이미지',
    originalModeDesc: '완성 시 원본 사진이 나타남',
    weaveMode: '위빙 텍스처',
    weaveModeDesc: '완성 시 색칠한 그대로 유지',
    createPuzzle: '격자 적용하기',
    selectImageRequired: '이미지 선택 필요',
    processing: '퍼즐 생성 중...',
    analyzeColors: '색상 분석 중...',
    initializing: '초기화 중...',
    // 로딩 단계별 메시지
    stepPreparing: '준비 중...',
    stepThumbnail: '미리보기 생성 중...',
    stepResize: '이미지 최적화 중...',
    stepSaving: '파일 저장 중...',
    stepAnalyzing: '색상 분석 중...',
    stepWeave: '위빙 텍스처 생성 중...',
    stepFinishing: '저장 완료 중...',
    tapToSelect: '탭하여 선택',
    changeImage: '이미지 변경',
    permissionRequired: '권한 필요',
    cameraPermissionMessage: '카메라 권한이 필요합니다.\n설정 → 앱 → 권한에서 허용해주세요.',
    galleryPermissionMessage: '갤러리 접근 권한이 필요합니다.\n설정 → 앱 → 권한에서 허용해주세요.',
    loadImageError: '이미지를 불러올 수 없습니다.\n앱을 완전히 종료 후 다시 시작해주세요.',
    selectImageTitle: '이미지 선택',
    selectImageMessage: '먼저 이미지를 선택해주세요.',
    gridApplied: '격자 적용 완료',
    gridAppliedMessage: '이미지가 저장되었습니다. 갤러리에서 확인하세요.',
    saveFailed: '저장 실패',
    saveFailedMessage: '이미지 저장 중 오류가 발생했습니다.',
    pointsRequired: '포인트 필요',
    pointsShortfall: '포인트가 부족합니다.\n\n필요: {{cost}}P\n보유: {{current}}P\n부족: {{shortfall}}P\n\n더 많은 퍼즐을 색칠하여 포인트를 획득하세요!',
  },

  // 플레이 화면
  play: {
    preparing: '캔버스 준비 중...',
    completeTitle: '🎉 축하합니다!',
    completeMessage: '퍼즐을 완성했습니다!\n\n점수 달성률: {{percent}}%\n보상: +{{reward}}P\n\n갤러리에서 작품을 확인하세요.',
    undo: '되돌리기',
    wrongCells: '{{count}}개',
    currentPosition: '현재 위치',
    remainingCells: '남은 셀 {{count}}개',
  },

  // 설정 화면
  settings: {
    title: '설정',
    language: '언어',
    languageDesc: '앱 표시 언어를 선택합니다',
    selectLanguage: '언어 선택',
    help: '사용 설명서',
    helpDesc: '앱 사용 방법 안내',
    about: '정보',
    version: '버전',
    developer: '개발자',
  },

  // 광고
  ads: {
    adArea: '광고 영역',
  },

  // 도움말
  help: {
    title: '사용 설명서',
    welcome: 'Photo Color에 오신 것을 환영합니다!',
    welcomeDesc: '사진을 색칠 퍼즐로 변환하고, 번호에 맞는 색상을 칠해 작품을 완성하세요.',

    // 섹션 제목
    gettingStarted: '시작하기',
    createPuzzle: '퍼즐 만들기',
    playPuzzle: '퍼즐 플레이',
    gallery: '갤러리',
    tips: '유용한 팁',

    // 시작하기
    q1: '이 앱은 무엇인가요?',
    a1: '사진을 숫자 색칠 퍼즐로 변환하는 앱입니다. 각 영역에 표시된 번호에 맞는 색상을 선택하여 칠하면 원본 이미지가 완성됩니다.',
    q2: '어떻게 시작하나요?',
    a2: '홈 화면에서 "새 퍼즐 만들기"를 눌러 사진을 선택하고, 난이도를 설정한 후 "격자 적용하기"를 누르세요.',

    // 퍼즐 만들기
    q3: '어떤 사진이 좋나요?',
    a3: '색상 대비가 뚜렷하고 단순한 구도의 사진이 좋습니다. 풍경, 꽃, 동물 사진이 특히 잘 어울립니다.',
    q4: '난이도는 어떻게 다른가요?',
    a4: '쉬움(16색)은 빠르게, 보통(36색)은 균형잡힌, 어려움(64색)은 사진처럼 세밀한 결과물을 제공합니다.',
    q5: '완성 모드란 무엇인가요?',
    a5: '"원본 이미지"는 완성 시 원본 사진이 나타나고, "위빙 텍스처"는 색칠한 그대로의 질감이 유지됩니다.',

    // 퍼즐 플레이
    q6: '색칠은 어떻게 하나요?',
    a6: '하단 팔레트에서 색상을 선택하고, 같은 번호가 표시된 영역을 터치하세요. 핀치 제스처로 확대/축소할 수 있습니다.',
    q7: '실수했을 때는 어떻게 하나요?',
    a7: '팔레트 옆의 되돌리기 버튼을 눌러 이전 상태로 복구할 수 있습니다.',
    q8: '진행 상황은 저장되나요?',
    a8: '네, 자동으로 저장됩니다. 앱을 종료해도 갤러리에서 이어서 플레이할 수 있습니다.',

    // 갤러리
    q9: '갤러리에는 무엇이 있나요?',
    a9: '생성한 모든 퍼즐이 저장됩니다. 진행 중인 퍼즐을 이어서 하거나, 완성된 작품을 감상할 수 있습니다.',
    q10: '퍼즐을 삭제하려면?',
    a10: '갤러리에서 퍼즐을 길게 누르면 삭제 또는 초기화 옵션이 나타납니다.',

    // 팁
    tip1: '쉬운 색상부터 시작하세요',
    tipDesc1: '넓은 영역을 차지하는 색상부터 칠하면 전체 그림의 윤곽이 빠르게 드러납니다.',
    tip2: '확대해서 작업하세요',
    tipDesc2: '작은 영역은 화면을 확대하여 정확하게 터치할 수 있습니다.',
    tip3: '휴식을 취하세요',
    tipDesc3: '진행 상황은 자동 저장되므로, 언제든 잠시 쉬었다가 이어서 할 수 있습니다.',
  },
};
