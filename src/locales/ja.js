/**
 * 🇯🇵 日本語翻訳
 */
export default {
  // 言語情報
  languageName: '日本語',
  languageCode: 'ja',

  // 共通
  common: {
    confirm: '確認',
    cancel: 'キャンセル',
    delete: '削除',
    reset: 'リセット',
    save: '保存',
    back: '戻る',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
  },

  // ホーム画面
  home: {
    title: 'Photo Color',
    subtitle: '写真を塗り絵パズルに',
    newPuzzle: '新しいパズル',
    gallery: 'ギャラリー',
    settings: '設定',
  },

  // ギャラリー画面
  gallery: {
    title: 'ギャラリー',
    itemCount: '{{count}}件の作品',
    emptyTitle: '完成した作品がありません',
    emptyDesc: 'パズルを完成させると、ここに保存されます',
    difficultyEasy: '簡単',
    difficultyMedium: '普通',
    difficultyHard: '難しい',
    colorCount: '{{count}}色',
    progress: '完成度: {{percent}}%',
    modeOriginal: 'オリジナル画像',
    modeWeave: 'ウィービングテクスチャ',
    deleteTitle: 'パズルを削除',
    deleteMessage: '「{{title}}」を完全に削除しますか？\n\nこの操作は元に戻せません。すべての進捗が削除されます。',
    deleteSuccess: 'パズルが削除されました。',
    resetTitle: '進捗をリセット',
    resetMessage: '「{{title}}」のすべての進捗をリセットしますか？\n\n現在の完成度: {{progress}}%\n\nこの操作は元に戻せません。',
    resetSuccess: '進捗がリセットされました。',
    resetFailed: 'リセットに失敗しました。',
    reset: 'リセット',
    untitled: '無題',
  },

  // 生成画面
  generate: {
    title: '新しいパズルを作成',
    selectImage: '画像を選択',
    takePhoto: 'カメラ',
    takePhotoDesc: 'カメラで写真を撮ってください',
    fromGallery: 'ギャラリー',
    selectFromGallery: 'フォトアルバムから画像を選択してください',
    sample: 'サンプル',
    sampleDesc: '練習用サンプル画像で始める',
    difficulty: '難易度選択 (色の数)',
    easyName: '簡単 (クイックプレイ)',
    normalName: '普通 (バランス)',
    hardName: '難しい (写真のように)',
    colorGrid: '{{colors}}色 · {{gridSize}}×{{gridSize}}グリッド',
    completionMode: '完成モード選択',
    originalMode: 'オリジナル画像',
    originalModeDesc: '完成時に元の写真が表示される',
    weaveMode: 'ウィービングテクスチャ',
    weaveModeDesc: '塗った状態を維持',
    createPuzzle: 'グリッドを適用',
    selectImageRequired: '画像選択が必要',
    processing: 'パズルを作成中...',
    analyzeColors: '色を分析中...',
    initializing: '初期化中...',
    tapToSelect: 'タップして選択',
    changeImage: '画像を変更',
    permissionRequired: '権限が必要',
    cameraPermissionMessage: 'カメラ権限が必要です。\n設定 → アプリ → 権限で許可してください。',
    galleryPermissionMessage: 'ギャラリーアクセス権限が必要です。\n設定 → アプリ → 権限で許可してください。',
    loadImageError: '画像を読み込めません。\nアプリを完全に終了して再起動してください。',
    selectImageTitle: '画像を選択',
    selectImageMessage: '最初に画像を選択してください。',
    gridApplied: 'グリッド適用完了',
    gridAppliedMessage: '画像が保存されました。ギャラリーで確認してください。',
    saveFailed: '保存に失敗',
    saveFailedMessage: '画像の保存中にエラーが発生しました。',
  },

  // プレイ画面
  play: {
    preparing: 'キャンバスを準備中...',
    completeTitle: '🎉 おめでとうございます！',
    completeMessage: 'パズルを完成しました！\nギャラリーで作品を確認してください。',
    undo: '元に戻す',
    wrongCells: '{{count}}個',
    currentPosition: '現在位置',
  },

  // 設定画面
  settings: {
    title: '設定',
    language: '言語',
    languageDesc: 'アプリの表示言語を選択',
    selectLanguage: '言語を選択',
    help: '使い方ガイド',
    helpDesc: 'アプリの使い方',
    about: '情報',
    version: 'バージョン',
    developer: '開発者',
  },

  // 広告
  ads: {
    adArea: '広告エリア',
  },

  // ヘルプ
  help: {
    title: '使い方ガイド',
    welcome: 'Photo Colorへようこそ！',
    welcomeDesc: '写真を塗り絵パズルに変換し、番号に合った色を塗って作品を完成させましょう。',

    // セクションタイトル
    gettingStarted: 'はじめに',
    createPuzzle: 'パズルを作成',
    playPuzzle: 'パズルをプレイ',
    gallery: 'ギャラリー',
    tips: '便利なヒント',

    // はじめに
    q1: 'このアプリは何ですか？',
    a1: '写真を数字塗り絵パズルに変換するアプリです。各エリアに表示された番号に合った色を選んで塗ると、元の画像が完成します。',
    q2: 'どうやって始めますか？',
    a2: 'ホーム画面で「新しいパズル」をタップし、写真を選択して難易度を設定し、「グリッドを適用」をタップしてください。',

    // パズルを作成
    q3: 'どんな写真が良いですか？',
    a3: '色のコントラストがはっきりしていて、シンプルな構図の写真が最適です。風景、花、動物の写真が特に向いています。',
    q4: '難易度はどう違いますか？',
    a4: '簡単（16色）は素早く、普通（36色）はバランス良く、難しい（64色）は写真のように細かい仕上がりになります。',
    q5: '完成モードとは何ですか？',
    a5: '「オリジナル画像」は完成時に元の写真が表示され、「ウィービングテクスチャ」は塗った質感がそのまま維持されます。',

    // パズルをプレイ
    q6: 'どうやって塗りますか？',
    a6: '下部のパレットから色を選び、同じ番号が表示されたエリアをタッチしてください。ピンチで拡大/縮小できます。',
    q7: '間違えた時はどうしますか？',
    a7: 'パレットの横にある元に戻すボタンをタップして、前の状態に戻せます。',
    q8: '進捗は保存されますか？',
    a8: 'はい、自動的に保存されます。アプリを閉じても、ギャラリーから続きをプレイできます。',

    // ギャラリー
    q9: 'ギャラリーには何がありますか？',
    a9: '作成したすべてのパズルが保存されます。進行中のパズルを続けたり、完成した作品を鑑賞したりできます。',
    q10: 'パズルを削除するには？',
    a10: 'ギャラリーでパズルを長押しすると、削除またはリセットのオプションが表示されます。',

    // ヒント
    tip1: '簡単な色から始めましょう',
    tipDesc1: '広いエリアを占める色から塗ると、全体の輪郭が早く見えてきます。',
    tip2: '拡大して作業しましょう',
    tipDesc2: '小さなエリアは画面を拡大して正確にタッチできます。',
    tip3: '休憩を取りましょう',
    tipDesc3: '進捗は自動保存されるので、いつでも休憩して続きからプレイできます。',
  },
};
