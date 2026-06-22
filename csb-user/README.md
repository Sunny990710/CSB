# CSB 사용자 포털 (`csb-user`)

`csb-admin`(어드민)와 **같은 층위**에 있는 임직원용 사용자 앱입니다.  
동일한 디자인 토큰·타입·데이터베이스를 공유합니다.

## 프로젝트 구조

```
CSB/              ← 저장소 루트
├── csb-admin/    ← 어드민 (포트 3000)
└── csb-user/     ← 사용자 (포트 3001)
```

## 실행

```bash
# 1) 사용자 포털
cd csb-user
cp .env.example .env
npm install
npm run dev
# → http://localhost:3001

# 2) (선택) 어드민도 함께
cd ../csb-admin
npm run dev
# → http://localhost:3000
```

`csb-user`는 기본적으로 **`../csb-admin/database.json`** 을 읽고 씁니다.  
어드민과 사용자가 **같은 대여 데이터**를 공유합니다.

## 화면

| 컴포넌트 | 기능 |
| --- | --- |
| `UserHomeView` | 샘플 카탈로그 · 검색/필터 · 보관함 |
| `SampleDetailModal` | 상세 · AI 태그 · 비슷한 샘플 |
| `UserLockerView` | 내 보관함 |
| `UserRentalView` | 바코드 대여/반납 · 전자서명 |
| `UserRentalStatusView` | 대여 현황 요약 |
| `RentalCompleteView` | 대여 완료 |

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3001` | 사용자 포털 포트 |
| `DATA_DIR` | `../csb-admin` | 공유 DB 폴더 |

## Vercel 배포

1. Vercel에서 **새 프로젝트**를 만들고 GitHub `CSB` 저장소를 연결합니다.
2. **Root Directory** → `csb-user`
3. 어드민(`csb-admin`)과 **같은 Blob 스토어**를 Connect하면 두 앱이 동일 DB를 공유합니다.
4. `vercel.json`이 빌드 시 `../csb-admin/database.json`을 시드로 복사합니다.

| 항목 | 어드민 | 사용자 |
| --- | --- | --- |
| Root Directory | `csb-admin` | `csb-user` |
| 포트 (로컬) | 3000 | 3001 |
