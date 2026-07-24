# 내 바운더리

집·직장 등 생활권 안의 장소를 테마별로 모으고, 지도·목록·메모를 한 화면에서 관리하는 개인 지도 작업실 프로토타입입니다.

- 배포본: [내 바운더리](https://my-boundary-seoul.workspace-014887.chatgpt.site/)
- 지도: MapLibre GL + OpenFreeMap
- 기본 스타일: Positron
- 비교 스타일: Bright
- 지도 API 키: 필요 없음

## 주요 기능

- 집·직장 바운더리 전환과 반경 조절
- 테마별 장소 필터와 지도 핀 표시
- 지도 핀·장소 목록·상세 패널 동기화
- 자연어 요청을 해석하는 AI 북마크 데모
- AI 후보 미리보기, 제외, 테마 변경 후 북마크 확정
- 장소별 별점·방문 상태·개인 메모
- 지도 전체 노트와 장소 멘션
- 모바일 `지도 / 목록 / 노트` 탭
- 브라우저 저장소를 이용한 데이터 유지와 샘플 데이터 초기화

> 현재 AI 추천은 프로토타입용 샘플 동작입니다. 실제 AI API와 장소 검색 API는 연결되어 있지 않습니다.

## 기술 구성

- Node.js 22 이상
- React 19
- Next.js 16 호환 구조
- vinext + Vite
- TypeScript
- MapLibre GL
- OpenFreeMap Positron / Bright 스타일
- Cloudflare Workers 호환 런타임

## 새 컴퓨터에서 시작하기

### 1. 프로젝트 압축 해제

ZIP 파일을 원하는 폴더에 압축 해제한 뒤 터미널에서 해당 폴더로 이동합니다.

### 2. Node.js와 pnpm 준비

[Node.js](https://nodejs.org/) 22.13 이상을 설치한 후 pnpm을 활성화합니다.

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 3. 의존성 설치

```bash
pnpm install --frozen-lockfile
```

### 4. 개발 서버 실행

macOS 또는 Linux:

```bash
pnpm dev
```

Windows PowerShell:

```powershell
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
pnpm exec vinext dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 엽니다.

## 검사와 빌드

macOS 또는 Linux:

```bash
pnpm lint
pnpm test
```

Windows PowerShell:

```powershell
pnpm exec eslint . --ignore-pattern dist --ignore-pattern .next
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
pnpm exec vinext build
node --test tests/rendered-html.test.mjs
```

## 프로젝트 구조

```text
app/
  BoundaryStudio.tsx   핵심 지도 작업실 UI와 상태 관리
  globals.css          전체 스타일과 반응형 레이아웃
  layout.tsx           페이지 메타데이터와 공통 레이아웃
  page.tsx             메인 페이지 진입점
public/
  og.png               링크 미리보기 이미지
tests/
  rendered-html.test.mjs
worker/
  index.ts             Cloudflare Worker 진입점
db/                    향후 D1 연동을 위한 기본 구조
drizzle/               데이터베이스 마이그레이션 메타데이터
```

## 지도 스타일

지도는 별도 계정이나 API 키 없이 OpenFreeMap의 공개 스타일을 불러옵니다.

- Positron: 차분하고 정보 밀도가 낮아 기본 작업 지도에 적합
- Bright: 도로와 지역 구분이 더 선명해 비교용으로 적합

스타일 설정은 `app/BoundaryStudio.tsx`의 `MAP_PROVIDERS`에서 변경할 수 있습니다.

## 데이터 저장 방식

북마크와 메모는 서버가 아닌 각 브라우저의 `localStorage`에 저장됩니다.

- 소스 코드를 다른 컴퓨터로 옮겨도 기존 컴퓨터의 북마크와 메모는 자동 이전되지 않습니다.
- 브라우저 데이터 삭제 또는 샘플 데이터 초기화 시 저장 내용이 사라질 수 있습니다.
- 계정 기반 동기화가 필요하면 서버 DB 또는 Cloudflare D1 연동이 필요합니다.

## 배포

프로젝트에는 현재 ChatGPT Sites 프로젝트를 가리키는 `.openai/hosting.json`이 포함되어 있습니다. 같은 계정과 권한이 있는 Codex 환경에서는 기존 사이트에 새 버전을 배포할 수 있습니다.

GitHub, Cloudflare 또는 다른 서비스로 이전할 때는 해당 서비스의 저장소·빌드·배포 설정을 새로 연결하세요. `.env` 파일, API 키, 접근 토큰은 저장소나 ZIP에 포함하지 않는 것을 권장합니다.

## 현재 제외 범위

- 실제 AI 및 장소 검색 API
- 회원가입과 클라우드 동기화
- 지도 공유와 공동 편집
- 길찾기와 이동시간 기반 바운더리
