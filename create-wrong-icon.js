// Create wrong_mark.png - Red X icon for wrong cells
const fs = require('fs');
const { createCanvas } = require('canvas');

const size = 128;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Transparent background
ctx.clearRect(0, 0, size, size);

// Draw red X
ctx.strokeStyle = '#FF0000';
ctx.lineWidth = 20;
ctx.lineCap = 'round';

const padding = 20;
// Top-left to bottom-right
ctx.beginPath();
ctx.moveTo(padding, padding);
ctx.lineTo(size - padding, size - padding);
ctx.stroke();

// Top-right to bottom-left
ctx.beginPath();
ctx.moveTo(size - padding, padding);
ctx.lineTo(padding, size - padding);
ctx.stroke();

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('modules/paint-canvas/android/src/main/res/drawable/wrong_mark.png', buffer);
console.log('✅ wrong_mark.png created!');
