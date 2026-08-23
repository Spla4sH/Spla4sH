/**
 * Renders the header banner and the tech stack panel, dark and light.
 *
 * These replace the typing-SVG header and 25 shields.io badges. A README can
 * only be styled through images -- GitHub strips <style>, class and style
 * attributes -- so anything that should look designed has to be drawn here.
 *
 * Usage: node scripts/generate-panels.mjs <out-dir>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { themes, accentsFor, sans, mono, escapeXml, monoWidth, sansWidth, logoMark, frame, chip } from './lib/render.mjs';

const outDir = process.argv[2] ?? 'dist';

const NAME_FIRST = 'Sebastian ';
const NAME_LAST = 'Rösch';
const ROLE = 'SAP Consultant & Developer  ·  S/4HANA';
const SITE = 'spla4sh.github.io';

const WIDTH = 880;

const groupsFor = (theme) => {
  const accents = accentsFor(theme);
  return [
  { label: 'LANGUAGES', accent: accents.emerald, items: ['Python', 'JavaScript', 'Java', 'Bash', 'HTML/CSS'] },
  { label: 'ML & DATA', accent: accents.ml, items: ['PyTorch', 'scikit-learn', 'Pandas', 'NumPy', 'Darts', 'AutoTS'] },
  { label: 'WEB', accent: accents.web, items: ['React', 'Node.js', 'Astro'] },
  { label: 'DEVOPS & CLOUD', accent: accents.devops, items: ['Docker', 'Kubernetes', 'ArgoCD', 'Helm', 'GitHub Actions', 'AWS', 'Linux'] },
  { label: 'DATABASES', accent: accents.data, items: ['MySQL', 'MongoDB'] },
  // No Git or GitHub: a badge for being on GitHub says nothing on a GitHub profile
  { label: 'TOOLS', accent: accents.research, items: ['GitLab', 'Jira', 'Claude Code'] },
  ];
};

function header(theme) {
  const accent = theme.accent;
  const height = 190;
  const nameSize = 46;
  const firstWidth = sansWidth(NAME_FIRST, nameSize);

  const inner = `${logoMark(48, 40, 56, accent, theme)}
    <text x="120" y="80" font-family="${sans}" font-size="${nameSize}" font-weight="700" fill="${theme.fg}" letter-spacing="-1.2">${escapeXml(NAME_FIRST)}<tspan fill="${accent}">${escapeXml(NAME_LAST)}</tspan></text>
    <text x="120" y="112" font-family="${mono}" font-size="16" fill="${theme.muted}" letter-spacing="0.5">${escapeXml(ROLE)}</text>
    <line x1="48" y1="140" x2="${WIDTH - 48}" y2="140" stroke="${theme.border}"/>
    <text x="48" y="167" font-family="${mono}" font-size="13" fill="${theme.dim}">Learning by building things</text>
    <text x="${WIDTH - 48}" y="167" text-anchor="end" font-family="${mono}" font-size="13" fill="${theme.dim}">${escapeXml(SITE)}</text>`;

  return frame(WIDTH, height, theme, accent, inner, `${NAME_FIRST}${NAME_LAST} — ${ROLE}`);
}

function techStack(theme) {
  const labelX = 40;
  // Just past the longest label ("DEVOPS & CLOUD") so the chips do not float
  const labelColumn = 150;
  const chipsX = labelX + labelColumn;
  const chipsWidth = WIDTH - chipsX - 40;
  const rowGap = 14;

  let y = 74;
  const parts = [];

  for (const group of groupsFor(theme)) {
    const rowTop = y;
    let cx = chipsX;
    let cy = y;
    const chips = [];

    for (const item of group.items) {
      const { width, svg } = chip(cx, cy, item, theme);
      // Wrap into a second line rather than letting a long group overflow
      if (cx + width > chipsX + chipsWidth && cx > chipsX) {
        cy += 32;
        cx = chipsX;
        const wrapped = chip(cx, cy, item, theme);
        chips.push(wrapped.svg);
        cx += wrapped.width + 8;
        continue;
      }
      chips.push(svg);
      cx += width + 8;
    }

    const rowHeight = cy - rowTop + 24;
    parts.push(`    <rect x="${labelX}" y="${rowTop}" width="3" height="${rowHeight}" rx="1.5" fill="${group.accent}"/>
    <text x="${labelX + 16}" y="${rowTop + 16}" font-family="${mono}" font-size="11" font-weight="500" fill="${group.accent}" letter-spacing="1.2">${escapeXml(group.label)}</text>
${chips.join('\n')}`);

    y = rowTop + rowHeight + rowGap;
  }

  const height = y + 26;
  const inner = `    <text x="${labelX}" y="46" font-family="${mono}" font-size="12" fill="${theme.dim}" letter-spacing="2">TECH STACK</text>
${parts.join('\n')}`;

  return frame(WIDTH, height, theme, theme.accent, inner, 'Tech stack');
}

await mkdir(outDir, { recursive: true });

for (const theme of [themes.dark, themes.light]) {
  const suffix = theme.name === 'light' ? '-light' : '';
  await writeFile(path.join(outDir, `header${suffix}.svg`), header(theme), 'utf8');
  await writeFile(path.join(outDir, `tech-stack${suffix}.svg`), techStack(theme), 'utf8');
}

console.log(`header and tech-stack written to ${outDir}/ (dark + light)`);
