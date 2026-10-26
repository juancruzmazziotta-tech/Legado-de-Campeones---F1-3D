const fs = require('fs');

// ==========================================
// 1. IMOLA (Autodromo Enzo e Dino Ferrari)
// ==========================================
const imolaSvg = fs.readFileSync('public/assets/aistudio/Imola_2009_d1aeef83.svg', 'utf8');
const match = imolaSvg.match(/id=\"path2582\"[^>]*d=\"([^\"]+)\"/s) || imolaSvg.match(/d=\"([^\"]+)\"[^>]*id=\"path2582\"/s);
const d = match[1];

const tokens = d.trim().split(/[\s,]+/);
let curX = 0, curY = 0;
let startX = 0, startY = 0;
const pts = [];

let i = 0;
let cmd = '';
while (i < tokens.length) {
  const token = tokens[i];
  if (/^[a-zA-Z]$/.test(token)) {
    cmd = token;
    i++;
  }
  if (cmd === 'm') {
    curX += parseFloat(tokens[i++]);
    curY += parseFloat(tokens[i++]);
    startX = curX; startY = curY;
    pts.push({x: curX, y: curY});
  } else if (cmd === 'M') {
    curX = parseFloat(tokens[i++]);
    curY = parseFloat(tokens[i++]);
    startX = curX; startY = curY;
    pts.push({x: curX, y: curY});
  } else if (cmd === 'c') {
    const dx1 = parseFloat(tokens[i++]);
    const dy1 = parseFloat(tokens[i++]);
    const dx2 = parseFloat(tokens[i++]);
    const dy2 = parseFloat(tokens[i++]);
    const dx = parseFloat(tokens[i++]);
    const dy = parseFloat(tokens[i++]);
    const p0 = {x: curX, y: curY};
    const p1 = {x: curX + dx1, y: curY + dy1};
    const p2 = {x: curX + dx2, y: curY + dy2};
    const p3 = {x: curX + dx, y: curY + dy};
    for (let step = 1; step <= 2; step++) {
      const t = step / 2;
      const it = 1 - t;
      const x = it*it*it*p0.x + 3*it*it*t*p1.x + 3*it*t*t*p2.x + t*t*t*p3.x;
      const y = it*it*it*p0.y + 3*it*it*t*p1.y + 3*it*t*t*p2.y + t*t*t*p3.y;
      pts.push({x, y});
    }
    curX += dx;
    curY += dy;
  } else if (cmd === 'C') {
    const x1 = parseFloat(tokens[i++]);
    const y1 = parseFloat(tokens[i++]);
    const x2 = parseFloat(tokens[i++]);
    const y2 = parseFloat(tokens[i++]);
    const x = parseFloat(tokens[i++]);
    const y = parseFloat(tokens[i++]);
    const p0 = {x: curX, y: curY};
    const p1 = {x: x1, y: y1};
    const p2 = {x: x2, y: y2};
    const p3 = {x: x, y: y};
    for (let step = 1; step <= 2; step++) {
      const t = step / 2;
      const it = 1 - t;
      const px = it*it*it*p0.x + 3*it*it*t*p1.x + 3*it*t*t*p2.x + t*t*t*p3.x;
      const py = it*it*it*p0.y + 3*it*it*t*p1.y + 3*it*t*t*p2.y + t*t*t*p3.y;
      pts.push({x: px, y: py});
    }
    curX = x;
    curY = y;
  } else if (cmd === 'z' || cmd === 'Z') {
    curX = startX; curY = startY;
  } else {
    i++;
  }
}
let bestDist = Infinity, startIdx = 0;
for (let j = 0; j < pts.length; j++) {
  const d = Math.hypot(pts[j].x - 302.2, pts[j].y - 605.0);
  if (d < bestDist) {
    bestDist = d;
    startIdx = j;
  }
}
const orderedImola = pts.slice(startIdx).concat(pts.slice(0, startIdx));
// Remove consecutive points that are closer than 8 meters
const cleanedImola = [];
for (let j = 0; j < orderedImola.length; j++) {
  const p = orderedImola[j];
  if (cleanedImola.length === 0) {
    cleanedImola.push(p);
  } else {
    const prev = cleanedImola[cleanedImola.length - 1];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 6) {
      cleanedImola.push(p);
    }
  }
}

let totalSvgLen = 0;
for (let j = 0; j < cleanedImola.length; j++) {
  const a = cleanedImola[j];
  const b = cleanedImola[(j + 1) % cleanedImola.length];
  totalSvgLen += Math.hypot(b.x - a.x, b.y - a.y);
}
const imolaScale = 4909 / totalSvgLen;
const ip0 = cleanedImola[0];
const ip1 = cleanedImola[1];
const iinitDx = ip1.x - ip0.x;
const iinitDy = ip1.y - ip0.y;
const iinitAngle = Math.atan2(iinitDy, iinitDx);
const imolaRot = -iinitAngle + Math.PI / 2;

const imolaPoints = cleanedImola.map(p => {
  const dx = (p.x - ip0.x) * imolaScale;
  const dy = (p.y - ip0.y) * imolaScale;
  const x = dx * Math.cos(imolaRot) - dy * Math.sin(imolaRot);
  const z = dx * Math.sin(imolaRot) + dy * Math.cos(imolaRot);
  return { x: +x.toFixed(1), z: +z.toFixed(1) };
});

// ==========================================
// 2. SPA-FRANCORCHAMPS (Circuit de Spa-Francorchamps)
// ==========================================
// Scale factor to preserve real 7.004 km F1 track distance
const spaTrace = [
  { name: 'Start Line', x: 235, y: 560 },
  { name: 'Run to La Source 1', x: 175, y: 605 },
  { name: 'Run to La Source 2', x: 110, y: 655 },
  { name: 'La Source braking', x: 55, y: 700 },
  { name: 'T1 La Source entry', x: 28, y: 720 },
  { name: 'T1 La Source apex', x: 18, y: 730 },
  { name: 'T1 La Source exit', x: 35, y: 710 },
  { name: 'Descent to Eau Rouge 1', x: 65, y: 650 },
  { name: 'T2 Descent 2', x: 110, y: 575 },
  { name: 'Descent 3', x: 160, y: 500 },
  { name: 'T3 Eau Rouge entry', x: 215, y: 440 },
  { name: 'T3 Eau Rouge dip', x: 230, y: 420 },
  { name: 'T4 Raidillon climb', x: 260, y: 380 },
  { name: 'T5 Raidillon crest', x: 300, y: 335 },
  { name: 'T6 Kemmel Straight 1', x: 370, y: 295 },
  { name: 'Kemmel Straight 2', x: 500, y: 230 },
  { name: 'Kemmel Straight 3', x: 650, y: 160 },
  { name: 'Kemmel Straight 4', x: 800, y: 95 },
  { name: 'Kemmel braking', x: 920, y: 40 },
  { name: 'T7 Les Combes entry', x: 975, y: 23 },
  { name: 'T7 Les Combes apex R', x: 1005, y: 32 },
  { name: 'T8 Les Combes chicane L', x: 1035, y: 55 },
  { name: 'T9 Malmedy exit R', x: 1075, y: 48 },
  { name: 'Descent to Bruxelles', x: 1130, y: 100 },
  { name: 'Bruxelles braking', x: 1175, y: 150 },
  { name: 'T10 Bruxelles entry', x: 1225, y: 195 },
  { name: 'T10 Bruxelles apex', x: 1240, y: 220 },
  { name: 'T10 Bruxelles exit', x: 1205, y: 235 },
  { name: 'T11 Speakers Corner', x: 1150, y: 200 },
  { name: 'Run to Pouhon 1', x: 1060, y: 230 },
  { name: 'Run to Pouhon 2', x: 950, y: 270 },
  { name: 'Pouhon approach', x: 850, y: 310 },
  { name: 'T12 Pouhon apex 1', x: 795, y: 360 },
  { name: 'T12 Pouhon mid', x: 785, y: 410 },
  { name: 'T13 Pouhon apex 2', x: 815, y: 460 },
  { name: 'Run to Campus 1', x: 880, y: 495 },
  { name: 'Run to Campus 2', x: 980, y: 535 },
  { name: 'T14 Campus approach', x: 1055, y: 570 },
  { name: 'T14 Campus entry R', x: 1065, y: 620 },
  { name: 'T15 Campus exit L', x: 1090, y: 665 },
  { name: 'Run to Stavelot', x: 1145, y: 705 },
  { name: 'T16 Stavelot entry', x: 1195, y: 745 },
  { name: 'T16 Stavelot apex', x: 1200, y: 775 },
  { name: 'T16 Stavelot exit', x: 1160, y: 790 },
  { name: 'Courbe Paul Frere 1', x: 1090, y: 790 },
  { name: 'Courbe Paul Frere 2', x: 1000, y: 755 },
  { name: 'Run to Blanchimont', x: 920, y: 690 },
  { name: 'T17 Blanchimont 1', x: 840, y: 605 },
  { name: 'T18 Blanchimont 2', x: 750, y: 540 },
  { name: 'Blanchimont exit straight 1', x: 640, y: 505 },
  { name: 'Blanchimont exit straight 2', x: 500, y: 525 },
  { name: 'Bus Stop braking', x: 380, y: 550 },
  { name: 'T19 Bus Stop entry R', x: 320, y: 545 },
  { name: 'T19 Bus Stop chicane R', x: 305, y: 515 },
  { name: 'T20 Bus Stop chicane L', x: 280, y: 515 },
  { name: 'T20 Bus Stop exit L', x: 270, y: 545 },
  { name: 'Pit straight run to line', x: 250, y: 555 },
];

let spaSvgLen = 0;
for (let j = 0; j < spaTrace.length; j++) {
  const a = spaTrace[j];
  const b = spaTrace[(j + 1) % spaTrace.length];
  spaSvgLen += Math.hypot(b.x - a.x, b.y - a.y);
}
const spaScale = 7004 / spaSvgLen;
const sp0 = spaTrace[0];
const sp1 = spaTrace[1];
const sinitDx = sp1.x - sp0.x;
const sinitDy = sp1.y - sp0.y;
const sinitAngle = Math.atan2(sinitDy, sinitDx);
const spaRot = -sinitAngle + Math.PI / 2;

const baseSpaPoints = spaTrace.map(p => {
  const dx = (p.x - sp0.x) * spaScale;
  const dy = (p.y - sp0.y) * spaScale;
  const x = dx * Math.cos(spaRot) - dy * Math.sin(spaRot);
  const z = dx * Math.sin(spaRot) + dy * Math.cos(spaRot);
  return { name: p.name, x: +x.toFixed(1), z: +z.toFixed(1) };
});

// Explicit U-turn hairpin for Turn 1 "La Source" with 50m separation from pit straight
// This completely eliminates any crossing/overlapping road ribbons and provides a true U-turn.
const spaPoints = [...baseSpaPoints];

const replacementHairpin = [
  { name: 'Start Line', x: 0, z: 0 },
  { name: 'Run to La Source 1', x: 0, z: 120 },
  { name: 'Run to La Source 2', x: 0, z: 240 },
  { name: 'La Source braking', x: 0, z: 350 },
  { name: 'T1 La Source entry', x: -6, z: 420 },
  { name: 'T1 La Source apex 1', x: -18, z: 455 },
  { name: 'T1 La Source apex mid', x: -35, z: 462 },
  { name: 'T1 La Source apex 2', x: -48, z: 445 },
  { name: 'T1 La Source exit', x: -54, z: 410 },
  { name: 'Descent to Eau Rouge 1', x: -55, z: 340 },
  { name: 'T2 Descent 2', x: -85, z: 220 },
  { name: 'Descent 3', x: -140, z: 70 },
  { name: 'T3 Eau Rouge entry', x: -184.5, z: -95.6 }
];

spaPoints.splice(0, 11, ...replacementHairpin);
spaPoints[spaPoints.length - 1] = { name: 'Pit straight run to line', x: 0, z: -35 };
spaPoints[spaPoints.length - 2] = { name: 'T20 Bus Stop exit L', x: 0, z: -75 };

fs.writeFileSync('src/three/circuitCoordinates.json', JSON.stringify({
  imola: imolaPoints,
  spa: spaPoints
}, null, 2));

console.log('Successfully generated circuitCoordinates.json!');
console.log('Imola points:', imolaPoints.length, 'Spa points:', spaPoints.length);

