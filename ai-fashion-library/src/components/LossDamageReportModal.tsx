import React, { useState } from 'react';
import { X, Check, RefreshCw, Printer, Package } from 'lucide-react';
import { Rental, Sample, LossDamageReport } from '../types';

export type LossDamageReportSubmitPayload = {
  reason: string;
  reportType: '분실' | '훼손';
  compensationAgreed: boolean;
  primaryEvaluator: string;
  fashionArchiveReviewer: string;
  fashionInstituteReviewer: string;
};

interface LossDamageReportModalProps {
  mode: 'create' | 'view';
  rental?: Rental;
  sample?: Sample;
  report?: LossDamageReport;
  onClose: () => void;
  onSubmit?: (payload: LossDamageReportSubmitPayload) => Promise<void>;
  onUpdate?: (reportId: string, payload: LossDamageReportSubmitPayload) => Promise<void>;
  submitting?: boolean;
  saving?: boolean;
}

const formatSlashDate = (dateStr?: string) => (dateStr || '').replace(/-/g, '/');

const formatKrDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return dateStr;
  const yy = String(d.getFullYear()).slice(2);
  return `${yy}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const sampleThumb = (sample?: Sample) =>
  sample?.imgFrontClean || sample?.imgFront || sample?.imgFlat || sample?.imgBackClean || sample?.imgBack;

export default function LossDamageReportModal({
  mode,
  rental,
  sample,
  report,
  onClose,
  onSubmit,
  onUpdate,
  submitting = false,
  saving = false,
}: LossDamageReportModalProps) {
  const isCreate = mode === 'create';
  const isView = mode === 'view';
  const data = isCreate
    ? {
        companyName: '이랜드월드',
        brand: rental?.sampleBrand || sample?.brand || '',
        department: rental?.borrowerGroup || '',
        employeeId: rental?.borrowerId || '',
        employeeName: rental?.borrowerName || '',
        sampleName: rental?.sampleName || sample?.name || '',
        sampleCode: rental?.sampleCode || sample?.code || '',
        rentalDate: rental?.rentDate || '',
        processedDate: new Date().toISOString().substring(0, 10),
        signedBy: rental?.borrowerName || '',
        signedAt: new Date().toISOString().substring(0, 10),
        primaryEvaluator: '',
        fashionArchiveReviewer: '',
        fashionInstituteReviewer: '',
      }
    : {
        companyName: report?.companyName || '이랜드월드',
        brand: report?.brand || '',
        department: report?.department || '',
        employeeId: report?.employeeId || '',
        employeeName: report?.employeeName || '',
        sampleName: report?.sampleName || '',
        sampleCode: report?.sampleCode || '',
        rentalDate: report?.rentalDate || '',
        processedDate: report?.processedDate || report?.signedAt || '',
        signedBy: report?.signedBy || '',
        signedAt: report?.signedAt || '',
        primaryEvaluator: report?.primaryEvaluator || '',
        fashionArchiveReviewer: report?.fashionArchiveReviewer || '',
        fashionInstituteReviewer: report?.fashionInstituteReviewer || '',
      };

  const [reportType, setReportType] = useState<'분실' | '훼손'>(report?.reportType || '분실');
  const [reason, setReason] = useState(report?.reason || '');
  const [compensationAgreed, setCompensationAgreed] = useState(report?.compensationAgreed ?? false);
  const [primaryEvaluator, setPrimaryEvaluator] = useState(data.primaryEvaluator);
  const [fashionArchiveReviewer, setFashionArchiveReviewer] = useState(data.fashionArchiveReviewer);
  const [fashionInstituteReviewer, setFashionInstituteReviewer] = useState(data.fashionInstituteReviewer);
  const [formError, setFormError] = useState('');

  const thumb = sampleThumb(sample);

  const buildPayload = (): LossDamageReportSubmitPayload | null => {
    if (!reason.trim()) {
      setFormError('훼손/분실 사유를 입력해 주세요.');
      return null;
    }
    if (isCreate && !compensationAgreed) {
      setFormError('변상 동의에 체크해 주세요.');
      return null;
    }
    setFormError('');
    return {
      reason: reason.trim(),
      reportType,
      compensationAgreed: isCreate ? compensationAgreed : (report?.compensationAgreed ?? true),
      primaryEvaluator,
      fashionArchiveReviewer,
      fashionInstituteReviewer,
    };
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload) return;
    await onSubmit?.(payload);
  };

  const handleSave = async () => {
    if (!report?.reportId) return;
    const payload = buildPayload();
    if (!payload) return;
    await onUpdate?.(report.reportId, payload);
  };

  const approvalRows = [
    { label: '샘플 대여자', value: data.employeeName },
    { label: '1차 평가자(실장/브랜드장)', value: primaryEvaluator || (isCreate ? '' : data.primaryEvaluator) || '—' },
    { label: '패션아카이브', value: fashionArchiveReviewer || (isCreate ? '' : data.fashionArchiveReviewer) || '—' },
    { label: '패션연구소', value: fashionInstituteReviewer || (isCreate ? '' : data.fashionInstituteReviewer) || '—' },
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
      id="loss-damage-report-modal-backdrop"
    >
      <div
        className="bg-white rounded-lg max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-4"
        onClick={(e) => e.stopPropagation()}
        id="loss-damage-report-modal"
      >
        <div className="bg-black text-white px-5 py-3 flex items-center justify-between shrink-0">
          <h4 className="text-sm font-extrabold tracking-tight">패션아카이브 샘플 훼손 / 분실 사유서</h4>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="flex justify-end">
            <table className="border border-slate-300 text-[10px] text-center border-collapse">
              <tbody>
                {approvalRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-600 whitespace-nowrap">{row.label}</td>
                    <td className="border border-slate-300 px-3 py-1 min-w-[72px] font-semibold text-slate-800">
                      {row.label !== '샘플 대여자' ? (
                        <input
                          type="text"
                          value={
                            row.label.startsWith('1차')
                              ? primaryEvaluator
                              : row.label === '패션아카이브'
                                ? fashionArchiveReviewer
                                : fashionInstituteReviewer
                          }
                          onChange={(e) => {
                            if (row.label.startsWith('1차')) setPrimaryEvaluator(e.target.value);
                            else if (row.label === '패션아카이브') setFashionArchiveReviewer(e.target.value);
                            else setFashionInstituteReviewer(e.target.value);
                          }}
                          placeholder="입력"
                          className="w-full text-center bg-white outline-none text-[10px] font-semibold placeholder:text-slate-300"
                        />
                      ) : (
                        row.value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table className="w-full border border-slate-300 text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600 w-28">법인명(업체명)</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.companyName}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600 w-16">브랜드</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.brand}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">부서</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.department}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">사번</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.employeeId}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600 w-12">이름</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.employeeName}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">샘플명</td>
                <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{data.sampleName}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">샘플코드</td>
                <td className="border border-slate-300 px-3 py-2 font-mono font-bold text-indigo-650" colSpan={3}>{data.sampleCode}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">대여일자</td>
                <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700">{formatSlashDate(data.rentalDate)}</td>
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">처리일</td>
                <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700" colSpan={3}>{formatSlashDate(data.processedDate)}</td>
              </tr>
              {rental?.rentalId && (
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">대여번호</td>
                  <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700" colSpan={5}>{rental.rentalId}</td>
                </tr>
              )}
              {report?.rentalId && !rental && (
                <tr>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-bold text-slate-600">대여번호</td>
                  <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700" colSpan={5}>{report.rentalId}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex gap-3 items-center text-[11px]">
            <span className="font-bold text-slate-600">구분</span>
            {(['분실', '훼손'] as const).map((type) => (
              <label key={type} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`reportType-${report?.reportId || rental?.rentalId || 'new'}`}
                  checked={reportType === type}
                  onChange={() => setReportType(type)}
                  className="text-slate-700 focus:ring-slate-500"
                />
                <span className="font-semibold text-slate-700">{type}</span>
              </label>
            ))}
          </div>

          <div className="border border-slate-300 overflow-hidden">
            <div className="bg-slate-200 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 border-b border-slate-300">
              &lt; 샘플 훼손 / 분실 사유 &gt;
            </div>
            <div className="flex">
              <div className="w-36 shrink-0 border-r border-slate-300 bg-slate-50 flex items-center justify-center p-3">
                {thumb ? (
                  <img src={thumb} referrerPolicy="no-referrer" alt={data.sampleName} className="max-h-28 w-full object-contain" />
                ) : (
                  <Package className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="flex-1 p-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={8}
                  placeholder="훼손/분실 경위를 직접 작성해 주세요."
                  className="w-full min-h-[160px] text-[11px] leading-relaxed text-slate-700 border border-slate-200 rounded-md px-2.5 py-2 outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-400 resize-y font-medium bg-white"
                />
              </div>
            </div>
          </div>

          <label className={`flex items-start gap-2 ${isCreate ? 'cursor-pointer' : ''}`}>
            {isCreate ? (
              <input
                type="checkbox"
                checked={compensationAgreed}
                onChange={(e) => setCompensationAgreed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
            ) : (
              <span className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded bg-rose-500 text-white shrink-0">
                <Check className="w-3 h-3" />
              </span>
            )}
            <span className="text-[11px] text-slate-700 font-medium leading-relaxed">
              샘플뱅크샘플 훼손 / 분실의 경우, 책정된 변상 금액으로 변상하겠습니다.
            </span>
          </label>

          {formError && <p className="text-[11px] font-bold text-rose-600">{formError}</p>}

          <div className="flex justify-end text-[11px] text-slate-700 pt-2">
            <div className="text-right space-y-1">
              <div>
                <span className="font-bold mr-2">날짜</span>
                <span className="font-semibold">{formatKrDate(data.signedAt)}</span>
              </div>
              <div>
                <span className="font-bold mr-2">이름 / 서명</span>
                <span className="font-semibold">{data.signedBy}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2 shrink-0">
          {isView && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                저장
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3.5 py-2 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                인쇄
              </button>
            </>
          )}
          {isCreate && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              사유서 제출 및 처리
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-lg cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
