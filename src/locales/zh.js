/**
 * 🇨🇳 中文翻译
 */
export default {
  // 语言信息
  languageName: '中文',
  languageCode: 'zh',

  // 通用
  common: {
    confirm: '确认',
    cancel: '取消',
    delete: '删除',
    reset: '重置',
    save: '保存',
    back: '返回',
    loading: '加载中...',
    error: '错误',
    success: '成功',
  },

  // 主页
  home: {
    title: 'Photo Color',
    subtitle: '将照片变成填色拼图',
    newPuzzle: '新建拼图',
    gallery: '画廊',
    settings: '设置',
  },

  // 画廊页面
  gallery: {
    title: '画廊',
    itemCount: '{{count}}件作品',
    emptyTitle: '没有完成的作品',
    emptyDesc: '完成拼图后将保存在这里',
    difficultyEasy: '简单',
    difficultyMedium: '普通',
    difficultyHard: '困难',
    colorCount: '{{count}}种颜色',
    progress: '完成度: {{percent}}%',
    modeOriginal: '原始图像',
    modeWeave: '编织纹理',
    deleteTitle: '删除拼图',
    deleteMessage: '确定要完全删除"{{title}}"吗？\n\n此操作无法撤销，所有进度都将被删除。',
    deleteSuccess: '拼图已删除。',
    resetTitle: '重置进度',
    resetMessage: '重置"{{title}}"的所有进度？\n\n当前完成度: {{progress}}%\n\n此操作无法撤销。',
    resetSuccess: '进度已重置。',
    resetFailed: '重置失败。',
    reset: '重置',
    untitled: '无标题',
  },

  // 创建页面
  generate: {
    title: '创建新拼图',
    selectImage: '选择图片',
    takePhoto: '相机',
    takePhotoDesc: '用相机拍照',
    fromGallery: '相册',
    selectFromGallery: '从相册中选择图片',
    sample: '示例',
    sampleDesc: '使用示例图片开始练习',
    difficulty: '选择难度 (颜色数量)',
    easyName: '简单 (快速游戏)',
    normalName: '普通 (平衡)',
    hardName: '困难 (像照片)',
    colorGrid: '{{colors}}种颜色 · {{gridSize}}×{{gridSize}}格子',
    completionMode: '选择完成模式',
    originalMode: '原始图像',
    originalModeDesc: '完成时显示原始照片',
    weaveMode: '编织纹理',
    weaveModeDesc: '保持上色后的状态',
    createPuzzle: '应用格子',
    selectImageRequired: '需要选择图片',
    processing: '正在创建拼图...',
    analyzeColors: '正在分析颜色...',
    initializing: '正在初始化...',
    tapToSelect: '点击选择',
    changeImage: '更换图片',
    permissionRequired: '需要权限',
    cameraPermissionMessage: '需要相机权限。\n请在设置 → 应用 → 权限中允许。',
    galleryPermissionMessage: '需要相册访问权限。\n请在设置 → 应用 → 权限中允许。',
    loadImageError: '无法加载图片。\n请完全关闭应用后重新启动。',
    selectImageTitle: '选择图片',
    selectImageMessage: '请先选择图片。',
    gridApplied: '格子应用完成',
    gridAppliedMessage: '图片已保存。请在画廊中查看。',
    saveFailed: '保存失败',
    saveFailedMessage: '保存图片时发生错误。',
  },

  // 游戏页面
  play: {
    preparing: '正在准备画布...',
    completeTitle: '🎉 恭喜！',
    completeMessage: '你完成了拼图！\n在画廊中查看你的作品。',
    undo: '撤销',
    wrongCells: '{{count}}个',
    currentPosition: '当前位置',
  },

  // 设置页面
  settings: {
    title: '设置',
    language: '语言',
    languageDesc: '选择应用显示语言',
    selectLanguage: '选择语言',
    help: '使用说明',
    helpDesc: '如何使用此应用',
    about: '关于',
    version: '版本',
    developer: '开发者',
  },

  // 广告
  ads: {
    adArea: '广告区域',
  },

  // 帮助
  help: {
    title: '使用说明',
    welcome: '欢迎使用 Photo Color！',
    welcomeDesc: '将照片转换为填色拼图，按照数字填上对应的颜色，完成你的作品。',

    // 章节标题
    gettingStarted: '开始使用',
    createPuzzle: '创建拼图',
    playPuzzle: '游玩拼图',
    gallery: '画廊',
    tips: '实用技巧',

    // 开始使用
    q1: '这个应用是什么？',
    a1: '这是一款将照片转换为数字填色拼图的应用。选择与每个区域显示的数字对应的颜色进行填色，即可完成原始图像。',
    q2: '如何开始？',
    a2: '在主页点击"新建拼图"，选择照片，设置难度，然后点击"应用格子"。',

    // 创建拼图
    q3: '什么照片效果最好？',
    a3: '色彩对比鲜明、构图简单的照片效果最佳。风景、花卉和动物照片特别适合。',
    q4: '难度有什么区别？',
    a4: '简单（16色）快速完成，普通（36色）平衡适中，困难（64色）提供照片级细节。',
    q5: '什么是完成模式？',
    a5: '"原始图像"完成时显示原照片，"编织纹理"保持填色后的纹理外观。',

    // 游玩拼图
    q6: '如何填色？',
    a6: '从底部调色板选择颜色，然后点击显示相同数字的区域。捏合手势可缩放。',
    q7: '填错了怎么办？',
    a7: '点击调色板旁边的撤销按钮可恢复到之前的状态。',
    q8: '进度会保存吗？',
    a8: '是的，自动保存。关闭应用后也可以从画廊继续游玩。',

    // 画廊
    q9: '画廊里有什么？',
    a9: '所有创建的拼图都保存在这里。可以继续进行中的拼图，或欣赏已完成的作品。',
    q10: '如何删除拼图？',
    a10: '在画廊长按拼图，即可看到删除或重置选项。',

    // 技巧
    tip1: '从简单的颜色开始',
    tipDesc1: '先填占据较大区域的颜色，可以快速显现整体轮廓。',
    tip2: '放大进行精细操作',
    tipDesc2: '放大画面可以更准确地点击小区域。',
    tip3: '适当休息',
    tipDesc3: '进度会自动保存，随时可以休息后继续。',
  },
};
