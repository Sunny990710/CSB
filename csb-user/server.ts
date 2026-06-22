import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// csb-admin 과 동일 database.json 공유 (기본: 형제 폴더)
const DEFAULT_DATA_DIR = path.join(process.cwd(), '..', 'csb-admin');
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'database.json');

let MODULE_DIR = process.cwd();
try {
  MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
} catch {
  /* noop */
}

const SEED_CANDIDATES = [
  DB_FILE,
  path.join(process.cwd(), 'database.json'),
  path.join(MODULE_DIR, '..', 'csb-admin', 'database.json'),
  path.join(MODULE_DIR, 'database.json'),
];

function findSeedFile(): string | null {
  for (const p of SEED_CANDIDATES) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > 100) return p;
    } catch {
      /* noop */
    }
  }
  return null;
}

const EMPTY_DB = {
  samples: [],
  members: [],
  groups: [],
  rentals: [],
  rentalAgreements: [],
  lossDamageReports: [],
  categories: [],
  brands: [],
  contents: [],
  availabilityAlerts: [],
};

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

function ensureLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = findSeedFile();
    if (seed && seed !== DB_FILE) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.copyFileSync(seed, DB_FILE);
    }
  }
}

function getLocalDB(): any {
  ensureLocalDB();
  if (fs.existsSync(DB_FILE)) {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
  return readSeed();
}

function saveLocalDB(data: any): boolean {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

async function getDB(): Promise<any> {
  try {
    return getLocalDB();
  } catch (err) {
    console.error('Error reading database:', err);
    return { ...EMPTY_DB };
  }
}

async function saveDB(data: any): Promise<boolean> {
  try {
    return saveLocalDB(data);
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

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

function getActiveAvailabilityAlertCodes(db: any, memberId: string): string[] {
  return (db.availabilityAlerts || [])
    .filter((a: any) => a.memberId === memberId && a.active && !a.notifiedAt)
    .map((a: any) => a.sampleCode);
}

function notifyAvailabilityAlerts(db: any, sampleCode: string) {
  const sample = db.samples?.find((s: any) => s.code === sampleCode);
  if (!sample || sample.status !== '대여가능') return;

  if (!db.availabilityAlerts) db.availabilityAlerts = [];

  for (const alert of db.availabilityAlerts) {
    if (alert.sampleCode !== sampleCode || !alert.active || alert.notifiedAt) continue;

    const subject = `[CSB] ${sample.name || sampleCode} 샘플 대여 가능`;
    const content = `${alert.memberName}님, 보관함에 담아두신 ${sample.name || sampleCode}(${sampleCode}) 샘플이 대여 가능 상태가 되었습니다.`;

    console.log(`[Availability Alert Email] To: ${alert.memberEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${content}`);

    alert.notifiedAt = new Date().toISOString();
    alert.active = false;
    alert.lastEmailSubject = subject;
    alert.lastEmailContent = content;
  }
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

// =========================================================================
// API (사용자 포털에 필요한 엔드포인트만)
// =========================================================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'csb-user', dataDir: DATA_DIR, time: new Date().toISOString() });
});

app.get('/api/db', async (_req, res) => {
  try {
    return res.json(await getDB());
  } catch (err) {
    console.error('GET /api/db error:', err);
    return res.json(readSeed());
  }
});

app.post('/api/rentals/sync-overdue', async (_req, res) => {
  try {
    const db = await getDB();
    const changed = syncOverdueStatuses(db);
    if (changed) await saveDB(db);
    res.json({ success: true, changed, rentals: db.rentals });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '연체 상태 동기화 실패' });
  }
});

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
  res.json({ success: true, agreement, message: '대여 동의서가 작성되었습니다.' });
});

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

app.post('/api/rentals/return', async (req, res) => {
  const { rentalId } = req.body;
  const db = await getDB();

  const rental = db.rentals.find((r: any) => r.rentalId === rentalId);
  if (!rental) return res.status(404).json({ success: false, message: '해당 대여 이력을 찾을 수 없습니다.' });

  const sample = db.samples.find((s: any) => s.code === rental.sampleCode);
  if (sample) sample.status = '대여가능';

  rental.returnDate = new Date().toISOString().substring(0, 10);
  rental.status = '반납완료';
  notifyAvailabilityAlerts(db, rental.sampleCode);
  await saveDB(db);
  res.json({ success: true, message: '반납 처리가 완료되었습니다.' });
});

app.get('/api/availability-alerts', async (req, res) => {
  try {
    const memberId = String(req.query.memberId || '');
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'memberId가 필요합니다.' });
    }
    const db = await getDB();
    if (!db.availabilityAlerts) db.availabilityAlerts = [];
    res.json({ success: true, codes: getActiveAvailabilityAlertCodes(db, memberId) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '알림 조회 실패' });
  }
});

app.post('/api/availability-alerts/toggle', async (req, res) => {
  try {
    const { memberId, memberEmail, memberName, sampleCode, sampleName } = req.body || {};
    if (!memberId || !sampleCode || !memberEmail) {
      return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
    }

    const db = await getDB();
    if (!db.availabilityAlerts) db.availabilityAlerts = [];

    const sample = db.samples?.find((s: any) => s.code === sampleCode);
    if (sample?.status === '대여가능') {
      return res.status(400).json({
        success: false,
        message: '이미 대여 가능한 샘플입니다.',
      });
    }

    const existing = db.availabilityAlerts.find(
      (a: any) => a.memberId === memberId && a.sampleCode === sampleCode && a.active && !a.notifiedAt
    );

    let subscribed = false;
    if (existing) {
      existing.active = false;
      subscribed = false;
    } else {
      db.availabilityAlerts.push({
        alertId: `AA-${Date.now()}`,
        memberId,
        memberEmail,
        memberName: memberName || memberEmail,
        sampleCode,
        sampleName: sampleName || sampleCode,
        createdAt: new Date().toISOString(),
        notifiedAt: null,
        active: true,
      });
      subscribed = true;
    }

    await saveDB(db);
    res.json({
      success: true,
      subscribed,
      codes: getActiveAvailabilityAlertCodes(db, memberId),
      message: subscribed
        ? `${memberEmail}로 대여 가능 시 알림을 보내드립니다.`
        : '대여 가능 알림이 해제되었습니다.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '알림 설정 실패' });
  }
});

// =========================================================================
// Vite (dev) / static (prod)
// =========================================================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: 24679, clientPort: 24679 },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CSB User portal at http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
    console.log(`Shared DB: ${DB_FILE}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start user server:', err);
  process.exit(1);
});

export default app;
