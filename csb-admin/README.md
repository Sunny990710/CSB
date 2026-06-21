# CSB 어드민 (`csb-admin`)

디자인 샘플 자산의 **대여·반납·연체**를 관리하고, **마이멜로디 AI 에이전트**가 연체 안내 메일 초안을 단계별 톤으로 자동 작성해 주는 통합 어드민입니다.

- **프론트엔드** · React 19 + Vite + Tailwind v4 (Pretendard)
- **백엔드** · Express + `@google/genai` (Gemini 3.5 Flash), 파일 기반 JSON 스토어
- **AI 기능** · 의류 이미지 분석 자동 등록 / 연체 안내 메일 단계별(gentle·warning·strict) 초안 생성

> AI Studio에서 내보낸 프로젝트를 **로컬 실행 + Git 배포**에 맞게 재구성했습니다.
> 원본 프런트엔드(`src/`)를 그대로 사용하며, 빌드 중 발견된 타입 오류 1건(`RentalManagerView`의 `sendingId` 타입)만 안전하게 바로잡았습니다.

---

## 폴더 구조

```
.
├── server.ts            # Express API + (dev)Vite 미들웨어 / (prod)정적 서빙
├── database.json        # 시드 데이터 (samples / members / groups / rentals)
├── index.html
├── src/
│   ├── main.tsx         # React 진입점
│   ├── App.tsx          # CSB 어드민 셸 · 사이드바 · /api/db 로딩 + 저장
│   ├── index.css        # Tailwind v4 + 폰트(Noto Sans KR / Inter / JetBrains Mono)
│   ├── types.ts         # 도메인 타입
│   └── components/
│       ├── DashboardView.tsx      # 홈 / 통계 차트
│       ├── SampleManagerView.tsx  # 상품관리 · 업로드 · AI 스마트 등록
│       ├── RentalManagerView.tsx  # 대여 · 반납 · AI 연체 안내 메일
│       └── MemberManagerView.tsx  # 임직원 · 부서 권한
├── Dockerfile
├── .env.example
└── package.json
```

---

## 로컬 실행

**사전 준비:** Node.js 20+ 권장

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 설정 (.env.example 복사 후 키 입력)
cp .env.example .env
#    GEMINI_API_KEY="..."  ← https://aistudio.google.com/apikey 에서 발급

# 3) 개발 서버 실행 (http://localhost:3000)
npm run dev
```

`npm run dev` 는 `tsx watch server.ts` 로 Express를 띄우고, Vite를 미들웨어 모드로 붙여 한 포트(3000)에서 API와 화면을 함께 서빙합니다.

> 💡 `GEMINI_API_KEY` 가 없어도 앱은 정상 동작합니다. AI 호출이 실패하면 서버가 **자동으로 한국어 템플릿 fallback** 으로 응답하도록 되어 있습니다.

### 프로덕션 빌드 미리보기

```bash
npm run build     # vite build(→ dist/public) + esbuild(→ dist/server.cjs)
npm start         # NODE_ENV=production 으로 dist/server.cjs 실행
```

---

## Git으로 배포

이 앱은 정적 사이트가 아니라 **상시 구동되는 Node 서버**(JSON 파일 쓰기 + 서버사이드 Gemini 호출)가 필요합니다. 따라서 Vercel 정적 배포가 아닌, Node 런타임/Docker를 지원하는 플랫폼을 사용합니다.

### 1) GitHub에 올리기

```bash
git init
git add .
git commit -m "init: 의류 샘플 대여 관리 시스템"
git branch -M main
git remote add origin https://github.com/<계정>/<레포>.git
git push -u origin main
```

### 2-A) Render (가장 간단)

1. Render → **New → Web Service** → 위 레포 연결
2. Environment: **Docker** (레포의 `Dockerfile` 자동 인식)
3. 환경변수에 `GEMINI_API_KEY` 추가
4. (선택) 데이터 영속화를 위해 **Disk** 를 `/data` 에 마운트하고 환경변수 `DATA_DIR=/data` 설정

> Docker를 쓰지 않으려면 Native Node 환경으로도 가능합니다.
> Build: `npm install && npm run build` / Start: `npm start`

### 2-B) Hugging Face Spaces (Docker SDK)

1. **New Space → Docker → Blank**
2. 레포 파일 push (`git push` 로 Space 레포에 그대로 올리면 됩니다)
3. Space **Settings → Variables and secrets** 에 `GEMINI_API_KEY` 추가
4. `README.md` 상단에 아래 Space 설정 헤더를 넣어 포트를 맞춥니다:

```yaml
---
title: 의류 샘플 대여 관리
sdk: docker
app_port: 3000
---
```

5. (선택) Space에 **Persistent Storage** 를 붙이고 `DATA_DIR=/data` 로 지정하면 재시작 후에도 대여 데이터가 보존됩니다.

> ⚠️ **데이터 영속성 주의** — 무료 컨테이너는 파일시스템이 휘발성이라 재시작 시 `database.json` 변경분이 초기화됩니다. 운영 데이터를 보존하려면 위처럼 `DATA_DIR` 을 영구 디스크에 연결하세요. 컨테이너는 최초 기동 시 번들된 `database.json` 을 `DATA_DIR` 로 자동 시드합니다.

---

## 환경변수

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI 기능 사용 시 | Gemini 이미지 분석·메일 초안 생성용 키 |
| `PORT` | 아니오 | 리슨 포트 (기본 3000, Render/HF가 자동 주입) |
| `DATA_DIR` | 아니오 | `database.json` 을 둘 영구 디렉터리 (기본: 프로젝트 루트) |

---

## 주요 API

| 메서드 · 경로 | 설명 |
| --- | --- |
| `GET /api/db` | 전체 데이터 조회 |
| `POST /api/rentals/borrow` | 대여 처리 |
| `POST /api/rentals/return` | 반납 처리 |
| `POST /api/agent/analyze-image` | 의류 이미지 → 메타데이터 분석 |
| `POST /api/samples/bulk-create-from-ai` | AI 분석 결과로 샘플 일괄 등록 |
| `POST /api/agent/draft-email` | 연체 안내 메일 초안 생성 |
| `POST /api/agent/send-email` | 발송 이력 기록 + 상태 갱신 |
