export type SampleStatus = '대여가능' | '대여중' | '연체중' | '분실' | '부평보관';

// AI 생성 태그 카테고리 (핏/디자인/소재/색상/스타일/제품설명)
export type AiTagCategory = 'fit' | 'design' | 'material' | 'color' | 'style' | 'season';
export type AiTagGroups = Partial<Record<AiTagCategory, string[]>>;

export interface Sample {
  id: number;
  regDate: string;
  status: SampleStatus;
  brand: string;
  specialBrand?: string; // 특화 브랜드 (예: adidas, ARTEX, Birdie)
  locationNo: string;
  code: string;
  name: string;
  imgFront?: string; // base64 data URL
  imgBack?: string;  // base64 data URL
  imgFrontClean?: string; // base64 data URL for background-removed clean front image
  imgBackClean?: string;  // base64 data URL for background-removed clean back image
  imgFlat?: string;  // base64 data URL for flat lay / aerial shot
  category: string;
  registerer: string;
  useYn: '사용' | '미사용';
  color: string;
  gender: string;
  country: string;
  price: number;
  description: string;
  brandCode: string;
  season: string;
  material: string;
  size?: string;
  condition?: string;
  aiTags?: AiTagGroups;     // AI가 생성한 태그 (핏/디자인/소재/색상/스타일/제품설명 카테고리별)
  location?: string;        // 위치 (창고/보관 위치)
  
  // Real fields from product specifications worksheet
  rentalFee?: number;       // 대여료 (e.g., 15000)
  overdueFee1?: number;     // 1차연체 금액 (e.g., 10000)
  overdueFee2?: number;     // 2차연체 금액 (e.g., 20005)
  rentalPeriod?: number;    // 대여기간 (e.g., 28)
  year?: string;            // 연도 (e.g., 2026)
  month?: string;           // 달
  views?: number;           // 조회수
  topic?: string;           // 주제 (오리지널 세부 카테고리 등)
  subCategory?: string;       // 세부 카테고리 (오리지널: 소품, 캐주얼 등)
  classification?: string;  // 분류 (e.g., 셔츠, 블라우스(PCCAI03))
  itemType?: string;        // 아이템
  hangeringNo?: string;     // 행거링번호
  overdueCharge?: number;   // 연체료
  overdueDays?: number;     // 연체일
  postingStatus?: '게시' | '비게시'; // 게시 여부
}

export interface Member {
  memberId: string;
  loginId?: string;      // 아이디 (로그인 아이디, 보통 이메일 앞부분)
  name: string;
  email: string;
  phone: string;
  groupName: string;
  affiliation?: string;  // 소속 (예: 패션BG 본부)
  brand?: string;        // 브랜드 (예: 패션연구소)
  appliedDate?: string;  // 신청일 (외부 경로로 가입 신청한 일시)
  approvalDate?: string; // 승인일
  status?: 'pending' | 'approved'; // 가입 승인 상태 (없으면 approved로 간주)
  role?: string;         // 권한 (예: 시스템관리자, 사이트관리자, 중국사이트관리자)
  category?: string;     // 카테고리 (한국 / 중국)
  useYn: '사용' | '미사용';
}

export interface Group {
  id: string;
  name: string;
  description: string;
  useYn: '사용' | '미사용';
}

export interface Category {
  id: string;
  code: string;
  name: string;
  useYn: '사용' | '미사용';
  parentId?: string | null; // null/undefined = 최상위 카테고리
}

export interface Brand {
  id: string;
  name: string;          // 브랜드명
  nameEn?: string;       // 브랜드 영문명
  code?: string;         // 브랜드 코드
  category?: string;     // 카테고리 (한국 / 중국)
  description?: string;  // 설명
  useYn: 'Y' | 'N';
}

// 콘텐츠 저장소: 폴더/자료(도서, 연구자료 등) 트리 노드
export interface ContentNode {
  id: string;
  name: string;
  type: 'folder' | 'item';
  parentId?: string | null;   // null/undefined = 최상위
  itemType?: string;          // 자료 유형 (도서 / 연구자료 / 링크 / 문서 등)
  author?: string;            // 저자/출처
  url?: string;               // 외부 링크
  fileData?: string;          // 업로드한 파일 (base64 data URL)
  fileName?: string;          // 업로드한 파일의 원본 이름
  fileType?: string;          // 업로드한 파일의 MIME 타입
  description?: string;       // 설명
  createdAt?: string;         // 등록일
}

export interface RentalAgreementItem {
  sampleCode: string;
  sampleName: string;
  category: string;
  brand: string;
  remark?: string;
}

export interface RentalAgreement {
  agreementId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerAffiliation: string;
  brand: string;
  purpose: string;
  rentDate: string;
  dueDate: string;
  rentDays: number;
  quantity: number;
  items: RentalAgreementItem[];
  signatureStatus: 'pending' | 'signed';
  signedAt?: string | null;
  signedBy?: string | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface Rental {
  rentalId: string;
  sampleCode: string;
  sampleName: string;
  sampleBrand: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerGroup: string;
  rentDate: string;
  dueDate: string;
  returnDate: string | null;
  status: '대여중' | '연체중' | '반납완료';
  notifyCount: number;
  lastNotifyDate: string | null;
  notifyHistory: {
    sentAt: string;
    subject: string;
    content: string;
  }[];
  agreementId?: string | null;
}

export interface LossDamageReport {
  reportId: string;
  rentalId: string;
  sampleCode: string;
  reportType: '분실' | '훼손';
  companyName: string;
  brand: string;
  department: string;
  employeeId: string;
  employeeName: string;
  sampleName: string;
  rentalDate: string;
  processedDate: string;
  reason: string;
  compensationAgreed: boolean;
  signedAt: string;
  signedBy: string;
  primaryEvaluator?: string;
  fashionArchiveReviewer?: string;
  fashionInstituteReviewer?: string;
  createdAt: string;
}

const parseDateOnlyUtc = (dateStr: string) => {
  const d = new Date(String(dateStr).replace(' ', 'T'));
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

export const todayDateStr = () => new Date().toISOString().substring(0, 10);

/** 반납예정일이 지났고 아직 반납되지 않은 경우 */
export function isRentalOverdue(r: Rental, refDate: string = todayDateStr()): boolean {
  if (r.status === '반납완료') return false;
  if (r.status === '연체중') return true;
  if (r.status !== '대여중' || !r.dueDate) return false;
  return parseDateOnlyUtc(r.dueDate) < parseDateOnlyUtc(refDate);
}

/** 화면·집계용 실제 상태 (반납예정일 경과 시 자동 연체) */
export function effectiveRentalStatus(r: Rental, refDate: string = todayDateStr()): Rental['status'] {
  if (r.status === '반납완료') return '반납완료';
  if (isRentalOverdue(r, refDate)) return '연체중';
  return r.status;
}

/** UI 표시용 샘플 상태 라벨 (데이터 값 '연체중' → 화면 '연체') */
export function sampleStatusLabel(status: SampleStatus): string {
  return status === '연체중' ? '연체' : status;
}

/** UI 표시용 대여 상태 라벨 */
export function rentalStatusLabel(status: Rental['status']): string {
  return status === '연체중' ? '연체' : status;
}
