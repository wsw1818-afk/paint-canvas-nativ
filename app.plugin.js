const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withPaintCanvas(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      const sourceModuleDir = path.join(projectRoot, 'modules', 'paint-canvas', 'android');
      const targetDir = path.join(platformRoot, 'app', 'src', 'main', 'java', 'com', 'paintcanvas');

      // Create target directory
      fs.mkdirSync(targetDir, { recursive: true });

      // Copy Kotlin files
      const kotlinFiles = ['PaintCanvasModule.kt', 'PaintCanvasView.kt'];
      for (const file of kotlinFiles) {
        const sourcePath = path.join(sourceModuleDir, 'src', 'main', 'java', 'com', 'paintcanvas', file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`Copied ${file} to android project`);
        }
      }

      return config;
    },
  ]);
}

module.exports = withPaintCanvas;
