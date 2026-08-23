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

const theme = {
  bg: '#0D1117',
  title: '#58A6FF',
  text: '#C9D1D9',
  dim: '#8B949E',
  track: '#21262D',
  font: "'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif",
};

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
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false) {
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

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function card(width, height, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <style>
    .t { font: 600 17px ${theme.font}; fill: ${theme.title} }
    .l { font: 400 14px ${theme.font}; fill: ${theme.text} }
    .v { font: 600 14px ${theme.font}; fill: ${theme.text} }
    .d { font: 400 12px ${theme.font}; fill: ${theme.dim} }
  </style>
  <rect width="${width}" height="${height}" rx="8" fill="${theme.bg}"/>
  <text x="26" y="36" class="t">${escapeXml(title)}</text>
${body}
</svg>`;
}

function statsCard(data) {
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
      const y = 78 + i * 28;
      return `  <text x="26" y="${y}" class="l">${escapeXml(label)}</text>\n` +
        `  <text x="394" y="${y}" class="v" text-anchor="end">${escapeXml(value.toLocaleString('en-US'))}</text>`;
    })
    .join('\n');

  // No name in the title: the account's display name, the README header and the
  // portfolio each use a different one, and the header above already names him.
  return card(420, 200, 'GitHub Stats', body);
}

function languagesCard(data) {
  const top = data.languages.slice(0, 6);
  const total = top.reduce((sum, l) => sum + l.size, 0) || 1;

  const barWidth = 368;
  let offset = 26;
  const bar = top
    .map((lang) => {
      const w = Math.max((lang.size / total) * barWidth, 2);
      const segment = `  <rect x="${offset.toFixed(1)}" y="58" width="${w.toFixed(1)}" height="10" fill="${lang.color}"/>`;
      offset += w;
      return segment;
    })
    .join('\n');

  const legend = top
    .map((lang, i) => {
      const x = 26 + (i % 2) * 190;
      const y = 100 + Math.floor(i / 2) * 26;
      const share = ((lang.size / total) * 100).toFixed(1);
      return `  <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${lang.color}"/>\n` +
        `  <text x="${x + 18}" y="${y}" class="l">${escapeXml(lang.name)}</text>\n` +
        `  <text x="${x + 170}" y="${y}" class="d" text-anchor="end">${share}%</text>`;
    })
    .join('\n');

  const body = `  <rect x="26" y="58" width="${barWidth}" height="10" rx="5" fill="${theme.track}"/>\n` +
    `  <g clip-path="url(#bar)">\n${bar}\n  </g>\n` +
    `  <defs><clipPath id="bar"><rect x="26" y="58" width="${barWidth}" height="10" rx="5"/></clipPath></defs>\n` +
    legend;

  return card(420, 200, 'Most Used Languages', body);
}

const data = await collect();
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'github-stats.svg'), statsCard(data), 'utf8');
await writeFile(path.join(outDir, 'top-languages.svg'), languagesCard(data), 'utf8');

console.log(`${data.repoCount} repos, ${data.stars} stars, ${data.commits} commits (last year)`);
console.log(`languages: ${data.languages.slice(0, 6).map((l) => l.name).join(', ')}`);
console.log(`written to ${outDir}/`);
