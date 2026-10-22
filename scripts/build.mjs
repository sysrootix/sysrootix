// Builds every picture on the profile, dark and light: header with live Khabarovsk weather, project cards,
// an agent-session replay, AI crew stats, commit pulse and the guestbook wall. Live data comes from the GitHub API,
// Open-Meteo and data/*.json; fonts and avatars are embedded, so the SVGs look the same everywhere.
// Pictures go to out/ — the Action force-pushes that folder to the `output` branch. Node 22+, no dependencies.
//   GITHUB_TOKEN=... node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'sysrootix';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// sysrootix.com palette: black, warm paper, one ember accent
const THEMES = {
  dark: { bg: '#000000', panel: '#0b0b0a', fg: '#f3f0e8', muted: 'rgba(243,240,232,.58)', faint: 'rgba(243,240,232,.34)',
    line: 'rgba(243,240,232,.12)', glass: 'rgba(243,240,232,.04)', ember: '#ff4a3d', emberSoft: 'rgba(255,74,61,.22)', ok: '#5fd38a' },
  light: { bg: '#f3f0e8', panel: '#faf8f3', fg: '#0b0b0a', muted: 'rgba(11,11,10,.62)', faint: 'rgba(11,11,10,.38)',
    line: 'rgba(11,11,10,.12)', glass: 'rgba(11,11,10,.035)', ember: '#e2352a', emberSoft: 'rgba(226,53,42,.16)', ok: '#1f8a4c' },
};
const LANG = { Swift: '#F05138', Rust: '#dea584', TypeScript: '#3178c6', JavaScript: '#f1e05a', Shell: '#89e051', Python: '#3572A5' };

const PROJECTS = [
  { slug: 'check-usage', repo: 'sysrootix/check-usage', name: 'CheckUsage', tag: 'menu bar',
    desc: 'Native macOS widget for AI usage limits: Claude, Cursor, Codex, Copilot, Gemini, Grok. No extra login, no telemetry.' },
  { slug: 'bandito', repo: 'banditohq/bandito', name: 'Bandito', tag: 'rust + swift',
    desc: 'Your AI crew on your own server. Claude Code, Codex and Grok agents that keep working after you close the laptop.' },
  { slug: 'freebright', repo: 'sysrootix/FreeBright', name: 'FreeBright', tag: 'free',
    desc: 'Extra brightness for MacBook Pro XDR displays. Open source, a free BrightIntosh alternative.' },
  { slug: 'activity-line', repo: 'sysrootix/activity-line', name: 'ActivityLine', tag: 'menu bar',
    desc: 'A live sparkline for CPU, GPU, RAM and network right in the macOS menu bar. Local, no telemetry.' },
  { slug: 'claude-agent-team', repo: 'sysrootix/claude-agent-team', name: 'claude-agent-team', tag: 'claude code',
    desc: 'Opus plans. Haiku codes. Hooks verify. A Claude Code setup that works like a small dev team.' },
  { slug: 'omut', repo: null, name: 'Omut', tag: 'ios', lang: 'Swift', site: 'omut.chat',
    desc: 'A messenger for iPhone and Mac: its own chats and Telegram in one app. Swift + Rust.' },
];

const font = n => readFileSync(join(ROOT, 'scripts/fonts', n + '.woff2')).toString('base64');
const FACES = { 'unbounded-700': 'U;font-weight:700', 'unbounded-500': 'U;font-weight:500', 'grotesk-500': 'G;font-weight:500',
  'grotesk-400': 'G;font-weight:400', 'mono-400': 'M' };
// only the faces a picture uses — every face is ~10–15 KB of base64
const fonts = list => list.map(n => `@font-face{font-family:${FACES[n]};src:url(data:font/woff2;base64,${font(n)})}`).join('');
const CLASSES = `.u{font-family:U,-apple-system,"Segoe UI",sans-serif}.g{font-family:G,-apple-system,"Segoe UI",sans-serif}
.m{font-family:M,ui-monospace,SFMono-Regular,Menlo,monospace}`;
const MOTIONLESS = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (w, h, faces, css, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${x(label)}">` +
  `<title>${x(label)}</title><style>${fonts(faces)}${CLASSES}${css}${MOTIONLESS}</style>${body}</svg>`;
const write = (rel, s) => { const p = join(ROOT, 'out', rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const STAR = 'M8 .5l2.3 4.7 5.2.8-3.8 3.7.9 5.2L8 12.4l-4.6 2.5.9-5.2L.5 6l5.2-.8z';

function wrap(text, max) {
  const lines = [''];
  for (const w of text.split(' ')) {
    if ((lines.at(-1) + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
  }
  return lines;
}

async function gh(path, body) {
  const r = await fetch('https://api.github.com' + path, {
    method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    headers: { accept: 'application/vnd.github+json', 'user-agent': USER, ...(TOKEN && { authorization: `Bearer ${TOKEN}` }) },
  });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// ---------- header: menu bar, greeting in five languages, the +10, live Khabarovsk sky ----------
// Open-Meteo weather codes: words for the menu bar and what falls across the picture
const WX = { 0: ['clear'], 1: ['mostly clear'], 2: ['partly cloudy', 'cloud'], 3: ['overcast', 'cloud'],
  45: ['fog', 'fog'], 48: ['freezing fog', 'fog'], 51: ['light drizzle', 'drizzle'], 53: ['drizzle', 'drizzle'],
  55: ['heavy drizzle', 'drizzle'], 56: ['freezing drizzle', 'drizzle'], 57: ['freezing drizzle', 'drizzle'],
  61: ['light rain', 'rain'], 63: ['rain', 'rain'], 65: ['heavy rain', 'rain'], 66: ['freezing rain', 'rain'], 67: ['freezing rain', 'rain'],
  71: ['light snow', 'snow'], 73: ['snow', 'snow'], 75: ['heavy snow', 'snow'], 77: ['snow grains', 'snow'],
  80: ['showers', 'rain'], 81: ['showers', 'rain'], 82: ['heavy showers', 'rain'], 85: ['snow showers', 'snow'], 86: ['snow showers', 'snow'],
  95: ['thunderstorm', 'storm'], 96: ['thunderstorm, hail', 'storm'], 99: ['thunderstorm, hail', 'storm'] };

// seeded, so the sky does not reshuffle between dark and light pictures
function rand(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; };
}

// lit part of the moon as a path: limb arc + terminator ellipse; waxing is lit on the right
function moon(cx, cy, r, phase) {
  const k = Math.cos(phase * 2 * Math.PI), rx = (r * Math.abs(k)).toFixed(2), wax = phase < 0.5;
  const top = `${cx} ${cy - r}`, bot = `${cx} ${cy + r}`;
  const limb = `M${top}A${r} ${r} 0 0 ${wax ? 1 : 0} ${bot}`;
  const term = `A${rx} ${r} 0 0 ${wax ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0)} ${top}Z`;
  return limb + term;
}

function sky(t, ctx, W, H) {
  if (!ctx.sun) return { back: '', front: '', css: '' };
  const { rise, set, now, day } = ctx.sun;
  const HZ = 252, CX = 1015, RX = 135, RY = 140; // horizon line and the arc over the +10
  let a, b; // the arc spans either today's daylight or the night around now
  if (day) { a = rise; b = set; } else if (now > set) { a = set; b = rise + 864e5; } else { a = set - 864e5; b = rise; }
  const f = Math.min(1, Math.max(0, (now - a) / (b - a))), th = Math.PI * (1 - f);
  const sx = +(CX + RX * Math.cos(th)).toFixed(1), sy = +(HZ - RY * Math.sin(th)).toFixed(1);
  const hm = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Vladivostok', hour: '2-digit', minute: '2-digit' });
  const [l, r] = day ? [`sunrise ${hm(rise)}`, `sunset ${hm(set)}`] : [`sunset ${hm(a)}`, `sunrise ${hm(b)}`];
  let back = `<path d="M${CX - RX} ${HZ}A${RX} ${RY} 0 0 1 ${CX + RX} ${HZ}" fill="none" stroke="${t.line}" stroke-dasharray="2 6" stroke-linecap="round"/>
<path d="M${CX - RX - 20} ${HZ}H${CX + RX + 20}" stroke="${t.line}"/>
<text x="${CX - RX}" y="${HZ + 18}" class="m" font-size="11" fill="${t.faint}">${l}</text>
<text x="${CX + RX}" y="${HZ + 18}" class="m" font-size="11" fill="${t.faint}" text-anchor="end">${r}</text>`;
  let css = '.glow{transform-box:fill-box;transform-origin:center;animation:glow 3.2s ease-out infinite}@keyframes glow{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(2.6)}}';
  const rnd = rand(Math.floor(now / 36e5));
  if (day) {
    back += `<circle class="glow" cx="${sx}" cy="${sy}" r="13" fill="${t.ember}"/><circle cx="${sx}" cy="${sy}" r="13" fill="${t.ember}"/>`;
  } else {
    const stars = Array.from({ length: 14 }, () => [CX - RX + rnd() * RX * 2, HZ - 30 - rnd() * 160, rnd()]);
    back += stars.map(([x0, y0, d]) => `<circle class="tw" style="animation-delay:-${(d * 4).toFixed(2)}s" cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="${(0.8 + d).toFixed(2)}" fill="${t.faint}"/>`).join('');
    css += '.tw{animation:tw 4s ease-in-out infinite}@keyframes tw{50%{opacity:.15}}';
    back += `<circle cx="${sx}" cy="${sy}" r="13" fill="${t.bg}" stroke="${t.faint}"/><path d="${moon(sx, sy, 13, ctx.sun.moon)}" fill="${t.fg}"/>`;
  }
  const kind = ctx.wx && (WX[ctx.wx.code] || [])[1];
  let front = '';
  if (kind === 'cloud' || kind === 'fog') {
    css += '.drift{animation:drift 26s ease-in-out infinite alternate}@keyframes drift{from{transform:translateX(-36px)}to{transform:translateX(36px)}}';
    front += `<defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${kind === 'fog' ? 16 : 3}"/></filter></defs>`;
    front += kind === 'cloud'
      ? `<g class="drift" filter="url(#soft)" opacity=".5" fill="${t.faint}"><circle cx="${sx - 14}" cy="${sy + 8}" r="16"/><circle cx="${sx + 8}" cy="${sy}" r="20"/><circle cx="${sx + 30}" cy="${sy + 10}" r="13"/><rect x="${sx - 30}" y="${sy + 8}" width="74" height="16" rx="8"/></g>`
      : [0, 1, 2].map(i => `<ellipse class="drift" style="animation-delay:-${i * 9}s" filter="url(#soft)" cx="${300 + i * 330}" cy="${170 + i * 70}" rx="380" ry="28" fill="${t.faint}" opacity=".35"/>`).join('');
  }
  if (kind === 'snow') {
    css += [0, 1, 2, 3].map(i => `@keyframes fall${i}{from{transform:translate(0,0)}to{transform:translate(${[-30, -10, 14, 32][i]}px,${H + 20}px)}}`).join('');
    front += Array.from({ length: 70 }, (_, i) => {
      const d = 8 + rnd() * 9;
      return `<circle style="animation:fall${i % 4} ${d.toFixed(1)}s linear -${(rnd() * d).toFixed(1)}s infinite" cx="${(rnd() * W).toFixed(0)}" cy="-6" r="${(0.9 + rnd() * 1.6).toFixed(2)}" fill="${t.fg}" opacity="${(0.25 + rnd() * 0.45).toFixed(2)}"/>`;
    }).join('');
  }
  if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') {
    css += `@keyframes rain{from{transform:translate(0,0)}to{transform:translate(-40px,${H + 30}px)}}`;
    const n = kind === 'drizzle' ? 34 : 64, len = kind === 'drizzle' ? 6 : 12;
    front += Array.from({ length: n }, () => {
      const d = (kind === 'drizzle' ? 1.4 : 0.8) + rnd() * 0.5, x0 = rnd() * (W + 60);
      return `<path style="animation:rain ${d.toFixed(2)}s linear -${(rnd() * d).toFixed(2)}s infinite" d="M${x0.toFixed(0)} -14l-${(len / 3).toFixed(1)} ${len}" stroke="${t.faint}" stroke-width="1.2" stroke-linecap="round"/>`;
    }).join('');
    if (kind === 'storm') {
      css += '.flash{opacity:0;animation:flash 9s infinite}@keyframes flash{0%,91%{opacity:0}92%{opacity:.22}93%{opacity:0}95%{opacity:.12}96%,100%{opacity:0}}';
      front += `<rect class="flash" width="${W}" height="${H}" fill="${t.fg}"/>`;
    }
  }
  // particles stay inside the window, under the menu bar
  if (front) front = `<defs><clipPath id="win"><rect y="45" width="${W}" height="${H - 45}" rx="22"/></clipPath></defs><g clip-path="url(#win)">${front}</g>`;
  return { back, front, css };
}

function header(t, ctx) {
  const W = 1200, H = 440;
  // a periodic series so the moving sparkline loops without a seam
  const pts = Array.from({ length: 40 }, (_, i) => 12 + 7 * Math.sin(i * 0.9) + 5 * Math.sin(i * 2.3 + 1) + 3 * Math.cos(i * 4.1));
  const series = [...pts, ...pts, pts[0]];
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${(i * 4).toFixed(1)} ${(26 - v).toFixed(1)}`).join('');
  const hello = [['EN', "Hi, I'm Nikita."], ['RU', 'Привет, я Никита.'], ['JA', 'こんにちは、ニキータです。'], ['ZH', '你好，我是尼基塔。'], ['ES', 'Hola, soy Nikita.']];
  const greet = hello.map(([k, s], i) =>
    `<g class="hi hi${i}" style="animation-delay:${i * 3}s"><text x="56" y="132" class="m" font-size="13" fill="${t.ember}" letter-spacing="2">${k}</text>` +
    `<text x="56" y="200" class="u" font-weight="700" font-size="60" fill="${t.fg}" letter-spacing="-1.5">${x(s)}</text></g>`).join('');
  const sk = sky(t, ctx, W, H);
  const wx = ctx.wx ? `Khabarovsk ${ctx.wx.temp < 0 ? '−' : ''}${Math.abs(ctx.wx.temp)}°C · ${(WX[ctx.wx.code] || ['weather'])[0]}` : 'Khabarovsk · UTC+10';
  const css = `.hi{opacity:0;animation:hi 15s infinite}
@keyframes hi{0%{opacity:0;transform:translateY(10px)}3%,17%{opacity:1;transform:none}20%,100%{opacity:0;transform:translateY(-10px)}}
@media (prefers-reduced-motion:reduce){.hi0{opacity:1}}
.run{animation:run 7s linear infinite}@keyframes run{to{transform:translateX(-160px)}}
.blink{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.cup{animation:cup 4s ease-in-out infinite}@keyframes cup{0%,100%{width:30px}50%{width:22px}}${sk.css}`;
  const body = `<rect width="${W}" height="${H}" rx="22" fill="${t.bg}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="${t.line}"/>
<path d="M0 22a22 22 0 0 1 22-22h${W - 44}a22 22 0 0 1 22 22v22H0z" fill="${t.glass}"/><path d="M0 44.5h${W}" stroke="${t.line}"/>
<circle cx="30" cy="22" r="6" fill="${t.ember}"/>
<text x="46" y="27" class="u" font-weight="500" font-size="14" fill="${t.fg}">sysrootix</text>
<text y="27" class="g" font-weight="500" font-size="14" fill="${t.muted}"><tspan x="148">Ship</tspan><tspan x="196">Agents</tspan><tspan x="262">Tools</tspan><tspan x="316">Coffee</tspan></text>
<defs><clipPath id="spark"><rect x="430" y="8" width="160" height="28" rx="4"/></clipPath></defs>
<g clip-path="url(#spark)"><g class="run"><path transform="translate(430 8)" d="${line}" fill="none" stroke="${t.ember}" stroke-width="1.6" stroke-linejoin="round"/></g></g>
<text x="606" y="27" class="m" font-size="12" fill="${t.muted}">coffee</text>
<rect x="658" y="17" width="30" height="10" rx="3" fill="none" stroke="${t.faint}"/><rect class="cup" x="658" y="17" width="30" height="10" rx="3" fill="${t.muted}"/>
<text x="712" y="27" class="m" font-size="12" fill="${t.muted}">${x(wx)}</text>
<text x="${W - 28}" y="27" class="m" font-size="12" fill="${t.fg}" text-anchor="end">${x(ctx.time)}</text>
${sk.back}
${greet}
<text x="56" y="250" class="g" font-size="20" fill="${t.muted}">Full-stack from Russia's Far East. I build retail platforms end to end</text>
<text x="56" y="278" class="g" font-size="20" fill="${t.muted}">and small, sharp tools for macOS. AI agents write the code, I make the calls.</text>
<text x="56" y="392" class="m" font-size="14" fill="${t.faint}">rust / typescript / swift / postgres / telegram / 1c<tspan class="blink" fill="${t.ember}"> ▍</tspan></text>
<text x="${W - 40}" y="384" class="u" font-weight="700" font-size="132" fill="none" stroke="${t.ember}" stroke-width="1.5" text-anchor="end" letter-spacing="-6" opacity=".9">+10</text>
<text x="${W - 44}" y="412" class="m" font-size="12" fill="${t.faint}" text-anchor="end">${x(ctx.london)}</text>
${sk.front}`;
  return svg(W, H, Object.keys(FACES), css, body, `Hi, I'm Nikita (sysrootix): full-stack developer from Khabarovsk, UTC+10. ${wx}, ${ctx.time}`);
}

// ---------- project card: a tiny app window ----------
function card(p, info, t) {
  const W = 420, H = 214;
  const lines = wrap(p.desc, 47).slice(0, 3);
  const lang = info.lang || p.lang;
  const foot = [];
  let fx = 24;
  if (lang) {
    foot.push(`<circle cx="${fx + 5}" cy="185" r="5" fill="${LANG[lang] || t.muted}"/><text x="${fx + 16}" y="189.5" class="g" font-size="13" fill="${t.muted}">${x(lang)}</text>`);
    fx += 26 + lang.length * 7.4;
  }
  if (info.stars != null) {
    foot.push(`<path transform="translate(${fx} 177)" d="${STAR}" fill="${info.stars ? t.ember : 'none'}" stroke="${info.stars ? t.ember : t.faint}" stroke-linejoin="round"/>` +
      `<text x="${fx + 22}" y="189.5" class="g" font-size="13" fill="${t.muted}">${info.stars}</text>`);
  } else if (p.site) {
    foot.push(`<text x="${fx}" y="189.5" class="g" font-size="13" fill="${t.muted}">${x(p.site)} ↗</text>`);
  }
  const tagW = p.tag.length * 7.3 + 20;
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.panel}" stroke="${t.line}"/>
<path d="M.5 14.5a14 14 0 0 1 14-14h${W - 29}a14 14 0 0 1 14 14v19H.5z" fill="${t.glass}"/><path d="M.5 33.5h${W - 1}" stroke="${t.line}"/>
<circle cx="20" cy="17" r="5" fill="${t.ember}"/><circle cx="37" cy="17" r="5" fill="${t.faint}"/><circle cx="54" cy="17" r="5" fill="${t.faint}"/>
<text x="${W / 2}" y="21.5" class="m" font-size="11.5" fill="${t.faint}" text-anchor="middle">${x(p.repo || p.site)}</text>
<text x="24" y="76" class="u" font-weight="500" font-size="22" fill="${t.fg}" letter-spacing="-.4">${x(p.name)}</text>
<text class="g" font-size="14.5" fill="${t.muted}">${lines.map((l, i) => `<tspan x="24" y="${104 + i * 21}">${x(l)}</tspan>`).join('')}</text>
${foot.join('')}
<rect x="${W - 24 - tagW}" y="174" width="${tagW}" height="22" rx="11" fill="none" stroke="${t.line}"/>
<text x="${W - 24 - tagW / 2}" y="189" class="m" font-size="11.5" fill="${t.muted}" text-anchor="middle">${x(p.tag)}</text>`;
  return svg(W, H, ['unbounded-500', 'grotesk-400', 'mono-400'], '', body, `${p.name}: ${p.desc}`);
}

// ---------- pulse: a year of contributions as one ActivityLine-style curve ----------
function pulse(days, t, built) {
  const W = 840, H = 250, L = 28, R = 28, TOP = 92, BOT = 200;
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const sums = weeks.map(w => w.reduce((s, d) => s + d.contributionCount, 0));
  const max = Math.max(1, ...sums);
  const step = (W - L - R) / Math.max(1, sums.length - 1);
  // square root keeps quiet weeks visible next to a burst; the curve shows rhythm, not exact counts
  const P = sums.map((v, i) => [L + i * step, BOT - Math.sqrt(v / max) * (BOT - TOP)]);
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length; i++) { // smooth: midpoints as quadratic curve ends
    const [px, py] = P[i - 1], [cx, cy] = P[i];
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
  }
  const [lx, ly] = P.at(-1);
  d += ` T${lx.toFixed(1)} ${ly.toFixed(1)}`;
  const total = days.reduce((s, x) => s + x.contributionCount, 0);
  let streak = 0, best = 0, run = 0;
  for (const day of days) { run = day.contributionCount ? run + 1 : 0; best = Math.max(best, run); }
  for (let i = days.length - 1; i >= 0 && (days[i].contributionCount || i === days.length - 1); i--) if (days[i].contributionCount) streak++;
  const busiest = Math.max(...sums);
  const months = [];
  weeks.forEach((w, i) => {
    const dt = new Date(w[0].date + 'T00:00:00Z');
    if (dt.getUTCDate() <= 7 && i > 1 && i < weeks.length - 2) months.push(`<text x="${L + i * step}" y="${BOT + 22}" class="m" font-size="11" fill="${t.faint}" text-anchor="middle">${dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toLowerCase()}</text>`);
  });
  const stat = (k, v, xx) => `<text x="${xx}" y="62" class="u" font-weight="500" font-size="24" fill="${t.fg}" letter-spacing="-.5">${x(v)}</text>` +
    `<text x="${xx}" y="38" class="m" font-size="11.5" fill="${t.faint}" letter-spacing="1">${x(k)}</text>`;
  const css = `.ping{animation:ping 2.2s ease-out infinite;transform-origin:${lx}px ${ly}px}@keyframes ping{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}
.draw{stroke-dasharray:4000;stroke-dashoffset:4000;animation:draw 2.4s cubic-bezier(.2,.8,.2,1) forwards}@keyframes draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.draw{stroke-dashoffset:0}}`;
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.panel}" stroke="${t.line}"/>
${stat('CONTRIBUTIONS · 12 MO', total.toLocaleString('en'), 28)}${stat('BUSIEST WEEK', String(busiest), 268)}${stat('LONGEST STREAK', `${best} days`, 448)}${stat('IN KHABAROVSK', built, 628)}
<path d="M${L} ${BOT}H${W - R}" stroke="${t.line}"/>
<path d="${d} L${lx} ${BOT} L${L} ${BOT}Z" fill="${t.emberSoft}"/>
<path class="draw" d="${d}" fill="none" stroke="${t.ember}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle class="ping" cx="${lx}" cy="${ly}" r="4" fill="${t.ember}"/><circle cx="${lx}" cy="${ly}" r="4" fill="${t.ember}"/>
${months.join('')}`;
  return svg(W, H, ['unbounded-500', 'mono-400'], css, body, `${total} contributions in the last 12 months, longest streak ${best} days`);
}

// ---------- replay: one agent session typed out in a terminal, on a loop ----------
const SESSION = [ // [segments, start s, typing s]; segment colours are theme keys
  [[['$ ', 'ember'], ['claude "rate-limit the orders API"', 'fg']], 0.4, 1.8],
  [[['opus', 'ember'], ['reads CLAUDE.md, memory, backlog', 'muted']], 2.8, 0.5],
  [[['opus', 'ember'], ['plan: 3 steps, tests first', 'muted']], 3.8, 0.5],
  [[['├ haiku·1', 'fg'], ['tests, 6 cases ........ ', 'muted'], ['red, as planned', 'ember']], 5.0, 0.6],
  [[['├ haiku·2', 'fg'], ['middleware + 429 ...... ', 'muted'], ['done', 'ok']], 5.7, 0.6],
  [[['└ haiku·3', 'fg'], ['docs + changelog ...... ', 'muted'], ['done', 'ok']], 6.3, 0.6],
  [[['reviewer', 'fg'], ['1 finding: no Retry-After → haiku·2', 'muted']], 8.0, 0.6],
  [[['haiku·2', 'fg'], ['fixed, tests ', 'muted'], ['green', 'ok']], 9.4, 0.5],
  [[['verify.sh', 'fg']], 10.6, 0.2],
  [[['✓ ', 'ok'], ['shipped in 14 min · lines typed by me: ', 'fg'], ['0', 'ember']], 13.4, 0.9],
];
function replay(t) {
  const W = 840, H = 360, P = 24, CH = 8.4, X0 = 28, Y0 = 78, LH = 27; // JetBrains Mono at 14px is 8.4px a glyph
  const pc = s => (s / P * 100).toFixed(2);
  let css = `.all{animation:all ${P}s infinite}@keyframes all{0%,95%{opacity:1}97.5%,100%{opacity:0}}`;
  let lines = '', covers = '';
  SESSION.forEach(([segs, start, dur], i) => {
    const y = Y0 + i * LH;
    // agent names sit in a 10-character column, like a real log
    const parts = segs.map(([txt, c], j) => [j === 0 && segs.length > 1 && txt.trim() !== '$' && txt.trim() !== '✓' ? txt.padEnd(10) : txt, c]);
    const n = parts.reduce((k, [s]) => k + s.length, 0);
    lines += `<text x="${X0}" y="${y}" class="m" font-size="14" xml:space="preserve">${parts.map(([s, c]) => `<tspan fill="${t[c]}">${x(s)}</tspan>`).join('')}</text>`;
    const w = Math.ceil(n * CH) + 12;
    css += `@keyframes c${i}{0%,${pc(start)}%{transform:translateX(0);animation-timing-function:steps(${Math.max(1, n)})}${pc(start + dur)}%,100%{transform:translateX(${w}px)}}`;
    covers += `<rect style="transform:translateX(${w}px);animation:c${i} ${P}s infinite" x="${X0 - 4}" y="${y - 18}" width="${W - X0}" height="${LH}" fill="${t.panel}"/>`;
  });
  // verify.sh: a bar that fills red-to-green, then says so
  const vy = Y0 + 8 * LH, bx = X0 + 10 * CH;
  css += `.bar{transform-box:fill-box;transform-origin:left center;animation:bar ${P}s infinite}
@keyframes bar{0%,${pc(10.8)}%{transform:scaleX(0);fill:${t.ember}}${pc(12.0)}%{fill:${t.ember}}${pc(12.4)}%,100%{transform:scaleX(1);fill:${t.ok}}}
.pass{animation:pass ${P}s infinite}@keyframes pass{0%,${pc(12.5)}%{opacity:0}${pc(12.6)}%,100%{opacity:1}}
.trk{animation:trk ${P}s infinite}@keyframes trk{0%,${pc(10.7)}%{opacity:0}${pc(10.8)}%,100%{opacity:1}}
.cur{animation:cur ${P}s infinite}@keyframes cur{0%,${pc(14.3)}%{opacity:0}${pc(14.4)}%,100%{opacity:1}}
.blink{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}`;
  // drawn over the line covers: its own animations decide when it shows
  const bar = `<rect class="trk" x="${bx}" y="${vy - 11}" width="240" height="10" rx="3" fill="${t.line}"/>` +
    `<rect class="bar" x="${bx}" y="${vy - 11}" width="240" height="10" rx="3" fill="${t.ok}"/>` +
    `<text class="pass m" x="${bx + 256}" y="${vy}" font-size="14" fill="${t.ok}">passed</text>`;
  const cy = Y0 + SESSION.length * LH;
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.panel}" stroke="${t.line}"/>
<path d="M.5 14.5a14 14 0 0 1 14-14h${W - 29}a14 14 0 0 1 14 14v19H.5z" fill="${t.glass}"/><path d="M.5 33.5h${W - 1}" stroke="${t.line}"/>
<circle cx="20" cy="17" r="5" fill="${t.ember}"/><circle cx="37" cy="17" r="5" fill="${t.faint}"/><circle cx="54" cy="17" r="5" fill="${t.faint}"/>
<text x="${W / 2}" y="21.5" class="m" font-size="11.5" fill="${t.faint}" text-anchor="middle">~/work · claude · opus plans, haiku codes, hooks verify</text>
<g class="all">${lines}${covers}${bar}<g class="cur"><text class="blink m" x="${X0}" y="${cy}" font-size="14" fill="${t.ember}">▍</text></g></g>`;
  return svg(W, H, ['mono-400'], css, body, 'Replay of an agent session: Opus plans, three Haiku workers code in parallel, a reviewer sends one fix back, verify.sh passes, shipped in 14 minutes.');
}

// ---------- crew: what my agents did this week, from data/crew.json (pushed daily from the Mac) ----------
function crew(t, c) {
  const W = 840, H = 270, L = 28, TOP = 104, BOT = 214;
  const stat = (k, v, xx) => `<text x="${xx}" y="62" class="u" font-weight="500" font-size="24" fill="${t.fg}" letter-spacing="-.5">${x(v)}</text>` +
    `<text x="${xx}" y="38" class="m" font-size="11.5" fill="${t.faint}" letter-spacing="1">${x(k)}</text>`;
  const wk = c.week;
  const days = c.days.slice(-14), max = Math.max(1, ...days.map(d => d.haiku + d.sonnet + d.review));
  const slot = (W - L * 2) / days.length, bw = Math.min(30, slot - 12);
  const KEYS = [['haiku', t.muted], ['sonnet', t.ember], ['review', t.faint]];
  let bars = '', css = '.grow{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:grow .9s cubic-bezier(.2,.8,.2,1) forwards}@keyframes grow{to{transform:none}}@media (prefers-reduced-motion:reduce){.grow{transform:none}}';
  days.forEach((d, i) => {
    let y = BOT;
    const bx = L + i * slot + (slot - bw) / 2;
    const segs = KEYS.map(([k, col]) => {
      const h = d[k] / max * (BOT - TOP);
      if (!h) return '';
      y -= h;
      return `<rect x="${bx.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h - 1.5).toFixed(1)}" rx="2" fill="${col}"/>`;
    }).join('');
    bars += `<g class="grow" style="animation-delay:${(i * 0.04).toFixed(2)}s">${segs}</g>`;
    if (i === 0 || i === days.length - 1) {
      const lbl = i ? 'today' : new Date(d.date + 'T00:00:00Z').toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toLowerCase();
      bars += `<text x="${(bx + bw / 2).toFixed(1)}" y="${BOT + 22}" class="m" font-size="11" fill="${t.faint}" text-anchor="middle">${lbl}</text>`;
    }
  });
  const legend = KEYS.map(([k, col], i) => `<rect x="${W - 262 + i * 84}" y="${TOP - 22}" width="10" height="10" rx="2" fill="${col}"/><text x="${W - 246 + i * 84}" y="${TOP - 13}" class="m" font-size="11" fill="${t.faint}">${k}</text>`).join('');
  const body = `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.panel}" stroke="${t.line}"/>
${stat('AGENT RUNS · 7 DAYS', String(wk.runs), 28)}${stat('AGENT-HOURS', String(wk.hours), 248)}${stat('TOOL CALLS', wk.tools.toLocaleString('en'), 428)}${stat('SENT BACK BY REVIEW', String(wk.returned), 628)}
<path d="M${L} ${BOT}.5H${W - L}" stroke="${t.line}"/>${bars}${legend}`;
  return svg(W, H, ['unbounded-500', 'mono-400'], css, body, `My AI crew in the last 7 days: ${wk.runs} agent runs, ${wk.hours} agent-hours, ${wk.tools} tool calls, ${wk.returned} diffs sent back by review`);
}

// ---------- guestbook wall: avatars of everyone who opened a "wave" issue ----------
function wall(t, guests, avatars) {
  const W = 840, COLS = 12, CELL = (W - 56) / COLS, SHOWN = Math.min(48, Math.max(COLS, Math.ceil((guests.length + 1) / COLS) * COLS));
  const rows = SHOWN / COLS, H = 112 + rows * 88;
  let cells = '', css = '.new{transform-box:fill-box;transform-origin:center;animation:pop 3.5s ease-in-out infinite}@keyframes pop{0%,70%,100%{transform:none}80%{transform:scale(1.12) rotate(-6deg)}90%{transform:scale(1.05) rotate(5deg)}}';
  for (let i = 0; i < SHOWN; i++) {
    const cx = 28 + CELL * i + CELL / 2 - Math.floor(i / COLS) * CELL * COLS, cy = 120 + Math.floor(i / COLS) * 88, g = guests[i];
    if (g && avatars[g.login]) {
      const name = g.login.length > 10 ? g.login.slice(0, 9) + '…' : g.login;
      cells += `<g${i ? '' : ' class="new"'}><image href="${avatars[g.login]}" x="${(cx - 24).toFixed(1)}" y="${cy - 24}" width="48" height="48" clip-path="url(#av)"/>` +
        `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="24.5" fill="none" stroke="${i ? t.line : t.ember}" stroke-width="${i ? 1 : 2}"/></g>` +
        `<text x="${cx.toFixed(1)}" y="${cy + 44}" class="m" font-size="10.5" fill="${t.muted}" text-anchor="middle">${x(name)}</text>`;
    } else if (i === guests.length) {
      cells += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="24" fill="none" stroke="${t.ember}" stroke-dasharray="3 4"/>` +
        `<text x="${cx.toFixed(1)}" y="${cy + 4}" class="m" font-size="11" fill="${t.ember}" text-anchor="middle">you?</text>`;
    } else {
      cells += `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="24" fill="none" stroke="${t.line}" stroke-dasharray="3 4"/>`;
    }
  }
  const n = guests.length;
  const body = `<defs><clipPath id="av" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${t.panel}" stroke="${t.line}"/>
<text x="28" y="38" class="m" font-size="11.5" fill="${t.faint}" letter-spacing="1">GUESTBOOK</text>
<text x="28" y="66" class="u" font-weight="500" font-size="24" fill="${t.fg}" letter-spacing="-.5">${n ? `${n} ${n === 1 ? 'wave' : 'waves'}` : 'No waves yet'}</text>
<text x="${W - 28}" y="38" class="m" font-size="11.5" fill="${t.faint}" text-anchor="end">open an issue titled "wave"</text>
<text x="${W - 28}" y="60" class="m" font-size="11.5" fill="${t.faint}" text-anchor="end">a bot puts you on this wall</text>
${cells}`;
  return svg(W, H, ['unbounded-500', 'mono-400'], css, body, n ? `Guestbook: ${n} people waved — ${guests.slice(0, 20).map(g => g.login).join(', ')}` : 'Guestbook: no waves yet');
}

const readJSON = (rel, fallback) => { const p = join(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback; };

async function weather() {
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=48.48&longitude=135.07&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&forecast_days=1&timezone=Asia%2FVladivostok';
  const r = await fetch(u);
  if (!r.ok) throw new Error('open-meteo: ' + r.status);
  const j = await r.json(), at = s => Date.parse(s + ':00+10:00');
  return { wx: { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code },
    sun: { rise: at(j.daily.sunrise[0]), set: at(j.daily.sunset[0]), day: !!j.current.is_day } };
}

async function avatar(g) {
  const r = await fetch(`https://avatars.githubusercontent.com/u/${g.id}?s=96&v=4`);
  if (!r.ok) throw new Error(`avatar ${g.login}: ${r.status}`);
  return `data:${r.headers.get('content-type') || 'image/png'};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
}

async function main() {
  const infos = {};
  for (const p of PROJECTS) {
    if (!p.repo) { infos[p.slug] = {}; continue; }
    try {
      const r = await gh(`/repos/${p.repo}`);
      infos[p.slug] = { stars: r.stargazers_count, lang: r.language };
    } catch (e) { console.warn(e.message); infos[p.slug] = { stars: null }; }
  }
  let days = [];
  try {
    const q = `{user(login:"${USER}"){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
    const j = await gh('/graphql', { query: q });
    days = j.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
  } catch (e) { console.warn('calendar:', e.message); }
  const now = Date.now();
  const at = (tz, o) => new Date(now).toLocaleString('en-GB', { timeZone: tz, ...o }).replace(',', '');
  const time = at('Asia/Vladivostok', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const sameDay = at('Asia/Vladivostok', { day: 'numeric' }) === at('Europe/London', { day: 'numeric' });
  const ctx = { time, london: sameDay ? `UTC+10 · London is at ${at('Europe/London', { hour: '2-digit', minute: '2-digit' })}`
    : `UTC+10 · in London it's still ${at('Europe/London', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` };
  try {
    const w = await weather();
    ctx.wx = w.wx;
    // moon age from a known new moon, 2000-01-06 18:14 UTC
    ctx.sun = { ...w.sun, now, moon: (((now - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1 + 1) % 1 };
  } catch (e) { console.warn('weather:', e.message); }
  // preview another sky: SKY=73,night node scripts/build.mjs  (Open-Meteo weather code, optional night)
  if (process.env.SKY && ctx.sun) { const [c, n] = process.env.SKY.split(','); ctx.wx.code = +c; if (n) ctx.sun.day = false; }
  const crewData = readJSON('data/crew.json', null);
  const guests = readJSON('data/guests.json', []);
  const avatars = {};
  for (const g of guests.slice(0, 48)) try { avatars[g.login] = await avatar(g); } catch (e) { console.warn(e.message); }
  for (const [mode, t] of Object.entries(THEMES)) {
    write(`header-${mode}.svg`, header(t, ctx));
    for (const p of PROJECTS) write(`cards/${p.slug}-${mode}.svg`, card(p, infos[p.slug], t));
    if (days.length) write(`pulse-${mode}.svg`, pulse(days, t, time));
    write(`replay-${mode}.svg`, replay(t));
    if (crewData) write(`crew-${mode}.svg`, crew(t, crewData));
    write(`wall-${mode}.svg`, wall(t, guests, avatars));
  }
  console.log('built', Object.keys(infos).length, 'cards,', days.length, 'days,', guests.length, 'guests,', ctx.wx ? `${ctx.wx.temp}°C code ${ctx.wx.code}` : 'no weather');
}

main().catch(e => { console.error(e); process.exit(1); });
