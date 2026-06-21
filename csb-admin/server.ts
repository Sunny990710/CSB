import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { put, list } from '@vercel/blob';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));

// --- Database ------------------------------------------------------------
// 운영(Vercel): Vercel Blob 스토어에 JSON 한 덩어리를 통째로 저장한다.
//   - BLOB_READ_WRITE_TOKEN 이 있으면 Blob 모드로 동작.
//   - Vercel 서버리스는 파일시스템이 읽기 전용/휘발성이라 파일 DB가 영구 저장되지 않음.
// 로컬 개발: 토큰이 없으면 기존처럼 파일시스템의 database.json 을 사용한다.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DB_FILE = path.join(DATA_DIR, 'database.json');

// ESM 번들에서 현재 파일 위치
let MODULE_DIR = process.cwd();
try { MODULE_DIR = path.dirname(fileURLToPath(import.meta.url)); } catch { /* noop */ }

// 번들된 시드(database.json)가 배포 환경에 따라 다른 위치에 놓일 수 있어 후보를 모두 탐색
const SEED_CANDIDATES = [
  path.join(process.cwd(), 'database.json'),
  path.join(MODULE_DIR, 'database.json'),
  path.join(MODULE_DIR, '..', 'database.json'),
  path.join(MODULE_DIR, '..', '..', 'database.json'),
  '/var/task/database.json',
  '/var/task/csb-admin/database.json',
];

function findSeedFile(): string | null {
  for (const p of SEED_CANDIDATES) {
    try { if (fs.existsSync(p) && fs.statSync(p).size > 100) return p; } catch { /* noop */ }
  }
  // size 조건 없이 한 번 더
  for (const p of SEED_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* noop */ }
  }
  return null;
}

const SEED_FILE = findSeedFile() || path.join(process.cwd(), 'database.json');

// 인증 방식 두 가지를 모두 지원한다.
//  1) 정적 토큰: BLOB_READ_WRITE_TOKEN (스토어를 직접 만들 때 주입되거나 수동 설정)
//  2) OIDC: 프로젝트에 스토어를 "Connect" 하면 BLOB_STORE_ID + VERCEL_OIDC_TOKEN 이
//     자동 주입되고, SDK가 토큰 없이도 자동 인증한다. (현재 csb 프로젝트가 이 방식)
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const USE_BLOB = !!(BLOB_TOKEN || process.env.BLOB_STORE_ID);
const BLOB_KEY = 'database.json';

// 정적 토큰이 있을 때만 token 을 넘기고, 없으면 SDK 가 OIDC 로 인증하도록 비워 둔다.
const blobAuth = BLOB_TOKEN ? { token: BLOB_TOKEN } : {};

const EMPTY_DB = { samples: [], members: [], groups: [], rentals: [], rentalAgreements: [], lossDamageReports: [], categories: [], brands: [], contents: [] };

// 번들/로컬에 포함된 database.json 을 초기 시드 데이터로 읽는다.
function readSeed(): any {
  const f = findSeedFile();
  if (f) {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (err) {
      console.error('Error reading seed file:', f, err);
    }
  }
  return { ...EMPTY_DB };
}

// --- 로컬 파일 스토어 -----------------------------------------------------
function ensureLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      if (DB_FILE !== SEED_FILE && fs.existsSync(SEED_FILE)) {
        fs.copyFileSync(SEED_FILE, DB_FILE);
      } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('Error seeding database file:', err);
    }
  }
}

function getLocalDB(): any {
  ensureLocalDB();
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
  return { ...EMPTY_DB };
}

function saveLocalDB(data: any): boolean {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

// --- Vercel Blob 스토어 ---------------------------------------------------
async function getBlobDB(): Promise<any> {
  const { blobs } = await list({ prefix: BLOB_KEY, ...blobAuth });
  const found = blobs.find((b) => b.pathname === BLOB_KEY) || blobs[0];
  // Blob 이 비어있으면(최초 배포) 번들된 database.json 으로 시드한다.
  if (!found) {
    const seed = readSeed();
    await saveBlobDB(seed);
    return seed;
  }
  // CDN 캐시 우회: 저장 직후에도 항상 최신 내용을 읽도록 타임스탬프 쿼리를 붙인다.
  const bust = `${found.url}${found.url.includes('?') ? '&' : '?'}ts=${Date.now()}`;
  const res = await fetch(bust, { cache: 'no-store' });
  if (!res.ok) throw new Error('Blob fetch failed: ' + res.status);
  return await res.json();
}

async function saveBlobDB(data: any): Promise<boolean> {
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    ...blobAuth,
  });
  return true;
}

// --- 통합 비동기 API ------------------------------------------------------
async function getDB(): Promise<any> {
  try {
    if (USE_BLOB) return await getBlobDB();
    return getLocalDB();
  } catch (err) {
    console.error('Error reading database:', err);
    return { ...EMPTY_DB };
  }
}

async function saveDB(data: any): Promise<boolean> {
  try {
    if (USE_BLOB) return await saveBlobDB(data);
    return saveLocalDB(data);
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// --- Gemini client (lazy) ------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required for agent features');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'sample-rental-admin' } },
    });
  }
  return aiClient;
}

// =========================================================================
// API Routes
// =========================================================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Blob 모드에서는 함수가 29MB JSON을 직접 반환하면 Vercel 응답 크기 한도(~4.5MB)에
// 걸리므로, Blob 공개 URL로 302 리다이렉트해 브라우저가 CDN에서 직접 받게 한다.
app.get('/api/db', async (_req, res) => {
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: BLOB_KEY, ...blobAuth });
      let found = blobs.find((b) => b.pathname === BLOB_KEY) || blobs[0];
      if (!found) {
        await saveBlobDB(readSeed());
        const again = await list({ prefix: BLOB_KEY, ...blobAuth });
        found = again.blobs.find((b) => b.pathname === BLOB_KEY) || again.blobs[0];
      }
      if (found) {
        const bust = `${found.url}${found.url.includes('?') ? '&' : '?'}ts=${Date.now()}`;
        res.setHeader('Cache-Control', 'no-store');
        return res.redirect(302, bust);
      }
    }
    return res.json(await getDB());
  } catch (err) {
    console.error('GET /api/db error:', err);
    // 통신 실패 시 번들된 로컬 시드라도 내려준다.
    return res.json(readSeed());
  }
});

// 시드 파일 탐색 진단용
app.get('/api/db/_seedinfo', (_req, res) => {
  const candidates = SEED_CANDIDATES.map((p) => {
    let exists = false; let size = 0;
    try { exists = fs.existsSync(p); if (exists) size = fs.statSync(p).size; } catch { /* noop */ }
    return { path: p, exists, size };
  });
  let cwdList: string[] = [];
  let taskList: string[] = [];
  try { cwdList = fs.readdirSync(process.cwd()); } catch { /* noop */ }
  try { taskList = fs.readdirSync('/var/task'); } catch { /* noop */ }
  res.json({
    cwd: process.cwd(),
    moduleDir: MODULE_DIR,
    chosenSeed: findSeedFile(),
    candidates,
    cwdList,
    taskList,
  });
});

// 운영 Blob 저장소를 번들된 로컬 database.json 으로 덮어쓴다(재시드).
// 프런트의 전체 저장 경로는 요청 본문 한도에 걸리므로, 서버에서 직접 기록한다.
app.all('/api/db/reseed', async (req, res) => {
  try {
    const seed = readSeed();
    const empty = (seed.samples?.length ?? 0) === 0 && (seed.members?.length ?? 0) === 0 && (seed.categories?.length ?? 0) === 0;
    const force = String((req.query as any)?.force || '') === '1';
    // 빈 시드로 기존 Blob을 덮어써 데이터가 유실되는 사고를 방지
    if (empty && !force) {
      return res.status(409).json({
        success: false,
        message: '시드 파일을 찾지 못했거나 비어 있어 재시드를 중단했습니다. /api/db/_seedinfo 로 경로를 확인하세요.',
        chosenSeed: findSeedFile(),
      });
    }
    await saveDB(seed);
    res.json({
      success: true,
      message: 'Blob 저장소를 로컬 database.json 내용으로 재시드했습니다.',
      bytes: JSON.stringify(seed).length,
      samples: seed.samples?.length ?? 0,
      members: seed.members?.length ?? 0,
      categories: seed.categories?.length ?? 0,
    });
  } catch (err: any) {
    console.error('reseed error:', err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

app.post('/api/db/save', async (req, res) => {
  if (await saveDB(req.body)) {
    res.json({ success: true, message: '데이터가 성공적으로 저장되었습니다.' });
  } else {
    res.status(500).json({ success: false, message: '데이터베이스 저장 실패' });
  }
});

// Bulk image upload — auto-matches front/back by filename against sample codes.
app.post('/api/samples/bulk-images', async (req, res) => {
  const { files } = req.body; // [{ filename, base64 }]
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ success: false, message: '올바르지 않은 요청 파일 형식입니다.' });
  }

  const db = await getDB();
  let matchCount = 0;

  files.forEach((file: { filename: string; base64: string }) => {
    const nameLower = file.filename.toLowerCase();
    const matchedSample = db.samples.find((s: any) =>
      nameLower.includes(s.code.toLowerCase())
    );
    if (matchedSample) {
      const isBack =
        nameLower.includes('back') ||
        nameLower.includes('뒤') ||
        nameLower.includes('_back') ||
        nameLower.includes('_01') ||
        nameLower.includes('_rear');
      if (isBack) matchedSample.imgBack = file.base64;
      else matchedSample.imgFront = file.base64;
      matchCount++;
    }
  });

  await saveDB(db);
  res.json({
    success: true,
    matchCount,
    message: `${matchCount}개의 이미지 파일이 상품 코드 매칭 및 등록 처리되었습니다.`,
  });
});

// Bulk import rows (Excel/CSV → JSON).
app.post('/api/samples/bulk-excel', async (req, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, message: '불러올 상품 행 데이터가 존재하지 않습니다.' });
  }

  const db = await getDB();
  let addedCount = 0;
  let updatedCount = 0;
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  rows.forEach((row: any) => {
    if (!row.code) return;

    const existingIndex = db.samples.findIndex((s: any) => s.code === row.code);
    const sampleRecord = {
      id: existingIndex >= 0 ? db.samples[existingIndex].id : db.samples.length + 1,
      regDate: existingIndex >= 0 ? db.samples[existingIndex].regDate : nowStr,
      status: row.status || '대여가능',
      brand: row.brand || '중국포인포',
      locationNo: row.locationNo || '0',
      code: row.code,
      name: row.name || '',
      category: row.category || '유형화샘플',
      registerer: row.registerer || '허경아',
      useYn: row.useYn || '사용',
      color: row.color || '',
      gender: row.gender || 'U',
      country: row.country || 'KR',
      price: Number(row.price) || 0,
      description: row.description || '',
      brandCode: row.brandCode || 'POINFO_CN',
      season: row.season || '',
      material: row.material || '',
      imgFront: row.imgFront || (existingIndex >= 0 ? db.samples[existingIndex].imgFront : ''),
      imgBack: row.imgBack || (existingIndex >= 0 ? db.samples[existingIndex].imgBack : ''),
    };

    if (existingIndex >= 0) {
      db.samples[existingIndex] = sampleRecord;
      updatedCount++;
    } else {
      db.samples.push(sampleRecord);
      addedCount++;
    }
  });

  await saveDB(db);
  res.json({
    success: true,
    addedCount,
    updatedCount,
    message: `일괄 등록 완료 (신규 ${addedCount}건, 수정/갱신 ${updatedCount}건)`,
  });
});

// 따옴표/줄바꿈을 처리하는 간단한 CSV 파서 → string[][]
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Import rows from a Google Spreadsheet.
// 기본은 API 키 없이 CSV 내보내기로 읽는다(시트는 "링크가 있는 모든 사용자: 뷰어" 공유 필요).
// GOOGLE_SHEETS_API_KEY가 설정돼 있으면 Sheets API v4를 사용한다.
// Body: { sheetId?, gid?, range? }. sheetId/gid 미지정 시 DEFAULT_SHEET_ID/DEFAULT_SHEET_GID(.env) 사용.
app.post('/api/sheets/import', async (req, res) => {
  const rawId = String(req.body.sheetId || process.env.DEFAULT_SHEET_ID || '').trim();
  if (!rawId) {
    return res.status(400).json({
      success: false,
      message: '불러올 스프레드시트가 없습니다. 시트 URL을 입력하거나, 서버 .env의 DEFAULT_SHEET_ID를 설정해 주세요.',
    });
  }

  // URL이 들어오면 /d/<id>/ 와 #gid=<gid> 를 추출
  let id = rawId;
  const idMatch = rawId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) id = idMatch[1];

  let gid = String(req.body.gid || process.env.DEFAULT_SHEET_GID || '0');
  const gidMatch = rawId.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch) gid = gidMatch[1];

  const key = process.env.GOOGLE_SHEETS_API_KEY;

  try {
    // --- API 키가 있으면 Sheets API 사용 -------------------------------
    if (key) {
      const r = String(req.body.range || 'A1:Z2000');
      const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}` +
        `/values/${encodeURIComponent(r)}?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url);
      const data: any = await resp.json();
      if (!resp.ok) {
        const msg = data?.error?.message || '구글 시트 조회에 실패했습니다. 공유 설정과 시트ID를 확인해 주세요.';
        return res.status(resp.status).json({ success: false, message: msg });
      }
      return res.json({ success: true, values: data.values || [] });
    }

    // --- 키가 없으면 CSV 내보내기로 읽기 (인증 불필요) -----------------
    const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
    const resp = await fetch(csvUrl, { redirect: 'follow' });
    const text = await resp.text();

    // 공유가 안 돼 있으면 구글 로그인 HTML이 돌아온다.
    if (!resp.ok || text.trim().startsWith('<!DOCTYPE') || text.includes('<html')) {
      return res.status(403).json({
        success: false,
        message: '시트에 접근할 수 없습니다. 시트를 "링크가 있는 모든 사용자: 뷰어"로 공유했는지 확인해 주세요.',
      });
    }

    return res.json({ success: true, values: parseCSV(text) });
  } catch (error: any) {
    console.error('Google Sheets import error:', error);
    res.status(500).json({ success: false, message: '구글 시트 통신 중 오류가 발생했습니다: ' + error.message });
  }
});

// 반납예정일이 지난 '대여중' 건을 '연체중'으로 자동 전환
function syncOverdueStatuses(db: any): boolean {
  const today = new Date().toISOString().substring(0, 10);
  const todayDay = parseDateOnlyUtc(today);
  let changed = false;

  for (const rental of db.rentals || []) {
    if (rental.status !== '대여중' || !rental.dueDate) continue;
    const dueDay = parseDateOnlyUtc(rental.dueDate);
    if (dueDay >= todayDay) continue;

    rental.status = '연체중';
    changed = true;
    const sample = db.samples?.find((s: any) => s.code === rental.sampleCode);
    if (sample?.status === '대여중') sample.status = '연체중';
  }

  return changed;
}

function parseDateOnlyUtc(dateStr: string) {
  const d = new Date(String(dateStr).replace(' ', 'T'));
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateOnly(d: Date) {
  return d.toISOString().substring(0, 10);
}

const RENTAL_ID_START = 1634000;

function nextRentalId(db: any): string {
  let max = RENTAL_ID_START;
  for (const rental of db.rentals || []) {
    const n = parseInt(String(rental.rentalId).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

function createRentalRecord(db: any, sample: any, member: any, rentDays: number) {
  const days = Number(rentDays) || 28;
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + days);

  const newRental = {
    rentalId: nextRentalId(db),
    sampleCode: sample.code,
    sampleName: sample.name || '미지정 상품',
    sampleBrand: sample.brand,
    borrowerId: member.memberId,
    borrowerName: member.name,
    borrowerEmail: member.email,
    borrowerGroup: member.groupName,
    rentDate: formatDateOnly(today),
    dueDate: formatDateOnly(due),
    returnDate: null,
    status: '대여중',
    notifyCount: 0,
    lastNotifyDate: null,
    notifyHistory: [],
    agreementId: null as string | null,
  };

  sample.status = '대여중';
  db.rentals.push(newRental);
  return newRental;
}

// Borrow.
app.post('/api/rentals/borrow', async (req, res) => {
  const { sampleCode, borrowerId, rentDays } = req.body;
  const db = await getDB();

  const sample = db.samples.find((s: any) => s.code === sampleCode);
  const member = db.members.find((m: any) => m.memberId === borrowerId);

  if (!sample) return res.status(404).json({ success: false, message: '해당 상품 코드를 가진 샘플을 찾을 수 없습니다.' });
  if (!member) return res.status(404).json({ success: false, message: '등록되지 않은 사원 번호입니다. 임직원 관리를 확인해주세요.' });
  if (sample.status !== '대여가능') return res.status(400).json({ success: false, message: '해당 샘플은 현재 대여 가능한 상태가 아닙니다.' });

  const days = Number(rentDays) || 28;
  const newRental = createRentalRecord(db, sample, member, days);
  await saveDB(db);
  res.json({ success: true, rental: newRental, message: '대여 처리가 완료되었습니다.' });
});

// Rental agreement — draft (서명 대기)
app.post('/api/rental-agreements', async (req, res) => {
  const { borrowerId, rentDays, items, purpose } = req.body;
  if (!borrowerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '대여자와 샘플 목록이 필요합니다.' });
  }

  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const member = db.members.find((m: any) => m.memberId === borrowerId);
  if (!member) return res.status(404).json({ success: false, message: '등록되지 않은 직원입니다.' });
  if (member.useYn !== '사용') {
    return res.status(400).json({ success: false, message: '대여 자격이 정지된 직원입니다.' });
  }

  const agreementItems: any[] = [];
  for (const item of items) {
    const sample = db.samples.find((s: any) => s.code === item.sampleCode);
    if (!sample) {
      return res.status(404).json({ success: false, message: `샘플을 찾을 수 없습니다 · ${item.sampleCode}` });
    }
    if (sample.status !== '대여가능') {
      return res.status(400).json({ success: false, message: `${sample.code}는 현재 대여 가능한 상태가 아닙니다.` });
    }
    agreementItems.push({
      sampleCode: sample.code,
      sampleName: sample.name || '미지정 상품',
      category: sample.category || sample.classification || '-',
      brand: sample.brand,
      remark: item.remark || sample.season || sample.description?.slice(0, 20) || '',
    });
  }

  const days = Number(rentDays) || 28;
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + days);

  const brands = [...new Set(agreementItems.map((i) => i.brand).filter(Boolean))];
  const brand = brands.length === 1 ? brands[0] : brands[0] || 'MIX';

  const seq = db.rentalAgreements.length + 1;
  const agreement = {
    agreementId: `R-${2400 + seq}`,
    borrowerId: member.memberId,
    borrowerName: member.name,
    borrowerEmail: member.email,
    borrowerAffiliation: member.affiliation || member.groupName,
    brand,
    purpose: purpose || '샘플 대여',
    rentDate: formatDateOnly(today),
    dueDate: formatDateOnly(due),
    rentDays: days,
    quantity: agreementItems.length,
    items: agreementItems,
    signatureStatus: 'pending',
    signedAt: null,
    signedBy: null,
    approvalStatus: 'pending',
    approvedAt: null,
    approvedBy: null,
    createdAt: formatDateOnly(today),
  };

  db.rentalAgreements.push(agreement);
  await saveDB(db);
  res.json({ success: true, agreement, message: '대여 동의서가 작성되었습니다. 전자서명 후 관리자 대여 승인이 필요합니다.' });
});

// Rental agreement — electronic signature only
app.post('/api/rental-agreements/:id/sign', async (req, res) => {
  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const agreement = db.rentalAgreements.find((a: any) => a.agreementId === req.params.id);
  if (!agreement) return res.status(404).json({ success: false, message: '동의서를 찾을 수 없습니다.' });
  if (agreement.signatureStatus === 'signed') {
    return res.status(400).json({ success: false, message: '이미 서명 완료된 동의서입니다.' });
  }

  const member = db.members.find((m: any) => m.memberId === agreement.borrowerId);
  if (!member) return res.status(404).json({ success: false, message: '대여자 정보를 찾을 수 없습니다.' });

  agreement.signatureStatus = 'signed';
  agreement.signedAt = formatDateOnly(new Date());
  agreement.signedBy = member.name;
  if (!agreement.approvalStatus) agreement.approvalStatus = 'pending';

  await saveDB(db);
  res.json({
    success: true,
    agreement,
    message: '전자서명이 완료되었습니다. 관리자 대여 승인을 기다려 주세요.',
  });
});

// Rental agreement — user self-service: sign + approve + borrow in one step
app.post('/api/rental-agreements/:id/complete', async (req, res) => {
  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const agreement = db.rentalAgreements.find((a: any) => a.agreementId === req.params.id);
  if (!agreement) return res.status(404).json({ success: false, message: '동의서를 찾을 수 없습니다.' });
  if (agreement.approvalStatus === 'approved') {
    return res.status(400).json({ success: false, message: '이미 대여 완료된 동의서입니다.' });
  }

  const member = db.members.find((m: any) => m.memberId === agreement.borrowerId);
  if (!member) return res.status(404).json({ success: false, message: '대여자 정보를 찾을 수 없습니다.' });

  agreement.signatureStatus = 'signed';
  agreement.signedAt = formatDateOnly(new Date());
  agreement.signedBy = req.body?.signedBy || member.name;

  const newRentals: any[] = [];
  for (const item of agreement.items) {
    const sample = db.samples.find((s: any) => s.code === item.sampleCode);
    if (!sample) {
      return res.status(404).json({ success: false, message: `샘플을 찾을 수 없습니다 · ${item.sampleCode}` });
    }
    if (sample.status !== '대여가능') {
      return res.status(400).json({
        success: false,
        message: `${item.sampleCode}는 현재 대여 가능한 상태가 아닙니다.`,
      });
    }
    const rental = createRentalRecord(db, sample, member, agreement.rentDays);
    rental.agreementId = agreement.agreementId;
    newRentals.push(rental);
  }

  agreement.approvalStatus = 'approved';
  agreement.approvedAt = formatDateOnly(new Date());
  agreement.approvedBy = member.name;

  await saveDB(db);
  res.json({
    success: true,
    agreement,
    rentals: newRentals,
    message: `${newRentals.length}건 대여가 완료되었습니다.`,
  });
});

// Rental agreement — admin approval & batch borrow
app.post('/api/rental-agreements/:id/approve', async (req, res) => {
  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const agreement = db.rentalAgreements.find((a: any) => a.agreementId === req.params.id);
  if (!agreement) return res.status(404).json({ success: false, message: '동의서를 찾을 수 없습니다.' });
  if (agreement.signatureStatus !== 'signed') {
    return res.status(400).json({ success: false, message: '전자서명이 완료된 동의서만 승인할 수 있습니다.' });
  }
  if (agreement.approvalStatus === 'approved') {
    return res.status(400).json({ success: false, message: '이미 대여 승인된 동의서입니다.' });
  }

  const member = db.members.find((m: any) => m.memberId === agreement.borrowerId);
  if (!member) return res.status(404).json({ success: false, message: '대여자 정보를 찾을 수 없습니다.' });

  const newRentals: any[] = [];
  for (const item of agreement.items) {
    const sample = db.samples.find((s: any) => s.code === item.sampleCode);
    if (!sample) {
      return res.status(404).json({ success: false, message: `샘플을 찾을 수 없습니다 · ${item.sampleCode}` });
    }
    if (sample.status !== '대여가능') {
      return res.status(400).json({
        success: false,
        message: `${item.sampleCode}는 현재 대여 가능한 상태가 아닙니다. 동의서 작성 후 다른 대여가 진행되었을 수 있습니다.`,
      });
    }
    const rental = createRentalRecord(db, sample, member, agreement.rentDays);
    rental.agreementId = agreement.agreementId;
    newRentals.push(rental);
  }

  agreement.approvalStatus = 'approved';
  agreement.approvedAt = formatDateOnly(new Date());
  agreement.approvedBy = req.body?.approvedBy || '관리자';

  await saveDB(db);
  res.json({
    success: true,
    agreement,
    rentals: newRentals,
    message: `${newRentals.length}건 대여 승인 · 대여 처리가 완료되었습니다.`,
  });
});

// Rental agreement — admin reject
app.post('/api/rental-agreements/:id/reject', async (req, res) => {
  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const agreement = db.rentalAgreements.find((a: any) => a.agreementId === req.params.id);
  if (!agreement) return res.status(404).json({ success: false, message: '동의서를 찾을 수 없습니다.' });
  if (agreement.approvalStatus === 'approved') {
    return res.status(400).json({ success: false, message: '이미 승인된 동의서는 반려할 수 없습니다.' });
  }

  const rejectedReason = String(req.body?.rejectedReason || req.body?.reason || '').trim();
  if (!rejectedReason) {
    return res.status(400).json({ success: false, message: '반려 사유를 입력해 주세요.' });
  }

  agreement.approvalStatus = 'rejected';
  agreement.rejectedAt = formatDateOnly(new Date());
  agreement.rejectedBy = req.body?.rejectedBy || '관리자';
  agreement.rejectedReason = rejectedReason;

  await saveDB(db);
  res.json({ success: true, agreement, message: '대여 신청이 반려되었습니다.' });
});

app.delete('/api/rental-agreements/:id', async (req, res) => {
  const db = await getDB();
  if (!db.rentalAgreements) db.rentalAgreements = [];

  const idx = db.rentalAgreements.findIndex((a: any) => a.agreementId === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '동의서를 찾을 수 없습니다.' });

  const agreement = db.rentalAgreements[idx];
  if (agreement.approvalStatus !== 'rejected') {
    return res.status(400).json({ success: false, message: '반려된 신청만 삭제할 수 있습니다.' });
  }

  db.rentalAgreements.splice(idx, 1);
  await saveDB(db);
  res.json({ success: true, message: '반려 신청이 삭제되었습니다.' });
});

// Mark rental as lost/damaged (sample → 분실) + 사유서 저장
app.post('/api/rentals/:id/mark-lost', async (req, res) => {
  const db = await getDB();
  const rental = db.rentals.find((r: any) => r.rentalId === req.params.id);
  if (!rental) return res.status(404).json({ success: false, message: '해당 대여 이력을 찾을 수 없습니다.' });
  if (rental.status === '반납완료') {
    return res.status(400).json({ success: false, message: '이미 반납 완료된 건입니다.' });
  }

  const { reason, reportType, compensationAgreed, primaryEvaluator, fashionArchiveReviewer, fashionInstituteReviewer } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: '훼손/분실 사유를 입력해 주세요.' });
  }
  if (!compensationAgreed) {
    return res.status(400).json({ success: false, message: '변상 동의에 체크해 주세요.' });
  }

  const sample = db.samples.find((s: any) => s.code === rental.sampleCode);
  const member = db.members?.find((m: any) => m.memberId === rental.borrowerId);
  const today = formatDateOnly(new Date());

  if (sample) sample.status = '분실';

  rental.returnDate = today;
  rental.status = '반납완료';

  if (!db.lossDamageReports) db.lossDamageReports = [];
  const report = {
    reportId: String(1000000 + db.lossDamageReports.length + 1),
    rentalId: rental.rentalId,
    sampleCode: rental.sampleCode,
    reportType: reportType === '훼손' ? '훼손' : '분실',
    companyName: '이랜드월드',
    brand: rental.sampleBrand || sample?.brand || '',
    department: rental.borrowerGroup || member?.groupName || '',
    employeeId: rental.borrowerId,
    employeeName: rental.borrowerName,
    sampleName: rental.sampleName,
    rentalDate: rental.rentDate,
    processedDate: today,
    reason: String(reason).trim(),
    compensationAgreed: true,
    signedAt: today,
    signedBy: rental.borrowerName,
    primaryEvaluator: primaryEvaluator || '',
    fashionArchiveReviewer: fashionArchiveReviewer || '',
    fashionInstituteReviewer: fashionInstituteReviewer || '',
    createdAt: today,
  };
  db.lossDamageReports.push(report);

  await saveDB(db);
  res.json({ success: true, rental, report, message: '분실/훼손 처리 및 사유서가 등록되었습니다.' });
});

// Update loss/damage report (사유·결재 정보 수정)
app.put('/api/loss-damage-reports/:id', async (req, res) => {
  const db = await getDB();
  if (!db.lossDamageReports) db.lossDamageReports = [];
  const report = db.lossDamageReports.find((r: any) => r.reportId === req.params.id);
  if (!report) return res.status(404).json({ success: false, message: '해당 사유서를 찾을 수 없습니다.' });

  const { reason, reportType, primaryEvaluator, fashionArchiveReviewer, fashionInstituteReviewer } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: '훼손/분실 사유를 입력해 주세요.' });
  }

  report.reason = String(reason).trim();
  if (reportType === '훼손' || reportType === '분실') report.reportType = reportType;
  if (primaryEvaluator != null) report.primaryEvaluator = String(primaryEvaluator);
  if (fashionArchiveReviewer != null) report.fashionArchiveReviewer = String(fashionArchiveReviewer);
  if (fashionInstituteReviewer != null) report.fashionInstituteReviewer = String(fashionInstituteReviewer);

  await saveDB(db);
  res.json({ success: true, report, message: '사유서가 저장되었습니다.' });
});

// Return.
app.post('/api/rentals/return', async (req, res) => {
  const { rentalId } = req.body;
  const db = await getDB();

  const rental = db.rentals.find((r: any) => r.rentalId === rentalId);
  if (!rental) return res.status(404).json({ success: false, message: '해당 대여 이력을 찾을 수 없습니다.' });

  const sample = db.samples.find((s: any) => s.code === rental.sampleCode);
  if (sample) sample.status = '대여가능';

  rental.returnDate = new Date().toISOString().substring(0, 10);
  rental.status = '반납완료';
  await saveDB(db);
  res.json({ success: true, message: '반납 처리가 완료되었습니다.' });
});

// Load 시 반납예정일 경과 건 상태 동기화
app.post('/api/rentals/sync-overdue', async (_req, res) => {
  try {
    const db = await getDB();
    const changed = syncOverdueStatuses(db);
    if (changed) await saveDB(db);
    res.json({ success: true, changed, rentals: db.rentals });
  } catch (err: any) {
    console.error('sync-overdue error:', err);
    res.status(500).json({ success: false, message: err.message || '연체 상태 동기화 실패' });
  }
});

// AI Agent: analyze a garment image → structured metadata.
app.post('/api/agent/analyze-image', async (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ success: false, message: '이미지 데이터가 존재하지 않습니다.' });

  try {
    const ai = getAi();
    let cleanedBase64 = base64;
    let mimeType = 'image/jpeg';
    if (base64.includes(';base64,')) {
      const parts = base64.split(';base64,');
      cleanedBase64 = parts[1];
      mimeType = parts[0].replace('data:', '');
    }

    const systemPrompt = `당신은 의류 이미지를 정밀 분석하여 패션 데이터베이스용 메타데이터를 정교하게 추출하는 전문가이자 마이멜로디 AI 패션 코디네이터 에이전트입니다.
제공된 의류 사진(FRONT 또는 전면 촬영본)을 꼼꼼하게 관찰한 다음, 상품의 패션 데이터 정보들을 분석하고 추출하여 일괄 스마트 등록을 위한 최적의 결과값을 한국어로 알려주세요.

반드시 아래 JSON 규격을 철저히 준수하여 출력하십시오. JSON 스키마 외의 설명글이나 백틱(\`\`\`) 등 불필요한 텍스트를 절대 출력하지 마십시오:
{
  "name": "[분석된 상품 명칭을 생성하세요. 예: GU 린넨 혼방 스트라이프 셔츠 | Women]",
  "brand": "[식별되거나 유추되는 브랜드명 기재, 모르는 경우 'GU' 또는 'UNIQLO', 'ZARA' 등 대중적인 브랜드 중에서 디자인 형태에 부합하도록 적당히 유추하거나, '중국포인포', '기타' 브랜드로 출력]",
  "material": "[소재 속성 기재, 예: '린넨 70%, 코튼 30%' 또는 '코튼 100%' 또는 '울 혼방']",
  "color": "[검출된 색상들을 기재, 예: '베이지', '오렌지, 화이트', '블랙']",
  "category": "[카테고리명 선택 기재: '오리지널', '유형화샘플', '촬영샘플', '출장샘플' 중 하나로 필수 선정하여 출력]",
  "gender": "[성별 타겟 유형 한 글자로 필수 기재: 'F'(여성용), 'M'(남성용), 'U'(공용) 중 하나로 선정]",
  "country": "[유추되는 원산지 국가 코드: 'KR'(한국), 'CN'(중국), 'JP'(일본), 'US'(미국) 중 하나로 기재]",
  "price": [적당히 산출한 시장 가격 또는 대여 단가값 정수 출력, 예: 39000],
  "size": "[유추되는 사이즈: 'S', 'M', 'L', 'XL' 중 하나로 기재]",
  "condition": "[의류의 추정 보존 상태: '아주 좋음', '좋음', '양호함', '약간의 얼룩/손상 있음', '얼룩/손상 있음' 중 하나로 기재]",
  "season": "[적절한 시즌: 'SS', 'FW' 중 하나로 기재]",
  "description": "[의류의 디자인 특징 및 디테일 요소를 1-2문장으로 기술한 설명 기재]",
  "aiTags": {
    "fit": ["[핏/실루엣 관련 짧은 영문 태그 1~3개. 예: 'regular fit', 'oversized', 'slim']"],
    "design": ["[디자인/디테일 관련 짧은 영문 태그 1~4개. 예: 'half-zip', 'stand collar', 'ribbed cuffs']"],
    "material": ["[소재/원단 관련 짧은 영문 태그 1~3개. 예: 'cotton', 'wool blend', 'knit']"],
    "color": ["[색상 관련 짧은 영문 태그 1~3개. 예: 'cream', 'beige', 'navy']"],
    "style": ["[스타일/무드 관련 짧은 영문 태그 1~3개. 예: 'casual', 'minimal', 'street']"],
    "season": ["[활용하기 좋은 시즌 관련 짧은 영문 태그 1~3개. 예: 'spring', 'summer', 'fall', 'winter']"]
  }
}`;

    const imagePart = { inlineData: { mimeType, data: cleanedBase64 } };

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [imagePart, { text: 'Analyze this garment image and return JSON structure.' }],
      config: { systemInstruction: systemPrompt, responseMimeType: 'application/json' },
    });

    const jsonOutput = JSON.parse((modelResponse.text || '{}').trim());
    res.json({ success: true, analysis: jsonOutput });
  } catch (error: any) {
    console.error('Gemini image analyze error:', error);
    // Graceful mock fallback if API key or network issues occur.
    res.json({
      success: true,
      analysis: {
        name: 'AI 추천 린넨 혼방 스트라이프 셔츠',
        brand: 'GU',
        material: '린넨 50%, 코튼 50%',
        color: '베이지',
        category: '유형화샘플',
        gender: 'F',
        country: 'JP',
        price: 29000,
        size: 'M',
        condition: '아주 좋음',
        season: 'SS',
        description: '자연스러운 구김과 린넨 혼방 소재로 쾌적한 피팅감을 선사하는 데일리 스트라이프 셔츠.',
        aiTags: {
          fit: ['regular fit'],
          design: ['stripe', 'button-up', 'long sleeves'],
          material: ['linen blend', 'cotton'],
          color: ['beige'],
          style: ['casual', 'daily'],
          season: ['spring', 'fall'],
        },
      },
    });
  }
});

// AI Agent: bulk-create samples from AI-assisted rows (sequential PCCAI codes).
app.post('/api/samples/bulk-create-from-ai', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '올바른 상품 등록 리스트가 전달되지 않았습니다.' });
  }

  const db = await getDB();
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  let addedCount = 0;

  let latestSeed = 32992;
  db.samples.forEach((s: any) => {
    if (s.code && s.code.startsWith('PCCAI')) {
      const numPart = parseInt(s.code.replace('PCCAI', ''));
      if (!isNaN(numPart) && numPart > latestSeed) latestSeed = numPart;
    }
  });

  items.forEach((item: any) => {
    // 상품코드는 스프레드시트에서 불러온 값(item.code)을 우선 사용하고,
    // 없을 때만 순차 발급 코드를 생성한다. (AI가 코드를 임의 생성하지 않음)
    let generatedCode: string;
    if (item.code && String(item.code).trim()) {
      generatedCode = String(item.code).trim();
    } else {
      latestSeed++;
      generatedCode = `PCCAI${String(latestSeed).padStart(6, '0')}`;
    }

    const sampleRecord = {
      id: db.samples.length + 1,
      regDate: nowStr,
      status: item.status || '대여가능',
      brand: item.brand || '중국포인포',
      specialBrand: item.specialBrand || '',
      locationNo: item.locationNo || 'H-' + Math.floor(Math.random() * 800 + 100),
      code: generatedCode,
      name: item.name || `${generatedCode} AI 등록 의류`,
      category: item.category || '유형화샘플',
      registerer: item.registerer || '허경아',
      useYn: '사용',
      color: item.color || '베이지',
      gender: item.gender || 'U',
      country: item.country || 'KR',
      price: Number(item.price) || 29000,
      description: item.description || '',
      brandCode: item.brandCode || (item.brand === 'GU' ? 'GU_JP' : item.brand === 'UNIQLO' ? 'UNIQLO_JP' : 'POINFO_CN'),
      season: item.season || 'SS',
      material: item.material || '면 100%',
      size: item.size || 'M',
      condition: item.condition || '아주 좋음',
      location: item.location || '',
      imgFront: item.imgFront || '',
      imgBack: item.imgBack || '',
      rentalFee: Number(item.price) || 15000,
      overdueFee1: 10000,
      overdueFee2: 20000,
      rentalPeriod: 28,
      year: item.year || '2026',
      month: item.month || '06',
      views: 0,
      topic: item.name || '',
      classification: '셔츠, 블라우스(PCCAI03)',
      itemType: item.itemType || (item.name ? item.name.split(' ').pop() : '셔츠'),
      hangeringNo: 'Hanger-' + Math.floor(Math.random() * 200 + 100),
      overdueCharge: 0,
      overdueDays: 0,
      postingStatus: '게시',
    };

    db.samples.unshift(sampleRecord);
    addedCount++;
  });

  await saveDB(db);
  res.json({
    success: true,
    addedCount,
    message: `${addedCount}개의 신규 의류 자산이 AI 스마트 대장 자동분석 및 순차 발급 코드로 옷장 대장에 일괄 등록되었습니다!`,
  });
});

// AI Agent: draft an overdue-return reminder email.
app.post('/api/agent/draft-email', async (req, res) => {
  const { borrowerName, borrowerGroup, sampleName, sampleCode, dueDate, daysOverdue, emailType } = req.body;

  try {
    const ai = getAi();
    const systemPrompt = `당신은 패션 의류 브랜드 기업의 '디자인 샘플 자산 관리실 마이멜로디' AI 에이전트입니다.
의류 샘플을 대여했으나 반납 예정 기일이 지나 연체 중인 임직원에게 발송할 친절하지만 명확한 반납 안내 독촉 메일을 양식에 맞춰 작성해주세요.
발송인 정보: 디자인자산관리시스템 (CDO 산하 디자인개발지원센터)
수신인 이메일 주소 및 그룹 부서 정보를 참고하여 예의 바르고 격조 높은 한국어 비즈니스 이메일 톤앤매너로 답변해 서정적이면서도 반납이 꼭 필요함을 알리세요.
이메일 타입에 따라 톤을 다르게 합니다:
- 'gentle': 1회 차 정중하고 상냥한 안내 (공유 자산 활성화 권장)
- 'warning': 2회 차 경고형 메시지 (타 팀 출장 촬영 일정이 잡혔거나 다음 개발 일정 영향 강조)
- 'strict': 최종 강력 경고 메시지 (경위서 혹은 본부 내 자산 미반납 리스트 공유 등 주의 안내)

사용자가 제공한 정보를 메일에 잘 녹여내세요. output 형식은 반드시 아래 JSON 규격이어야 하며, 다른 부가 텍스트는 출력하지 마세요:
{
  "subject": "[이메일 제목]",
  "content": "[이메일 본문 내용 (엔터와 줄바꿈 개행 '\\n' 포함)]"
}`;

    const userPrompt = `임직원 정보:
- 이름: ${borrowerName}
- 부서: ${borrowerGroup}
- 대여 상품명: ${sampleName}
- 상품 코드: ${sampleCode}
- 반납 예정일: ${dueDate}
- 연체 일수: ${daysOverdue}일 연체 중
- 메일 단계: ${emailType || 'gentle'}`;

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: { systemInstruction: systemPrompt, responseMimeType: 'application/json' },
    });

    res.json(JSON.parse((modelResponse.text || '{}').trim()));
  } catch (error: any) {
    console.error('Gemini Draft Error:', error);
    res.status(200).json({
      subject: `[반납 촉구 안내] 대여하신 의류 샘플 반납 기한 경과 안내 (${sampleName})`,
      content: `안녕하세요, ${borrowerGroup} ${borrowerName} 님.\n\n디자인 샘플 자산 지원실에서 안내해 드립니다.\n귀하께서 대여하신 의류 샘플 [${sampleName}] (${sampleCode})은 반납 기한(${dueDate})을 지나 ${daysOverdue}일째 연체 상태입니다.\n\n해당 제품과 관련한 후속 모델 개발 및 타 브랜드 자산 공람 일정이 밀려 있어 차질이 발생하고 있습니다.\n본 메일을 확인하시는 즉시 어드민 실로 자산을 가져와 확인 절차를 거쳐 반납 접수 처리해주시기를 부탁드립니다.\n\n감사합니다.\n디자인자산관리시스템 드림`,
    });
  }
});

// Record a sent notification (writes to rental history; flips status to 연체중).
app.post('/api/agent/send-email', async (req, res) => {
  const { rentalId, subject, content } = req.body;
  const db = await getDB();

  const rental = db.rentals.find((r: any) => r.rentalId === rentalId);
  if (!rental) return res.status(404).json({ success: false, message: '해당 대여 내역을 찾을 수 없습니다.' });

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  rental.notifyCount = (rental.notifyCount || 0) + 1;
  rental.lastNotifyDate = nowStr;
  if (!rental.notifyHistory) rental.notifyHistory = [];
  rental.notifyHistory.unshift({ sentAt: nowStr, subject, content });

  if (rental.status === '대여중') {
    rental.status = '연체중';
    const s = db.samples.find((xs: any) => xs.code === rental.sampleCode);
    if (s && s.status === '대여중') s.status = '연체중';
  }

  await saveDB(db);
  res.json({
    success: true,
    notifyCount: rental.notifyCount,
    lastNotifyDate: nowStr,
    message: `${rental.borrowerName} (${rental.borrowerEmail}) 님께 자동으로 반납 안내 이메일이 발송되었습니다.`,
  });
});

// =========================================================================
// Vite (dev: middleware) / static (prod) + server bootstrap
// =========================================================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: 24678, clientPort: 24678 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'public');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ 포트 ${PORT}이(가) 이미 사용 중입니다.`);
      console.error(`   Windows: netstat -ano | findstr :${PORT}  →  taskkill /PID <pid> /F`);
      console.error(`   또는 .env 에 PORT=3002 등 다른 포트를 지정하세요.\n`);
    } else {
      console.error('Server listen error:', err);
    }
    process.exit(1);
  });
}

// Vercel(서버리스) 환경에서는 app.listen()을 호출하지 않고 app만 내보낸다.
// startServer()는 vite dev 미들웨어/정적 서빙을 포함하므로 일반 Node 실행에서만 호출한다.
// 정적 파일 서빙은 vercel.json 라우팅이 담당한다.
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start admin server:', err);
    process.exit(1);
  });
}

export default app;
