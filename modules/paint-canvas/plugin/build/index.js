"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const withPaintCanvas = (config) => {
    // Android 설정
    config = (0, config_plugins_1.withDangerousMod)(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const modulePath = path.join(projectRoot, 'modules', 'paint-canvas', 'android');
            const targetPath = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'paintcanvas');
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
            // 소스 디렉토리 존재 확인
            if (!fs.existsSync(modulePath)) {
                throw new Error(`PaintCanvas native module directory not found: ${modulePath}`);
            }
            files.forEach(file => {
                const src = path.join(modulePath, 'src', 'main', 'java', 'com', 'paintcanvas', file);
                const dest = path.join(targetPath, file);
                if (!fs.existsSync(src)) {
                    throw new Error(`PaintCanvas source file not found: ${src}`);
                }
                console.log(`[PaintCanvas Plugin] Copying ${file} to ${dest}`);
                fs.copyFileSync(src, dest);
            });
            // MainApplication.kt 수정 (패키지 추가)
            const packageName = config.android?.package || 'com.wisangwon.ColorPlayExpo';
            const packagePath = packageName.replace(/\./g, '/');
            const mainAppPath = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', packagePath, 'MainApplication.kt');
            if (fs.existsSync(mainAppPath)) {
                let content = fs.readFileSync(mainAppPath, 'utf-8');
                // Import 추가
                if (!content.includes('import com.paintcanvas.PaintCanvasPackage')) {
                    content = content.replace('import expo.modules.ReactNativeHostWrapper', 'import expo.modules.ReactNativeHostWrapper\n\nimport com.paintcanvas.PaintCanvasPackage');
                }
                // packages 리스트에 추가
                if (!content.includes('PaintCanvasPackage()')) {
                    content = content.replace(/packages.apply\s*\{/, `packages.apply {
              add(PaintCanvasPackage())`);
                }
                fs.writeFileSync(mainAppPath, content);
            }
            return config;
        },
    ]);
    return config;
};
exports.default = withPaintCanvas;
