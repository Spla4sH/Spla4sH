/**
 * Shared drawing helpers for the profile's generated SVGs.
 *
 * The palette is lifted from the portfolio at spla4sh.github.io so both
 * surfaces read as one system. Every card is rendered twice, dark and light,
 * because a README pinned to #0a0a0a shows dark boxes on a white page for
 * anyone browsing GitHub in its light theme.
 */

/** Category accents, same ones the portfolio gives its project cards. */
export const accents = {
  emerald: '#10b981',
  ml: '#a78bfa',
  devops: '#60a5fa',
  data: '#fbbf24',
  web: '#2dd4bf',
  research: '#fb7185',
};

/**
 * The portfolio's accents are tuned for a near-black background; on white the
 * lighter ones (amber above all) drop below readable contrast, so the light
 * theme gets darkened equivalents of the same hues.
 */
const accentsLight = {
  emerald: '#0f8a68',
  ml: '#7c3aed',
  devops: '#2563eb',
  data: '#b45309',
  web: '#0d9488',
  research: '#e11d48',
};

export const accentsFor = (theme) => (theme.name === 'light' ? accentsLight : accents);

export const themes = {
  dark: {
    name: 'dark',
    bg: '#0a0a0a',
    surface: '#111113',
    chip: '#18181b',
    fg: '#fafafa',
    muted: '#a1a1aa',
    dim: '#71717a',
    border: '#27272a',
    borderStrong: '#3f3f46',
    accent: '#10b981',
    glow: 0.16,
  },
  light: {
    name: 'light',
    bg: '#ffffff',
    surface: '#f6f8fa',
    chip: '#ffffff',
    fg: '#1f2328',
    muted: '#57606a',
    dim: '#6e7781',
    border: '#d8dee4',
    borderStrong: '#afb8c1',
    // Darkened so emerald keeps its contrast on white
    accent: '#0f8a68',
    glow: 0.1,
  },
};

// Inter and JetBrains Mono cannot be shipped to a README, so these stacks fall
// back to whatever the reader's machine has. The look comes from layout and
// colour rather than from one specific typeface.
export const sans = "'Segoe UI', Inter, Ubuntu, Helvetica, Arial, sans-serif";
export const mono = "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

export const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Rough advance widths; enough to lay out chips without a font engine. */
export const monoWidth = (text, size) => text.length * size * 0.6;
export const sansWidth = (text, size) => text.length * size * 0.52;

/** The terminal mark from the portfolio's OG cards. */
export function logoMark(x, y, size, accent, theme) {
  const s = size / 84;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <rect width="84" height="84" rx="16" fill="${theme.surface}" stroke="${theme.border}" stroke-width="2"/>
    <path d="M22 27 L41 42 L22 57" stroke="${accent}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect x="46" y="53" width="18" height="7" rx="3.5" fill="${accent}"/>
  </g>`;
}

/**
 * Frames one card: background, the accent glow from the OG template and the
 * baseline rule along the bottom edge.
 */
export function frame(width, height, theme, accent, inner, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <defs>
    <radialGradient id="glow" cx="12%" cy="-20%" r="95%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="${theme.glow}"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="${theme.glow * 0.28}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="card"><rect width="${width}" height="${height}" rx="10"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${width}" height="${height}" fill="${theme.bg}"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
${inner}
    <rect x="0" y="${height - 3}" width="${width}" height="3" fill="${accent}"/>
  </g>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="none" stroke="${theme.border}"/>
</svg>`;
}

/** A bordered pill in the shape the portfolio's TechBadge uses. */
export function chip(x, y, label, theme, size = 12) {
  const w = monoWidth(label, size) + 20;
  const h = 24;
  return {
    width: w,
    svg: `    <rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="6" fill="${theme.chip}" stroke="${theme.border}"/>
    <text x="${(x + w / 2).toFixed(1)}" y="${y + 16}" text-anchor="middle" font-family="${mono}" font-size="${size}" fill="${theme.muted}">${escapeXml(label)}</text>`,
  };
}
