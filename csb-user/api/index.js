// Vercel 서버리스 함수 진입점.
// Express app 자체가 (req, res) 핸들러이므로 serverless-http 래퍼 없이 직접 넘긴다.
// vercel.json의 rewrite가 /api/* 전체를 이 함수로 보내고,
// 원본 URL(/api/health 등)이 보존되어 server.ts의 라우트가 매칭된다.
// 빌드 단계에서 esbuild가 server.ts를 ./_server.js 로 번들해 둔다.
import app from './_server.js';

export default app;
