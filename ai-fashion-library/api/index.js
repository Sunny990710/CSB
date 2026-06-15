// Vercel 서버리스 함수 진입점.
// 빌드 단계에서 esbuild가 server.ts를 ./_server.js 로 번들해 둔다.
// (같은 api/ 폴더 안에 있으므로 Vercel 함수 번들에 항상 포함된다.)
import serverless from 'serverless-http';
import app from './_server.js';

export default serverless(app);
