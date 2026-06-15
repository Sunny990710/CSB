// Vercel 서버리스 함수 진입점.
// server.ts의 Express 앱을 serverless-http로 감싸서 그대로 재사용한다.
// 프론트엔드 코드는 한 줄도 고칠 필요가 없다 (여전히 /api/... 로 호출).
import serverless from 'serverless-http';
import app from '../server';

export default serverless(app);
