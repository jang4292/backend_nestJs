#!/usr/bin/env node
/**
 * 학습 사이트 생성기: docs/**\/*.md(원본) → docs/html/**\/*.html(스냅샷)
 *
 *   node docs/html/_tools/build.mjs            스냅샷 생성(기존 생성물을 지우고 다시 만듦)
 *   node docs/html/_tools/build.mjs --verify   링크·앵커·설정만 검사, 파일을 쓰지 않음(CI)
 *   node docs/html/_tools/build.mjs --status   마지막 스냅샷 이후 바뀐 md 목록(실패하지 않음)
 *
 * 규칙과 사용법: docs/html/README.md
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked, Renderer } from 'marked';

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML_DIR = path.resolve(TOOLS_DIR, '..');
const REPO_DIR = path.resolve(HTML_DIR, '../..');
const HTML_REL = toPosix(path.relative(REPO_DIR, HTML_DIR)); // docs/html
const SITE_GUIDE_SRC = `${HTML_REL}/README.md`;
/** 생성물 정리 때 지우지 않는 항목(원본) */
const KEEP_IN_OUTPUT = new Set(['_tools', 'README.md']);
const BUILD_INFO_FILE = 'build-info.json';
const SEARCH_TEXT_LIMIT = 20_000;

const mode = process.argv.includes('--verify')
  ? 'verify'
  : process.argv.includes('--status')
    ? 'status'
    : 'build';

main();

function main() {
  const config = readJson(path.join(TOOLS_DIR, 'site.config.json'));
  const sources = collectSources(config);

  if (mode === 'status') {
    printStatus(sources);
    return;
  }

  const git = readGitInfo();
  const site = renderSite(config, sources, git);

  for (const warning of site.warnings) console.warn(`WARN  ${warning}`);
  if (site.errors.length > 0) {
    for (const error of site.errors) console.error(`ERROR ${error}`);
    console.error(
      `\n${site.errors.length} error(s). 원본 md를 고친 뒤 다시 실행하세요. 생성물은 바꾸지 않았습니다.`,
    );
    process.exitCode = 1;
    return;
  }

  if (mode === 'verify') {
    console.log(
      `OK  ${site.pages.length} pages, ${site.linkCount} internal links checked (no files written)`,
    );
    return;
  }

  writeSite(site, sources, git);
  console.log(
    `OK  ${site.pages.length} pages → ${HTML_REL}/ (snapshot ${git.date} · ${git.branch} ${git.commit}${git.dirty ? ' + uncommitted changes' : ''})`,
  );
}

// ---------------------------------------------------------------------------
// 원본 수집
// ---------------------------------------------------------------------------

/** 사이트에 들어갈 md 목록. config에 적힌 순서가 학습 순서이고, 빠진 docs/*.md는 '기타 문서'로 붙입니다. */
function collectSources(config) {
  const listed = [];
  const seen = new Set();
  const add = (entry, section) => {
    const item = typeof entry === 'string' ? { src: entry } : entry;
    if (seen.has(item.src)) return;
    seen.add(item.src);
    listed.push({ ...item, section });
  };

  add({ src: config.home }, null);
  for (const section of config.sections) {
    for (const entry of section.pages) add(entry, section.title);
  }

  const unlisted = walkMarkdown(path.join(REPO_DIR, 'docs'))
    .map((abs) => toPosix(path.relative(REPO_DIR, abs)))
    .filter(
      (rel) => !rel.startsWith(`${HTML_REL}/`) || rel === SITE_GUIDE_SRC,
    )
    .filter((rel) => !seen.has(rel))
    .sort();
  for (const rel of unlisted) add({ src: rel, unlisted: true }, '기타 문서');

  return listed.map((item) => {
    const abs = path.join(REPO_DIR, item.src);
    const exists = fs.existsSync(abs);
    const markdown = exists ? fs.readFileSync(abs, 'utf8') : '';
    return {
      ...item,
      abs,
      exists,
      markdown,
      hash: sha256(markdown),
      out: outputPathFor(item.src, config.home),
    };
  });
}

function walkMarkdown(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkMarkdown(abs));
    else if (entry.name.endsWith('.md')) result.push(abs);
  }
  return result;
}

/** 원본 경로 → 사이트 안의 출력 경로(docs/html 기준) */
function outputPathFor(src, home) {
  if (src === home) return 'index.html';
  if (src === SITE_GUIDE_SRC) return 'site-maintenance.html';
  if (src.startsWith('docs/')) return src.slice('docs/'.length).replace(/\.md$/, '.html');
  return `repo/${src.replace(/\.md$/, '.html')}`;
}

// ---------------------------------------------------------------------------
// 렌더링과 검증
// ---------------------------------------------------------------------------

function renderSite(config, sources, git) {
  const errors = [];
  const warnings = [];
  const pagesBySrc = new Map(sources.map((s) => [s.src, s]));
  const pendingAnchors = [];
  let linkCount = 0;

  for (const source of sources) {
    if (!source.exists) errors.push(`site.config.json: ${source.src} 파일이 없습니다`);
    if (source.unlisted) {
      warnings.push(`${source.src}가 site.config.json에 없어 '기타 문서'에 넣었습니다`);
    }
  }

  const pages = [];
  for (const source of sources.filter((s) => s.exists)) {
    const ctx = {
      source,
      ids: new Map(),
      headings: [],
      title: undefined,
    };
    const marked = createMarked(ctx, {
      onLink(href) {
        return resolveLink(href, source, pagesBySrc, git, (problem) =>
          errors.push(`${source.src}: ${problem}`),
          (target, anchor) => {
            linkCount += 1;
            if (anchor) pendingAnchors.push({ from: source.src, target, anchor });
          },
        );
      },
    });

    const html = marked.parse(source.markdown);
    const title = ctx.title ?? path.basename(source.src, '.md');
    pages.push({
      ...source,
      title,
      html,
      headings: ctx.headings,
      ids: ctx.ids,
      stamp: extractStamp(source.markdown),
      historical: /^>\s*이력 문서/m.test(source.markdown.split('\n').slice(0, 8).join('\n')),
      text: plainText(html).slice(0, SEARCH_TEXT_LIMIT),
    });
  }

  const pagesForAnchors = new Map(pages.map((p) => [p.src, p]));
  for (const check of pendingAnchors) {
    const target = pagesForAnchors.get(check.target);
    if (target && !target.ids.has(check.anchor)) {
      errors.push(`${check.from}: #${check.anchor} 앵커가 ${check.target}에 없습니다`);
    }
  }

  return { config, pages, errors, warnings, linkCount };
}

/** marked 인스턴스: 제목에 GitHub 방식 id, 링크 재작성, 표 감싸기 */
function createMarked(ctx, { onLink }) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = plainText(inner);
        // GitHub은 h1에도 id를 붙이므로 같은 순서로 slug를 소비해야 중복 번호(-1, -2)가 일치합니다.
        const id = uniqueSlug(ctx.ids, text);
        if (depth === 1 && ctx.title === undefined) {
          ctx.title = text;
          return `<h1 id="${escapeAttr(id)}">${inner}</h1>\n`;
        }
        if (depth <= 3) ctx.headings.push({ depth, text, id });
        return `<h${depth} id="${escapeAttr(id)}"><a class="heading-anchor" href="#${escapeAttr(encodeURIComponent(id))}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const resolved = onLink(href);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        const external = resolved.external
          ? ' target="_blank" rel="noopener noreferrer"'
          : '';
        const cls = resolved.className ? ` class="${resolved.className}"` : '';
        return `<a href="${escapeAttr(resolved.href)}"${titleAttr}${external}${cls}>${inner}</a>`;
      },
      table(token) {
        return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
      },
    },
  });
  return marked;
}

/**
 * md 링크를 사이트 링크로 바꿉니다.
 * - 다른 md(사이트 페이지) → 상대 .html 경로 + 앵커(앵커는 나중에 검증)
 * - 저장소의 다른 파일(코드 등) → 스냅샷 커밋의 GitHub 링크
 * - 존재하지 않는 경로 → 오류
 */
function resolveLink(href, source, pagesBySrc, git, report, track) {
  if (/^(https?:|mailto:)/i.test(href)) return { href, external: true };

  const hashIndex = href.indexOf('#');
  const rawPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? '' : safeDecode(href.slice(hashIndex + 1));

  if (rawPath === '') {
    track(source.src, anchor);
    return { href };
  }

  const targetRel = toPosix(
    path.normalize(path.join(path.dirname(source.src), safeDecode(rawPath))),
  ).replace(/\/$/, '');
  if (targetRel.startsWith('..')) {
    report(`${href} 링크가 저장소 밖을 가리킵니다`);
    return { href };
  }

  const page = pagesBySrc.get(targetRel);
  if (page) {
    track(targetRel, anchor);
    const from = path.posix.dirname(source.out);
    const rel = path.posix.relative(from, page.out) || path.posix.basename(page.out);
    return { href: anchor ? `${rel}#${encodeURIComponent(anchor)}` : rel };
  }

  const abs = path.join(REPO_DIR, targetRel);
  if (!fs.existsSync(abs)) {
    report(`${href} 링크의 대상(${targetRel})이 없습니다`);
    return { href };
  }
  const kind = fs.statSync(abs).isDirectory() ? 'tree' : 'blob';
  const url = git.repoUrl
    ? `${git.repoUrl}/${kind}/${git.commit}/${encodePath(targetRel)}${anchor ? `#${anchor}` : ''}`
    : path.posix.relative(path.posix.dirname(`${HTML_REL}/${source.out}`), targetRel);
  return { href: url, external: Boolean(git.repoUrl), className: 'source-link' };
}

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------

function writeSite(site, sources, git) {
  cleanOutput();
  const template = fs.readFileSync(path.join(TOOLS_DIR, 'template.html'), 'utf8');
  const { config, pages } = site;
  const ordered = pages.filter((p) => p.out !== 'index.html');
  const pageIds = pages.map((p) => pageIdOf(p));

  for (const page of pages) {
    const root = rootPrefix(page.out);
    const isHome = page.out === 'index.html';
    const index = ordered.indexOf(page);
    const values = {
      lang: config.lang ?? 'ko',
      root,
      pageId: pageIdOf(page),
      pageTitle: escapeHtml(page.title),
      siteTitle: escapeHtml(config.title),
      description: escapeAttr(config.description ?? ''),
      bodyClass: isHome ? 'page-home' : 'page-doc',
      nav: renderNav(config, pages, page),
      pageMeta: isHome ? renderHome(config, pages, git, pageIds, page) : renderPageMeta(page),
      content: page.html,
      prevNext: isHome ? '' : renderPrevNext(ordered[index - 1], ordered[index + 1], page),
      toc: renderToc(page),
      sourcePath: escapeHtml(page.src),
      sourceUrl: escapeAttr(
        git.repoUrl ? `${git.repoUrl}/blob/${git.commit}/${encodePath(page.src)}` : '#',
      ),
      snapshotDate: escapeHtml(git.date),
      snapshotBranch: escapeHtml(git.branch),
      snapshotCommit: escapeHtml(git.commit),
      snapshotDirty: git.dirty ? ' · 커밋되지 않은 변경 포함' : '',
    };
    writeFile(page.out, fillTemplate(template, values));
  }

  for (const asset of fs.readdirSync(path.join(TOOLS_DIR, 'assets'))) {
    fs.mkdirSync(path.join(HTML_DIR, 'assets'), { recursive: true });
    fs.copyFileSync(
      path.join(TOOLS_DIR, 'assets', asset),
      path.join(HTML_DIR, 'assets', asset),
    );
  }

  const searchIndex = pages.map((p) => ({
    id: pageIdOf(p),
    u: p.out,
    t: p.title,
    s: p.section ?? '',
    h: p.headings.filter((h) => h.depth >= 2).map((h) => [h.text, h.id]),
    x: p.text,
  }));
  writeFile(
    'assets/search-index.js',
    `// 생성물: docs/html/_tools/build.mjs\nwindow.__SEARCH_INDEX__ = ${JSON.stringify(searchIndex)};\n`,
  );

  const buildInfo = {
    generator: `${HTML_REL}/_tools/build.mjs`,
    generatedAt: git.isoTime,
    branch: git.branch,
    commit: git.commit,
    uncommittedChanges: git.dirty,
    pageCount: pages.length,
    sources: Object.fromEntries(sources.filter((s) => s.exists).map((s) => [s.src, s.hash])),
  };
  writeFile(BUILD_INFO_FILE, `${JSON.stringify(buildInfo, null, 2)}\n`);
}

function cleanOutput() {
  for (const entry of fs.readdirSync(HTML_DIR)) {
    if (KEEP_IN_OUTPUT.has(entry)) continue;
    fs.rmSync(path.join(HTML_DIR, entry), { recursive: true, force: true });
  }
}

function renderNav(config, pages, current) {
  const bySrc = new Map(pages.map((p) => [p.src, p]));
  const from = path.posix.dirname(current.out);
  const link = (page) =>
    path.posix.relative(from, page.out) || path.posix.basename(page.out);
  const sections = [...config.sections.map((s) => s.title)];
  if (pages.some((p) => p.unlisted)) sections.push('기타 문서');

  const home = bySrc.get(config.home);
  let html = `<ul class="nav-list nav-home"><li><a href="${escapeAttr(link(home))}"${current === home ? ' aria-current="page"' : ''}>홈</a></li></ul>`;
  for (const title of sections) {
    const items = pages.filter((p) => p.section === title);
    if (items.length === 0) continue;
    const open = items.includes(current) ? ' open' : '';
    html += `<details class="nav-section"${open}><summary>${escapeHtml(title)}</summary><ul class="nav-list">`;
    for (const page of items) {
      const currentAttr = page === current ? ' aria-current="page"' : '';
      html += `<li><a href="${escapeAttr(link(page))}" data-page-id="${escapeAttr(pageIdOf(page))}"${currentAttr}>${escapeHtml(page.title)}</a></li>`;
    }
    html += '</ul></details>';
  }
  return html;
}

function renderToc(page) {
  const items = page.headings.filter((h) => h.depth === 2 || h.depth === 3);
  if (items.length < 2) return '';
  let html = '<p class="toc-title">이 페이지</p><ul>';
  for (const h of items) {
    html += `<li class="toc-${h.depth}"><a href="#${escapeAttr(encodeURIComponent(h.id))}">${escapeHtml(h.text)}</a></li>`;
  }
  return `${html}</ul>`;
}

function renderPageMeta(page) {
  const badges = [];
  if (page.section) badges.push(`<span class="badge">${escapeHtml(page.section)}</span>`);
  if (page.historical) badges.push('<span class="badge badge-muted">이력 문서</span>');
  if (page.stamp) badges.push(`<span class="badge badge-stamp">${escapeHtml(page.stamp)}</span>`);
  return `<div class="page-meta">${badges.join('')}<label class="read-toggle"><input type="checkbox" data-read-toggle> 읽음</label></div>`;
}

function renderHome(config, pages, git, pageIds, home) {
  const sections = config.sections
    .map((section) => {
      const items = pages.filter((p) => p.section === section.title);
      const list = items
        .map((p) => {
          const desc = p.desc ? `<span class="card-desc">${escapeHtml(p.desc)}</span>` : '';
          return `<li><a href="${escapeAttr(path.posix.relative('.', p.out))}" data-page-id="${escapeAttr(pageIdOf(p))}">${escapeHtml(p.title)}</a>${desc}</li>`;
        })
        .join('');
      return `<section class="card"><h2 class="card-title">${escapeHtml(section.title)}</h2><ul>${list}</ul></section>`;
    })
    .join('');
  const total = pageIds.filter((id) => id !== pageIdOf(home)).length;
  return `<div class="hero">
  <p class="hero-kicker">학습 사이트 · 스냅샷 ${escapeHtml(git.date)} · ${escapeHtml(git.branch)} <code>${escapeHtml(git.commit)}</code></p>
  <p class="hero-desc">${escapeHtml(config.description ?? '')}</p>
  <div class="progress" data-progress data-total="${total}"><div class="progress-bar"><span></span></div><p class="progress-label">읽은 문서 <strong data-progress-count>0</strong> / ${total}</p></div>
</div>
<div class="cards">${sections}</div>
<hr class="home-divider">`;
}

function renderPrevNext(prev, next, current) {
  const from = path.posix.dirname(current.out);
  const link = (p) => path.posix.relative(from, p.out) || path.posix.basename(p.out);
  const prevHtml = prev
    ? `<a class="pager-prev" href="${escapeAttr(link(prev))}"><span>이전</span>${escapeHtml(prev.title)}</a>`
    : '<span></span>';
  const nextHtml = next
    ? `<a class="pager-next" href="${escapeAttr(link(next))}"><span>다음</span>${escapeHtml(next.title)}</a>`
    : '<span></span>';
  return `<nav class="pager" aria-label="이전·다음 문서">${prevHtml}${nextHtml}</nav>`;
}

// ---------------------------------------------------------------------------
// status: 마지막 스냅샷 이후 바뀐 원본
// ---------------------------------------------------------------------------

function printStatus(sources) {
  const infoPath = path.join(HTML_DIR, BUILD_INFO_FILE);
  if (!fs.existsSync(infoPath)) {
    console.log('스냅샷이 없습니다. npm run docs:html로 처음 생성하세요.');
    return;
  }
  const info = readJson(infoPath);
  const before = info.sources ?? {};
  const now = Object.fromEntries(sources.filter((s) => s.exists).map((s) => [s.src, s.hash]));
  const changed = Object.keys(now).filter((k) => before[k] && before[k] !== now[k]);
  const added = Object.keys(now).filter((k) => !before[k]);
  const removed = Object.keys(before).filter((k) => !now[k]);

  console.log(
    `마지막 스냅샷: ${info.generatedAt} · ${info.branch} ${info.commit}${info.uncommittedChanges ? ' (+ 미커밋 변경)' : ''}`,
  );
  if (changed.length + added.length + removed.length === 0) {
    console.log('변경 없음: HTML 스냅샷이 현재 md와 같습니다.');
    return;
  }
  for (const k of changed) console.log(`  수정  ${k}`);
  for (const k of added) console.log(`  추가  ${k}`);
  for (const k of removed) console.log(`  삭제  ${k}`);
  console.log('\nHTML을 갱신하려면 npm run docs:html을 실행합니다.');
}

// ---------------------------------------------------------------------------
// 보조 함수
// ---------------------------------------------------------------------------

function readGitInfo() {
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd: REPO_DIR, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const remote = git('remote', 'get-url', 'origin');
  const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remote);
  const dirty = git(
    'status',
    '--porcelain',
    '--',
    'docs',
    'README.md',
    'API_EXAMPLES.md',
    `:(exclude)${HTML_REL}`,
  );
  const now = new Date();
  const kst = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    repoUrl: match ? `https://github.com/${match[1]}/${match[2]}` : '',
    branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    commit: git('rev-parse', '--short', 'HEAD') || 'unknown',
    dirty: dirty.length > 0,
    date: kst,
    isoTime: now.toISOString(),
  };
}

/** GitHub 제목 앵커 규칙(github-slugger와 같은 결과): 소문자, 문자·숫자·`-`·`_`·공백만 남기고 공백을 `-`로. 중복은 -1, -2 */
function uniqueSlug(ids, text) {
  const original = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
  let result = original;
  while (ids.has(result)) {
    ids.set(original, ids.get(original) + 1);
    result = `${original}-${ids.get(original)}`;
  }
  ids.set(result, 0);
  return result;
}

function extractStamp(markdown) {
  const head = markdown.split('\n').slice(0, 10).join('\n');
  const current = /^>\s*(?:최신화 기준|Last updated)\s*:\s*(.+?)[\s·]*$/m.exec(head);
  if (current) return `최신화 ${current[1].replace(/`/g, '')}`;
  const frozen = /^>\s*이력 문서\s*—\s*(기준 시점 [0-9-]+)/m.exec(head);
  return frozen ? frozen[1] : '';
}

function plainText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`template.html: {{${key}}} 값이 없습니다`);
    return values[key];
  });
}

function pageIdOf(page) {
  return page.src.replace(/\.md$/, '');
}

function rootPrefix(out) {
  const depth = out.split('/').length - 1;
  return '../'.repeat(depth);
}

function writeFile(rel, content) {
  const abs = path.join(HTML_DIR, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
