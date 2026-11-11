# 학습 사이트 관리 가이드 (docs/html)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 이 폴더는 `docs/`의 md 문서로 만든 **학습용 웹사이트 스냅샷**입니다. 내용을 고칠 때는 원본 md만 수정합니다. 이 폴더의 `.html`은 직접 고치지 않습니다.

## 1. 원칙

| 원칙 | 내용 |
| --- | --- |
| **md가 원본** | 문서 내용은 언제나 `docs/**/*.md`(그리고 루트의 `README.md`, `API_EXAMPLES.md`)에서 고칩니다 |
| **HTML은 스냅샷** | 평소에는 md만 수정합니다. 원하는 시점에 `npm run docs:html`을 실행하면 **그때의 md 전체**로 사이트를 새로 만듭니다 |
| **독립 실행** | 서버나 인터넷 없이 `docs/html/index.html`을 브라우저로 열면 동작합니다(검색 포함) |
| **사이트 관련 파일은 모두 이 폴더에** | 생성기, 설정, 템플릿, 스타일, 이 문서, 생성 결과가 `docs/html/` 아래에 있습니다 |
| **깨진 링크는 만들지 않음** | 내부 링크나 앵커가 틀리면 생성이 실패하고 기존 스냅샷은 그대로 남습니다 |

## 2. 여는 방법

```bash
open docs/html/index.html                    # macOS (Windows: start, Linux: xdg-open)
# 또는 로컬 서버로
python3 -m http.server 8080 -d docs/html     # http://localhost:8080
```

- 왼쪽: 섹션별 문서 목록(학습 순서). 읽은 문서에는 ✓가 붙습니다.
- 위: 검색(`/` 키). 제목, 소제목, 본문을 모두 찾습니다.
- 오른쪽: 이 페이지 목차(넓은 화면)
- 페이지 위 `읽음` 체크와 홈의 진도 막대는 **이 브라우저에만** 저장됩니다(localStorage). 다른 PC나 브라우저와 공유되지 않습니다.
- ◐ 버튼: 라이트/다크 테마

## 3. 폴더 구조

```text
docs/html/
├─ README.md                ← 이 문서(원본). 사이트의 "사이트 관리" 페이지가 됨
├─ _tools/                  ← 원본: 여기만 고칩니다
│  ├─ build.mjs             ← 생성기(Node 24, ESM). 의존성은 devDependency marked 하나
│  ├─ site.config.json      ← 사이트 제목, 섹션과 페이지 순서
│  ├─ template.html         ← 모든 페이지의 공통 레이아웃
│  └─ assets/
│     ├─ site.css           ← 스타일(라이트/다크 토큰)
│     └─ site.js            ← 검색, 테마, 읽음 표시, 코드 복사, 목차 강조
│
│  ─ 아래는 모두 생성물(npm run docs:html이 지우고 다시 만듦) ─
├─ index.html               ← docs/README.md + 학습 경로 카드
├─ site-maintenance.html    ← 이 문서
├─ learning/ audit/ auth/ deployment/ product/ music/   ← docs/와 같은 상대 경로의 .html
├─ repo/README.html, repo/API_EXAMPLES.html             ← 저장소 루트 문서
├─ assets/                  ← _tools/assets 복사본 + search-index.js(검색 색인)
└─ build-info.json          ← 스냅샷 정보: 시각, 브랜치, 커밋, 원본 md별 sha256
```

원본 경로와 출력 경로의 대응:

| 원본 | 출력 |
| --- | --- |
| `docs/README.md` | `index.html` |
| `docs/html/README.md` | `site-maintenance.html` |
| `docs/<경로>.md` | `<경로>.html` |
| 저장소 루트 `<파일>.md` | `repo/<파일>.html` |

## 4. 명령

| 명령 | 하는 일 | 파일 변경 |
| --- | --- | --- |
| `npm run docs:html:status` | 마지막 스냅샷 이후 **수정·추가·삭제된 md** 목록. 실패하지 않음 | 없음 |
| `npm run docs:html:verify` | 모든 md를 변환해 보고 링크·앵커·설정을 검사. 오류가 있으면 실패 | 없음 |
| `npm run docs:html` | verify를 통과하면 생성물을 지우고 스냅샷을 새로 만듦 | `docs/html/`의 생성물 |

CI(`verify` job)는 `docs:html:verify`만 실행합니다. **md의 링크 무결성은 매 PR 검사하지만, HTML 스냅샷 갱신은 강제하지 않습니다.**

## 5. 언제, 어떻게 갱신하나

**갱신 시점 예시**

- 릴리스(develop → main) 직전
- 감사, 학습 가이드처럼 큰 문서 작업을 마친 뒤
- 공부하기 전에 최신 상태로 보고 싶을 때

**절차**

1. md를 수정하고 커밋합니다. 스냅샷은 커밋 기준으로 기록되므로 커밋 후 생성하는 것이 좋습니다. 미커밋 변경이 있으면 사이트에 "커밋되지 않은 변경 포함"이 표시됩니다.
2. 무엇이 바뀌었는지 확인합니다.
   ```bash
   npm run docs:html:status
   ```
3. 스냅샷을 만듭니다.
   ```bash
   npm run docs:html
   ```
   `ERROR`가 나오면 생성물은 바뀌지 않습니다. 메시지에 적힌 md를 고친 뒤 다시 실행합니다([8장](#8-문제-해결)).
4. 브라우저로 열어 확인합니다(홈, 바뀐 페이지, 검색).
5. 생성물만 따로 커밋합니다.
   ```bash
   git add docs/html
   git commit -m "docs(html): snapshot $(date +%F)"
   ```
6. `npm run docs:html:status`가 "변경 없음"인지 확인합니다.

## 6. 문서를 추가·이동·삭제할 때

**새 문서 추가**

1. md를 씁니다. 상단에 `> 최신화 기준: YYYY-MM-DD · <branch> <commit>`을 적습니다(사이트에 배지로 표시됨). 고정된 기록이면 `> 이력 문서 — 기준 시점 YYYY-MM-DD`로 시작합니다.
2. `_tools/site.config.json`의 알맞은 섹션 `pages`에 추가합니다. 배열 순서가 사이드바와 이전/다음 순서입니다.
   ```json
   { "src": "docs/learning/new-guide.kr.md", "desc": "홈 카드에 표시할 한 줄 설명(선택)" }
   ```
   - config에 넣지 않은 `docs/*.md`도 사이트에 들어가지만 "기타 문서"로 분류되고 `WARN`이 출력됩니다.
3. 관련 문서(학습 로드맵, docs 인덱스)에서 새 문서로 링크합니다.
4. `npm run docs:html:verify` → 필요하면 `npm run docs:html`

**이동·이름 변경·삭제**

- md의 링크를 함께 고칩니다. 깨진 링크는 verify가 파일과 위치를 알려 줍니다.
- `site.config.json`의 `src`도 고칩니다. 없는 파일을 가리키면 오류입니다.
- 스냅샷을 다시 만들면 옛 페이지는 자동으로 지워집니다(생성물 전체를 다시 만들기 때문).

## 7. 링크 규칙

| md에 쓴 링크 | 사이트에서 |
| --- | --- |
| 다른 md (`../learning/x.kr.md#앵커`) | 해당 `.html`로 바뀜. 앵커가 그 문서에 없으면 **오류** |
| 같은 문서 앵커 (`#3-명령`) | 그대로. 없으면 **오류** |
| 저장소의 코드·설정 파일 (`../../src/main.ts`) | 스냅샷 커밋의 GitHub 링크(↗ 표시). 파일이 없으면 **오류** |
| 외부 URL (`https://…`) | 새 탭으로 열림. 검사하지 않음 |
| 저장소 밖 경로 | **오류** |

- 앵커는 GitHub과 같은 규칙으로 만듭니다: 소문자로 바꾸고, 문자·숫자·`-`·`_`·공백만 남긴 뒤 공백을 `-`로 바꿉니다. 같은 제목이 반복되면 `-1`, `-2`가 붙습니다.
  - 예: `## 4. 적용 방식 비교: 직접 SQL / 명령 / 기동 시 자동` → `#4-적용-방식-비교-직접-sql--명령--기동-시-자동`
- 그래서 GitHub에서 md로 볼 때와 사이트에서 볼 때 같은 링크가 모두 동작합니다.

## 8. 문제 해결

| 메시지 | 원인 | 조치 |
| --- | --- | --- |
| `ERROR <md>: #<앵커> 앵커가 <대상>에 없습니다` | 제목을 바꿨거나 앵커 철자가 다름 | 대상 문서의 제목을 보고 7장 규칙으로 앵커를 고침 |
| `ERROR <md>: <링크> 링크의 대상(<경로>)이 없습니다` | 파일 이동·삭제, 상대 경로 오류 | 경로를 고침 |
| `ERROR site.config.json: <src> 파일이 없습니다` | config의 경로가 틀림 | `src`를 고침 |
| `ERROR template.html: {{x}} 값이 없습니다` | 템플릿에 생성기가 모르는 자리표시자가 있음 | 템플릿이나 `build.mjs`의 `values`를 맞춤 |
| `WARN <md>가 site.config.json에 없어…` | 새 md를 config에 넣지 않음 | 6장대로 config에 추가 |
| 사이트에 "커밋되지 않은 변경 포함" | 미커밋 md로 생성 | 커밋 후 다시 생성 |
| 검색 결과가 오래됨 | 스냅샷을 다시 만들지 않음 | `npm run docs:html` |

## 9. 디자인 수정

- 레이아웃: `_tools/template.html`. 자리표시자는 `{{이름}}` 형식이며, 값은 `build.mjs`의 `writeSite()`에서 채웁니다.
  - 주요 값: `{{content}}`(본문), `{{nav}}`(사이드바), `{{toc}}`(목차), `{{pageMeta}}`(배지·읽음 체크), `{{prevNext}}`, `{{root}}`(사이트 루트까지의 상대 경로), `{{snapshotDate}}`·`{{snapshotCommit}}`
- 색과 글꼴: `_tools/assets/site.css` 상단의 변수(`--bg`, `--text`, `--accent` …). 다크 테마는 같은 변수를 다시 정의합니다.
- 동작: `_tools/assets/site.js`. 외부 요청(fetch)을 쓰지 않아야 `file://`에서도 동작합니다.
- 수정한 뒤에는 `npm run docs:html`로 다시 만들어 확인합니다.

## 10. 주의

- **공개 저장소입니다.** 생성물도 공개되므로 원본 md와 같은 규칙을 따릅니다. 실제 서버 주소, 포트, 계정, 비밀번호는 쓰지 않고 `<dev-db-host>` 같은 자리표시자를 씁니다.
- 생성물(`.html`, `assets/`, `build-info.json`)을 손으로 고치면 다음 스냅샷에서 사라집니다.
- GitHub 웹에서는 `.html`이 렌더링되지 않습니다. GitHub에서 읽을 때는 md를, 학습할 때는 이 사이트를 씁니다. GitHub Pages로 공개하려면 별도 workflow가 필요하며, 지금은 설정하지 않았습니다.

## 11. 결정 기록 (2026-11-09)

| 결정 | 이유 |
| --- | --- |
| md를 원본으로 두고 HTML은 원할 때 스냅샷으로 생성 | 사용자 요청. 내용이 한곳에만 있어 두 벌을 맞출 필요가 없음 |
| 사이트 관련 파일을 모두 `docs/html/` 아래에 | 사용자 요청. 사이트를 지우거나 옮길 때 폴더 하나만 다루면 됨 |
| CI는 링크 검사만, 스냅샷 동기화는 강제하지 않음 | 스냅샷 시점은 사람이 정함. 대신 md 링크가 깨지는 것은 매 PR 막음 |
| marked(devDependency) + 자체 앵커 규칙 | 표, 체크박스 같은 GFM 지원. 앵커를 GitHub과 같게 만들어 기존 md 링크를 그대로 사용 |
| 검색 색인을 JS 파일로 생성 | `file://`에서는 fetch가 막히므로 스크립트로 불러옴 |
| 읽음 표시는 localStorage | 개인 학습용 편의 기능. 저장이 막혀도 사이트는 정상 동작 |

## 12. 갱신 체크리스트

- [ ] md 수정과 커밋을 마쳤다
- [ ] `npm run docs:html:status`로 바뀐 문서를 확인했다
- [ ] 새 문서는 `site.config.json`에 넣었다
- [ ] `npm run docs:html`이 `OK`로 끝났다
- [ ] 홈, 바뀐 페이지, 검색, 다크 테마를 브라우저로 확인했다
- [ ] `docs(html): snapshot YYYY-MM-DD`로 생성물만 커밋했다
