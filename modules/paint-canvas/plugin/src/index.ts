import { ConfigPlugin, withDangerousMod, AndroidConfig } from '@expo/config-plugins';
import * as path from 'path';
import * as fs from 'fs';

const withPaintCanvas: ConfigPlugin = (config) => {
  // Android 설정
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const modulePath = path.join(projectRoot, 'modules', 'paint-canvas', 'android');
      const targetPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'paintcanvas'
      );

      // 디렉토리 생성
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      // Kotlin 파일 복사
      const files = [
        'PaintCanvasView.kt',
        'PaintCanvasViewManager.kt',
        'PaintCanvasPackage.kt'
      ];

      files.forEach(file => {
        const src = path.join(modulePath, 'src', 'main', 'java', 'com', 'paintcanvas', file);
        const dest = path.join(targetPath, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      });

      // MainApplication.kt 수정 (패키지 추가)
      const packageName = config.android?.package || 'com.wisangwon.ColorPlayExpo';
      const packagePath = packageName.replace(/\./g, '/');
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'MainApplication.kt'
      );

      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf-8');

        // Import 추가
        if (!content.includes('import com.paintcanvas.PaintCanvasPackage')) {
          content = content.replace(
            'import expo.modules.ReactNativeHostWrapper',
            'import expo.modules.ReactNativeHostWrapper\n\nimport com.paintcanvas.PaintCanvasPackage'
          );
        }

        // packages 리스트에 추가
        if (!content.includes('PaintCanvasPackage()')) {
          content = content.replace(
            /packages.apply\s*\{/,
            `packages.apply {
              add(PaintCanvasPackage())`
          );
        }

        fs.writeFileSync(mainAppPath, content);
      }

      return config;
    },
  ]);

  return config;
};

export default withPaintCanvas;
