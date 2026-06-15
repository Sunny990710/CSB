// Vercel 서버리스 catch-all 함수.
// 파일명이 [[...path]] 이므로 /api/ 아래 모든 경로(/api/health, /api/db 등)가
// 이 함수 하나로 들어오고, 원본 URL 경로가 그대로 보존된다.
// 빌드 단계에서 esbuild가 server.ts를 ./_server.js 로 번들해 둔다.
import serverless from 'serverless-http';
import app from './_server.js';

export default serverless(app);
