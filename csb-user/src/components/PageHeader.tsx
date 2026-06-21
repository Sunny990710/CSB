import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** 사용자 포털 페이지 제목 — 모든 탭 동일 타이포 */
export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="text-xs text-slate-500 mt-1 font-medium">{description}</p>}
      </div>
      {action}
    </div>
  );
}
