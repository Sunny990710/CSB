export type SampleStatus = '대여가능' | '대여중' | '연체중' | '분실' | '부평보관';

export interface Sample {
  id: number;
  regDate: string;
  status: SampleStatus;
  brand: string;
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
  
  // Real fields from product specifications worksheet
  rentalFee?: number;       // 대여료 (e.g., 15000)
  overdueFee1?: number;     // 1차연체 금액 (e.g., 10000)
  overdueFee2?: number;     // 2차연체 금액 (e.g., 20005)
  rentalPeriod?: number;    // 대여기간 (e.g., 28)
  year?: string;            // 연도 (e.g., 2026)
  month?: string;           // 달
  views?: number;           // 조회수
  topic?: string;           // 주제
  classification?: string;  // 분류 (e.g., 셔츠, 블라우스(PCCAI03))
  itemType?: string;        // 아이템
  hangeringNo?: string;     // 행거링번호
  overdueCharge?: number;   // 연체료
  overdueDays?: number;     // 연체일
  postingStatus?: '게시' | '비게시'; // 게시 여부
}

export interface Member {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  groupName: string;
  useYn: '사용' | '미사용';
}

export interface Group {
  id: string;
  name: string;
  description: string;
  useYn: '사용' | '미사용';
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
}
