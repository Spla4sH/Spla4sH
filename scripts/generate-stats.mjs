/**
 * Renders the two GitHub stats cards for the profile README.
 *
 * Public instances of github-readme-stats share one API token between everyone
 * using them, so they go dark whenever that token hits GitHub's hourly limit --
 * and they answer with HTTP 200 carrying an error card, which is invisible to
 * any uptime check. This queries the API directly and writes plain SVG files
 * that get committed, so the README depends on no running service at all.
 *
 * Usage: node scripts/generate-stats.mjs <out-dir>
 * Env:   GH_LOGIN, GH_TOKEN
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { themes, sans, mono, escapeXml, frame } from './lib/render.mjs';

const login = process.env.GH_LOGIN;
const token = process.env.GH_TOKEN;
const outDir = process.argv[2] ?? 'dist';

if (!login || !token) {
  console.error('GH_LOGIN and GH_TOKEN are required');
  process.exit(1);
}

/**
 * Repos whose language bytes are build output rather than written code.
 * darts-forecasting carries 27 MB of generated Sphinx HTML, which on its own
 * makes HTML 94% of every language total and buries the actual work.
 * The tidier long-term fix is a .gitattributes marking those paths as
 * linguist-generated in the repo itself; until then they are skipped here.
 */
const EXCLUDE_FROM_LANGUAGES = new Set(['darts-forecasting']);

const QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    name
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      totalPullRequestContributions
      totalRepositoriesWithContributedCommits
    }
    pullRequests { totalCount }
    issues { totalCount }
    # Public only, so the repo count and the language split describe what a
    # visitor can actually go and look at - and so the "Public Repositories"
    # label stays true even if STATS_TOKEN is added later. Commit counts are
    # the one figure that legitimately includes private work.
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      pageInfo { hasNextPage endCursor }
      totalCount
      nodes {
        name
        stargazerCount
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

async function graphql(variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profile-stats-generator',
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });

  if (!res.ok) throw new Error(`GitHub API responded ${res.status}: ${await res.text()}`);

  const body = await res.json();
  // A GraphQL error still arrives as 200, which is exactly the trap that made
  // the hosted cards fail silently. Treat it as the failure it is.
  if (body.errors?.length) throw new Error(`GraphQL error: ${JSON.stringify(body.errors)}`);
  return body.data.user;
}

async function collect() {
  let after = null;
  let user = null;
  const repos = [];

  do {
    const page = await graphql({ login, after });
    user ??= page;
    repos.push(...page.repositories.nodes);
    after = page.repositories.pageInfo.hasNextPage ? page.repositories.pageInfo.endCursor : null;
  } while (after);

  const c = user.contributionsCollection;
  const languages = new Map();

  for (const repo of repos) {
    if (EXCLUDE_FROM_LANGUAGES.has(repo.name)) continue;
    for (const { size, node } of repo.languages.edges) {
      const entry = languages.get(node.name) ?? { size: 0, color: node.color ?? '#8B949E' };
      entry.size += size;
      languages.set(node.name, entry);
    }
  }

  return {
    name: user.name ?? login,
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    // contributionsCollection covers the trailing year, so the label says so
    commits: c.totalCommitContributions + c.restrictedContributionsCount,
    contributedTo: c.totalRepositoriesWithContributedCommits,
    pullRequests: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    languages: [...languages.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.size - a.size),
  };
}

const CARD_WIDTH = 430;
const CARD_HEIGHT = 200;

/** Section eyebrow in the same mono/uppercase key as the other panels. */
const eyebrow = (label, theme) =>
  `    <text x="30" y="44" font-family="${mono}" font-size="12" fill="${theme.dim}" letter-spacing="2">${escapeXml(label)}</text>`;

function statsCard(data, theme) {
  // The streak card below this one already carries total contributions and
  // streaks, so these rows complement it rather than repeat it. Issues and PRs
  // are left out on purpose: at 0 and 1 they say nothing about the work.
  const rows = [
    ['Public Repositories', data.repoCount],
    ['Commits (last year)', data.commits],
    ['Contributed to (last year)', data.contributedTo],
    ['Total Stars Earned', data.stars],
  ];

  const body = rows
    .map(([label, value], i) => {
      const y = 86 + i * 28;
      return `    <text x="30" y="${y}" font-family="${sans}" font-size="14" fill="${theme.muted}">${escapeXml(label)}</text>\n` +
        `    <text x="${CARD_WIDTH - 30}" y="${y}" text-anchor="end" font-family="${mono}" font-size="15" font-weight="500" fill="${theme.fg}">${escapeXml(value.toLocaleString('en-US'))}</text>`;
    })
    .join('\n');

  // No name in the title: the account's display name, the README header and the
  // portfolio each use a different one, and the header above already names him.
  return frame(CARD_WIDTH, CARD_HEIGHT, theme, theme.accent, `${eyebrow('GITHUB STATS', theme)}\n${body}`, 'GitHub stats');
}

function languagesCard(data, theme) {
  const top = data.languages.slice(0, 6);
  const total = top.reduce((sum, l) => sum + l.size, 0) || 1;

  const barX = 30;
  const barY = 64;
  const barWidth = CARD_WIDTH - barX * 2;

  let offset = barX;
  const bar = top
    .map((lang) => {
      const w = Math.max((lang.size / total) * barWidth, 2);
      const segment = `      <rect x="${offset.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="10" fill="${lang.color}"/>`;
      offset += w;
      return segment;
    })
    .join('\n');

  const legend = top
    .map((lang, i) => {
      const x = barX + (i % 2) * 190;
      const y = 108 + Math.floor(i / 2) * 26;
      const share = ((lang.size / total) * 100).toFixed(1);
      return `    <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${lang.color}"/>\n` +
        `    <text x="${x + 18}" y="${y}" font-family="${sans}" font-size="14" fill="${theme.muted}">${escapeXml(lang.name)}</text>\n` +
        `    <text x="${x + 165}" y="${y}" text-anchor="end" font-family="${mono}" font-size="12" fill="${theme.dim}">${share}%</text>`;
    })
    .join('\n');

  const body = `${eyebrow('MOST USED LANGUAGES', theme)}
    <defs><clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barWidth}" height="10" rx="5"/></clipPath></defs>
    <rect x="${barX}" y="${barY}" width="${barWidth}" height="10" rx="5" fill="${theme.chip}"/>
    <g clip-path="url(#bar)">
${bar}
    </g>
${legend}`;

  return frame(CARD_WIDTH, CARD_HEIGHT, theme, theme.accent, body, 'Most used languages');
}

const data = await collect();
await mkdir(outDir, { recursive: true });

for (const theme of [themes.dark, themes.light]) {
  const suffix = theme.name === 'light' ? '-light' : '';
  await writeFile(path.join(outDir, `github-stats${suffix}.svg`), statsCard(data, theme), 'utf8');
  await writeFile(path.join(outDir, `top-languages${suffix}.svg`), languagesCard(data, theme), 'utf8');
}

console.log(`${data.repoCount} repos, ${data.stars} stars, ${data.commits} commits (last year)`);
console.log(`languages: ${data.languages.slice(0, 6).map((l) => l.name).join(', ')}`);
console.log(`written to ${outDir}/`);
