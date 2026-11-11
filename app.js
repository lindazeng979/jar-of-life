/* Jar of Life: big rocks first. */
(() => {
'use strict';
const { Engine, Bodies, Body, Composite, Query, Constraint, Sleeping } = Matter;

// ---------------------------------------------------------------- constants
const W = 560, H = 740;
const VIEW_H = 480; // visible world height at jar size 1 (the area above is an off-screen drop zone)
const JAR_BASE = { halfW: 165, height: 382 };
const JAR_SIZE = { min: 0.75, max: 1.5 };
const JAR = { left: 115, right: 445, bottom: 700, rim: 318, r: 24 };
function setJarGeometry(size) {
  JAR.left = W / 2 - JAR_BASE.halfW * size;
  JAR.right = W / 2 + JAR_BASE.halfW * size;
  JAR.rim = JAR.bottom - JAR_BASE.height * size;
}
// The camera zooms with the jar so it always fills the frame; the pieces keep their size.
function view() {
  const z = state.jarSize;
  const bottom = JAR.bottom + 40 * z;
  return { z, x0: W / 2 - (W / 2) * z, y0: bottom - VIEW_H * z };
}
const ORDER = ['rock', 'pebble', 'sand', 'beer'];
const WRONG_ORDER = ['sand', 'pebble', 'rock', 'beer'];
const STORE_KEY = 'jar-of-life.v1';

const PRESETS = {
  Stone:    { rock: '#8e8b85', pebble: '#b89b7e', sand: '#e6d5ae', beer: '#e5a84b' },
  Slate:    { rock: '#6b7785', pebble: '#a4aeb8', sand: '#dfe3e6', beer: '#7fb2d6' },
  Gemstone: { rock: '#4f63c9', pebble: '#2f9e78', sand: '#f0c4d9', beer: '#f2b134' },
  Pastel:   { rock: '#9aa8c4', pebble: '#e4a39c', sand: '#f2e2c0', beer: '#f4c26f' },
  Ocean:    { rock: '#35626a', pebble: '#7aa597', sand: '#e9dcc2', beer: '#5fb3c9' },
  Dusk:     { rock: '#5d4a6e', pebble: '#b0708a', sand: '#f0c9a8', beer: '#e7894f' },
};
const DRINKS = { beer: 'Beer', coffee: 'Coffee', boba: 'Boba', tea: 'Tea' };

const DEFAULT_SUGGESTIONS = {
  rock:   ['Health', 'Sleep (7+ hrs)', 'Family', 'Close friends', 'Core classes', 'Dance'],
  pebble: ['Internship prep', 'Research tasks', 'Office hours', 'Club commitments', 'Errands', 'Laundry'],
  sand:   ['Doomscrolling', 'Group chats', 'Checking email', 'Info sessions for free food', 'Over-planning my calendar'],
  beer:   ['Boba runs', 'Thrifting', 'Deep talks with dormmates', 'A great book', 'Movie night', 'Pickup sports'],
};

const BLURBS = {
  rock: 'Your highest priorities: health, family, close relationships, and the 1–2 commitments that anchor who you are. Skipping them leads to lasting regret.',
  pebble: 'Important but secondary: classes, work, bills, projects. Skipping them is stressful, but your core life stays intact.',
  sand: 'The small stuff: busywork, distractions, chores done out of habit. If you could drop it without anyone noticing, it’s sand.',
  beer: 'Leisure, fun and real connection, whatever leaves you refreshed. Proof that a full life still has room for joy.',
};
const JAR_BLURB = 'Your finite time, energy and capacity. It doesn’t get any bigger.';

// Sorting tests, in two wordings. Answer 'yes' leads to the step's own type.
const TESTS = {
  general: {
    label: 'General',
    rock: {
      name: 'The "Skip It" test',
      q: x => `If you ignored “${x}” completely for a month, or a year, what would happen?`,
      yes: ['Deep, lasting regret. It would hurt my core foundation.', "e.g. missing a child's milestones, neglecting your health, ignoring your closest relationships"],
      no:  ['Some inconvenience or stress, but my core life would be fine.', 'e.g. an overgrown lawn, a late work report, putting off car maintenance'],
    },
    kind: {
      q: x => `Is “${x}” something you have to do, or something you do in your downtime?`,
      duty: ['Something I have to do', 'A task, duty, or obligation'],
      leisure: ['Something I do in downtime', 'Leisure, hanging out, winding down'],
    },
    pebble: {
      name: 'The Delegation & Energy test',
      q: x => `Could someone else do “${x}”, or could you drop it without anyone noticing?`,
      yes: ['No. It needs my attention or carries real responsibility.', 'e.g. paying taxes, managing a work project, fixing a broken appliance'],
      no:  ['Yes. It could be delegated, automated, or dropped.', 'e.g. endlessly checking email, reorganizing a drawer, meetings where you aren’t needed'],
    },
    beer: {
      name: 'The Restoration test',
      q: x => `How do you usually feel after “${x}”?`,
      yes: ['Refreshed, grateful, or energized', 'e.g. a drink with a close friend, a favorite sport, a great book'],
      no:  ['Drained, guilty, or like I wasted time', 'e.g. doomscrolling for two hours before bed'],
    },
  },
  stanford: {
    label: 'College student',
    rock: {
      name: 'The Graduation test',
      q: x => `When you walk across the stage at commencement, will you still care about “${x}”?`,
      yes: ['Yes. It’s core to who I am or where I’m going.', 'Your academic foundation, sleep, working out, real meals, 1–2 deep commitments like a lab or a dance team'],
      no:  ['Not really. It mostly looks good on LinkedIn this quarter.', 'e.g. an A+ instead of an A in a breadth requirement, a third pre-professional club'],
    },
    kind: {
      q: x => `Is “${x}” a commitment, or how you spend your downtime?`,
      duty: ['A commitment or obligation', 'Classes, clubs, recruiting, errands'],
      leisure: ['Downtime', 'Socializing, hobbies, winding down'],
    },
    pebble: {
      name: 'The FOMO & Status test',
      q: x => `Why are you saying “yes” to “${x}”?`,
      yes: ['It builds real skills or needs my leadership.', 'e.g. prepping for a case competition, office hours for a hard p-set'],
      no:  ['Prestige, clout, or fear of falling behind.', 'e.g. info sessions for the free food, a club you hate but keep for the title, doomscrolling Sidechat'],
    },
    beer: {
      name: 'The Soul-Fuel test',
      q: x => `Does “${x}” make you feel alive, or does it just fill space?`,
      yes: ['I feel alive: creative, connected, myself.', 'e.g. losing track of time at dance practice, thrifting, late-night boba and deep talks'],
      no:  ['It just fills space. I end up exhausted with nothing to show for it.', 'e.g. a party you didn’t even want to go to, out of FOMO'],
    },
  },
};

const DUMP_TEXT = {
  general: [
    ['Write down everything', 'Everything you did over the last three days, one per line.'],
    ['Circle your Big Rocks', 'Tap the top 2–3 things you would still care about five years from now.'],
    ['Cross out the Sand', 'Tap anything that felt like a waste of time.'],
    ['Separate what’s left', 'Necessary duties are Pebbles. Real fun or rest is {drink}.'],
  ],
  stanford: [
    ['Audit your calendar', 'Every class, club meeting, coffee chat and social event from last week, one per line.'],
    ['Pick your top 3 Big Rocks', 'For this quarter, e.g. pass CS/math core, stay consistent with dance, get 7+ hours of sleep. Protect those hours first.'],
    ['Cut the Sand', 'Clubs where you’re just a passive member, group chats that trigger your FOMO. Tap to cross them out.'],
    ['Fit the rest', 'Pebbles (internship prep, research tasks) go in weekday blocks. Protect your {drink} so you don’t burn out before finals.'],
  ],
};

const QUOTES = [
  ['Put the big rocks in first, or they will never fit.', 'The Jar of Life'],
  ['The key is not to prioritize what’s on your schedule, but to schedule your priorities.', 'Stephen R. Covey'],
  ['A full life still has room for a {drink} with a friend.', 'The Jar of Life'],
  ['Separate what builds your future from what just feeds your FOMO.', ''],
  ['Let the pebbles fill the spaces between, and let the sand settle around them.', ''],
  ['Everything feels like a Big Rock when every opportunity is elite. Sort by trajectory, not prestige.', ''],
];

// ---------------------------------------------------------------- state
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

function defaults() {
  return {
    items: [],
    colors: { ...PRESETS.Stone },
    drink: 'beer',
    wording: 'stanford',
    jarSize: 1,
    suggestions: JSON.parse(JSON.stringify(DEFAULT_SUGGESTIONS)),
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaults();
    return sanitize(JSON.parse(raw));
  } catch { return defaults(); }
}
function sanitize(s) {
  const d = defaults();
  if (!s || typeof s !== 'object') return d;
  const out = { ...d };
  if (Array.isArray(s.items)) {
    out.items = s.items
      .filter(i => i && typeof i.name === 'string' && ORDER.includes(i.type))
      .map(i => ({ id: String(i.id || uid()), name: i.name.slice(0, 40), type: i.type, seed: Number(i.seed) >>> 0 || newSeed() }));
  }
  if (s.colors) for (const t of ORDER) if (/^#[0-9a-f]{6}$/i.test(s.colors[t] || '')) out.colors[t] = s.colors[t];
  if (DRINKS[s.drink]) out.drink = s.drink;
  const own = typeof s.drinkCustom === 'string' ? s.drinkCustom.trim().slice(0, 20) : '';
  if (s.drink === 'custom' && own) { out.drink = 'custom'; out.drinkCustom = own; }
  if (TESTS[s.wording]) out.wording = s.wording;
  if (Number.isFinite(s.jarSize)) out.jarSize = Math.min(JAR_SIZE.max, Math.max(JAR_SIZE.min, s.jarSize));
  if (s.suggestions) for (const t of ORDER) if (Array.isArray(s.suggestions[t])) out.suggestions[t] = s.suggestions[t].filter(x => typeof x === 'string').map(x => x.slice(0, 40));
  return out;
}
let state = load();
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }, 150);
}

const drinkName = () => state.drink === 'custom' && state.drinkCustom
  ? state.drinkCustom.charAt(0).toUpperCase() + state.drinkCustom.slice(1)
  : DRINKS[state.drink] || DRINKS.beer;
const typeLabel = (t, plural) => ({
  rock: plural ? 'Big Rocks' : 'Big Rock',
  pebble: plural ? 'Pebbles' : 'Pebble',
  sand: 'Sand',
  beer: drinkName(),
})[t];

// ---------------------------------------------------------------- color utils
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
function mix(hex, toward, amt) { const a = hexToRgb(hex), b = hexToRgb(toward); return rgbToHex(...a.map((v, i) => v + (b[i] - v) * amt)); }
const lighten = (h, a) => mix(h, '#ffffff', a);
const darken = (h, a) => mix(h, '#1a1410', a);
function luminance(h) { const [r, g, b] = hexToRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; }
const inkOn = h => luminance(h) > 0.32 ? '#37352f' : '#ffffff';
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

function applyCssColors() {
  for (const t of ORDER) document.documentElement.style.setProperty('--c-' + t, state.colors[t]);
}

// ---------------------------------------------------------------- random + geometry
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// ---------------------------------------------------------------- physics
const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
const world = engine.world;
let walls = [];
function buildWalls() {
  if (walls.length) Composite.remove(world, walls);
  const o = { isStatic: true, friction: 0.6, label: 'wall' };
  const midX = (JAR.left + JAR.right) / 2, top = -2000;
  walls = [
    Bodies.rectangle(midX, JAR.bottom + 40, JAR.right - JAR.left + 200, 80, o),
    Bodies.rectangle(JAR.left - 40, (top + JAR.bottom + 80) / 2, 80, JAR.bottom + 80 - top, o),
    Bodies.rectangle(JAR.right + 40, (top + JAR.bottom + 80) / 2, 80, JAR.bottom + 80 - top, o),
    // soften the bottom corners to match the drawn jar
    Bodies.polygon(JAR.left, JAR.bottom, 3, 18, { ...o, angle: Math.PI / 4 }),
    Bodies.polygon(JAR.right, JAR.bottom, 3, 18, { ...o, angle: Math.PI / 4 }),
  ];
  Composite.add(world, walls);
}
function applyJarSize() {
  setJarGeometry(state.jarSize);
  buildWalls();
  liquidLevel = JAR.bottom;
}

const bodies = new Map();   // item id -> body
const poured = new Set();   // beer item ids currently poured
let queue = [];             // items waiting to drop
let nextDropAt = 0;
let pourUntil = 0;
let liquidLevel = JAR.bottom;

const SIZES = { rock: [60, 70], pebble: [26, 32], sand: [12, 14] };

function makeBody(item, x, y) {
  const rand = mulberry32(item.seed);
  const [a, b] = SIZES[item.type];
  const r = a + rand() * (b - a);
  const common = { restitution: 0.08, friction: 0.7, frictionStatic: 0.9, frictionAir: 0.012, sleepThreshold: 40 };
  let body;
  if (item.type === 'sand') {
    body = Bodies.circle(x, y, r, { ...common, density: 0.0016, friction: 0.9 });
  } else {
    const n = item.type === 'rock' ? 12 : 9;
    const squash = item.type === 'rock' ? 0.78 + rand() * 0.14 : 0.8 + rand() * 0.15;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const rr = r * (0.84 + rand() * 0.16);
      pts.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr * squash });
    }
    body = Bodies.fromVertices(x, y, [convexHull(pts)], { ...common, density: item.type === 'rock' ? 0.003 : 0.0022 });
    Body.setAngle(body, (rand() - 0.5) * 1.2);
  }
  // decoration, in body-local coordinates at angle 0
  const speckles = [];
  const nSpeck = item.type === 'rock' ? 26 : item.type === 'pebble' ? 9 : 16;
  for (let i = 0; i < nSpeck; i++) {
    const ang = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * (item.type === 'sand' ? 0.95 : 0.75);
    speckles.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, s: item.type === 'sand' ? 1.4 + rand() * 1.6 : 0.8 + rand() * 1.8, light: rand() > 0.55 });
  }
  body.plugin = { jar: { item, r, speckles, angle0: body.angle } };
  return body;
}

function spawn(item) {
  if (item.type === 'beer') {
    poured.add(item.id);
    pourUntil = performance.now() + 650;
    return;
  }
  const r = SIZES[item.type][1];
  const half = (JAR.right - JAR.left) / 2 - r - 6;
  const x = (JAR.left + JAR.right) / 2 + (Math.random() * 2 - 1) * half;
  let y = JAR.rim - 260;
  // if the pile is already high, drop above it so it doesn't spawn inside something
  const others = Composite.allBodies(world).filter(b => !b.isStatic);
  for (let tries = 0; tries < 40; tries++) {
    const region = { min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r } };
    if (!Query.region(others, region).length) break;
    y -= r * 1.2;
  }
  const body = makeBody(item, x, y);
  Body.setVelocity(body, { x: 0, y: 2 });
  Composite.add(world, body);
  bodies.set(item.id, body);
}

function despawn(id) {
  const b = bodies.get(id);
  if (b) { Composite.remove(world, b); bodies.delete(id); }
  poured.delete(id);
  queue = queue.filter(i => i.id !== id);
  wakeAll();
}
function wakeAll() { for (const b of Composite.allBodies(world)) if (!b.isStatic) Sleeping.set(b, false); }

function clearJar() {
  for (const id of [...bodies.keys()]) despawn(id);
  poured.clear();
  queue = [];
}
function pour(order = ORDER) {
  clearJar();
  const rank = t => order.indexOf(t);
  queue = state.items.slice().sort((a, b) => rank(a.type) - rank(b.type));
  nextDropAt = performance.now() + 250;
}
function enqueue(item) { queue.push(item); }

const dropGap = { rock: 280, pebble: 110, sand: 40, beer: 160 };
function processQueue(now) {
  if (!queue.length || now < nextDropAt) return;
  const item = queue.shift();
  if (state.items.find(i => i.id === item.id)) spawn(item);
  const nextType = queue[0] && queue[0].type;
  nextDropAt = now + (nextType && nextType !== item.type ? 450 : dropGap[item.type]);
}

// ---------------------------------------------------------------- rendering
const canvas = $('#jar');
const ctx = canvas.getContext('2d');
let scale = 1, dpr = 1;
function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  scale = rect.width / W;
}
new ResizeObserver(resize).observe(canvas);

function jarPath(c, inset = 0) {
  const l = JAR.left + inset, rt = JAR.right - inset, b = JAR.bottom - inset * 0.5, t = JAR.rim - 26, rr = JAR.r;
  c.beginPath();
  c.moveTo(l, t);
  c.lineTo(l, b - rr);
  c.quadraticCurveTo(l, b, l + rr, b);
  c.lineTo(rt - rr, b);
  c.quadraticCurveTo(rt, b, rt, b - rr);
  c.lineTo(rt, t);
}

function smoothShape(c, v) {
  const n = v.length;
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  let m = mid(v[n - 1], v[0]);
  c.beginPath();
  c.moveTo(m.x, m.y);
  for (let i = 0; i < n; i++) {
    const nx = mid(v[i], v[(i + 1) % n]);
    c.quadraticCurveTo(v[i].x, v[i].y, nx.x, nx.y);
  }
  c.closePath();
}

function wrapLines(text, maxW, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; }
  return lines.map(l => fitText(l, maxW));
}
function fitText(t, maxW) {
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.replace(/…$/, '') + '…';
}

let hoverId = null;
function drawBody(b) {
  const { item, r, speckles, angle0 } = b.plugin.jar;
  const color = state.colors[item.type];
  const { x, y } = b.position;
  const rot = b.angle - angle0;
  const cos = Math.cos(b.angle), sin = Math.sin(b.angle);
  const hovered = hoverId === item.id;

  ctx.save();
  if (item.type === 'sand') {
    // a little heap of grains
    ctx.fillStyle = rgba(darken(color, 0.15), 0.35);
    ctx.beginPath(); ctx.arc(x, y + 0.5, r * 0.98, 0, Math.PI * 2); ctx.fill();
    for (const s of speckles) {
      const sx = x + s.x * cos - s.y * sin, sy = y + s.x * sin + s.y * cos;
      ctx.fillStyle = s.light ? lighten(color, 0.3) : darken(color, 0.12);
      ctx.beginPath(); ctx.arc(sx, sy, s.s, 0, Math.PI * 2); ctx.fill();
    }
    if (hovered) { ctx.strokeStyle = darken(color, 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    return;
  }

  ctx.shadowColor = 'rgba(15,15,15,0.18)';
  ctx.shadowBlur = item.type === 'rock' ? 8 : 4;
  ctx.shadowOffsetY = item.type === 'rock' ? 3 : 2;
  smoothShape(ctx, b.vertices);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, lighten(color, 0.32));
  g.addColorStop(0.55, color);
  g.addColorStop(1, darken(color, 0.32));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // texture
  ctx.save();
  ctx.clip();
  for (const s of speckles) {
    const sx = x + s.x * Math.cos(rot) - s.y * Math.sin(rot), sy = y + s.x * Math.sin(rot) + s.y * Math.cos(rot);
    ctx.fillStyle = s.light ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.13)';
    ctx.beginPath(); ctx.arc(sx, sy, s.s, 0, Math.PI * 2); ctx.fill();
  }
  // soft top highlight
  const hl = ctx.createRadialGradient(x - r * 0.3, y - r * 0.5, 0, x - r * 0.3, y - r * 0.5, r * 0.6);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();

  ctx.lineWidth = hovered ? 2.5 : 1;
  ctx.strokeStyle = hovered ? darken(color, 0.55) : rgba(darken(color, 0.5), 0.45);
  ctx.stroke();

  // label (kept upright)
  const ink = inkOn(color);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ink === '#ffffff') { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3; }
  if (item.type === 'rock') {
    ctx.font = '600 15px "Geist", system-ui, sans-serif';
    const lines = wrapLines(item.name, r * 1.45, 2);
    const lh = 17;
    lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
  } else {
    ctx.font = '600 11px "Geist", system-ui, sans-serif';
    ctx.fillText(fitText(item.name, r * 1.75), x, y + 0.5);
  }
  ctx.restore();
}

let beerPills = [];
let fizz = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.4, v: 0.15 + Math.random() * 0.35 }));

function drawLiquid(t) {
  const n = poured.size;
  const color = state.colors.beer;
  const target = JAR.bottom - Math.min(n * 30, JAR.bottom - JAR.rim + 4);
  liquidLevel += (target - liquidLevel) * 0.04;
  if (liquidLevel > JAR.bottom - 0.5 && n === 0) { beerPills = []; return; }

  ctx.save();
  jarPath(ctx, 3);
  ctx.closePath();
  ctx.clip();
  const lvl = liquidLevel;
  // body of liquid with a gentle wave
  ctx.beginPath();
  ctx.moveTo(JAR.left, JAR.bottom + 10);
  for (let x = JAR.left; x <= JAR.right; x += 8) ctx.lineTo(x, lvl + Math.sin(x / 26 + t * 1.8) * 2.2);
  ctx.lineTo(JAR.right, JAR.bottom + 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, lvl, 0, JAR.bottom);
  g.addColorStop(0, rgba(lighten(color, 0.15), 0.5));
  g.addColorStop(1, rgba(darken(color, 0.1), 0.7));
  ctx.fillStyle = g;
  ctx.fill();
  // fizz
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const depth = JAR.bottom - lvl;
  if (depth > 12) for (const f of fizz) {
    f.y -= f.v / Math.max(depth, 60);
    if (f.y < 0) { f.y = 1; f.x = Math.random(); }
    const fx = JAR.left + 10 + f.x * (JAR.right - JAR.left - 20), fy = lvl + 6 + f.y * (depth - 8);
    ctx.beginPath(); ctx.arc(fx, fy, f.s, 0, Math.PI * 2); ctx.fill();
  }
  // foam line
  ctx.beginPath();
  for (let x = JAR.left; x <= JAR.right; x += 6) {
    const yy = lvl + Math.sin(x / 26 + t * 1.8) * 2.2;
    x === JAR.left ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = 'rgba(255,253,245,0.85)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawBeerLabels(t) {
  const color = state.colors.beer;
  if (!poured.size) { beerPills = []; return; }
  ctx.save();
  ctx.font = '500 11.5px "Geist", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const items = state.items.filter(i => poured.has(i.id));
  const pills = items.map(i => { const txt = fitText(i.name, 110); return { item: i, txt, w: ctx.measureText(txt).width + 22, h: 22 }; });
  const rows = [[]];
  let rowW = 0;
  const maxW = JAR.right - JAR.left - 24;
  for (const p of pills) {
    if (rowW + p.w > maxW && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rows[rows.length - 1].push(p); rowW += p.w + 6;
  }
  beerPills = [];
  rows.forEach((row, ri) => {
    const total = row.reduce((s, p) => s + p.w + 6, -6);
    let x = (JAR.left + JAR.right) / 2 - total / 2;
    for (const [k, p] of row.entries()) {
      const bob = Math.sin(t * 1.6 + k * 1.3 + ri) * 2;
      const py = Math.min(liquidLevel - 15 + ri * 26 + bob, JAR.bottom - 18);
      const px = x;
      const hovered = hoverId === p.item.id;
      ctx.shadowColor = 'rgba(15,15,15,0.12)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
      ctx.beginPath(); ctx.roundRect(px, py - p.h / 2, p.w, p.h, 4);
      ctx.fillStyle = lighten(color, 0.55); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = hovered ? 2 : 1; ctx.strokeStyle = darken(color, hovered ? 0.45 : 0.2); ctx.stroke();
      // tiny bubble icon
      ctx.fillStyle = rgba(color, 0.9);
      ctx.beginPath(); ctx.arc(px + 9, py, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#37352f';
      ctx.fillText(p.txt, px + p.w / 2 + 3, py + 0.5);
      beerPills.push({ item: p.item, x: px, y: py - p.h / 2, w: p.w, h: p.h });
      x += p.w + 6;
    }
  });
  ctx.restore();
}

function drawPourStream(now) {
  if (now > pourUntil) return;
  const k = Math.min(1, (pourUntil - now) / 650);
  const x = (JAR.left + JAR.right) / 2 + 30;
  ctx.save();
  ctx.strokeStyle = rgba(state.colors.beer, 0.6 * k + 0.1);
  ctx.lineWidth = 7 * k + 1;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, view().y0); ctx.lineTo(x, liquidLevel); ctx.stroke();
  ctx.restore();
}

function drawJarBack() {
  ctx.save();
  jarPath(ctx);
  ctx.closePath();
  const g = ctx.createLinearGradient(JAR.left, 0, JAR.right, 0);
  g.addColorStop(0, 'rgba(236,240,241,0.9)');
  g.addColorStop(0.5, 'rgba(247,249,249,0.6)');
  g.addColorStop(1, 'rgba(232,237,238,0.9)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function drawJarFront() {
  ctx.save();
  // glass outline
  jarPath(ctx);
  ctx.strokeStyle = 'rgba(140,152,155,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  jarPath(ctx, -5);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(JAR.left + 18, JAR.rim + 30); ctx.lineTo(JAR.left + 18, JAR.bottom - 90); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(JAR.left + 32, JAR.rim + 40); ctx.lineTo(JAR.left + 32, JAR.rim + 100); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(JAR.right - 16, JAR.rim + 50); ctx.lineTo(JAR.right - 16, JAR.bottom - 90); ctx.stroke();
  // mason jar thread rings at the mouth
  const mt = JAR.rim - 26;
  for (let i = 0; i < 3; i++) {
    const yy = mt + 6 + i * 8;
    ctx.beginPath();
    ctx.moveTo(JAR.left - 4, yy); ctx.quadraticCurveTo((JAR.left + JAR.right) / 2, yy + 5, JAR.right + 4, yy);
    ctx.strokeStyle = 'rgba(140,152,155,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse((JAR.left + JAR.right) / 2, mt, (JAR.right - JAR.left) / 2 + 4, 7, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140,152,155,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function drawBackground() {
  const v = view();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(v.x0, v.y0, W * v.z, VIEW_H * v.z);
  ctx.fillStyle = '#e9e9e7';
  ctx.fillRect(v.x0 + 20 * v.z, JAR.bottom + 8, (W - 40) * v.z, v.z);
  // soft contact shadow under the jar
  ctx.fillStyle = 'rgba(15,15,15,0.07)';
  ctx.beginPath(); ctx.ellipse((JAR.left + JAR.right) / 2, JAR.bottom + 10, (JAR.right - JAR.left) / 2 + 20, 9, 0, 0, Math.PI * 2); ctx.fill();
}

let overflow = false, lastOverflowCheck = 0;
function checkOverflow(now) {
  if (now - lastOverflowCheck < 400) return;
  lastOverflowCheck = now;
  if (queue.length) { overflow = false; return; }
  overflow = false;
  for (const b of bodies.values()) if (b.speed < 0.6 && b.bounds.min.y < JAR.rim - 30) { overflow = true; break; }
}

function drawOverlayText() {
  ctx.save();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.textAlign = 'center';
  if (!state.items.length) {
    const v = view();
    const cy = ((JAR.rim + JAR.bottom) / 2 - v.y0) / v.z;
    ctx.fillStyle = '#9b9a97';
    ctx.font = '600 20px "Geist", system-ui, sans-serif';
    ctx.fillText('Your jar is empty.', W / 2, cy - 12);
    ctx.font = '400 14px "Geist", system-ui, sans-serif';
    ctx.fillText('Start with a big rock.', W / 2, cy + 16);
  }
  if (overflow) {
    const msg = 'Your jar is overflowing. Something has to give.';
    ctx.font = '500 14px "Geist", system-ui, sans-serif';
    const w = ctx.measureText(msg).width + 28;
    ctx.fillStyle = '#fdebec';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 10, w, 34, 6); ctx.fill();
    ctx.fillStyle = '#9f2f2d';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, 27);
  }
  ctx.restore();
}

let last = performance.now();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  const dt = Math.min(now - last, 32);
  last = now;
  processQueue(now);
  Engine.update(engine, dt || 16.67);
  // clean up anything that escaped (should not happen, but be safe)
  for (const [id, b] of bodies) if (b.position.y > H + 200) despawn(id);
  checkOverflow(now);

  {
    const v = view(), k = dpr * scale / v.z;
    ctx.setTransform(k, 0, 0, k, -v.x0 * k, -v.y0 * k);
  }
  drawBackground();
  drawJarBack();
  const t = reduceMotion ? 0 : now / 1000;
  const ordered = [...bodies.values()].sort((a, b) => ORDER.indexOf(b.plugin.jar.item.type) - ORDER.indexOf(a.plugin.jar.item.type));
  drawLiquid(t);
  for (const b of ordered) drawBody(b);
  drawPourStream(now);
  drawBeerLabels(t);
  drawJarFront();
  drawOverlayText();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- pointer
const tooltip = $('#tooltip');
function toWorld(e) {
  const r = canvas.getBoundingClientRect(), v = view();
  return { x: v.x0 + (e.clientX - r.left) / scale * v.z, y: v.y0 + (e.clientY - r.top) / scale * v.z };
}
function hitTest(p) {
  for (let i = beerPills.length - 1; i >= 0; i--) {
    const b = beerPills[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { item: b.item };
  }
  const found = Query.point([...bodies.values()], p);
  if (found.length) {
    // prefer the smallest body under the pointer (sand sits between rocks)
    found.sort((a, b) => a.plugin.jar.r - b.plugin.jar.r);
    return { item: found[0].plugin.jar.item, body: found[0] };
  }
  return null;
}
let down = null, drag = null;
canvas.addEventListener('pointerdown', e => {
  const p = toWorld(e);
  const hit = hitTest(p);
  closeEditor();
  if (!hit) return;
  down = { hit, sx: e.clientX, sy: e.clientY, p };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const p = toWorld(e);
  if (down) {
    const moved = Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > 6;
    if (!drag && moved && down.hit.body) {
      const b = down.hit.body;
      Sleeping.set(b, false);
      drag = Constraint.create({ pointA: p, bodyB: b, pointB: { x: down.p.x - b.position.x, y: down.p.y - b.position.y }, stiffness: 0.12, damping: 0.08, length: 0 });
      Composite.add(world, drag);
      tooltip.hidden = true;
      canvas.style.cursor = 'grabbing';
    }
    if (drag) { drag.pointA = p; Sleeping.set(drag.bodyB, false); }
    return;
  }
  const hit = hitTest(p);
  hoverId = hit ? hit.item.id : null;
  canvas.style.cursor = hit ? 'pointer' : 'default';
  if (hit) {
    const r = canvas.getBoundingClientRect();
    tooltip.replaceChildren(document.createTextNode(hit.item.name), el('span', null, typeLabel(hit.item.type)));
    tooltip.style.left = (e.clientX - r.left) + 'px';
    tooltip.style.top = (e.clientY - r.top) + 'px';
    tooltip.hidden = false;
  } else tooltip.hidden = true;
});
function endPointer(e, cancelled) {
  if (drag) { Composite.remove(world, drag); drag = null; wakeAll(); canvas.style.cursor = 'pointer'; }
  else if (down && !cancelled) openEditor(down.hit.item, e.clientX, e.clientY);
  down = null;
}
canvas.addEventListener('pointerup', e => endPointer(e, false));
canvas.addEventListener('pointercancel', e => endPointer(e, true));
canvas.addEventListener('pointerleave', () => { if (!down) { hoverId = null; tooltip.hidden = true; } });

// ---------------------------------------------------------------- item ops
function addItem(name, type, { fromDump } = {}) {
  name = name.trim().slice(0, 40);
  if (!name) return null;
  const item = { id: uid(), name, type, seed: newSeed() };
  state.items.push(item);
  enqueue(item);
  save();
  if (!fromDump) renderLists();
  return item;
}
let lastDeleted = null;
function deleteItem(id) {
  const idx = state.items.findIndex(i => i.id === id);
  if (idx < 0) return;
  const [item] = state.items.splice(idx, 1);
  despawn(id);
  if (hoverId === id) hoverId = null;
  lastDeleted = { item, idx };
  save();
  renderLists();
  toast(`Removed “${item.name}”`, 'Undo', () => {
    if (!lastDeleted) return;
    state.items.splice(Math.min(lastDeleted.idx, state.items.length), 0, lastDeleted.item);
    enqueue(lastDeleted.item);
    lastDeleted = null;
    save(); renderLists();
  });
}
function renameItem(id, name) {
  const item = state.items.find(i => i.id === id);
  if (!item || !name.trim()) return;
  item.name = name.trim().slice(0, 40);
  save();
  renderListsSoon();
}
function retypeItem(id, type) {
  const item = state.items.find(i => i.id === id);
  if (!item || item.type === type) return;
  despawn(id);
  item.type = type;
  item.seed = newSeed();
  enqueue(item);
  save();
  renderLists();
}

// ---------------------------------------------------------------- shared UI bits
function typeButton(type, { checked, onClick, label } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'type-btn';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', checked ? 'true' : 'false');
  if (type === 'unsure') b.innerHTML = '<span class="q">?</span>';
  else b.append(swatch(type));
  b.append(document.createTextNode(label || (type === 'unsure' ? 'Not sure' : typeLabel(type))));
  b.addEventListener('click', onClick);
  return b;
}
function swatch(type) {
  const s = document.createElement('span');
  s.className = 'sw ' + type;
  if (type === 'sand') { s.style.backgroundColor = state.colors.sand; return s; }
  s.style.background = `radial-gradient(circle at 35% 30%, ${lighten(state.colors[type], .3)}, ${state.colors[type]} 55%, ${darken(state.colors[type], .25)})`;
  return s;
}
function tagColors(node, type) {
  const c = state.colors[type];
  node.style.setProperty('--tag-bg', mix(c, '#ffffff', type === 'sand' ? 0.5 : 0.78));
  node.style.setProperty('--tag-ink', mix(c, '#2a2722', 0.62));
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

let toastTimer = 0;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.replaceChildren(el('span', null, msg));
  if (actionLabel) {
    const b = el('button', null, actionLabel);
    b.addEventListener('click', () => { action(); t.hidden = true; });
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

// ---------------------------------------------------------------- tabs
for (const tab of $$('.tab')) {
  tab.addEventListener('click', () => {
    for (const t of $$('.tab')) t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    for (const p of $$('.tabpanel')) p.hidden = p.id !== 'tab-' + tab.dataset.tab;
    try { localStorage.setItem(STORE_KEY + '.tab', tab.dataset.tab); } catch {}
  });
}
try { const t = localStorage.getItem(STORE_KEY + '.tab'); if (t) $(`.tab[data-tab="${t}"]`)?.click(); } catch {}

// ---------------------------------------------------------------- add tab
let addType = 'rock';
function renderAddTypes() {
  const box = $('#add-types');
  box.replaceChildren(...[...ORDER, 'unsure'].map(t => typeButton(t, { checked: addType === t, onClick: () => { addType = t; renderAddTypes(); } })));
}
$('#add-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#add-name');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  input.value = '';
  if (addType === 'unsure') openWizard({ name });
  else addItem(name, addType);
});

let editingSugg = false;
$('#btn-edit-sugg').addEventListener('click', () => { editingSugg = !editingSugg; renderSuggestions(); });
function renderSuggestions() {
  $('#btn-edit-sugg').textContent = editingSugg ? 'Done' : 'Edit';
  $('#sugg-help').textContent = editingSugg ? 'Rename, remove or add suggestions. Changes save automatically.' : 'Tap one to drop it in the jar.';
  const box = $('#suggestions');
  box.replaceChildren();
  for (const t of ORDER) {
    const g = el('div', 'group');
    const title = el('div', 'group-title');
    title.append(swatch(t), document.createTextNode(typeLabel(t, true)));
    const chips = el('div', 'chips');
    state.suggestions[t].forEach((s, i) => {
      if (editingSugg) {
        const wrap = el('span', 'chip-edit');
        const inp = document.createElement('input');
        inp.value = s; inp.maxLength = 40; inp.setAttribute('aria-label', 'Suggestion name');
        inp.addEventListener('input', () => { state.suggestions[t][i] = inp.value; save(); });
        inp.addEventListener('blur', () => { if (!inp.value.trim()) { state.suggestions[t].splice(i, 1); save(); renderSuggestions(); } });
        const x = el('button', null, '×'); x.title = 'Remove'; x.type = 'button';
        x.addEventListener('click', () => { state.suggestions[t].splice(i, 1); save(); renderSuggestions(); });
        wrap.append(inp, x);
        chips.append(wrap);
      } else {
        const c = el('button', 'chip');
        c.type = 'button';
        c.append(el('span', 'plus', '+'), el('span', 'txt', s));
        c.addEventListener('click', () => addItem(s, t));
        chips.append(c);
      }
    });
    if (editingSugg) {
      const add = el('button', 'chip chip-add', '+ Add');
      add.type = 'button';
      add.addEventListener('click', () => {
        state.suggestions[t].push('');
        renderSuggestions();
        const inputs = box.querySelectorAll(`.group:nth-child(${ORDER.indexOf(t) + 1}) input`);
        inputs[inputs.length - 1]?.focus();
      });
      chips.append(add);
    }
    g.append(title, chips);
    box.append(g);
  }
}

function renderJarList() {
  const box = $('#jar-list');
  box.replaceChildren();
  if (!state.items.length) { box.append(el('p', 'empty-note', 'Nothing yet. Add your big rocks first.')); return; }
  for (const t of ORDER) {
    const items = state.items.filter(i => i.type === t);
    if (!items.length) continue;
    const g = el('div', 'group');
    const title = el('div', 'group-title');
    title.append(swatch(t), document.createTextNode(typeLabel(t, true)), el('span', 'count', String(items.length)));
    const chips = el('div', 'chips');
    for (const it of items) {
      const c = el('button', 'chip tag');
      c.type = 'button';
      tagColors(c, t);
      c.append(el('span', 'txt', it.name));
      c.addEventListener('click', e => { e.stopPropagation(); const r = c.getBoundingClientRect(); openEditor(it, r.left, r.bottom + 4, true); });
      chips.append(c);
    }
    g.append(title, chips);
    box.append(g);
  }
}

function renderLegend() {
  const ul = $('#legend');
  const jarRow = el('li');
  jarRow.append(el('span', 'sw jar'), el('b', null, 'The jar'), el('span', 'count'), el('p', null, JAR_BLURB));
  ul.replaceChildren(jarRow, ...ORDER.map(t => {
    const li = el('li');
    const n = state.items.filter(i => i.type === t).length;
    li.append(swatch(t), el('b', null, typeLabel(t, true)), el('span', 'count', String(n)), el('p', null, BLURBS[t]));
    return li;
  }));
}

// ---------------------------------------------------------------- sort tab
$('#sort-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#sort-name').value.trim();
  if (!v) { $('#sort-name').focus(); return; }
  $('#sort-name').value = '';
  openWizard({ name: v });
});
function renderSortList() {
  const box = $('#sort-list');
  box.replaceChildren();
  if (!state.items.length) { box.append(el('p', 'empty-note', 'Your jar is empty.')); return; }
  for (const t of ORDER) for (const it of state.items.filter(i => i.type === t)) {
    const row = el('div', 'sort-row');
    const b = el('button', 'btn', 'Test');
    b.addEventListener('click', () => openWizard({ name: it.name, id: it.id }));
    row.append(swatch(it.type), el('span', 'name', it.name), b);
    box.append(row);
  }
}
function renderWordingToggles() {
  for (const box of $$('[data-wording-toggle]')) {
    box.replaceChildren(...Object.entries(TESTS).map(([k, v]) => {
      const b = el('button', null, v.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', state.wording === k ? 'true' : 'false');
      b.addEventListener('click', () => { state.wording = k; save(); renderWordingToggles(); renderDump(); });
      return b;
    }));
  }
}

// ---------------------------------------------------------------- wizard
const wiz = $('#wizard');
let wizState = null;
function openWizard({ name, id }) {
  closeEditor();
  wizState = { name, id, step: 'rock', history: [] };
  renderWizard();
  if (!wiz.open) wiz.showModal();
}
wiz.addEventListener('click', e => { if (e.target === wiz) wiz.close(); });
function wizGo(next) { wizState.history.push(wizState.step); wizState.step = next; renderWizard(); }
function renderWizard() {
  const T = TESTS[state.wording];
  const { name, step } = wizState;
  const body = $('#wiz-body');
  body.replaceChildren();
  const top = el('div', 'wiz-top');
  const close = el('button', 'wiz-close', '×'); close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => wiz.close());

  if (step.startsWith('result:')) {
    const type = step.split(':')[1];
    top.append(el('span', 'wiz-kicker', 'Result'), close);
    const res = el('div', 'result');
    res.append(previewCanvas(type));
    res.append(el('h3', null, `“${name}” sounds like ${type === 'sand' ? 'Sand' : (type === 'beer' ? drinkName() : 'a ' + typeLabel(type))}.`));
    res.append(el('p', null, BLURBS[type]));
    const actions = el('div', 'row-btns');
    const existing = wizState.id && state.items.find(i => i.id === wizState.id);
    const primary = el('button', 'btn btn-primary', existing ? (existing.type === type ? 'Keep it there' : `Move it to ${typeLabel(type, true)}`) : 'Drop it in the jar');
    primary.addEventListener('click', () => {
      if (existing) retypeItem(existing.id, type); else addItem(name, type);
      wiz.close();
    });
    actions.append(primary);
    res.append(actions);
    res.append(el('p', 'muted small', 'Or choose a different spot:'));
    const pick = el('div', 'type-picker');
    for (const t of ORDER) pick.append(typeButton(t, { checked: t === type, onClick: () => { wizState.step = 'result:' + t; renderWizard(); } }));
    res.append(pick);
    body.append(top, res);
  } else {
    const s = T[step];
    top.append(el('span', 'wiz-kicker', step === 'kind' ? 'Quick check' : s.name), close);
    body.append(top, el('p', 'wiz-q', s.q(name)));
    const ans = el('div', 'wiz-ans');
    const opt = ([t, hint], go) => { const b = el('button', 'ans'); b.append(el('b', null, t), el('span', null, hint)); b.addEventListener('click', go); return b; };
    if (step === 'rock') ans.append(opt(s.yes, () => wizGo('result:rock')), opt(s.no, () => wizGo('kind')));
    if (step === 'kind') ans.append(opt(s.duty, () => wizGo('pebble')), opt(s.leisure, () => wizGo('beer')));
    if (step === 'pebble') ans.append(opt(s.yes, () => wizGo('result:pebble')), opt(s.no, () => wizGo('result:sand')));
    if (step === 'beer') ans.append(opt(s.yes, () => wizGo('result:beer')), opt(s.no, () => wizGo('result:sand')));
    body.append(ans);
  }
  const foot = el('div', 'wiz-foot');
  const back = el('button', 'link', 'Back');
  back.hidden = !wizState.history.length;
  back.addEventListener('click', () => { wizState.step = wizState.history.pop(); renderWizard(); });
  const words = el('span', 'muted small', T.label === 'General' ? 'General wording' : 'College wording');
  foot.append(back, words);
  body.append(foot);
}
function previewCanvas(type) {
  const c = document.createElement('canvas');
  const s = 96, ratio = Math.min(window.devicePixelRatio || 1, 2);
  c.width = s * ratio; c.height = s * ratio; c.style.width = c.style.height = s + 'px';
  const g = c.getContext('2d');
  g.scale(ratio, ratio);
  const color = state.colors[type];
  const rand = mulberry32(42);
  if (type === 'beer') {
    g.fillStyle = rgba(color, 0.85);
    g.beginPath(); g.roundRect(30, 26, 36, 52, [4, 4, 10, 10]); g.fill();
    g.fillStyle = '#fffdf5'; g.beginPath(); g.roundRect(27, 18, 42, 14, 7); g.fill();
    g.strokeStyle = rgba(color, 0.9); g.lineWidth = 4; g.beginPath(); g.arc(68, 50, 9, -1.2, 1.2); g.stroke();
    return c;
  }
  if (type === 'sand') {
    for (let i = 0; i < 160; i++) {
      const a = rand() * Math.PI, d = Math.sqrt(rand());
      const x = 48 + Math.cos(a) * d * 34, y = 70 - Math.sin(a) * d * 26;
      g.fillStyle = rand() > .5 ? lighten(color, .25) : darken(color, .15);
      g.beginPath(); g.arc(x, y, 1.2 + rand() * 1.4, 0, Math.PI * 2); g.fill();
    }
    return c;
  }
  const r = type === 'rock' ? 38 : 22, n = 12, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = r * (0.85 + rand() * .15); pts.push({ x: 48 + Math.cos(a) * rr, y: 50 + Math.sin(a) * rr * .8 }); }
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  let m = mid(pts[n - 1], pts[0]); g.beginPath(); g.moveTo(m.x, m.y);
  for (let i = 0; i < n; i++) { const nx = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i].x, pts[i].y, nx.x, nx.y); }
  const gr = g.createRadialGradient(48 - r * .35, 50 - r * .45, 2, 48, 50, r * 1.25);
  gr.addColorStop(0, lighten(color, .32)); gr.addColorStop(.55, color); gr.addColorStop(1, darken(color, .32));
  g.shadowColor = 'rgba(15,15,15,.16)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = gr; g.fill();
  return c;
}

// ---------------------------------------------------------------- editor popover
const editor = $('#editor');
let editing = null;
function openEditor(item, x, y) {
  editing = item.id;
  $('#ed-name').value = item.name;
  renderEditorTypes(item);
  editor.hidden = false;
  const w = editor.offsetWidth, h = editor.offsetHeight;
  const left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8));
  const top = y + h + 16 > window.innerHeight ? Math.max(8, y - h - 12) : y + 12;
  editor.style.left = left + 'px';
  editor.style.top = top + 'px';
  tooltip.hidden = true;
}
function renderEditorTypes(item) {
  $('#ed-types').replaceChildren(...ORDER.map(t => typeButton(t, { checked: item.type === t, onClick: () => { retypeItem(item.id, t); renderEditorTypes(item); } })));
}
function closeEditor() { editor.hidden = true; editing = null; }
$('#ed-name').addEventListener('input', e => { if (editing) renameItem(editing, e.target.value); });
$('#ed-name').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') closeEditor(); });
$('#ed-delete').addEventListener('click', () => { if (editing) { const id = editing; closeEditor(); deleteItem(id); } });
$('#ed-sort').addEventListener('click', () => { const it = state.items.find(i => i.id === editing); if (it) openWizard({ name: it.name, id: it.id }); });
document.addEventListener('pointerdown', e => {
  if (!editor.hidden && !editor.contains(e.target) && e.target !== canvas && !e.target.closest('#jar-list')) closeEditor();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditor(); });

// ---------------------------------------------------------------- brain dump
let dump = { step: 0, text: '', rows: [], replace: false };
function parseDump(text) {
  const seen = new Set();
  return text.split(/\n|,|;/).map(s => s.replace(/^[\s\-*•\d.)]+/, '').trim()).filter(s => {
    const k = s.toLowerCase();
    if (!s || seen.has(k)) return false;
    seen.add(k); return true;
  }).map(name => ({ name: name.slice(0, 40), type: null }));
}
function renderDump() {
  const box = $('#dump');
  const steps = DUMP_TEXT[state.wording];
  box.replaceChildren();
  const bar = el('div', 'steps');
  for (let i = 0; i < 4; i++) bar.append(Object.assign(el('i'), { className: i <= dump.step ? 'on' : '' }));
  const [title, sub] = steps[dump.step];
  box.append(bar, el('h2', 'dump-h', `${dump.step + 1}. ${title}`), el('p', 'muted', sub.replace('{drink}', drinkName())));
  const nav = el('div', 'dump-nav');
  const back = el('button', 'btn', 'Back');
  back.addEventListener('click', () => { dump.step--; renderDump(); });
  const next = el('button', 'btn btn-primary', 'Next');

  if (dump.step === 0) {
    const ta = el('textarea', 'dump-area');
    ta.placeholder = state.wording === 'stanford'
      ? 'CS 106B lecture\nDance practice\nCoffee chat with a recruiter\nScrolling Sidechat\nBoba with roommates\n…'
      : 'Work meeting\nGym\nDinner with family\nScrolling social media\nLaundry\n…';
    ta.value = dump.text;
    ta.addEventListener('input', () => { dump.text = ta.value; });
    box.append(ta);
    next.addEventListener('click', () => {
      const rows = parseDump(dump.text);
      if (!rows.length) { ta.focus(); return; }
      // keep earlier choices for rows that are still there
      const prev = new Map(dump.rows.map(r => [r.name.toLowerCase(), r.type]));
      dump.rows = rows.map(r => ({ ...r, type: prev.get(r.name.toLowerCase()) || null }));
      dump.step = 1; renderDump();
    });
    nav.append(el('span'), next);
  } else if (dump.step === 1 || dump.step === 2) {
    const mark = dump.step === 1 ? 'rock' : 'sand';
    const list = el('ul', 'dump-list');
    for (const r of dump.rows) {
      const li = el('li', 'dump-item');
      const locked = dump.step === 2 && r.type === 'rock';
      if (r.type === 'rock') li.classList.add('circled');
      if (r.type === 'sand') li.classList.add('crossed');
      if (locked) li.classList.add('fixed');
      li.append(r.type === 'rock' || r.type === 'sand' ? swatch(r.type) : el('span', 'sw', ''), el('span', 'name', r.name));
      if (!locked) {
        li.tabIndex = 0;
        const toggle = () => { r.type = r.type === mark ? null : mark; renderDump(); };
        li.addEventListener('click', toggle);
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      }
      list.append(li);
    }
    box.append(list);
    if (dump.step === 1) {
      const n = dump.rows.filter(r => r.type === 'rock').length;
      box.append(el('p', 'muted small', n > 3 ? `${n} circled. That's a lot of big rocks. Could some be pebbles?` : `${n} circled`));
    }
    next.addEventListener('click', () => { dump.step++; renderDump(); });
    nav.append(back, next);
  } else {
    const list = el('ul', 'dump-list');
    for (const r of dump.rows) {
      const li = el('li', 'dump-item fixed');
      if (r.type === 'rock' || r.type === 'sand') {
        li.append(swatch(r.type), el('span', 'name', r.name), el('span', 'muted small', typeLabel(r.type)));
      } else {
        if (!r.type) r.type = 'pebble';
        li.classList.remove('fixed');
        li.style.cursor = 'default';
        const seg = el('span', 'mini-seg');
        for (const t of ['pebble', 'beer']) {
          const b = el('button');
          b.type = 'button';
          b.setAttribute('aria-pressed', r.type === t ? 'true' : 'false');
          b.append(swatch(t), document.createTextNode(typeLabel(t)));
          b.addEventListener('click', () => { r.type = t; renderDump(); });
          seg.append(b);
        }
        li.append(el('span', 'name', r.name), seg);
      }
      list.append(li);
    }
    box.append(list);
    const chk = el('label', 'check');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = dump.replace;
    cb.addEventListener('change', () => { dump.replace = cb.checked; });
    chk.append(cb, document.createTextNode('Replace what’s in my jar'));
    next.textContent = 'Pour into my jar';
    next.addEventListener('click', () => {
      if (dump.replace) { state.items = []; clearJar(); }
      const rank = t => ORDER.indexOf(t);
      dump.rows.slice().sort((a, b) => rank(a.type) - rank(b.type)).forEach(r => addItem(r.name, r.type, { fromDump: true }));
      if (dump.replace) pour();
      toast(`Added ${dump.rows.length} things to your jar`);
      dump = { step: 0, text: '', rows: [], replace: false };
      renderLists(); renderDump();
    });
    const right = el('div', 'row-btns');
    right.style.alignItems = 'center';
    right.append(chk, next);
    nav.append(back, right);
  }
  box.append(nav);
}

// ---------------------------------------------------------------- customize
function renderCustomize() {
  $('#presets').replaceChildren(...Object.entries(PRESETS).map(([name, cols]) => {
    const b = el('button', 'btn preset');
    const dots = el('span', 'dots');
    for (const t of ORDER) { const i = el('i'); i.style.background = cols[t]; dots.append(i); }
    b.append(dots, document.createTextNode(name));
    b.addEventListener('click', () => { state.colors = { ...cols }; colorsChanged(); });
    return b;
  }));
  $('#colors').replaceChildren(...ORDER.map(t => {
    const lab = el('label', 'color-item');
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = state.colors[t];
    inp.addEventListener('input', () => { state.colors[t] = inp.value; colorsChanged(false); });
    lab.append(inp, el('span', null, typeLabel(t, true)));
    return lab;
  }));
  $('#drink-seg').replaceChildren(...Object.entries(DRINKS).map(([k, v]) => {
    const b = el('button', null, v);
    b.type = 'button';
    b.setAttribute('aria-pressed', state.drink === k ? 'true' : 'false');
    b.addEventListener('click', () => { state.drink = k; $('#drink-own').value = ''; save(); renderAll(); });
    return b;
  }));
}
$('#drink-own').addEventListener('input', e => {
  const v = e.target.value.trim().slice(0, 20);
  if (v) { state.drink = 'custom'; state.drinkCustom = v; }
  else if (state.drink === 'custom') state.drink = 'beer';
  save();
  renderAll();
});
function colorsChanged(rerenderInputs = true) {
  save();
  applyCssColors();
  renderLegend(); renderSuggestions(); renderJarList(); renderAddTypes(); renderSortList();
  if (rerenderInputs) renderCustomize();
}
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jar-of-life-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
// A jar can travel inside a link. It lives after the '#', which browsers never send to the server.
function encodeJar() {
  const compact = { v: 1, i: state.items.map(i => [i.name, ORDER.indexOf(i.type)]), c: state.colors, d: state.drink, dc: state.drinkCustom, w: state.wording, s: state.suggestions, j: state.jarSize };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeJar(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
  return sanitize({
    items: (c.i || []).map(([name, t]) => ({ name, type: ORDER[t], id: uid(), seed: newSeed() })),
    colors: c.c, drink: c.d, drinkCustom: c.dc, wording: c.w, suggestions: c.s, jarSize: c.j,
  });
}
$('#btn-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#jar=' + encodeJar();
  try { await navigator.clipboard.writeText(url); toast('Link copied. Bookmark it or open it on another device.'); }
  catch { prompt('Copy this link:', url); }
});
function loadFromHash() {
  const m = location.hash.match(/^#jar=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  let incoming;
  try { incoming = decodeJar(m[1]); } catch { toast('That jar link is broken or incomplete'); return; }
  if (state.items.length && !confirm(`Open the jar from this link (${incoming.items.length} things)? It replaces the jar saved in this browser.`)) return;
  state = incoming;
  save();
  toast('Jar loaded from link');
}
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    state = sanitize(JSON.parse(await f.text()));
    save(); applyJarSize(); renderAll(); renderJarSize(); pour();
    toast('Jar imported');
  } catch { toast('That file could not be read'); }
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset everything? This clears your jar, colors and suggestions.')) return;
  state = defaults();
  save(); clearJar(); applyJarSize(); renderAll(); renderJarSize();
});

// ---------------------------------------------------------------- jar buttons
$('#btn-order').addEventListener('click', () => pour(ORDER));
$('#btn-wrong').addEventListener('click', () => {
  pour(WRONG_ORDER);
  toast('Sand and pebbles first. Watch where the big rocks end up.');
});
$('#btn-demo').addEventListener('click', () => {
  if (!state.items.length) { toast('Add a few things to your jar first'); return; }
  $('#stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  pour(WRONG_ORDER);
  toast('Sand and pebbles first. Watch where the big rocks end up.');
});
const sizeInput = $('#jar-size');
let sizeTimer = 0;
function renderJarSize() {
  sizeInput.value = state.jarSize;
  $('#jar-size-val').textContent = Math.round(state.jarSize * 100) + '%';
}
sizeInput.addEventListener('input', () => {
  state.jarSize = Number(sizeInput.value);
  renderJarSize();
  applyJarSize();
  // refill once the slider settles, so everything lands inside the new jar
  clearJar();
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(() => { pour(); save(); }, 220);
});
// On narrow screens the jar is above the panel, so bring it back into view to show the result.
sizeInput.addEventListener('change', () => {
  const r = $('#stage').getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) $('#stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
});
$('#btn-shake').addEventListener('click', () => {
  for (const b of bodies.values()) {
    Sleeping.set(b, false);
    Body.setVelocity(b, { x: (Math.random() - 0.5) * 6, y: -2 - Math.random() * 5 });
    Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.2);
  }
});
$('#btn-empty').addEventListener('click', () => {
  if (!state.items.length) return;
  if (!confirm('Take everything out of the jar?')) return;
  const backup = state.items.slice();
  state.items = [];
  clearJar(); save(); renderLists();
  toast('Jar emptied', 'Undo', () => { state.items = backup; save(); renderLists(); pour(); });
});

// ---------------------------------------------------------------- quotes
let qi = Math.floor(Math.random() * QUOTES.length);
let quoteTimer = 0;
function showQuote(step = 0) {
  qi = (qi + step + QUOTES.length) % QUOTES.length;
  const q = $('#quote');
  q.style.opacity = 0;
  setTimeout(() => {
    const [text, by] = QUOTES[qi];
    q.replaceChildren(document.createTextNode(text.replace('{drink}', drinkName().toLowerCase())));
    if (by) q.append(el('small', null, by));
    q.style.opacity = 1;
  }, reduceMotion ? 0 : 350);
  // restart the countdown so a quote you went back to doesn't vanish right away
  clearInterval(quoteTimer);
  quoteTimer = setInterval(() => showQuote(1), 14000);
}
$('#q-prev').addEventListener('click', () => showQuote(-1));
$('#q-next').addEventListener('click', () => showQuote(1));

// ---------------------------------------------------------------- render all
function renderLists() { renderJarList(); renderLegend(); renderSortList(); }
let listTimer = 0;
function renderListsSoon() { clearTimeout(listTimer); listTimer = setTimeout(renderLists, 250); }
function renderAll() {
  applyCssColors();
  const own = $('#drink-own');
  if (document.activeElement !== own) own.value = state.drink === 'custom' ? state.drinkCustom : '';
  for (const s of $$('[data-drink]')) s.textContent = drinkName().toLowerCase();
  renderAddTypes(); renderSuggestions(); renderLists(); renderWordingToggles(); renderDump(); renderCustomize();
}

loadFromHash();
applyJarSize();
renderAll();
renderJarSize();
resize();
pour();
showQuote();
requestAnimationFrame(frame);
})();
