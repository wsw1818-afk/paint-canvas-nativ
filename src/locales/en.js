/**
 * 🇺🇸 English Translation
 */
export default {
  // Language Info
  languageName: 'English',
  languageCode: 'en',

  // Common
  common: {
    confirm: 'OK',
    cancel: 'Cancel',
    delete: 'Delete',
    reset: 'Reset',
    save: 'Save',
    back: 'Back',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },

  // Home Screen
  home: {
    title: 'Photo Color',
    subtitle: 'Turn photos into color puzzles',
    newPuzzle: 'New Puzzle',
    gallery: 'Gallery',
    settings: 'Settings',
  },

  // Gallery Screen
  gallery: {
    title: 'Gallery',
    itemCount: '{{count}} artworks',
    emptyTitle: 'No completed artworks',
    emptyDesc: 'Complete puzzles to save them here',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    colorCount: '{{count}} colors',
    progress: 'Progress: {{percent}}%',
    modeOriginal: 'Original Image',
    modeWeave: 'Weave Texture',
    deleteTitle: 'Delete Puzzle',
    deleteMessage: 'Are you sure you want to delete "{{title}}"?\n\nThis action cannot be undone and all progress will be lost.',
    deleteSuccess: 'Puzzle deleted.',
    resetTitle: 'Reset Progress',
    resetMessage: 'Reset all progress for "{{title}}"?\n\nCurrent progress: {{progress}}%\n\nThis action cannot be undone.',
    resetSuccess: 'Progress has been reset.',
    resetFailed: 'Failed to reset progress.',
    reset: 'Reset',
    untitled: 'Untitled',
  },

  // Generate Screen
  generate: {
    title: 'Create New Puzzle',
    selectImage: 'Select Image',
    takePhoto: 'Camera',
    takePhotoDesc: 'Take a photo with the camera',
    fromGallery: 'Gallery',
    selectFromGallery: 'Select an image from your photo album',
    sample: 'Sample',
    sampleDesc: 'Start with a sample image for practice',
    difficulty: 'Select Difficulty (Color Count)',
    easyName: 'Easy (Quick Play)',
    normalName: 'Normal (Balanced)',
    hardName: 'Hard (Photo-like)',
    colorGrid: '{{colors}} colors · {{gridSize}}×{{gridSize}} grid',
    completionMode: 'Select Completion Mode',
    originalMode: 'Original Image',
    originalModeDesc: 'Original photo appears on completion',
    weaveMode: 'Weave Texture',
    weaveModeDesc: 'Keeps the colored appearance',
    createPuzzle: 'Apply Grid',
    selectImageRequired: 'Select Image Required',
    processing: 'Creating puzzle...',
    analyzeColors: 'Analyzing colors...',
    initializing: 'Initializing...',
    tapToSelect: 'Tap to select',
    changeImage: 'Change Image',
    permissionRequired: 'Permission Required',
    cameraPermissionMessage: 'Camera permission is required.\nGo to Settings → Apps → Permissions to allow.',
    galleryPermissionMessage: 'Gallery access permission is required.\nGo to Settings → Apps → Permissions to allow.',
    loadImageError: 'Unable to load image.\nPlease close the app completely and restart.',
    selectImageTitle: 'Select Image',
    selectImageMessage: 'Please select an image first.',
    gridApplied: 'Grid Applied',
    gridAppliedMessage: 'Image saved. Check it in the gallery.',
    saveFailed: 'Save Failed',
    saveFailedMessage: 'An error occurred while saving the image.',
  },

  // Play Screen
  play: {
    preparing: 'Preparing canvas...',
    completeTitle: '🎉 Congratulations!',
    completeMessage: 'You completed the puzzle!\nCheck your artwork in the gallery.',
    undo: 'Undo',
    wrongCells: '{{count}}',
    currentPosition: 'Current Position',
  },

  // Settings Screen
  settings: {
    title: 'Settings',
    language: 'Language',
    languageDesc: 'Select app display language',
    selectLanguage: 'Select Language',
    help: 'User Guide',
    helpDesc: 'How to use this app',
    about: 'About',
    version: 'Version',
    developer: 'Developer',
  },

  // Ads
  ads: {
    adArea: 'Advertisement',
  },

  // Help
  help: {
    title: 'User Guide',
    welcome: 'Welcome to Photo Color!',
    welcomeDesc: 'Transform photos into color-by-number puzzles and complete your artwork by painting the right colors.',

    // Section titles
    gettingStarted: 'Getting Started',
    createPuzzle: 'Creating Puzzles',
    playPuzzle: 'Playing Puzzles',
    gallery: 'Gallery',
    tips: 'Useful Tips',

    // Getting Started
    q1: 'What is this app?',
    a1: 'This app transforms photos into number coloring puzzles. Select and paint colors matching the numbers shown in each area to complete the original image.',
    q2: 'How do I start?',
    a2: 'Tap "New Puzzle" on the home screen, select a photo, set the difficulty, then tap "Apply Grid".',

    // Creating Puzzles
    q3: 'What photos work best?',
    a3: 'Photos with clear color contrast and simple composition work best. Landscapes, flowers, and animals are particularly suitable.',
    q4: 'How do difficulties differ?',
    a4: 'Easy (16 colors) is quick, Normal (36 colors) is balanced, Hard (64 colors) provides photo-like detail.',
    q5: 'What is completion mode?',
    a5: '"Original Image" reveals the original photo when completed, "Weave Texture" maintains the painted texture appearance.',

    // Playing Puzzles
    q6: 'How do I paint?',
    a6: 'Select a color from the bottom palette, then touch areas with matching numbers. Pinch to zoom in/out.',
    q7: 'What if I make a mistake?',
    a7: 'Tap the undo button next to the palette to restore the previous state.',
    q8: 'Is my progress saved?',
    a8: 'Yes, automatically. You can continue from the gallery even after closing the app.',

    // Gallery
    q9: 'What\'s in the gallery?',
    a9: 'All your puzzles are saved here. Continue in-progress puzzles or admire completed artworks.',
    q10: 'How to delete a puzzle?',
    a10: 'Long press a puzzle in the gallery to see delete or reset options.',

    // Tips
    tip1: 'Start with easy colors',
    tipDesc1: 'Painting larger areas first reveals the overall outline quickly.',
    tip2: 'Zoom in for precision',
    tipDesc2: 'Zoom in to accurately touch small areas.',
    tip3: 'Take breaks',
    tipDesc3: 'Progress is auto-saved, so take a break and continue anytime.',
  },
};
