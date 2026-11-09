/* 학습 사이트 동작. 원본: docs/html/_tools/assets/site.js (빌드 때 docs/html/assets/로 복사)
 * file:// 로 열어도 동작하도록 외부 요청(fetch) 없이 search-index.js의 전역 값만 씁니다.
 * localStorage는 개인 편의(테마, 읽음 표시)에만 쓰며, 막혀 있어도 페이지는 정상 동작합니다. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var root = doc.getAttribute('data-root') || '';
  var pageId = doc.getAttribute('data-page-id') || '';
  var index = window.__SEARCH_INDEX__ || [];

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
    return null;
  }

  // ---------- 테마 ----------
  var themeButton = document.querySelector('.theme-button');
  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var current = doc.getAttribute('data-theme');
      var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = current ? current === 'dark' : systemDark;
      var next = isDark ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      store('docs-theme', next);
    });
  }

  // ---------- 모바일 사이드바 ----------
  var menuButton = document.querySelector('.menu-button');
  if (menuButton) {
    menuButton.addEventListener('click', function () {
      var open = document.body.classList.toggle('sidebar-open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (event) {
      if (!document.body.classList.contains('sidebar-open')) return;
      if (event.target.closest('.sidebar') || event.target.closest('.menu-button')) return;
      document.body.classList.remove('sidebar-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  }

  // ---------- 읽음 표시와 진도 ----------
  function isRead(id) {
    return store('docs-read:' + id) === '1';
  }

  function refreshReadMarks() {
    var links = document.querySelectorAll('a[data-page-id]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-read', isRead(links[i].getAttribute('data-page-id')));
    }
    var progress = document.querySelector('[data-progress]');
    if (progress) {
      var total = Number(progress.getAttribute('data-total')) || 0;
      var ids = {};
      for (var j = 0; j < index.length; j++) ids[index[j].id] = true;
      var count = 0;
      for (var id in ids) {
        if (id !== pageId && isRead(id)) count++;
      }
      var countEl = progress.querySelector('[data-progress-count]');
      if (countEl) countEl.textContent = String(count);
      var bar = progress.querySelector('.progress-bar span');
      if (bar) bar.style.width = total ? Math.round((count / total) * 100) + '%' : '0';
    }
  }

  var readToggle = document.querySelector('[data-read-toggle]');
  if (readToggle) {
    readToggle.checked = isRead(pageId);
    readToggle.addEventListener('change', function () {
      store('docs-read:' + pageId, readToggle.checked ? '1' : null);
      refreshReadMarks();
    });
  }
  refreshReadMarks();

  // ---------- 코드 복사 ----------
  var blocks = document.querySelectorAll('.markdown pre > code');
  for (var b = 0; b < blocks.length; b++) {
    (function (code) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-button';
      button.textContent = '복사';
      button.addEventListener('click', function () {
        var text = code.innerText;
        var done = function () {
          button.textContent = '복사됨';
          setTimeout(function () { button.textContent = '복사'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var area = document.createElement('textarea');
          area.value = text;
          document.body.appendChild(area);
          area.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(area);
        }
      });
      code.parentNode.appendChild(button);
    })(blocks[b]);
  }

  // ---------- 목차 현재 위치 ----------
  var tocLinks = document.querySelectorAll('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    for (var t = 0; t < tocLinks.length; t++) {
      byId[decodeURIComponent(tocLinks[t].getAttribute('href').slice(1))] = tocLinks[t];
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var k in byId) byId[k].classList.remove('is-active');
        var link = byId[entry.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-64px 0px -70% 0px' });
    var headings = document.querySelectorAll('.markdown h2[id], .markdown h3[id]');
    for (var h = 0; h < headings.length; h++) observer.observe(headings[h]);
  }

  // ---------- 검색 ----------
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlight(text, terms) {
    var html = escapeHtml(text);
    terms.forEach(function (term) {
      if (!term) return;
      var safe = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(safe, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    });
    return html;
  }

  function snippet(text, term) {
    var lower = text.toLowerCase();
    var at = lower.indexOf(term);
    if (at < 0) return text.slice(0, 120);
    var start = Math.max(0, at - 50);
    return (start > 0 ? '…' : '') + text.slice(start, at + 90) + '…';
  }

  function search(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var found = [];
    index.forEach(function (page) {
      var title = page.t.toLowerCase();
      var heads = page.h.map(function (h) { return h[0].toLowerCase(); }).join(' \n ');
      var body = page.x.toLowerCase();
      var all = title + ' ' + heads + ' ' + body;
      for (var i = 0; i < terms.length; i++) {
        if (all.indexOf(terms[i]) < 0) return;
      }
      var score = 0;
      var anchor = '';
      var headingText = '';
      terms.forEach(function (term) {
        if (title.indexOf(term) >= 0) score += 10;
        if (body.indexOf(term) >= 0) score += 1;
      });
      for (var j = 0; j < page.h.length; j++) {
        var ht = page.h[j][0].toLowerCase();
        if (terms.every(function (term) { return ht.indexOf(term) >= 0; })) {
          score += 5;
          anchor = page.h[j][1];
          headingText = page.h[j][0];
          break;
        }
      }
      found.push({ page: page, score: score, anchor: anchor, heading: headingText });
    });
    found.sort(function (a, b) { return b.score - a.score; });
    return found.slice(0, 20).map(function (r) {
      return {
        href: root + r.page.u + (r.anchor ? '#' + encodeURIComponent(r.anchor) : ''),
        title: r.page.t,
        sub: [r.page.s, r.heading].filter(Boolean).join(' › '),
        snippet: snippet(r.page.x, terms[0]),
        terms: terms,
      };
    });
  }

  var selected = -1;
  function render(items) {
    selected = -1;
    if (!items.length) {
      results.innerHTML = '<div class="r-empty">결과가 없습니다.</div>';
    } else {
      results.innerHTML = items.map(function (item) {
        return '<a href="' + escapeHtml(item.href) + '">' +
          '<div class="r-title">' + highlight(item.title, item.terms) + '</div>' +
          (item.sub ? '<div class="r-sub">' + highlight(item.sub, item.terms) + '</div>' : '') +
          '<div class="r-snippet">' + highlight(item.snippet, item.terms) + '</div></a>';
      }).join('');
    }
    results.hidden = false;
  }

  var timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = input.value.trim();
      if (!q) { results.hidden = true; return; }
      render(search(q));
    }, 120);
  });

  input.addEventListener('keydown', function (event) {
    var links = results.querySelectorAll('a');
    if (event.key === 'Escape') { results.hidden = true; input.blur(); return; }
    if (!links.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      for (var i = 0; i < links.length; i++) links[i].setAttribute('aria-selected', String(i === selected));
      links[selected].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      var target = links[selected >= 0 ? selected : 0];
      if (target) window.location.href = target.getAttribute('href');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      input.focus();
    }
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.search')) results.hidden = true;
  });
})();
