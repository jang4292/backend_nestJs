'use strict';
let token = '';
let blobUrl = '';
const $ = (id) => document.getElementById(id);
const form = (id) => $(id);
const values = (id) => Object.fromEntries(new FormData(form(id)).entries());
const base = () => form('login').elements.base.value.replace(/\/$/, '');
function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
function row(target, label, buttonLabel, handler) {
  const element = document.createElement('div');
  element.className = 'entry';
  const text = document.createElement('span');
  text.textContent = label;
  element.append(text);
  if (handler) {
    const button = document.createElement('button');
    button.textContent = buttonLabel;
    button.addEventListener('click', () => run(handler));
    element.append(button);
  }
  $(target).append(element);
}
function clear(id) {
  $(id).replaceChildren();
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(base() + path, { ...options, headers });
  if (!res.ok) {
    let data;
    try {
      data = await res.json();
    } catch {
      /* no JSON error body */
    }
    throw new Error(
      data?.message || data?.error?.message || `요청 실패 (${res.status})`,
    );
  }
  return res.status === 204 ? null : res.json();
}
async function run(action) {
  try {
    await action();
  } catch (error) {
    message(error.message || String(error), true);
  }
}
function submit(id, action) {
  form(id).addEventListener('submit', (e) => {
    e.preventDefault();
    run(() => action(values(id), e));
  });
}
function click(id, action) {
  $(id).addEventListener('click', () => run(action));
}
function ok(id) {
  message(`${id} 작업을 완료했습니다.`);
}
document.querySelectorAll('nav button').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.hidden = tab.id !== button.dataset.tab;
    });
  }),
);
submit('login', async (v) => {
  const result = await api('/auth/login', {
    method: 'POST',
    body: {
      identifierType: v.identifierType,
      identifier: v.identifier,
      password: v.password,
    },
  });
  token = result.access_token;
  $('session').textContent = `${result.user.username} 로그인`;
  form('login').elements.password.value = '';
  message('로그인했습니다.');
});
click('logout', () => {
  token = '';
  $('session').textContent = '로그인 전';
  message('로그아웃했습니다.');
});
submit('artist', async (v) => {
  const result = await api('/music/management/artists', {
    method: 'POST',
    body: v,
  });
  message(`아티스트 #${result.id} 등록 완료`);
  await loadArtists();
});
submit('alias', async (v) => {
  await api(`/music/management/artists/${v.artistId}/aliases`, {
    method: 'POST',
    body: { name: v.name },
  });
  ok('별칭');
});
async function loadArtists() {
  clear('artists');
  const data = await api('/music/management/artists');
  data.forEach((item) => row('artists', `#${item.id} · ${item.name}`));
}
click('load-artists', loadArtists);
submit('work', async (v) => {
  const result = await api('/music/management/works', {
    method: 'POST',
    body: v,
  });
  message(`작품 #${result.id} 등록 완료`);
  await loadWorks();
});
async function loadWorks() {
  clear('works');
  const data = await api('/music/management/works');
  data.forEach((item) => row('works', `#${item.id} · ${item.title}`));
}
click('load-works', loadWorks);
submit('track', async (v) => {
  const result = await api('/music/tracks', { method: 'POST', body: v });
  message(`트랙 #${result.id} 등록 완료`);
  await loadTracks();
});
submit('recording', async (v) => {
  const body = {};
  if (v.workId) body.workId = Number(v.workId);
  if (v.artistIds)
    body.artistIds = v.artistIds.split(',').map((s) => Number(s.trim()));
  for (const key of ['recordingType', 'recordingLocation', 'recordingDate'])
    if (v[key]) body[key] = v[key];
  await api(`/music/management/recordings/${v.trackId}`, {
    method: 'PATCH',
    body,
  });
  ok('녹음 정보 저장');
});
submit('upload', async () => {
  const data = new FormData();
  const f = form('upload');
  data.set('file', f.elements.file.files[0]);
  const result = await api(`/music/tracks/${f.elements.trackId.value}/upload`, {
    method: 'POST',
    body: data,
  });
  message(`파일 #${result.id} 업로드 완료. 목록 항목에 파일 ID를 지정하세요.`);
});
async function loadTracks() {
  clear('tracks');
  const data = await api('/music/tracks?page=1&limit=100');
  data.forEach((item) =>
    row(
      'tracks',
      `#${item.id} · ${item.title} — ${item.artist}`,
      '파일 보기',
      async () => {
        const files = await api(`/music/tracks/${item.id}/audio-assets`);
        message(
          files.length
            ? files
                .map((f) => `파일 #${f.id} (${f.contentType || '기존 URL'})`)
                .join(' · ')
            : '등록된 파일이 없습니다.',
        );
      },
    ),
  );
}
click('load-tracks', loadTracks);
submit('playlist', async (v) => {
  const result = await api('/music/playlists', {
    method: 'POST',
    body: { title: v.title, anonymousPlayable: v.anonymousPlayable === 'on' },
  });
  message(`목록 #${result.id} 생성 완료`);
  await loadPlaylists();
});
submit('playlist-item', async (v) => {
  const result = await api(`/music/playlists/${v.playlistId}/tracks`, {
    method: 'POST',
    body: { trackId: Number(v.trackId), position: Number(v.position) },
  });
  message(`목록 항목 #${result.id} 추가 완료`);
});
submit('asset', async (v) => {
  await api(`/music/management/playlist-items/${v.itemId}/asset`, {
    method: 'PATCH',
    body: { audioAssetId: Number(v.audioAssetId) },
  });
  ok('재생 파일 지정');
});
submit('playlist-detail', async (v, event) => {
  if (event.submitter?.name === 'publish') {
    await api(`/music/playlists/${v.id}/publish`, { method: 'PATCH' });
    message('플레이리스트를 공개했습니다.');
  }
  const result = await api(`/music/management/playlists/${v.id}`);
  clear('playlist-items');
  result.items.forEach((i) =>
    row(
      'playlist-items',
      `항목 #${i.id} · 순서 ${i.position} · ${i.track.title} · 파일 ${i.audioAssetId ?? '미지정'}`,
    ),
  );
});
async function loadPlaylists() {
  clear('playlist-list');
  const data = await api('/music/management/playlists');
  data.forEach((item) =>
    row('playlist-list', `#${item.id} · ${item.title} · ${item.status}`),
  );
}
click('load-playlists', loadPlaylists);
submit('usage-create', async (v) => {
  const result = await api('/music/management/usages', {
    method: 'POST',
    body: {
      playlistId: Number(v.playlistId),
      usedAt: new Date(v.usedAt).toISOString(),
      location: v.location,
      ...(v.eventName ? { eventName: v.eventName } : {}),
    },
  });
  message(`사용 회차 #${result.id} 생성 완료`);
  await loadUsages();
});
submit('usage-detail', async (v, event) => {
  if (event.submitter?.name === 'confirm') {
    await api(`/music/management/usages/${v.id}/confirm`, { method: 'POST' });
    message('회차를 확정했습니다.');
  }
  const result = await api(`/music/management/usages/${v.id}`);
  clear('usage-items');
  result.items.forEach((i) =>
    row(
      'usage-items',
      `항목 #${i.id} · ${i.trackTitle} · 사용 ${i.playCount}회 · 파일 ${i.audioAssetId ?? '미확인'}`,
    ),
  );
});
submit('usage-item', async (v) => {
  await api(`/music/management/usages/${v.usageId}/items/${v.itemId}`, {
    method: 'PATCH',
    body: { playCount: Number(v.playCount) },
  });
  ok('사용 횟수 수정');
});
async function loadUsages() {
  clear('usage-list');
  const data = await api('/music/management/usages');
  data.forEach((item) =>
    row(
      'usage-list',
      `#${item.id} · ${item.playlistTitle} · ${new Date(item.usedAt).toLocaleString()} · ${item.location} · ${item.status}`,
    ),
  );
}
click('load-usages', loadUsages);
submit('statistics-form', async (v) => {
  const end = new Date(`${v.to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const params = new URLSearchParams({
    from: new Date(`${v.from}T00:00:00`).toISOString(),
    to: end.toISOString(),
  });
  if (v.location) params.set('location', v.location);
  const result = await api(`/music/management/statistics?${params}`);
  clear('stats');
  for (const [key, title] of [
    ['recordings', '녹음'],
    ['works', '작품'],
    ['artists', '아티스트'],
    ['assets', '파일'],
  ]) {
    const h = document.createElement('h3');
    h.textContent = title;
    $('stats').append(h);
    const data = result[key];
    const max = Math.max(1, ...data.map((x) => x.count));
    if (!data.length) row('stats', '집계된 데이터가 없습니다.');
    data.forEach((x) => {
      row(
        'stats',
        `${x.name || (x.id === null ? '파일 미확인' : `#${x.id}`)} · ${x.count}회`,
      );
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${(x.count / max) * 100}%`;
      bar.append(fill);
      $('stats').append(bar);
    });
  }
});
click('load-public', async () => {
  clear('public-list');
  const result = await api('/music/public/playlists?page=1&limit=100');
  result.items.forEach((p) =>
    row(
      'public-list',
      `#${p.id} · ${p.title} · ${p.trackCount}곡`,
      '열기',
      () => showPublic(p.id),
    ),
  );
});
async function showPublic(id) {
  const result = await api(`/music/public/playlists/${id}`);
  clear('public-items');
  result.tracks.forEach((i) =>
    row(
      'public-items',
      `${i.position}. ${i.track.title} — ${i.track.artist}${i.hasSelectedAudio ? '' : ' (파일 미지정)'}`,
      '재생',
      async () => {
        if (!i.hasSelectedAudio) throw new Error('선택된 파일이 없습니다.');
        const path = result.anonymousPlayable
          ? `/music/public/playlists/${id}/items/${i.id}/content`
          : `/music/playlists/${id}/items/${i.id}/content`;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = '';
        }
        if (result.anonymousPlayable) $('player').src = base() + path;
        else {
          if (!token) throw new Error('로그인이 필요합니다.');
          const response = await fetch(base() + path, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(`재생 실패 (${response.status})`);
          blobUrl = URL.createObjectURL(await response.blob());
          $('player').src = blobUrl;
        }
        await $('player').play();
      },
    ),
  );
}
