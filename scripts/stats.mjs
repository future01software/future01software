// GitHub istatistik kartlarını (assets/stats.svg, assets/langs.svg) üretir.
// GitHub Actions içinde `gh` CLI ile çalışır; dış servise bağımlı değildir.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const USER = process.env.STATS_USER || "future01software";
const api = (p) => JSON.parse(execFileSync("gh", ["api", p], { encoding: "utf8" }));
const apiSafe = (p, fallback) => { try { return api(p); } catch { return fallback; } };

const user = api(`users/${USER}`);
const repos = api(`users/${USER}/repos?per_page=100&type=owner`).filter((r) => !r.fork);
const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
const forks = repos.reduce((s, r) => s + r.forks_count, 0);
const commits = apiSafe(`search/commits?q=author:${USER}&per_page=1`, { total_count: 0 }).total_count;
const prs = apiSafe(`search/issues?q=author:${USER}+type:pr&per_page=1`, { total_count: 0 }).total_count;

const langs = {};
for (const r of repos) {
  const l = apiSafe(`repos/${USER}/${r.name}/languages`, {});
  for (const [k, v] of Object.entries(l)) langs[k] = (langs[k] || 0) + v;
}
const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const FONT = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const frame = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#14e0c4"/><stop offset="1" stop-color="#3b9eff"/></linearGradient></defs>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="#0a1117" stroke="#1d2b33"/>
  <text x="24" y="38" font-family="${FONT}" font-size="13" letter-spacing="3" fill="#14e0c4">${title}</text>
  <rect x="24" y="50" width="40" height="2" fill="url(#g)"/>
${body}
</svg>
`;

// --- stats card ---
const rows = [
  ["Toplam yıldız", stars],
  ["Commit", commits],
  ["Pull request", prs],
  ["Public repo", repos.length],
  ["Fork", forks],
  ["Takipçi", user.followers],
];
const statsBody = rows.map(([k, v], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 24 + col * 200, y = 92 + row * 40;
  return `  <text x="${x}" y="${y}" font-family="${SANS}" font-size="14" fill="#8b9da3">${esc(k)}</text>
  <text x="${x + 170}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="16" font-weight="700" fill="#e8f4f2">${esc(v)}</text>`;
}).join("\n");
writeFileSync("assets/stats.svg", frame(420, 200, "TELEMETRİ", statsBody));

// --- languages card ---
const colors = ["#14e0c4", "#3b9eff", "#f7df1e", "#e34f26", "#a78bfa", "#5d7480"];
let bx = 24;
const barW = 372;
const bar = top.map(([, v], i) => {
  const w = Math.max(2, (v / total) * barW);
  const s = `  <rect x="${bx.toFixed(1)}" y="70" width="${w.toFixed(1)}" height="10" fill="${colors[i]}"/>`;
  bx += w;
  return s;
}).join("\n");
const legend = top.map(([k, v], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 24 + col * 190, y = 112 + row * 28;
  return `  <circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${colors[i]}"/>
  <text x="${x + 18}" y="${y}" font-family="${SANS}" font-size="14" fill="#d6e4e2">${esc(k)}</text>
  <text x="${x + 170}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#8b9da3">${((v / total) * 100).toFixed(1)}%</text>`;
}).join("\n");
const langsBody = `  <clipPath id="c"><rect x="24" y="70" width="${barW}" height="10" rx="5"/></clipPath>
  <rect x="24" y="70" width="${barW}" height="10" rx="5" fill="#1d2b33"/>
  <g clip-path="url(#c)">
${bar}
  </g>
${legend || `  <text x="24" y="112" font-family="${SANS}" font-size="14" fill="#8b9da3">Henüz veri yok</text>`}`;
writeFileSync("assets/langs.svg", frame(420, 200, "EN ÇOK KULLANILAN DİLLER", langsBody));

console.log({ stars, commits, prs, repos: repos.length, forks, followers: user.followers, top });
