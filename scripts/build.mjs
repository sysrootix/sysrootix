// Builds every picture on the profile: header, project cards, commit pulse — dark and light.
// Live data (stars, languages, contribution calendar) comes from the GitHub API; fonts are embedded,
// so the SVGs look the same everywhere. Node 20+, no dependencies.
//   GITHUB_TOKEN=... node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'sysrootix';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// sysrootix.com palette: black, warm paper, one ember accent
const THEMES = {
  dark: { bg: '#000000', panel: '#0b0b0a', fg: '#f3f0e8', muted: 'rgba(243,240,232,.58)', faint: 'rgba(243,240,232,.34)',
    line: 'rgba(243,240,232,.12)', glass: 'rgba(243,240,232,.04)', ember: '#ff4a3d', emberSoft: 'rgba(255,74,61,.22)' },
  light: { bg: '#f3f0e8', panel: '#faf8f3', fg: '#0b0b0a', muted: 'rgba(11,11,10,.62)', faint: 'rgba(11,11,10,.38)',
    line: 'rgba(11,11,10,.12)', glass: 'rgba(11,11,10,.035)', ember: '#e2352a', emberSoft: 'rgba(226,53,42,.16)' },
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
const write = (rel, s) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
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

// ---------- header: menu bar, greeting in five languages, the +10 ----------
function header(t, mode) {
  const W = 1200, H = 440;
  // a periodic series so the moving sparkline loops without a seam
  const pts = Array.from({ length: 40 }, (_, i) => 12 + 7 * Math.sin(i * 0.9) + 5 * Math.sin(i * 2.3 + 1) + 3 * Math.cos(i * 4.1));
  const series = [...pts, ...pts, pts[0]];
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${(i * 4).toFixed(1)} ${(26 - v).toFixed(1)}`).join('');
  const hello = [['EN', "Hi, I'm Nikita."], ['RU', 'Привет, я Никита.'], ['JA', 'こんにちは、ニキータです。'], ['ZH', '你好，我是尼基塔。'], ['ES', 'Hola, soy Nikita.']];
  const greet = hello.map(([k, s], i) =>
    `<g class="hi hi${i}" style="animation-delay:${i * 3}s"><text x="56" y="132" class="m" font-size="13" fill="${t.ember}" letter-spacing="2">${k}</text>` +
    `<text x="56" y="200" class="u" font-weight="700" font-size="60" fill="${t.fg}" letter-spacing="-1.5">${x(s)}</text></g>`).join('');
  const css = `.hi{opacity:0;animation:hi 15s infinite}
@keyframes hi{0%{opacity:0;transform:translateY(10px)}3%,17%{opacity:1;transform:none}20%,100%{opacity:0;transform:translateY(-10px)}}
@media (prefers-reduced-motion:reduce){.hi0{opacity:1}}
.run{animation:run 7s linear infinite}@keyframes run{to{transform:translateX(-160px)}}
.blink{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.cup{animation:cup 4s ease-in-out infinite}@keyframes cup{0%,100%{width:30px}50%{width:22px}}`;
  const body = `<rect width="${W}" height="${H}" rx="22" fill="${t.bg}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="${t.line}"/>
<path d="M0 22a22 22 0 0 1 22-22h${W - 44}a22 22 0 0 1 22 22v22H0z" fill="${t.glass}"/><path d="M0 44.5h${W}" stroke="${t.line}"/>
<circle cx="30" cy="22" r="6" fill="${t.ember}"/>
<text x="46" y="27" class="u" font-weight="500" font-size="14" fill="${t.fg}">sysrootix</text>
<text y="27" class="g" font-weight="500" font-size="14" fill="${t.muted}"><tspan x="148">Ship</tspan><tspan x="196">Agents</tspan><tspan x="262">Tools</tspan><tspan x="316">Coffee</tspan></text>
<defs><clipPath id="spark"><rect x="${W - 520}" y="8" width="160" height="28" rx="4"/></clipPath></defs>
<g clip-path="url(#spark)"><g class="run"><path transform="translate(${W - 520} 8)" d="${line}" fill="none" stroke="${t.ember}" stroke-width="1.6" stroke-linejoin="round"/></g></g>
<text x="${W - 348}" y="27" class="m" font-size="12" fill="${t.muted}">coffee</text>
<rect x="${W - 296}" y="17" width="30" height="10" rx="3" fill="none" stroke="${t.faint}"/><rect class="cup" x="${W - 296}" y="17" width="30" height="10" rx="3" fill="${t.muted}"/>
<text x="${W - 250}" y="27" class="m" font-size="12" fill="${t.muted}">Khabarovsk · UTC+10</text>
<text x="${W - 28}" y="27" class="m" font-size="12" fill="${t.fg}" text-anchor="end">tomorrow</text>
${greet}
<text x="56" y="250" class="g" font-size="20" fill="${t.muted}">Full-stack from Russia's Far East. I build retail platforms end to end</text>
<text x="56" y="278" class="g" font-size="20" fill="${t.muted}">and small, sharp tools for macOS. AI agents write the code, I make the calls.</text>
<text x="56" y="392" class="m" font-size="14" fill="${t.faint}">rust / typescript / swift / postgres / telegram / 1c<tspan class="blink" fill="${t.ember}"> ▍</tspan></text>
<text x="${W - 40}" y="384" class="u" font-weight="700" font-size="132" fill="none" stroke="${t.ember}" stroke-width="1.5" text-anchor="end" letter-spacing="-6" opacity=".9">+10</text>
<text x="${W - 44}" y="412" class="m" font-size="12" fill="${t.faint}" text-anchor="end">hours ahead of London — it's probably tomorrow here</text>`;
  return svg(W, H, Object.keys(FACES), css, body, "Hi, I'm Nikita (sysrootix): full-stack developer from Khabarovsk, UTC+10");
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
  const now = new Date();
  const built = now.toLocaleString('en-GB', { timeZone: 'Asia/Vladivostok', weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  for (const [mode, t] of Object.entries(THEMES)) {
    write(`assets/header-${mode}.svg`, header(t, mode));
    for (const p of PROJECTS) write(`assets/cards/${p.slug}-${mode}.svg`, card(p, infos[p.slug], t));
    if (days.length) write(`assets/pulse-${mode}.svg`, pulse(days, t, built));
  }
  console.log('built', Object.keys(infos).length, 'cards,', days.length, 'days');
}

main().catch(e => { console.error(e); process.exit(1); });
