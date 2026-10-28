import * as THREE from 'three';
import type { UVRect } from './world-geometry';

/** Original, static display art: one shared atlas for an entire streamed metropolis. */
export function neonSigns(): { map: THREE.CanvasTexture; rects: UVRect[] } {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const a = canvas.getContext('2d')!;
  a.fillStyle = '#040c25'; a.fillRect(0, 0, 1024, 1024);
  const glowText = (text: string, x: number, y: number, size: number, color: string, max = 480) => {
    a.font = `italic 700 ${size}px sans-serif`; a.textAlign = 'center'; a.fillStyle = color;
    a.shadowColor = color; a.shadowBlur = 16; a.fillText(text, x, y, max); a.shadowBlur = 0;
  };
  // A graphic holographic portrait, with cyan rim lighting and magenta hair.
  const portrait = a.createLinearGradient(0, 0, 512, 512);
  portrait.addColorStop(0, '#032e65'); portrait.addColorStop(.5, '#511c98'); portrait.addColorStop(1, '#ec207e');
  a.fillStyle = portrait; a.fillRect(0, 0, 512, 512);
  a.strokeStyle = '#26dfff55'; a.lineWidth = 2;
  for (let x = -300; x < 650; x += 42) { a.beginPath(); a.moveTo(x, 0); a.lineTo(x + 280, 512); a.stroke(); }
  a.fillStyle = '#12113f'; a.beginPath(); a.moveTo(90, 460); a.bezierCurveTo(0, 40, 300, -110, 433, 110); a.bezierCurveTo(487, 200, 386, 410, 470, 512); a.closePath(); a.fill();
  const skin = a.createLinearGradient(150, 100, 380, 340); skin.addColorStop(0, '#49ceef'); skin.addColorStop(.45, '#b783ed'); skin.addColorStop(1, '#ee4fb2');
  a.fillStyle = skin; a.beginPath(); a.moveTo(180, 135); a.bezierCurveTo(210, 58, 345, 75, 380, 167); a.lineTo(370, 240); a.lineTo(396, 278); a.lineTo(366, 288); a.bezierCurveTo(353, 366, 294, 395, 257, 350); a.lineTo(247, 416); a.lineTo(148, 450); a.lineTo(205, 340); a.bezierCurveTo(137, 280, 126, 214, 180, 135); a.fill();
  a.fillStyle = '#191340'; a.beginPath(); a.moveTo(110, 255); a.bezierCurveTo(112, -10, 355, -9, 404, 166); a.bezierCurveTo(301, 59, 251, 205, 146, 244); a.lineTo(159, 370); a.closePath(); a.fill();
  a.strokeStyle = '#ff38d5'; a.lineWidth = 9; a.beginPath(); a.moveTo(138, 355); a.bezierCurveTo(71, 71, 288, 6, 374, 123); a.stroke();
  a.strokeStyle = '#15305d'; a.lineWidth = 7; a.beginPath(); a.moveTo(269, 230); a.quadraticCurveTo(302, 208, 334, 230); a.stroke();
  a.strokeStyle = '#14122e'; a.lineWidth = 5; a.beginPath(); a.moveTo(272, 248); a.quadraticCurveTo(307, 225, 333, 246); a.stroke();
  a.fillStyle = '#5ff7ff'; a.beginPath(); a.ellipse(310, 245, 8, 6, 0, 0, Math.PI * 2); a.fill();
  a.strokeStyle = '#ff2b8e'; a.lineWidth = 6; a.beginPath(); a.moveTo(329, 321); a.quadraticCurveTo(349, 326, 365, 315); a.stroke();
  a.strokeStyle = '#5defff'; a.lineWidth = 4; a.beginPath(); a.moveTo(380, 166); a.lineTo(370, 240); a.lineTo(396, 278); a.lineTo(366, 288); a.stroke();
  a.fillStyle = '#07132e'; a.beginPath(); a.moveTo(0, 512); a.lineTo(125, 433); a.lineTo(246, 407); a.lineTo(400, 512); a.fill();
  glowText('L U M E N', 256, 477, 35, '#a1f6ff');
  a.fillStyle = '#afffff16'; for (let y = 0; y < 512; y += 6) a.fillRect(0, y, 512, 1);

  // The expressway's own animated-neon aesthetic, without a flashing animation.
  const brand = a.createLinearGradient(512, 64, 1024, 320); brand.addColorStop(0, '#06162e'); brand.addColorStop(1, '#251041');
  a.fillStyle = brand; a.fillRect(512, 64, 512, 256);
  a.strokeStyle = '#15d9ff'; a.lineWidth = 4; a.strokeRect(526, 78, 484, 228);
  a.strokeStyle = '#ff32c9'; a.beginPath(); a.moveTo(540, 275); a.lineTo(994, 112); a.stroke();
  glowText('CHILLWAVE', 768, 205, 70, '#5ceaff'); glowText('D R I V E', 768, 264, 30, '#ff62dc');
  a.fillStyle = '#63dfff'; a.font = '15px monospace'; a.textAlign = 'center'; a.fillText('AFTER DARK / SUNSET EXPRESSWAY', 768, 104);

  // Vaporwave sunset and palm silhouettes.
  const sunset = a.createLinearGradient(0, 512, 0, 1024); sunset.addColorStop(0, '#121d61'); sunset.addColorStop(.55, '#b329b8'); sunset.addColorStop(1, '#281345');
  a.fillStyle = sunset; a.fillRect(0, 512, 512, 512);
  a.fillStyle = '#ff79cf'; a.beginPath(); a.arc(268, 746, 119, 0, Math.PI * 2); a.fill();
  a.fillStyle = '#992c9a'; for (let y = 760; y < 868; y += 15) a.fillRect(145, y, 246, 3 + (y - 760) / 30);
  a.strokeStyle = '#f84fe555'; a.lineWidth = 2;
  for (let y = 887; y < 1024; y += 19) { a.beginPath(); a.moveTo(0, y); a.lineTo(512, y); a.stroke(); }
  for (let x = -550; x <= 1050; x += 75) { a.beginPath(); a.moveTo(268, 864); a.lineTo(x, 1024); a.stroke(); }
  for (const [x, y, scale] of [[90, 785, 1], [428, 823, .8], [38, 868, .55]]) {
    a.save(); a.translate(x, y); a.scale(scale, scale); a.strokeStyle = '#080b27'; a.fillStyle = '#080b27'; a.lineWidth = 13;
    a.beginPath(); a.moveTo(12, 190); a.quadraticCurveTo(29, 60, 0, 0); a.stroke();
    for (let i = 0; i < 7; i++) { const angle = i * .71 - Math.PI; a.save(); a.rotate(angle); a.beginPath(); a.moveTo(0, 0); a.quadraticCurveTo(55, -45, 130, 19); a.quadraticCurveTo(52, -13, 0, 0); a.fill(); a.restore(); }
    a.restore();
  }
  glowText('AFTERGLOW', 256, 978, 42, '#ffa6eb');
  // Tall bilingual tower signs, separate UV regions sharing the same material.
  for (const [x, label, color, english] of [[512, 'ネオン', '#ff44d9', 'NEON DISTRICT'], [768, '未来', '#58eaff', 'FUTURE CITY']] as const) {
    a.fillStyle = '#110e2d'; a.fillRect(x, 512, 256, 512); a.strokeStyle = color; a.lineWidth = 5; a.strokeRect(x + 12, 526, 232, 484);
    Array.from(label).forEach((letter, i) => glowText(letter, x + 128, 670 + i * (label.length === 2 ? 150 : 120), 107, color, 220));
    a.fillStyle = color; a.textAlign = 'center'; a.font = '15px monospace'; a.fillText(english, x + 128, 988, 220);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const rect = (x: number, y: number, w: number, h: number): UVRect => [x / 1024, 1 - (y + h) / 1024, w / 1024, h / 1024];
  return { map, rects: [rect(2, 2, 508, 508), rect(514, 66, 508, 252), rect(2, 514, 508, 508), rect(514, 514, 252, 508), rect(770, 514, 252, 508)] };
}
