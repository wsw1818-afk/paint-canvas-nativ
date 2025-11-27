const sharp = require('sharp');

// 64x64 투명 배경에 노란색 삼각형 경고 아이콘 생성
const size = 64;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- 노란색 삼각형 (경고 아이콘) -->
  <path d="M32 6 L60 58 H4 Z" fill="#FFD700" stroke="#E6A500" stroke-width="2" stroke-linejoin="round"/>

  <!-- 느낌표 몸통 -->
  <rect x="28" y="20" width="8" height="20" rx="2" fill="#333333"/>

  <!-- 느낌표 점 -->
  <circle cx="32" cy="49" r="4" fill="#333333"/>
</svg>
`;

sharp(Buffer.from(svg))
  .png()
  .toFile('modules/paint-canvas/android/src/main/res/drawable-nodpi/wrong_mark.png')
  .then(() => console.log('Created transparent yellow triangle warning icon!'))
  .catch(err => console.error('Error:', err));
