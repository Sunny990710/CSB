import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Search, FileSpreadsheet, Image as ImageIcon, 
  Upload, X, Check, RefreshCw, AlertCircle, FileText, CheckCircle, ChevronDown, Eye,
  LayoutGrid, List, HelpCircle, Camera, Sparkles, Download, Share2
} from 'lucide-react';
import { Sample, SampleStatus, Rental } from '../types';

interface SampleManagerViewProps {
  samples: Sample[];
  onSaveDB: (newSamples: Sample[]) => void;
  forceTab?: 'list' | 'bulk-excel' | 'bulk-images';
  rentals?: Rental[];
}

export default function SampleManagerView({ samples, onSaveDB, forceTab, rentals = [] }: SampleManagerViewProps) {
  // Main view state
  const [activeTab, setActiveTab] = useState<'list' | 'bulk-excel' | 'bulk-images'>(forceTab || 'list');

  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
    }
  }, [forceTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('전체');
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [selectedCondition, setSelectedCondition] = useState('전체');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Single sample modal or edit form states
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingDetail, setViewingDetail] = useState<Sample | null>(null);
  const [autoFillOn, setAutoFillOn] = useState(true);
  const [viewingDetailCuts, setViewingDetailCuts] = useState(false);
  const [colorInput, setColorInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');

  // Active preview mode for side (front or back)
  const [activePreviewSide, setActivePreviewSide] = useState<'front' | 'back'>('front');
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [showEditMenu, setShowEditMenu] = useState<boolean>(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState<boolean>(false);

  const getStatusBadgeStyle = (st: string) => {
    switch (st) {
      case '대여가능': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20';
      case '대여중': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20';
      case '연체중': return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20 animate-pulse';
      case '부평보관': return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  // Sync active preview tab to front side whenever editing target changes
  useEffect(() => {
    setActivePreviewSide('front');
  }, [editingSample?.id]);

  // New single sample form
  const [newSample, setNewSample] = useState<Partial<Sample>>({
    code: '',
    name: '',
    brand: '중국포인포',
    category: '유형화샘플',
    status: '대여가능',
    locationNo: '0',
    registerer: '허경아',
    useYn: '사용',
    color: '',
    gender: 'U',
    country: 'KR',
    price: 0,
    description: '',
    brandCode: 'POINFO_CN',
    season: 'SS',
    material: '',
    imgFront: '',
    imgBack: '',
  });

  // Excel Bulk registration state
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [parsedBulkRows, setParsedBulkRows] = useState<any[]>([]);
  const [bulkError, setBulkError] = useState('');

  // Bulk images drag & drop matching state
  const [dragActive, setDragActive] = useState(false);
  const [uploadedPreviewFiles, setUploadedPreviewFiles] = useState<{
    id: string;
    filename: string;
    base64: string;
    matchedCode: string | null;
    isBack: boolean;
    assigned: boolean;
  }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New States for AI Smart Bulk Wardrobe creator (Mode B)
  const [bulkImagesMode, setBulkImagesMode] = useState<'mapping' | 'ai-new'>('mapping');
  const [aiDraftItems, setAiDraftItems] = useState<{
    id: string;
    filenameFront: string;
    filenameBack?: string;
    base64Front: string;
    base64Back?: string;
    isAnalyzing: boolean;
    isAnalyzed: boolean;
    name: string;
    brand: string;
    price: number;
    material: string;
    size: string;
    condition: string;
    color: string;
    country: string;
    gender: string;
    category: string;
    description: string;
    season: string;
    activeImgTab?: 'front' | 'back';
  }[]>([]);
  const [aiViewMode, setAiViewMode] = useState<'card' | 'table'>('card');
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered samples
  const filteredSamples = samples.filter((s) => {
    const matchQuery = 
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registerer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const countVal = (s.country === 'CN' || s.category === '중국샘플') ? '중국' : '한국';
    const matchCountry = selectedCountry === '전체' || countVal === selectedCountry;

    const catVal = s.category === '중국샘플' ? '유형화샘플' : s.category;
    const matchCategory = selectedCategory === '전체' || catVal === selectedCategory;

    const matchBrand = selectedBrand === '전체' || s.brand === selectedBrand;
    const matchStatus = selectedStatus === '전체' || s.status === selectedStatus;
    const matchCondition = selectedCondition === '전체' || (s.condition || '아주 좋음') === selectedCondition;
    
    return matchQuery && matchBrand && matchCategory && matchStatus && matchCondition && matchCountry;
  });

  // Get list of unique brands / categories
  const uniqueBrands = ['전체', ...Array.from(new Set(samples.map((s) => s.brand)))];
  const uniqueCategories = ['전체', '오리지널', '유형화샘플', 'EP샘플', '자사샘플'];

  // Excel file / text parser helper (tsv parser)
  const handleParseExcelText = () => {
    if (!bulkTextInput.trim()) {
      setBulkError('분석할 행 텍스트가 비어있습니다.');
      return;
    }

    try {
      setBulkError('');
      const rows = bulkTextInput.split('\n');
      const tempRows: any[] = [];
      
      rows.forEach((row, idx) => {
        const cleanRow = row.trim();
        if (!cleanRow) return;
        
        // Split by tabs or commas
        const cols = cleanRow.split(/\t|,/);
        
        // Skip header indicator lines if first column looks like '번호' or '상품코드' or '중복여부'
        if (idx === 0 && (cleanRow.includes('상품코드') || cleanRow.includes('코드') || cleanRow.includes('상태'))) {
          return;
        }

        // Try mapping Columns:
        // We look for a pattern where column might match:
        // 0: 상품코드, 1: 상품명, 2: 브랜드, 3: 카테고리, 4: 위치번호, 5: 칼라, 6: 등록자, 7: 가격...
        // Let's make an intelligent mapper, or simple default indexed fallback:
        let code = '';
        let name = '';
        let status: SampleStatus = '대여가능';
        let brand = '중국포인포';
        let category = '유형화샘플';
        let locationNo = '0';
        let registerer = '허경아';
        let price = 0;
        let color = '';
        let gender = 'U';
        let material = '';

        if (cols.length >= 2) {
          // Check if col looks like sample code format: e.g. starts with letters and numbers
          const isCode = (str: string) => /^[A-Za-z0-9_-]{5,20}$/.test(str.trim());
          
          // Row matching order fallback
          if (isCode(cols[0])) {
            code = cols[0].trim();
            name = cols[1]?.trim() || '';
            status = (cols[2]?.trim() as SampleStatus) || '대여가능';
            brand = cols[3]?.trim() || '중국포인포';
            category = cols[4]?.trim() || '유형화샘플';
          } else if (cols[1] && isCode(cols[1])) {
            // 번호가 첫 칸에 포함된 경우 (e.g. 1 PCCAI032991 ...)
            code = cols[1].trim();
            name = cols[2]?.trim() || '';
            status = (cols[3]?.trim() as SampleStatus) || '대여가능';
            brand = cols[4]?.trim() || '중국포인포';
            category = cols[5]?.trim() || '유형화샘플';
          } else {
            // General index find for the first code-like cell
            const codeIndex = cols.findIndex(col => isCode(col));
            if (codeIndex !== -1) {
              code = cols[codeIndex].trim();
              name = cols[codeIndex + 1]?.trim() || cols[codeIndex - 1]?.trim() || '';
            } else {
              code = cols[0].trim();
              name = cols[1]?.trim() || '';
            }
          }
        } else {
          // single column represents plain code
          code = cols[0].trim();
        }

        if (code) {
          // Check for duplicate in current state
          const isDuplicate = samples.some(s => s.code === code);
          tempRows.push({
            code,
            name: name || `${code} 샘플 의류`,
            status,
            brand,
            category,
            locationNo,
            registerer,
            price,
            color,
            gender,
            material,
            isDuplicate
          });
        }
      });

      if (tempRows.length === 0) {
        setBulkError('유효한 상품코드 행을 찾을 수 없습니다. 칼럼 구분을 tab이나 반각 쉼표(,)로 기입했는지 확인해 주세요.');
      } else {
        setParsedBulkRows(tempRows);
      }
    } catch (e: any) {
      setBulkError(`파싱 오류 발생: ${e.message}`);
    }
  };

  const handleSaveBulkExcel = () => {
    if (parsedBulkRows.length === 0) return;

    fetch('/api/samples/bulk-excel', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsedBulkRows })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        // Refresh local UI DB
        window.location.reload();
      } else {
        alert('저장에 실패하였습니다: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('일괄 저장 처리 중 오류 발생');
    });
  };

  // Drag & drop file handler
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processUploadedFiles = (files: FileList) => {
    const promises = Array.from(files).map((file) => {
      return new Promise<{ filename: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            filename: file.name,
            base64: event.target?.result as string
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((results) => {
      const parsedPreviews = results.map((item, idx) => {
        const nameLower = item.filename.toLowerCase();
        
        // Find matching sample code
        let matchedCode: string | null = null;
        for (const sample of samples) {
          if (nameLower.includes(sample.code.toLowerCase())) {
            matchedCode = sample.code;
            break;
          }
        }

        // Check if filename contains indications of "back/뒤"
        const isBack = 
          nameLower.includes('back') || 
          nameLower.includes('뒤') || 
          nameLower.includes('_back') || 
          nameLower.includes('_1') || 
          nameLower.includes('_rear') ||
          nameLower.includes('rear');

        return {
          id: `${Date.now()}-${idx}`,
          filename: item.filename,
          base64: item.base64,
          matchedCode,
          isBack,
          assigned: !!matchedCode
        };
      });

      setUploadedPreviewFiles((prev) => [...prev, ...parsedPreviews]);
    }).catch(err => console.error("File processing error:", err));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processUploadedFiles(e.target.files);
    }
  };

  const handleSaveBulkImages = () => {
    if (uploadedPreviewFiles.length === 0) return;

    const payload = uploadedPreviewFiles.map(f => ({
      filename: f.filename,
      base64: f.base64
    }));

    fetch('/api/samples/bulk-images', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        window.location.reload();
      } else {
        alert('오류가 발생했습니다: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('일괄 이미지 업로드 통신 실패');
    });
  };

  const triggerAiAnalysisForItem = (itemId: string, base64: string) => {
    fetch('/api/agent/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64 })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.analysis) {
        const ana = data.analysis;
        setAiDraftItems(prev => prev.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              isAnalyzing: false,
              isAnalyzed: true,
              name: ana.name || item.name,
              brand: ana.brand || item.brand,
              price: Number(ana.price) || item.price,
              material: ana.material || item.material,
              size: ana.size || item.size,
              condition: ana.condition || item.condition,
              color: ana.color || item.color,
              country: ana.country || item.country,
              gender: ana.gender || item.gender,
              category: ana.category || item.category,
              description: ana.description || item.description,
              season: ana.season || item.season
            };
          }
          return item;
        }));
      } else {
        setAiDraftItems(prev => prev.map(item => item.id === itemId ? { ...item, isAnalyzing: false } : item));
      }
    })
    .catch(err => {
      console.error("AI analysis error:", err);
      setAiDraftItems(prev => prev.map(item => item.id === itemId ? { ...item, isAnalyzing: false } : item));
    });
  };

  const processAiUploadedFiles = (files: FileList) => {
    const promises = Array.from(files).map((file) => {
      return new Promise<{ filename: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            filename: file.name,
            base64: event.target?.result as string
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((results) => {
      const getBaseName = (filename: string): string => {
        let name = filename.replace(/\.[^/.]+$/, "").trim();
        const suffixRegex = /[\s_-]+(0[0-9]+|[0-9]+|b[0-9]+|f[0-9]+|front|back|f|b|rear|preview|앞|뒤|전면|후면|전|후|copy|복사)$/i;
        
        let prevName = "";
        while (name !== prevName) {
          prevName = name;
          name = name.replace(suffixRegex, "").trim();
        }
        name = name.replace(/[\s_-]+$/, "").trim();
        return name || filename;
      };

      const isBackImage = (fname: string): boolean => {
        const withoutExt = fname.replace(/\.[^/.]+$/, "").trim().toLowerCase();
        
        // Specific user request layout:
        // SPJWF4VCY5_00 -> front, SPJWF4VCY5_b1 -> back.
        if (withoutExt.endsWith('_b1') || withoutExt.endsWith('-b1') || withoutExt.endsWith(' b1')) {
          return true;
        }

        const lastPartMatch = withoutExt.match(/[\s_-]+(0[0-9]+|[0-9]+|b[0-9]+|f[0-9]+|front|back|f|b|rear|preview|앞|뒤|전면|후면|전|후|copy|복사)$/);
        if (lastPartMatch) {
          const suffix = lastPartMatch[1];
          // Check if suffix clearly represents back: b, back, rear, 뒤, 후면, 후, b1, b2, or even number suffix like 02, 2, 04, 4
          if (/^(b|back|rear|뒤|후면|후|b[0-9]+|02|2|04|4)$/i.test(suffix)) {
            return true;
          }
        }

        return (
          withoutExt.includes('back') ||
          withoutExt.includes('rear') ||
          withoutExt.includes('후면') ||
          withoutExt.includes('뒤')
        );
      };

      const groups: { [key: string]: typeof results } = {};
      results.forEach((item) => {
        const base = getBaseName(item.filename);
        if (!groups[base]) {
          groups[base] = [];
        }
        groups[base].push(item);
      });

      const newDrafts = Object.keys(groups).map((base, idx) => {
        const groupFiles = groups[base];
        const id = `${Date.now()}-${idx}`;

        let frontFile = groupFiles[0];
        let backFile = groupFiles[1] || null;

        if (groupFiles.length === 2) {
          const firstIsBack = isBackImage(groupFiles[0].filename);
          const secondIsBack = isBackImage(groupFiles[1].filename);
          if (firstIsBack && !secondIsBack) {
            frontFile = groupFiles[1];
            backFile = groupFiles[0];
          } else if (secondIsBack && !firstIsBack) {
            frontFile = groupFiles[0];
            backFile = groupFiles[1];
          } else {
            const sorted = [...groupFiles].sort((a, b) => a.filename.localeCompare(b.filename));
            frontFile = sorted[0];
            backFile = sorted[1];
          }
        } else if (groupFiles.length > 2) {
          const backs = groupFiles.filter(f => isBackImage(f.filename));
          const fronts = groupFiles.filter(f => !isBackImage(f.filename));
          frontFile = fronts[0] || groupFiles[0];
          backFile = backs[0] || groupFiles[1] || null;
        }

        const draft = {
          id,
          filenameFront: frontFile.filename,
          filenameBack: backFile ? backFile.filename : undefined,
          base64Front: frontFile.base64,
          base64Back: backFile ? backFile.base64 : undefined,
          isAnalyzing: true,
          isAnalyzed: false,
          name: base.substring(0, 40),
          brand: '중국포인포',
          price: 29000,
          material: '코튼 100%',
          size: 'M',
          condition: '아주 좋음',
          color: '베이지',
          country: 'KR',
          gender: 'U',
          category: '유형화샘플',
          description: '',
          season: 'SS',
          activeImgTab: 'front' as 'front' | 'back'
        };

        triggerAiAnalysisForItem(id, frontFile.base64);
        return draft;
      });

      setAiDraftItems(prev => [...prev, ...newDrafts]);
    }).catch(err => console.error("AI file parsing error:", err));
  };

  const handleSaveBulkAiItems = () => {
    if (aiDraftItems.length === 0) return;

    const payloadItems = aiDraftItems.map(item => ({
      name: item.name,
      brand: item.brand,
      price: item.price,
      material: item.material,
      size: item.size,
      condition: item.condition,
      color: item.color,
      country: item.country,
      gender: item.gender,
      category: item.category,
      description: item.description,
      season: item.season,
      imgFront: item.base64Front,
      imgBack: item.base64Back || ''
    }));

    fetch('/api/samples/bulk-create-from-ai', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payloadItems })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert(data.message);
        setAiDraftItems([]);
        window.location.reload();
      } else {
        alert('등록 중 에러가 발생했습니다: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('일괄 AI 신규 등록 통신 실패');
    });
  };

  // Add sample record
  const handleAddSample = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSample.code) {
      alert('상품코드를 기입해주세요.');
      return;
    }

    const dup = samples.some(s => s.code === newSample.code);
    if (dup) {
      alert('이미 대장에 존재하는 중복된 상품코드입니다.');
      return;
    }

    const payload: Sample = {
      id: samples.length + 1,
      regDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: (newSample.status as SampleStatus) || '대여가능',
      brand: newSample.brand || '중국포인포',
      locationNo: newSample.locationNo || '0',
      code: newSample.code,
      name: newSample.name || `${newSample.code} 샘플 의류`,
      category: newSample.category || '유형화샘플',
      registerer: newSample.registerer || '허경아',
      useYn: '사용',
      color: newSample.color || '',
      gender: newSample.gender || 'U',
      country: newSample.country || 'KR',
      price: Number(newSample.price) || 0,
      description: newSample.description || '',
      brandCode: newSample.brandCode || 'POINFO_CN',
      season: newSample.season || 'SS',
      material: newSample.material || '',
      imgFront: newSample.imgFront || '',
      imgBack: newSample.imgBack || '',
      
      // Defaults matching the standard spec sheet rules
      rentalFee: 15000,
      overdueFee1: 10000,
      overdueFee2: 20000,
      rentalPeriod: 28,
      year: '2026',
      month: '06',
      views: 0,
      topic: '',
      classification: '셔츠, 블라우스(PCCAI03)',
      itemType: '셔츠',
      hangeringNo: '',
      overdueCharge: 0,
      overdueDays: 0,
      postingStatus: '게시'
    };

    onSaveDB([payload, ...samples]);
    setIsAddOpen(false);
    setNewSample({
      code: '',
      name: '',
      brand: '중국포인포',
      category: '유형화샘플',
      status: '대여가능',
      locationNo: '0',
      registerer: '허경아',
      useYn: '사용',
      price: 0,
      imgFront: '',
      imgBack: ''
    });
  };

  // Trigger file loader for edit modal front/back/flat images
  const handleSingleImageUpload = (sampleId: number, side: 'front' | 'back' | 'flat', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const fieldName = side === 'front' ? 'imgFront' : side === 'back' ? 'imgBack' : 'imgFlat';
        const updated = samples.map(s => {
          if (s.id === sampleId) {
            return {
              ...s,
              [fieldName]: base64
            };
          }
          return s;
        });
        onSaveDB(updated);
        
        // sync inside modal if opening
        if (editingSample && editingSample.id === sampleId) {
          setEditingSample(prev => prev ? { ...prev, [fieldName]: base64 } : null);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Download sample image
  const handleDownloadImage = (sample: Sample) => {
    const imageUrl = sample.imgFront || sample.imgBack || '';
    if (!imageUrl) {
      alert("등록된 자산 이미지가 없어 다운로드할 수 없습니다.");
      return;
    }
    
    // Check if it is Base64 data
    if (imageUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `SAMPLE_${sample.code}_front.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Normal URL download fallback
      const a = document.createElement('a');
      a.href = imageUrl;
      a.target = '_blank';
      a.download = `SAMPLE_${sample.code}_front.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Share sample asset link or copy info
  const handleShareImage = (sample: Sample) => {
    const shareText = `[디자인 의류 자산] 상품명: ${sample.name || '미등록'} | 코드: ${sample.code} | 대여료: ₩${(sample.rentalFee ?? 15000).toLocaleString()} | 상태: ${sample.status}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText)
        .then(() => alert("해당 의류 정보가 클립보드에 복사되었습니다!"))
        .catch(() => {
          // fallback if clipboard fails
          alert(shareText);
        });
    } else {
      alert(shareText);
    }
  };

  // Generate beautiful clean product cutout using pixel chroma-key & soft drop shadow
  const generateBgRemoval = (side: 'front' | 'back') => {
    if (!editingSample || isGeneratingBg) return;
    
    const targetImg = side === 'front' ? editingSample.imgFront : editingSample.imgBack;
    
    if (!targetImg) {
      alert(`${side === 'front' ? '전면' : '후면'} 이미지가 등록되어 있어야 누끼컷 생성이 가능합니다.`);
      return;
    }

    setIsGeneratingBg(true);
    
    setTimeout(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = targetImg;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw original image to scan pixels
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          
          // Sample corner background color
          let sumR = 0, sumG = 0, sumB = 0, sampleCount = 0;
          const sampleSize = Math.min(15, Math.floor(canvas.width * 0.05));
          
          // top-left corner
          for (let y = 0; y < sampleSize; y++) {
            for (let x = 0; x < sampleSize; x++) {
              const idx = (y * canvas.width + x) * 4;
              sumR += data[idx];
              sumG += data[idx+1];
              sumB += data[idx+2];
              sampleCount++;
            }
          }
          // top-right corner
          for (let y = 0; y < sampleSize; y++) {
            for (let x = canvas.width - sampleSize; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4;
              sumR += data[idx];
              sumG += data[idx+1];
              sumB += data[idx+2];
              sampleCount++;
            }
          }

          const bgR = sumR / sampleCount;
          const bgG = sumG / sampleCount;
          const bgB = sumB / sampleCount;
          
          const tolerance = 48;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            const dist = Math.sqrt(
              Math.pow(r - bgR, 2) + 
              Math.pow(g - bgG, 2) + 
              Math.pow(b - bgB, 2)
            );
            
            const isWhiteBg = r > 238 && g > 238 && b > 238;
            
            if (dist < tolerance || isWhiteBg) {
              data[i+3] = 0; // Solid transparent background
            } else if (dist < tolerance + 15) {
              const feather = (dist - tolerance) / 15;
              data[i+3] = Math.min(data[i+3], Math.floor(feather * 255));
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          
          // Create final canvas with light gray backdrop and e-commerce drop shadow
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = canvas.width;
          finalCanvas.height = canvas.height;
          const finalCtx = finalCanvas.getContext('2d');
          if (finalCtx) {
            const grad = finalCtx.createLinearGradient(0, 0, 0, finalCanvas.height);
            grad.addColorStop(0, '#f8fafc'); // slate-50
            grad.addColorStop(1, '#f1f5f9'); // slate-100
            finalCtx.fillStyle = grad;
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            finalCtx.shadowColor = 'rgba(15, 23, 42, 0.08)';
            finalCtx.shadowBlur = 18;
            finalCtx.shadowOffsetX = 0;
            finalCtx.shadowOffsetY = 6;
            
            finalCtx.drawImage(canvas, 0, 0);
            
            const cleanDataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
            const fieldCleanName = side === 'front' ? 'imgFrontClean' : 'imgBackClean';
            
            const updated = samples.map(s => {
              if (s.id === editingSample.id) {
                return { ...s, [fieldCleanName]: cleanDataUrl };
              }
              return s;
            });
            onSaveDB(updated);
            setEditingSample(prev => prev ? { ...prev, [fieldCleanName]: cleanDataUrl } : null);
            setShowOriginal(false); // Switch to clean cutout view automatically
            setShowEditMenu(false);
          }
        }
        setIsGeneratingBg(false);
      };
      img.onerror = () => {
        setIsGeneratingBg(false);
        alert('정면 이미지를 로딩하는데 실패했습니다.');
      };
    }, 1800);
  };

  // Edit action save handler
  const handleUpdateSample = () => {
    if (!editingSample) return;
    const updated = samples.map(s => s.id === editingSample.id ? editingSample : s);
    onSaveDB(updated);
    setEditingSample(null);
  };

  // Delete sample
  const handleDeleteSample = (id: number) => {
    if (window.confirm('정말 해당 의류 샘플 자산을 폐기 대장에서 제외하시겠습니까? (대여 내역 잔존 시 데이터 부정합 에러가 발생할 수 있습니다.)')) {
      const updated = samples.filter(s => s.id !== id);
      onSaveDB(updated);
    }
  };

  return (
    <div className="space-y-6" id="sample-manager-container">
      {/* Tab Select bar with high-end badges */}
      <div className="flex border-b border-slate-200" id="management-subtabs">
        {[
          { id: 'list', label: '전체 상품', icon: FileText, desc: '전체 상품 목록 조회 및 단일 등록' },
          { id: 'bulk-excel', label: '엑셀 복사/일괄 등록', icon: FileSpreadsheet, desc: 'Excel 데이터 그대로 붙여넣어 일괄등록' },
          { id: 'bulk-images', label: '상품 이미지 일괄등록', icon: ImageIcon, desc: '촬영 이미지 다중 파일매칭 자동 매핑' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 px-6 font-semibold text-xs flex items-center gap-2 border-b-2 font-sans relative transition-all ${
                isActive 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              id={`tab-btn-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.span 
                  layoutId="activeSubtabUnderline" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" 
                />
              )}
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE VIEW */}
      <AnimatePresence mode="wait">
        {activeTab === 'list' && (
          <motion.div
            key="list-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
            id="list-view-root"
          >
            {/* Beautiful, spacious modern search bar and filter layout mirrored from Screenshot 1 */}
            <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-3xs" id="imagehub-filter-panel">
              
              {/* Row 1: Broad Search Box & Primary Action Button */}
              <div className="flex gap-3 justify-between items-center" id="search-bar-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="검색어를 입력하세요 (상품코드, 상품명, 카테고리, 등록자)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all font-sans"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 p-0.5 hover:bg-slate-200 rounded-full"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsAddOpen(true)}
                  className="bg-violet-650 hover:bg-violet-750 text-white font-bold text-xs h-9.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer"
                  id="btn-trigger-add-sample"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>단일 샘플 신규등록</span>
                </button>
              </div>

              {/* Row 2: Screenshot 1 - Styled Control Chips & View Mode Toggle */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2.5 border-t border-slate-100" id="filter-chips-row">
                <div className="flex flex-wrap gap-2 items-center">
                  
                  {/* Select Trigger chip matching Screenshot 1 [선택하기] */}
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBrand('전체');
                      setSelectedCategory('전체');
                      setSelectedStatus('전체');
                      setSelectedCondition('전체');
                    }}
                    className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                    <span>필터 초기화</span>
                  </button>

                  {/* Brand select as outline chip */}
                  <div className="relative">
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="전체">브랜드: 전체</option>
                      {uniqueBrands.filter(b => b !== '전체').map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Country select as outline chip */}
                  <div className="relative">
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="전체">국가: 전체</option>
                      <option value="한국">국가: 한국</option>
                      <option value="중국">국가: 중국</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Category select as outline chip */}
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="전체">카테고리: 전체</option>
                      {uniqueCategories.filter(c => c !== '전체').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Status Options select as outline chip */}
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="전체">상태: 전체</option>
                      <option value="대여가능">대여가능</option>
                      <option value="대여중">대여중</option>
                      <option value="연체중">연체중</option>
                      <option value="부평보관">부평보관</option>
                      <option value="분실">분실</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Condition Options select as outline chip aligned with user screen */}
                  <div className="relative">
                    <select
                      value={selectedCondition}
                      onChange={(e) => setSelectedCondition(e.target.value)}
                      className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="전체">컨디션: 전체</option>
                      <option value="아주 좋음">아주 좋음</option>
                      <option value="좋음">좋음</option>
                      <option value="양호함">양호함</option>
                      <option value="약간의 얼룩/손상 있음">약간의 얼룩/손상 있음</option>
                      <option value="얼룩/손상 있음">얼룩/손상 있음</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Decorative error checkbox mirroring Screenshot 1 [등록 오류] checkbox style */}
                  <label className="flex items-center gap-1.5 bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 cursor-pointer select-none transition-all">
                    <input 
                      type="checkbox" 
                      checked={selectedStatus === '연체중'} 
                      onChange={(e) => setSelectedStatus(e.target.checked ? '연체중' : '전체')}
                      className="w-3.5 h-3.5 text-violet-650 border-slate-300 rounded-sm focus:ring-violet-500 cursor-pointer" 
                    />
                    <span>미납 연체건만</span>
                  </label>
                </div>

                {/* Counter & Layout mode selector right-aligned like Screenshot 1 */}
                <div className="flex items-center gap-2.5 sm:self-center shrink-0 self-end justify-between w-full sm:w-auto">
                  <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide">
                    이미지 {filteredSamples.length}
                  </span>
                  
                  <div className="flex border border-slate-200/85 rounded-lg p-0.5 bg-slate-50 gap-0.5" id="view-mode-toggle-group">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-violet-650 shadow-3xs' : 'text-slate-400 hover:text-slate-650'}`}
                      title="그리드 보기"
                      id="btn-view-mode-grid"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white text-violet-650 shadow-3xs' : 'text-slate-400 hover:text-slate-650'}`}
                      title="표 보기"
                      id="btn-view-mode-table"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Responsive View Switch (Table View vs Modern Grid Card format) */}
            {(() => {
              const getStatusBadgeStyle = (st: string) => {
                switch(st) {
                  case '대여가능': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  case '대여중': return 'bg-blue-50 text-blue-700 border-blue-100';
                  case '연체중': return 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse';
                  case '부평보관': return 'bg-amber-50 text-amber-700 border-amber-100';
                  default: return 'bg-slate-100 text-slate-600 border-slate-200';
                }
              };

              return viewMode === 'table' ? (
                /* Main apparel table list */
                <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden" id="samples-datagrid-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" id="samples-main-table">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                          <th className="py-3 px-4 text-center min-w-[65px] whitespace-nowrap">번호</th>
                          <th className="py-3 px-4 whitespace-nowrap">상품코드</th>
                          <th className="py-3 px-4 whitespace-nowrap">상품 이미지 (앞/뒤)</th>
                          <th className="py-3 px-4 whitespace-nowrap">상품명</th>
                          <th className="py-3 px-4 whitespace-nowrap">구분(카테고리)</th>
                          <th className="py-3 px-4 whitespace-nowrap">브랜드</th>
                          <th className="py-3 px-4 text-right whitespace-nowrap">대여료</th>
                          <th className="py-3 px-4 whitespace-nowrap">등록일</th>
                          <th className="py-3 px-4 text-center whitespace-nowrap">상태</th>
                          <th className="py-3 px-4 text-center whitespace-nowrap">동작</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                        {filteredSamples.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-20 text-center text-slate-400">
                              검색 필터와 일치하는 의류 샘플 데이터가 존재하지 않습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredSamples.map((sample, index) => {
                            return (
                              <tr key={sample.id} className="hover:bg-slate-50/70 transition-colors" id={`tbl-row-${sample.id}`}>
                                <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-[11px]">{sample.id}</td>
                                <td 
                                  className="py-3.5 px-4 font-mono font-bold text-indigo-650 hover:text-indigo-850 hover:underline cursor-pointer"
                                  onClick={() => setEditingSample(sample)}
                                  title="상세 편집"
                                >
                                  {sample.code}
                                </td>
                                <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-1.5" id={`img-preview-group-${sample.id}`}>
                                    {/* Front Image Slot */}
                                    <div className="relative group/img w-10 h-10 rounded border border-slate-150 bg-slate-50 overflow-hidden flex items-center justify-center">
                                      {sample.imgFront ? (
                                        <img src={sample.imgFront} referrerPolicy="no-referrer" alt="Front" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[9px] text-slate-400 font-mono scale-90">FRONT</span>
                                      )}
                                      <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 cursor-pointer transition-opacity">
                                        <Upload className="w-3.5 h-3.5 text-white" />
                                        <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden" 
                                          onChange={(e) => handleSingleImageUpload(sample.id, 'front', e)}
                                        />
                                      </label>
                                    </div>
                                    {/* Back Image Slot */}
                                    <div className="relative group/img w-10 h-10 rounded border border-slate-150 bg-slate-50 overflow-hidden flex items-center justify-center">
                                      {sample.imgBack ? (
                                        <img src={sample.imgBack} referrerPolicy="no-referrer" alt="Back" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[9px] text-slate-400 font-mono scale-90">BACK</span>
                                      )}
                                      <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 cursor-pointer transition-opacity">
                                        <Upload className="w-3.5 h-3.5 text-white" />
                                        <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden" 
                                          onChange={(e) => handleSingleImageUpload(sample.id, 'back', e)}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </td>
                                <td 
                                  className="py-3.5 px-4 cursor-pointer group/row" 
                                  onClick={() => setEditingSample(sample)}
                                  title="상세 편집"
                                >
                                  <div className="font-semibold text-slate-800 group-hover/row:text-indigo-650 transition-colors">{sample.name || '-'}</div>
                                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">등록자: {sample.registerer}</div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="text-xs text-slate-600 bg-slate-100 py-0.5 px-2 rounded-md font-medium">
                                    {sample.category}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700">{sample.brand}</td>
                                <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 text-right">
                                  {(sample.rentalFee ?? 15000).toLocaleString()}원
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{sample.regDate}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`text-[11px] font-bold py-1 px-2.5 rounded-full border ${getStatusBadgeStyle(sample.status)}`}>
                                    {sample.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex justify-center items-center gap-1.5" id={`action-cell-${sample.id}`} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => setEditingSample(sample)}
                                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                      title="상세 편집"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSample(sample.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                      title="샘플 폐기"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Premium Grid Layout Mode showing gorgeous cards */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5" id="samples-image-grid">
                  {filteredSamples.length === 0 ? (
                    <div className="col-span-full py-24 text-center text-slate-400 bg-white border border-slate-200/50 rounded-2xl">
                      검색 필터와 일치하는 의류 샘플 데이터가 존재하지 않습니다.
                    </div>
                  ) : (
                    filteredSamples.map((sample) => (
                      <div
                        key={sample.id}
                        className="group bg-white rounded-xl border border-slate-200/70 overflow-hidden transition-all duration-200 flex flex-col justify-between hover:border-slate-350 hover:shadow-sm shadow-3xs hover:-translate-y-0.5 cursor-pointer"
                        id={`grid-card-${sample.id}`}
                        onClick={() => setEditingSample(sample)}
                      >
                        {/* Image area with smart aspect ratio representation */}
                        <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden group/img flex items-center justify-center">
                          {sample.imgFront ? (
                            <div className="w-full h-full relative">
                              {/* Front Image */}
                              <img 
                                src={sample.imgFront} 
                                referrerPolicy="no-referrer" 
                                alt={`${sample.name} 전면`} 
                                className={`w-full h-full object-cover transition-opacity duration-300 absolute inset-0 ${
                                  sample.imgBack ? 'group-hover/img:opacity-0' : 'opacity-100'
                                }`} 
                              />
                              {/* Back Image (appears smoothly on hover if configured) */}
                              {sample.imgBack && (
                                <img 
                                  src={sample.imgBack} 
                                  referrerPolicy="no-referrer" 
                                  alt={`${sample.name} 후면`} 
                                  className="w-full h-full object-cover transition-opacity duration-300 absolute inset-0 opacity-0 group-hover/img:opacity-100" 
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-slate-350">
                              <ImageIcon className="w-7 h-7 opacity-35" />
                              <span className="text-[9px] font-bold tracking-wider uppercase font-mono">No Apparel Image</span>
                            </div>
                          )}

                          {/* Top floating badges inside card view */}
                          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1 z-10">
                            <span className={`text-[9px] font-bold py-0.5 px-2 rounded-md border shadow-3xs ${getStatusBadgeStyle(sample.status)}`}>
                              {sample.status}
                            </span>
                          </div>

                          {/* Image Save and Share trigger buttons */}
                          <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity duration-150 z-10" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDownloadImage(sample)}
                              className="p-1.5 bg-white text-slate-650 hover:bg-slate-900 hover:text-white rounded-md border border-slate-200 shadow-3xs cursor-pointer transition-all flex items-center justify-center"
                              title="이미지 저장"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleShareImage(sample)}
                              className="p-1.5 bg-white text-slate-650 hover:bg-slate-900 hover:text-white rounded-md border border-slate-200 shadow-3xs cursor-pointer transition-all flex items-center justify-center"
                              title="의류 자산 공유(클립보드)"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata block inside card view */}
                        <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-white">
                          <div className="space-y-1">
                            <span className="text-[9.5px] font-bold text-violet-600 font-mono tracking-tight uppercase block">
                              {sample.code}
                            </span>
                            <h4 className="text-[12px] font-bold text-slate-800 line-clamp-1 group-hover:text-violet-650 transition-colors" title={sample.name}>
                              {sample.name || `의류 자산 - ${sample.code}`}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-sans">
                              등록: {sample.regDate?.substring(0, 10)} · {sample.registerer}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                            <span className="font-mono font-bold text-slate-800 text-[11px]" title="대여 비용">
                              {`₩${(sample.rentalFee ?? 15000).toLocaleString()}`}
                            </span>

                            <div className="flex gap-1" id={`card-actions-${sample.id}`} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEditingSample(sample)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors"
                                title="상세 편집"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSample(sample.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                title="자산 폐기"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

          </motion.div>
        )}

        {/* Excel style Copy Paste bulk tab */}
        {activeTab === 'bulk-excel' && (
          <motion.div
            key="bulk-excel-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
            id="bulk-excel-root"
          >
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4" id="excel-instructions">
              <h3 className="text-sm font-semibold text-slate-800">엑셀 시트 텍스트 복사 및 붙여넣기 (일괄 업로드)</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                오른쪽 텍스트 입력창 영역에 <b>Excel 시트의 행 영역을 그대로 긁어서(Ctrl+C) 복사 붙여넣기(Ctrl+V)</b> 하십시오. 각 열은 <b>탭 문자</b> 또는 쉼표 기호로 구분되어야 합니다.<br />
                <b>예제 양식 데이터 순서 추천:</b> <code className="font-mono bg-slate-100 text-indigo-700 py-0.5 px-2 rounded-md">상품코드 | 상품명 | 상태 | 브랜드 | 카테고리</code>
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1" id="excel-interactive-editor">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700">1. 아래 텍스트박스에 데이터 복사 붙여넣기</span>
                  <textarea
                    rows={8}
                    className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400/80 leading-relaxed"
                    placeholder={`PCCAI032975\t25SS 캐주얼 후드 보이스 트랙수트\t대여가능\t중국포인포\t유형화샘플\nPCCAI032974\t25FW 아동 패딩 베스트 웰론\t대여가능\t중국포인포\t오리지널`}
                    value={bulkTextInput}
                    onChange={(e) => setBulkTextInput(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setBulkTextInput('')}
                      className="text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      비우기
                    </button>
                    <button
                      onClick={handleParseExcelText}
                      className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      id="btn-parse-excel"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      구조화 분석하기
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 flex flex-col justify-between" id="excel-pre-template">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <FileText className="w-4 h-4 text-slate-500" />
                      엑셀 모의 템플릿 로컬 기재해 직접 테스트하기
                    </span>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      별빛 아우터와 겨울 시즌 아동복을 대량 등록하기 편하도록 세팅하였습니다. "템플릿 예시 삽입" 버튼을 클릭해 텍스트창을 채운 뒤 실시간으로 수량을 체크하고 일괄 등록하십시오.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setBulkTextInput(
                        `PCCAI032979\t26SS 기모 세일러 세트 원앤원\t대여가능\t중국포인포\t유형화샘플\n` +
                        `PCCAI032978\t윈터 슬림 슬러시 롱 아우터\t부평보관\t중국포인포\t오리지널\n` +
                        `PCCAI032977\t에센셜 스트라이프 아우터 패션 자켓\t대여가능\t중국포인포\t자사샘플\n` +
                        `PCCAI032976\t에어 서쿨레이터 여름 반팔 아동복\t대여가능\t중국포인포\t중국샘플`
                      );
                    }}
                    className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold py-2 rounded-lg transition-colors shadow-2xs"
                  >
                    템플릿 예시 텍스트 삽입하기
                  </button>
                </div>
              </div>
            </div>

            {bulkError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100 flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {parsedBulkRows.length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4" id="excel-parse-preview">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500 animate-bounce" />
                    <h4 className="text-sm font-semibold text-slate-800">일괄 분석 완료 내역 ({parsedBulkRows.length}건)</h4>
                  </div>
                  <button
                    onClick={handleSaveBulkExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-1 shadow-sm shrink-0"
                    id="btn-save-bulk-excel"
                  >
                    일합 대장 저장 및 일괄 등록
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans" id="parsed-preview-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400">
                        <th className="py-2.5 px-3">중복여부</th>
                        <th className="py-2.5 px-3">샘플코드</th>
                        <th className="py-2.5 px-3">샘플명</th>
                        <th className="py-2.5 px-3">브랜드</th>
                        <th className="py-2.5 px-3">위치번호</th>
                        <th className="py-2.5 px-3">카테고리</th>
                        <th className="py-2.5 px-3">등록자</th>
                        <th className="py-2.5 px-3">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedBulkRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold">
                            {row.isDuplicate ? (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 py-0.5 px-1.5 rounded">중복 (갱신용)</span>
                            ) : (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 py-0.5 px-1.5 rounded">신규 자산</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{row.code}</td>
                          <td className="py-2.5 px-3">{row.name}</td>
                          <td className="py-2.5 px-3 font-medium">{row.brand}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{row.locationNo}</td>
                          <td className="py-2.5 px-3 text-slate-500">{row.category}</td>
                          <td className="py-2.5 px-3 text-slate-500">{row.registerer}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Bulk image front back drag drop map tab */}
        {activeTab === 'bulk-images' && (
          <motion.div
            key="bulk-images-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
            id="bulk-images-root"
          >
            {/* Mode Option Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl max-w-md border border-slate-200" id="bulk-images-mode-selector font-sans">
              <button
                type="button"
                onClick={() => setBulkImagesMode('mapping')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  bulkImagesMode === 'mapping'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>기존 의류 사진 일괄 매핑</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkImagesMode('ai-new')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  bulkImagesMode === 'ai-new'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                <span>신규 의류 AI 일괄 등록</span>
              </button>
            </div>

            {/* Mode A: Image Mapping to Existing Closet Codes */}
            {bulkImagesMode === 'mapping' && (
              <div className="space-y-6" id="bulk-images-mapping-block">
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4" id="images-instructions">
                  <h3 className="text-sm font-semibold text-slate-800">의류 상품 이미지 일괄 스마트 드롭 매칭</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    다수의 의류 정면 및 배면(전면/후면) 촬영 파일들을 마우스로 드래그 앤 드롭 영역에 모조리 끌어다 놓으십시오.<br />
                    <b>파일명 매핑 룰:</b> 시스템은 파일 이름에 포함된 상품코드 기입어(예: <code className="bg-slate-100 text-indigo-700 py-0.5 px-1 font-mono rounded">PCCAI032991</code>)를 판별하여 대장에 매칭하고, 파일명 뒷자리에 <code className="bg-slate-100 font-mono text-slate-700 py-0.5 px-1 rounded">back</code>, <code className="bg-slate-100 font-mono text-slate-700 py-0.5 px-1 rounded">뒤</code>, <code className="bg-slate-100 font-mono text-slate-705 py-0.5 px-1 rounded">_01</code>, <code className="bg-slate-100 font-mono text-slate-700 py-0.5 px-1 rounded">_rear</code> 등이 포함되면 <b>후면(배면) 이미지</b>로 구분하여 매핑합니다.
                  </p>

                  {/* Drag drop zone */}
                  <div
                    className={`p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                      dragActive 
                        ? 'border-indigo-500 bg-indigo-50/50' 
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    id="drag-images-dropzone"
                  >
                    <div className="p-4 bg-white rounded-full shadow-xs border border-slate-100 text-slate-400">
                      <Upload className="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">전체 옷 촬영 사진파일을 여기에 끌어다 대기열에 놓으세요</p>
                      <p className="text-[10px] text-slate-400">또는 마우스로 클릭해 직접 기기에서 선택하십시오 (다중 지원)</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {uploadedPreviewFiles.length > 0 && (
                  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4" id="matched-images-list">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-indigo-500" />
                        <h4 className="text-sm font-semibold text-slate-800">업로드 완료 대기열 및 매칭현황 ({uploadedPreviewFiles.length}장)</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUploadedPreviewFiles([])}
                          className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors cursor-pointer"
                        >
                          전체 비우기
                        </button>
                        <button
                          onClick={handleSaveBulkImages}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-1 shadow-sm shrink-0"
                          id="btn-save-bulk-images"
                        >
                          의류 대장 이미지 일괄 등록 완료
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="images-preview-grid">
                      {uploadedPreviewFiles.map((pf) => (
                        <div
                          key={pf.id}
                          className="p-3 bg-slate-50 border border-slate-150 rounded-xl relative flex flex-col gap-2 group/card shadow-2xs"
                        >
                          <button
                            onClick={() => setUploadedPreviewFiles(prev => prev.filter(x => x.id !== pf.id))}
                            className="absolute top-2 right-2 p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full border border-slate-100 opacity-60 group-hover/card:opacity-100 transition-opacity"
                            title="제거"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-full h-32 rounded-lg bg-white overflow-hidden border border-slate-100 flex items-center justify-center">
                            <img src={pf.base64} alt={pf.filename} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="font-mono text-[10px] text-slate-400 truncate tracking-tight">{pf.filename}</div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 font-sans">앞/뒤 판정:</span>
                              <div className="flex gap-1" id={`pf-side-toggle-${pf.id}`}>
                                <button
                                  onClick={() => {
                                    setUploadedPreviewFiles(prev => prev.map(x => x.id === pf.id ? { ...x, isBack: false } : x));
                                  }}
                                  className={`text-[9px] font-bold py-0.5 px-2 rounded-md ${!pf.isBack ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                >
                                  정면 (전)
                                </button>
                                <button
                                  onClick={() => {
                                    setUploadedPreviewFiles(prev => prev.map(x => x.id === pf.id ? { ...x, isBack: true } : x));
                                  }}
                                  className={`text-[9px] font-bold py-0.5 px-2 rounded-md ${pf.isBack ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                >
                                  배면 (후)
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-slate-500">매칭 의류 지정:</span>
                              <select
                                value={pf.matchedCode || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setUploadedPreviewFiles(prev => prev.map(x => x.id === pf.id ? { ...x, matchedCode: val || null, assigned: !!val } : x));
                                }}
                                className="bg-white border border-slate-250 p-1.5 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                              >
                                <option value="">-- 미지정 (수동선택) --</option>
                                {samples.map(s => (
                                  <option key={s.id} value={s.code}>[{s.code}] {s.name}</option>
                                ))}
                              </select>
                            </div>

                            {pf.assigned ? (
                              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 font-sans pt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 duration-100" />
                                지정된 샘플에 자동 삽입됩니다.
                              </div>
                            ) : (
                              <div className="text-[10px] text-rose-500 font-bold flex items-center gap-1 font-sans pt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                상품코드를 직접 지정해주세요.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode B: AI Assisted Bulk Clothes Creator */}
            {bulkImagesMode === 'ai-new' && (
              <div className="space-y-6" id="bulk-images-ai-new-block">
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-slate-800">신규 의류 AI 원클릭 일괄 스마트 등록</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    등록하려는 의류의 촬영 사진들을 업로드 영역에 놓아보세요. <br />
                    <b>Gemini AI 모델</b>이 의류 사진의 전체 윤곽, 브랜드 로고타입, 원단 혼용 재질 및 디자인 큐를 실시간 분석하여 <b>상품명, 브랜드, 대여료, 소재, 사이즈, 색상, 성별추천, 카테고리</b> 등을 자동으로 미리 기입해 드립니다!
                  </p>

                  {/* Drag drop zone for Mode B */}
                  <div
                    className={`p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                      dragActive 
                        ? 'border-indigo-500 bg-indigo-50/50' 
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        processAiUploadedFiles(e.dataTransfer.files);
                      }
                    }}
                    onClick={() => aiFileInputRef.current?.click()}
                    id="drag-ai-images-dropzone"
                  >
                    <div className="p-4 bg-white rounded-full shadow-xs border border-slate-100 text-slate-400">
                      <Sparkles className="w-8 h-8 text-indigo-600 animate-bounce" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">신규 의류 촬영 사진들을 복수로 여기에 가져다 놓으십시오</p>
                      <p className="text-[10px] text-slate-400">또는 클릭하여 기기 사진첩에서 바로 일괄 업로드 (Gemini 가공 지원)</p>
                    </div>
                    <input
                      ref={aiFileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          processAiUploadedFiles(e.target.files);
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* AI Draft items list editor */}
                {aiDraftItems.length > 0 && (
                  <div className="space-y-4" id="ai-draft-matching-container">
                    <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                        <div>
                          <h4 className="text-sm font-bold text-indigo-950 font-sans">AI 일괄 대장 속성 분석 편집 테이블 ({aiDraftItems.length}개 의류 대기)</h4>
                          <p className="text-[10px] text-slate-500 font-sans">
                            개별 카드의 자동 작성 결과를 수정하거나 탭 후 "일괄 등록 완료"를 클릭하면 순차 자동 발급형 코드로 한 번에 영구 기록됩니다.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setAiDraftItems([])}
                          className="text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 py-2 px-4 rounded-lg transition-all cursor-pointer font-sans"
                        >
                          내역 전체비우기
                        </button>
                        
                        {/* Toggle button to switch between table & card views */}
                        <button
                          type="button"
                          onClick={() => setAiViewMode(aiViewMode === 'card' ? 'table' : 'card')}
                          className="text-xs font-bold text-indigo-750 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 py-2 px-4 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                        >
                          {aiViewMode === 'card' ? (
                            <>
                              <List className="w-4 h-4 text-indigo-650" />
                              <span>표 스타일로 전환</span>
                            </>
                          ) : (
                            <>
                              <LayoutGrid className="w-4 h-4 text-indigo-650" />
                              <span>카드 스타일로 전환</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {aiViewMode === 'table' ? (
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs" id="ai-draft-table-view">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-3 px-4 w-16 text-center">이미지</th>
                              <th className="py-3 px-4 min-w-[200px]">상품명 *</th>
                              <th className="py-3 px-4 w-32">브랜드</th>
                              <th className="py-3 px-4 w-32">대여료 (원)</th>
                              <th className="py-3 px-4 w-32">상세 소재</th>
                              <th className="py-3 px-4 w-20">사이즈</th>
                              <th className="py-3 px-4 w-24">시즌</th>
                              <th className="py-3 px-4 w-24">색상</th>
                              <th className="py-3 px-4 w-24">원산지</th>
                              <th className="py-3 px-4 w-28">의류 계열</th>
                              <th className="py-3 px-4 w-28">카테고리</th>
                              <th className="py-3 px-4 w-12 text-center">제거</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {aiDraftItems.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="py-2 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-10 h-10 rounded-md border border-slate-200 overflow-hidden relative bg-slate-50" title={`전면: ${item.filenameFront}`}>
                                      <img src={item.base64Front} alt="Front" className="w-full h-full object-cover" />
                                      {item.isAnalyzing && (
                                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                          <RefreshCw className="w-3 h-3 text-white animate-spin" />
                                        </div>
                                      )}
                                    </div>
                                    {item.base64Back && (
                                      <div className="w-10 h-10 rounded-md border border-slate-200 overflow-hidden relative bg-slate-50" title={`후면: ${item.filenameBack}`}>
                                        <img src={item.base64Back} alt="Back" className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 right-0 bg-indigo-600 text-[8px] px-0.5 text-white scale-90 rounded">BACK</div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, name: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 hover:bg-slate-150/70 focus:bg-white border border-slate-200 py-1 px-2.5 rounded-md font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.brand}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, brand: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200 py-1 px-2 rounded-md font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, price: Number(e.target.value) } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200 py-1 px-2 rounded-md font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.material}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, material: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200 py-1 px-2 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.size}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, size: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200/80 py-1 px-1.5 rounded-md text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <select
                                    value={item.season}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, season: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 border border-slate-200/80 py-1 px-1 rounded-md text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value="SS">SS (봄/여름)</option>
                                    <option value="FW">FW (가을/겨울)</option>
                                  </select>
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.color}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, color: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200/80 py-1 px-2 rounded-md text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={item.country}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, country: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 focus:bg-white border border-slate-200/80 py-1 px-2 rounded-md text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <select
                                    value={item.gender}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, gender: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 border border-slate-200/80 py-1 px-1 rounded-md text-[11px] font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value="F">여성용</option>
                                    <option value="M">남성용</option>
                                    <option value="U">공용</option>
                                  </select>
                                </td>
                                <td className="py-2 px-4">
                                  <select
                                    value={item.category}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, category: e.target.value } : x))}
                                    className="w-full bg-slate-100/50 border border-slate-200/80 py-1 px-1 rounded-md text-[11px] font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value="유형화샘플">유형화샘플</option>
                                    <option value="오리지널">오리지널</option>
                                    <option value="촬영샘플">촬영샘플</option>
                                    <option value="출장샘플">출장샘플</option>
                                  </select>
                                </td>
                                <td className="py-2 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setAiDraftItems(prev => prev.filter(x => x.id !== item.id))}
                                    className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {aiDraftItems.map((item) => (
                          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex gap-5 relative group transition-all hover:border-indigo-200 hover:shadow-md">
                            
                            {/* Left thumbnail preview with status overlays */}
                            <div className="w-32 h-44 bg-slate-55 rounded-lg border border-slate-200 flex-shrink-0 relative overflow-hidden flex flex-col items-center justify-between">
                              <div className="relative w-full h-[142px] flex items-center justify-center bg-slate-50 overflow-hidden">
                                <img 
                                  src={item.activeImgTab === 'back' && item.base64Back ? item.base64Back : item.base64Front} 
                                  alt={item.activeImgTab === 'back' ? item.filenameBack : item.filenameFront} 
                                  className="w-full h-full object-cover" 
                                />
                                
                                {item.isAnalyzing && (
                                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-center gap-1 text-white animate-pulse">
                                    <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                                    <span className="text-[8px] font-bold tracking-wider text-slate-200 font-sans">AI 분석중...</span>
                                  </div>
                                )}

                                {item.isAnalyzed && !item.isAnalyzing && (
                                  <div className="absolute bottom-1 left-1.5 right-1.5 bg-indigo-650/90 text-white font-extrabold text-[8px] py-0.5 rounded-sm flex items-center justify-center gap-0.5 shadow-sm font-sans">
                                    <Sparkles className="w-2 h-2 text-yellow-300" />
                                    <span>AI 추천완료</span>
                                  </div>
                                )}
                              </div>

                              {/* Toggle Front / Back at the bottom of thumbnail if paired */}
                              {item.base64Back ? (
                                <div className="w-full bg-slate-100 border-t border-slate-200 p-0.5 flex gap-0.5 text-[8.5px] font-extrabold select-none">
                                  <button
                                    type="button"
                                    onClick={() => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, activeImgTab: 'front' } : x))}
                                    className={`flex-1 py-0.5 rounded-sm text-center transition-all cursor-pointer ${
                                      (item.activeImgTab || 'front') === 'front'
                                        ? 'bg-indigo-600 text-white font-bold'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    전면
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, activeImgTab: 'back' } : x))}
                                    className={`flex-1 py-0.5 rounded-sm text-center transition-all cursor-pointer ${
                                      item.activeImgTab === 'back'
                                        ? 'bg-indigo-600 text-white font-bold'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    후면
                                  </button>
                                </div>
                              ) : (
                                <div className="w-full bg-slate-50/80 border-t border-slate-200 py-1 text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest font-sans">
                                  단면 이미지
                                </div>
                              )}
                            </div>

                            {/* 2-column or structured inputs form like the requested reference */}
                            <div className="flex-1 space-y-3 min-w-0 pr-2">
                              {/* Product Name */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">상품명 (의류 명칭)</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, name: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-3 pr-8 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-sans"
                                    placeholder="옷 상품명을 입력하세요"
                                  />
                                  <Sparkles className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-indigo-400" />
                                </div>
                              </div>

                              {/* Brand & Price */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">브랜드</label>
                                  <input
                                    type="text"
                                    value={item.brand}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, brand: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-sans"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">대여료 (원)</label>
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, price: Number(e.target.value) } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                                  />
                                </div>
                              </div>

                              {/* Material & Size */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">상세 소재</label>
                                  <input
                                    type="text"
                                    value={item.material}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, material: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-sans"
                                    placeholder="예: 면 100%"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">사이즈 / 시즌</label>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <input
                                      type="text"
                                      value={item.size}
                                      placeholder="XL"
                                      onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, size: e.target.value } : x))}
                                      className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-sans"
                                    />
                                    <select
                                      value={item.season}
                                      onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, season: e.target.value } : x))}
                                      className="w-full bg-slate-50 border border-slate-200 p-1 rounded-lg text-[10px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-sans"
                                    >
                                      <option value="SS">SS (봄/여름)</option>
                                      <option value="FW">FW (가을/겨울)</option>
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* Origin Country & Color & Condition */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">원산지</label>
                                  <input
                                    type="text"
                                    value={item.country}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, country: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 text-center font-sans"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">색상</label>
                                  <input
                                    type="text"
                                    value={item.color}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, color: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-2 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 text-center font-sans"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">컨디션</label>
                                  <select
                                    value={item.condition}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, condition: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 text-center"
                                  >
                                    <option value="아주 좋음">아주 좋음</option>
                                    <option value="좋음">좋음</option>
                                    <option value="양호함">양호함</option>
                                    <option value="약간의 얼룩/손상 있음">약간의 얼룩/손상 있음</option>
                                    <option value="얼룩/손상 있음">얼룩/손상 있음</option>
                                  </select>
                                </div>
                              </div>

                              {/* Gender Target and Category */}
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">의류 계열</label>
                                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    {[
                                      { value: 'F', label: '여성용' },
                                      { value: 'M', label: '남성용' },
                                      { value: 'U', label: '공용' }
                                    ].map(pill => (
                                      <button
                                        key={pill.value}
                                        type="button"
                                        onClick={() => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, gender: pill.value } : x))}
                                        className={`flex-1 text-[10px] py-1 font-bold rounded-md transition-all cursor-pointer ${
                                          item.gender === pill.value
                                            ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-black/5'
                                            : 'text-slate-500 hover:text-slate-850'
                                        }`}
                                      >
                                        {pill.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">대장 카테고리</label>
                                  <select
                                    value={item.category}
                                    onChange={(e) => setAiDraftItems(prev => prev.map(x => x.id === item.id ? { ...x, category: e.target.value } : x))}
                                    className="w-full bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                                  >
                                    <option value="유형화샘플">유형화샘플</option>
                                    <option value="오리지널">오리지널</option>
                                    <option value="촬영샘플">촬영샘플</option>
                                    <option value="출장샘플">출장샘플</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Delete pill */}
                            <button
                              type="button"
                              onClick={() => setAiDraftItems(prev => prev.filter(x => x.id !== item.id))}
                              className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white hover:bg-rose-500 border border-slate-200 hover:border-rose-500 rounded-full flex items-center justify-center text-slate-400 hover:text-white shadow-xs duration-100 cursor-pointer z-10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={handleSaveBulkAiItems}
                        className="py-3 px-8 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md font-sans transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>총 {aiDraftItems.length}개의 AI 완성 의류 옷장 대장에 일괄 등록 완료하기</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SINGLE ITEM DETAIL MODAL */}
      {/* SINGLE ITEM DETAIL MODAL */}
      {viewingDetail && (() => {
        const activeRentalForSample = rentals.find(r => r.sampleCode === viewingDetail.code && r.status !== '반납완료');
        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto font-sans" id="detail-modal">
            <div className="bg-slate-950 text-slate-100 rounded-2xl max-w-4xl w-full border border-slate-800/80 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-4 animate-in fade-in duration-205">
              
              {/* Header Block of Detail viewer */}
              <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-950 shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-extrabold uppercase font-mono px-2 py-0.5 rounded-md border border-indigo-500/10">
                    의류 자산상세 장부 조회
                  </span>
                  <h4 className="text-base font-bold tracking-tight text-white">{viewingDetail.name || '미등록 명칭 샘플'}</h4>
                </div>
                <button 
                  onClick={() => setViewingDetail(null)}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto text-xs flex-1">
                {/* 4-column structured specification ledger */}
                <div className="border border-slate-800 rounded-xl overflow-hidden grid grid-cols-4 font-sans text-[11px] leading-relaxed select-none">
                  {/* Row 1 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">상품코드</div>
                  <div className="bg-slate-950 text-indigo-400 font-mono font-bold p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.code}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold font-sans">상품명</div>
                  <div className="bg-slate-950 text-white font-semibold p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.name || '-'}</div>

                  {/* Row 2 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">등록자</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.registerer}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold">등록일</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.regDate}</div>

                  {/* Row 3 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">카테고리</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.category}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold">상태</div>
                  <div className="bg-slate-950 p-2.5 border-b border-slate-800 flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(viewingDetail.status)}`}>
                      {viewingDetail.status}
                    </span>
                  </div>

                  {/* Row 4 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">연도</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.year || '2026'}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold">시즌</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.season || 'FW'}</div>

                  {/* Row 5 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">달</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.month || '-'}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold font-sans">위치</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.locationNo || '0'}</div>

                  {/* Row 6 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">브랜드</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-slate-800 col-span-3 flex items-center font-bold">{viewingDetail.brand || '-'}</div>

                  {/* Row 7 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">성별</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center">
                    {viewingDetail.gender === 'M' ? '남성용 (M)' : viewingDetail.gender === 'F' ? '여성용 (F)' : '공용 (P)'}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold">컬러</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.color || '-'}</div>

                  {/* Row 8 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">주제</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.topic || '-'}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold font-sans">분류</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.classification || '셔츠, 블라우스(PCCAI03)'}</div>

                  {/* Row 9 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">아이템</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center font-semibold">{viewingDetail.itemType || '-'}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-b border-slate-800 flex items-center font-bold font-sans">국가</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.country || 'JP'}</div>

                  {/* Row 10 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">샘플설명</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center">{viewingDetail.description || '-'}</div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center">대여료</div>
                  <div className="bg-slate-950 text-emerald-400 font-mono font-bold p-2.5 border-b border-slate-800 flex items-center">
                    {(viewingDetail.rentalFee || 15000).toLocaleString()}원
                  </div>

                  {/* Row 11 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">가격</div>
                  <div className="bg-slate-950 text-slate-300 font-mono font-bold p-2.5 border-b border-r border-slate-800 flex items-center">
                    {viewingDetail.price ? `${viewingDetail.price.toLocaleString()}원` : '-'}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center">행거링번호</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{viewingDetail.hangeringNo || '-'}</div>

                  {/* Row 12 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">1차연체 금액</div>
                  <div className="bg-slate-950 text-orange-400 font-mono font-semibold p-2.5 border-b border-r border-slate-800 flex items-center">
                    {(viewingDetail.overdueFee1 || 10000).toLocaleString()}원
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center font-bold">2차연체 금액</div>
                  <div className="bg-slate-950 text-rose-450 font-mono font-semibold p-2.5 border-b border-slate-800 flex items-center font-bold">
                    {(viewingDetail.overdueFee2 || 20000).toLocaleString()}원
                  </div>

                  {/* Row 13 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">연체료</div>
                  <div className="bg-slate-950 text-rose-400 font-mono font-bold p-2.5 border-b border-r border-slate-800 flex items-center">
                    {activeRentalForSample && activeRentalForSample.status === '연체중'
                      ? `${(viewingDetail.overdueCharge || 10000).toLocaleString()}원`
                      : '-'}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center font-bold">연체일</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">
                    {activeRentalForSample && activeRentalForSample.status === '연체중'
                      ? `${Math.max(1, Math.round((Date.now() - new Date(activeRentalForSample.dueDate).getTime()) / (1000 * 60 * 60 * 24)))}일`
                      : '-'}
                  </div>

                  {/* Row 14 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">반납예정일</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-r border-slate-800 flex items-center">
                    {activeRentalForSample ? activeRentalForSample.dueDate : '-'}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center font-bold">대여일</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">{activeRentalForSample ? activeRentalForSample.rentDate : '-'}</div>

                  {/* Row 15 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-b border-slate-800 flex items-center font-bold">대여자</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-b border-r border-slate-800 flex items-center font-bold">
                    {activeRentalForSample 
                      ? `${activeRentalForSample.borrowerName} (${activeRentalForSample.borrowerEmail?.split('@')[0]})` 
                      : '-'}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 font-bold border-b border-slate-800 flex items-center font-bold">대여기간</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 border-b border-slate-800 flex items-center">
                    {viewingDetail.rentalPeriod || 28}일
                  </div>

                  {/* Row 16 */}
                  <div className="bg-slate-900 text-slate-400 p-2.5 border-r border-slate-800 flex items-center font-bold">게시</div>
                  <div className="bg-slate-950 text-slate-300 p-2.5 border-r border-slate-800 flex items-center font-semibold">
                    {viewingDetail.postingStatus || (viewingDetail.useYn === '사용' ? '게시' : '비게시')}
                  </div>
                  <div className="bg-slate-900 text-slate-400 p-2.5 flex items-center font-bold">소재</div>
                  <div className="bg-slate-950 text-slate-300 font-mono p-2.5 flex items-center">{viewingDetail.material || 'C'}</div>
                </div>

                 {/* Product Visual Mock representation */}
                 <div className="space-y-2">
                   <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                     <span className="font-bold text-slate-300 block text-[11px] font-sans">상세이미지 (PRODUCT IMAGES)</span>
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400">보기 모드:</span>
                       <button
                         type="button"
                         onClick={() => setViewingDetailCuts(false)}
                         className={`px-2 py-1 text-[9px] font-extrabold rounded-md cursor-pointer transition-all ${
                           !viewingDetailCuts 
                             ? 'bg-slate-800 text-white font-black' 
                             : 'text-slate-400 hover:text-slate-200'
                         }`}
                       >
                         원본 컷
                       </button>
                       <button
                         type="button"
                         onClick={() => setViewingDetailCuts(true)}
                         className={`px-2 py-1 text-[9px] font-extrabold rounded-md cursor-pointer transition-all ${
                           viewingDetailCuts 
                             ? 'bg-indigo-600 text-white font-black hover:bg-indigo-500' 
                             : 'text-slate-400 hover:text-slate-200'
                         }`}
                       >
                         누끼 컷 (AI)
                       </button>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
                       <span className="font-bold text-slate-400 block text-[10px] text-center">전면 (FRONT)</span>
                       <div className="aspect-[4/5] bg-slate-950 rounded-lg border border-slate-900 overflow-hidden flex items-center justify-center">
                         {(() => {
                           const displayImg = viewingDetailCuts 
                             ? (viewingDetail.imgFrontClean || viewingDetail.imgFront) 
                             : viewingDetail.imgFront;
                           
                           return displayImg ? (
                             <img src={displayImg} referrerPolicy="no-referrer" alt="Front" className="w-full h-full object-cover" />
                           ) : (
                             <div className="text-slate-600 flex flex-col items-center gap-1">
                               <ImageIcon className="w-6 h-6 opacity-40" />
                               <span className="text-[10px]">사진 없음</span>
                             </div>
                           );
                         })()}
                       </div>
                     </div>
 
                     <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
                       <span className="font-bold text-slate-400 block text-[10px] text-center">후면 (BACK)</span>
                       <div className="aspect-[4/5] bg-slate-950 rounded-lg border border-slate-900 overflow-hidden flex items-center justify-center">
                         {(() => {
                           const displayImg = viewingDetailCuts 
                             ? (viewingDetail.imgBackClean || viewingDetail.imgBack) 
                             : viewingDetail.imgBack;
                           
                           return displayImg ? (
                             <img src={displayImg} referrerPolicy="no-referrer" alt="Back" className="w-full h-full object-cover" />
                           ) : (
                             <div className="text-slate-600 flex flex-col items-center gap-1">
                               <ImageIcon className="w-6 h-6 opacity-40" />
                               <span className="text-[10px]">사진 없음</span>
                             </div>
                           );
                         })()}
                       </div>
                     </div>
                   </div>
                 </div>

              </div>
              
              <div className="bg-slate-900 p-4 border-t border-slate-850 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditingSample(viewingDetail);
                    setViewingDetail(null);
                  }}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  수정
                </button>
                <button
                  onClick={() => setViewingDetail(null)}
                  className="bg-slate-800 hover:bg-slate-705 text-white font-bold px-5 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  목록/닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="add-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-3.5 bg-violet-600 rounded-sm" />
                <h4 className="text-xs font-black text-slate-800">의류 샘플 자산 신규 등록</h4>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-200 transition-colors">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddSample} className="p-5 space-y-4 overflow-y-auto font-sans text-xs flex-1">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">상품코드 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="예: PCCAI032995"
                    value={newSample.code}
                    onChange={(e) => setNewSample(prev => ({...prev, code: e.target.value.toUpperCase()}))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">상품명</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="예: CDO 추천 프랑스 바잉 자켓"
                    value={newSample.name}
                    onChange={(e) => setNewSample(prev => ({...prev, name: e.target.value}))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">브랜드</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="예: 중국포인포"
                    value={newSample.brand}
                    onChange={(e) => setNewSample(prev => ({...prev, brand: e.target.value}))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">카테고리</label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 appearance-none pr-8 cursor-pointer"
                      value={newSample.category}
                      onChange={(e) => setNewSample(prev => ({...prev, category: e.target.value}))}
                    >
                      <option value="오리지널">오리지널</option>
                      <option value="자사샘플">자사샘플</option>
                      <option value="중국샘플">중국샘플</option>
                      <option value="유형화샘플">유형화샘플</option>
                      <option value="EP샘플">EP샘플</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-450 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">위치번호</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="예: B-A03"
                    value={newSample.locationNo}
                    onChange={(e) => setNewSample(prev => ({...prev, locationNo: e.target.value}))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">성별구분</label>
                  <div className="relative">
                    <select
                      value={newSample.gender}
                      onChange={(e) => setNewSample(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 appearance-none pr-8 cursor-pointer"
                    >
                      <option value="U">남녀공용 (U)</option>
                      <option value="M">남성전용 (M)</option>
                      <option value="F">여성전용 (F)</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-450 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">칼라</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="멜란지 그레이"
                    value={newSample.color}
                    onChange={(e) => setNewSample(prev => ({...prev, color: e.target.value}))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">소재</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="면 100%"
                    value={newSample.material}
                    onChange={(e) => setNewSample(prev => ({...prev, material: e.target.value}))}
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="bg-white hover:bg-slate-105 border border-slate-250 text-slate-600 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer shadow-3xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-violet-605 text-white font-bold px-5 py-2 rounded-lg hover:bg-violet-750 transition-colors shadow-2xs cursor-pointer text-xs"
                >
                  상품 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* SINGLE EDIT MODAL */}
      {editingSample && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="edit-modal">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200/90 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-4">
            
            {/* Header Block */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black rounded-md uppercase tracking-tight font-mono">
                  Asset Customizer Studio
                </span>
                <h4 className="text-sm font-extrabold text-slate-800">의류 샘플 상세 정보 수정</h4>
              </div>
              <button onClick={() => setEditingSample(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Main Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans text-xs">
              
              {/* Image 1 - Redesigned Interactive Editor Block */}
              <div className="border border-slate-200/85 rounded-xl p-5 bg-white flex flex-col md:flex-row gap-6 relative shadow-xs" id="apparel-redesign-card">
                
                {/* Visual Section (Left) */}
                <div className="w-full md:w-56 flex flex-col items-center shrink-0">
                  <div className="relative w-48 h-60 bg-slate-50 rounded-xl border border-slate-150 overflow-hidden flex items-center justify-center shadow-2xs" id="apparel-edit-viewport">
                    
                    {/* Active preview title tag badge */}
                    <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md text-white font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wide shadow-sm z-20">
                      {activePreviewSide === 'front' ? '전면' : '후면'} {(!showOriginal && (activePreviewSide === 'front' ? editingSample.imgFrontClean : editingSample.imgBackClean)) ? '(누끼)' : '(원본)'}
                    </div>

                    {/* Edit button overlay on top-right */}
                    <div className="absolute top-2.5 right-2.5 z-25">
                      <button
                        type="button"
                        onClick={() => setShowEditMenu(!showEditMenu)}
                        className="bg-white/95 hover:bg-slate-100 border border-slate-200 text-slate-800 font-extrabold text-[9.5px] px-2.5 py-1 rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-slate-600" />
                        <span>편집</span>
                      </button>

                      {/* Dropdown Menu Popup - matching second screenshot exactly */}
                      {showEditMenu && (
                        <div className="absolute right-0 mt-1.5 bg-white border border-slate-200/90 p-1.5 rounded-xl shadow-xl w-40 z-35 space-y-1">
                          <label className="flex items-center gap-2 hover:bg-slate-50 p-2 rounded-lg w-full text-slate-700 font-bold text-[10px] cursor-pointer transition-colors leading-none">
                            <Edit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>이미지 편집</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                handleSingleImageUpload(editingSample.id, activePreviewSide, e);
                                setShowEditMenu(false);
                              }}
                            />
                          </label>
                          <div className="border-t border-slate-100 my-1" />
                          <div className="flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg text-slate-700 font-bold text-[10px] transition-colors leading-none font-sans">
                            <span className="flex items-center gap-2">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>원본 이미지</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowOriginal(!showOriginal);
                              }}
                              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-hidden cursor-pointer ${
                                showOriginal ? 'bg-indigo-650' : 'bg-slate-250'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-3xs transform transition-transform duration-200 ease-in-out ${
                                showOriginal ? 'translate-x-3.5' : 'translate-x-0'
                              }`} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {isGeneratingBg ? (
                      /* Generative AI background removal scanner animation */
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-35 select-none overflow-hidden animate-pulse">
                        {/* Scanning scanner light line */}
                        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_12px_#a78bfa] animate-bounce" style={{ animationDuration: '1.4s' }} />
                        
                        <div className="p-3 bg-violet-950/40 border border-violet-800/40 rounded-full text-violet-400 mb-2.5 animate-spin" style={{ animationDuration: '4s' }}>
                          <RefreshCw className="w-5.5 h-5.5 animate-spin" />
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-violet-400 tracking-wider font-sans">AI 누끼컷 생성 중...</p>
                          <p className="text-[8.5px] text-slate-400 leading-tight">
                            기계학습 실루엣 분리 및<br />
                            조명 그림자 최적화 연산 중...
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Image rendering conditional branch */}
                    {(() => {
                      const hasRawImg = activePreviewSide === 'front' ? editingSample.imgFront : editingSample.imgBack;
                      const displayImg = activePreviewSide === 'front' 
                        ? (showOriginal ? editingSample.imgFront : (editingSample.imgFrontClean || editingSample.imgFront))
                        : (showOriginal ? editingSample.imgBack : (editingSample.imgBackClean || editingSample.imgBack));

                      if (!hasRawImg) {
                        return (
                          <div className="flex flex-col items-center gap-2 p-4 text-center text-slate-400">
                            <Camera className="w-8 h-8 text-slate-350" />
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              {activePreviewSide === 'front' ? 'NO FRONT IMAGE' : 'NO REAR IMAGE'}
                            </span>
                            <label className="text-[9px] font-bold bg-slate-200 text-slate-700 py-1 px-2.5 rounded hover:bg-slate-300 cursor-pointer transition-colors shadow-3xs uppercase mt-1">
                              파일 등록
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleSingleImageUpload(editingSample.id, activePreviewSide, e)}
                              />
                            </label>
                          </div>
                        );
                      }

                      return (
                        <div className="w-full h-full relative group">
                          <img 
                            src={displayImg} 
                            referrerPolicy="no-referrer" 
                            alt={`${activePreviewSide} Preview`} 
                            className="w-full h-full object-cover transition-all" 
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Selector tabs directly under image viewport */}
                  <div className="flex gap-2 mt-3 w-48 justify-between">
                    {[
                      { side: 'front', label: '전면' },
                      { side: 'back', label: '후면' },
                    ].map((item) => {
                      const isActive = activePreviewSide === item.side;
                      return (
                        <button
                          key={item.side}
                          type="button"
                          onClick={() => setActivePreviewSide(item.side as any)}
                          className={`text-[10px] font-extrabold py-1.5 flex-1 text-center rounded-lg border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:bg-slate-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Generate Cutout Action Badge Button */}
                  <div className="w-48 mt-2.5">
                    {(() => {
                      const hasCleanImg = activePreviewSide === 'front' ? editingSample.imgFrontClean : editingSample.imgBackClean;
                      if (hasCleanImg) {
                        return (
                          <button
                            type="button"
                            onClick={() => generateBgRemoval(activePreviewSide)}
                            className="w-full py-1.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 text-violet-650 font-extrabold text-[10px] rounded-lg text-center cursor-pointer transition-all shadow-3xs flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>AI 배경제거 다시실행</span>
                          </button>
                        );
                      } else {
                        return (
                          <button
                            type="button"
                            onClick={() => generateBgRemoval(activePreviewSide)}
                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg text-center cursor-pointer transition-all shadow-3xs flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI 배경제거 누끼컷 생성</span>
                          </button>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Form fields Section (Right side of design) */}
                <div className="flex-1 space-y-4">
                  
                  {/* Row 1: 상품명 with automatic input badge */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-700">상품명</span>
                      <button
                        type="button"
                        onClick={() => setAutoFillOn(prev => !prev)}
                        className={`px-1.5 py-0.5 border text-[9px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          autoFillOn 
                            ? 'bg-blue-50 border-blue-300 text-blue-500 shadow-3xs' 
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${autoFillOn ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                        {autoFillOn ? 'ON 자동입력' : 'OFF 수동입력'}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                      value={editingSample.name}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, name: e.target.value} : null)}
                      placeholder="제품명을 입력하세요"
                    />
                  </div>

                  {/* Row 2: 색상 (Tag inputs) & 카테고리 (Category selection) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 색상 Tags input field */}
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">색상</span>
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 border border-slate-300 bg-slate-50/50 rounded-lg min-h-[32px] focus-within:ring-1 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                        {(() => {
                          const colorArr = editingSample.color ? editingSample.color.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                          return (
                            <>
                              {colorArr.map((tag: string, index: number) => (
                                <span key={index} className="inline-flex items-center gap-1 bg-white text-slate-700 text-[10px] font-bold py-0.5 px-2 rounded-full border border-slate-205 shadow-3xs">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = colorArr.filter((t: string) => t !== tag).join(', ');
                                      setEditingSample(prev => prev ? {...prev, color: updated} : null);
                                    }}
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer font-bold select-none text-[9px]"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                              <input
                                type="text"
                                placeholder={colorArr.length === 0 ? "예: 오렌지 (엔터로 추가)" : ""}
                                value={colorInput}
                                onChange={(e) => setColorInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    const clean = colorInput.trim().replace(/^,+|,+$/g, '');
                                    if (clean && !colorArr.includes(clean)) {
                                      const updatedList = [...colorArr, clean].join(', ');
                                      setEditingSample(prev => prev ? {...prev, color: updatedList} : null);
                                      setColorInput('');
                                    }
                                  }
                                }}
                                className="flex-1 min-w-[70px] bg-transparent text-xs text-slate-800 focus:outline-none py-0.5 font-medium"
                              />
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 카테고리 selection dropdown */}
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">카테고리</span>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors appearance-none pr-8 font-medium cursor-pointer"
                          value={editingSample.category}
                          onChange={(e) => setEditingSample(prev => prev ? {...prev, category: e.target.value} : null)}
                        >
                          <option value="셔츠">셔츠</option>
                          <option value="아우터">아우터</option>
                          <option value="원단">원단</option>
                          <option value="오리지널">오리지널</option>
                          <option value="자사샘플">자사샘플</option>
                          <option value="중국샘플">중국샘플</option>
                          <option value="유형화샘플">유형화샘플</option>
                          <option value="EP샘플">EP샘플</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-450 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: 브랜드 & 원산지 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">브랜드</span>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        value={editingSample.brand}
                        onChange={(e) => setEditingSample(prev => prev ? {...prev, brand: e.target.value} : null)}
                        placeholder="GU"
                      />
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">원산지</span>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        value={editingSample.country}
                        onChange={(e) => setEditingSample(prev => prev ? {...prev, country: e.target.value} : null)}
                        placeholder="원산지"
                      />
                    </div>
                  </div>

                  {/* Row 4: 소재 (Tags) & 상품군 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 소재 tag input */}
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">소재</span>
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 border border-slate-300 bg-slate-50/50 rounded-lg min-h-[32px] focus-within:ring-1 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                        {(() => {
                          const matArr = editingSample.material ? editingSample.material.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                          return (
                            <>
                              {matArr.map((tag: string, index: number) => (
                                <span key={index} className="inline-flex items-center gap-1 bg-white text-slate-700 text-[10px] font-bold py-0.5 px-2 rounded-full border border-slate-205 shadow-3xs">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = matArr.filter((t: string) => t !== tag).join(', ');
                                      setEditingSample(prev => prev ? {...prev, material: updated} : null);
                                    }}
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer font-bold select-none text-[9px]"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                              <input
                                type="text"
                                placeholder={matArr.length === 0 ? "예: 린넨,코튼" : ""}
                                value={materialInput}
                                onChange={(e) => setMaterialInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    const clean = materialInput.trim().replace(/^,+|,+$/g, '');
                                    if (clean && !matArr.includes(clean)) {
                                      const updatedList = [...matArr, clean].join(', ');
                                      setEditingSample(prev => prev ? {...prev, material: updatedList} : null);
                                      setMaterialInput('');
                                    }
                                  }
                                }}
                                className="flex-1 min-w-[70px] bg-transparent text-xs text-slate-800 focus:outline-none py-0.5 font-medium"
                              />
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Classification Button selection */}
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">상품군</span>
                      <div className="flex gap-2 mt-0.5">
                        {[
                          { label: '여성', value: 'F' },
                          { label: '남성', value: 'M' },
                          { label: '공용', value: 'U' },
                        ].map((pill) => {
                          const isSelected = editingSample.gender === pill.value;
                          return (
                            <button
                              key={pill.value}
                              type="button"
                              onClick={() => setEditingSample(prev => prev ? {...prev, gender: pill.value} : null)}
                              className={`px-4 py-1 rounded-full border text-xs font-bold cursor-pointer transition-all flex-1 ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-400 text-blue-600 font-extrabold shadow-3xs scale-102'
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              {pill.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Row 5: 컨디션 상태 조율 select */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-700">컨디션</span>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors appearance-none pr-8 font-bold font-sans cursor-pointer text-indigo-900"
                          value={editingSample.condition || '아주 좋음'}
                          onChange={(e) => setEditingSample(prev => prev ? {...prev, condition: e.target.value} : null)}
                        >
                          <option value="아주 좋음">아주 좋음</option>
                          <option value="좋음">좋음</option>
                          <option value="양호함">양호함</option>
                          <option value="약간의 얼룩/손상 있음">약간의 얼룩/손상 있음</option>
                          <option value="얼룩/손상 있음">얼룩/손상 있음</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="hidden sm:block" />
                  </div>

                </div>
              </div>

              {/* technical asset management fields (Image 2 standard fields) */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4 shadow-3xs" id="technical-asset-specs">
                <span className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-xs" />
                  기타 대장 정보 및 식별자 제어
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 block">상품코드 (수정불가)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-mono font-bold select-none cursor-not-allowed text-xs"
                      value={editingSample.code}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">위치번호</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none text-xs"
                      value={editingSample.locationNo}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, locationNo: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">대여 상태</label>
                    <div className="relative">
                      <select
                        value={editingSample.status}
                        onChange={(e) => setEditingSample(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs appearance-none pr-8 cursor-pointer"
                      >
                        <option value="대여가능">대여가능</option>
                        <option value="대여중">대여중</option>
                        <option value="연체중">연체중</option>
                        <option value="부평보관">부평보관</option>
                        <option value="분실">분실</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-450 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Real-estate financial / operational specs from sheet */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-200/60">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">대여료 (원)</label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      value={editingSample.rentalFee ?? 15000}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, rentalFee: Number(e.target.value)} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">1차연체 금액 (원)</label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      value={editingSample.overdueFee1 ?? 10000}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, overdueFee1: Number(e.target.value)} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">2차연체 금액 (원)</label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      value={editingSample.overdueFee2 ?? 20000}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, overdueFee2: Number(e.target.value)} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">대여기간 (일)</label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      value={editingSample.rentalPeriod ?? 28}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, rentalPeriod: Number(e.target.value)} : null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">연도 (Year)</label>
                    <input
                      type="text"
                      placeholder="예: 2026"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.year ?? '2026'}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, year: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">달 (Month)</label>
                    <input
                      type="text"
                      placeholder="예: 06"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.month ?? '06'}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, month: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">주제 (Topic)</label>
                    <input
                      type="text"
                      placeholder="예: 타탄체크"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.topic ?? ''}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, topic: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">분류 (Classification)</label>
                    <input
                      type="text"
                      placeholder="예: 셔츠, 블라우스"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.classification ?? '셔츠, 블라우스(PCCAI03)'}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, classification: e.target.value} : null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">아이템 종류</label>
                    <input
                      type="text"
                      placeholder="예: 셔츠"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.itemType ?? ''}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, itemType: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">행거링 번호</label>
                    <input
                      type="text"
                      placeholder="예: Hanger-110"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-sans"
                      value={editingSample.hangeringNo ?? ''}
                      onChange={(e) => setEditingSample(prev => prev ? {...prev, hangeringNo: e.target.value} : null)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">게시 상태</label>
                    <div className="relative">
                      <select
                        value={editingSample.postingStatus ?? (editingSample.useYn === '사용' ? '게시' : '비게시')}
                        onChange={(e) => setEditingSample(prev => prev ? { ...prev, postingStatus: e.target.value as any, useYn: e.target.value === '게시' ? '사용' : '미사용' } : null)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs appearance-none pr-8 cursor-pointer"
                      >
                        <option value="게시">게시</option>
                        <option value="비게시">비게시</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-450 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* FRONT & BACK Image replacements pickers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-500 text-[11px]">모달 전면 사진 갱신 (FRONT)</span>
                    <div className="flex items-center gap-3 bg-white p-2 border border-slate-200/90 rounded-lg shadow-3xs">
                      <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-3xs">
                        {editingSample.imgFront ? (
                          <img src={editingSample.imgFront} referrerPolicy="no-referrer" alt="Edit Front" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] text-slate-400 font-mono tracking-tighter text-center">NO FRONT</span>
                        )}
                      </div>
                      <label className="bg-slate-50 hover:bg-slate-100 text-[10px] font-bold py-1.5 px-3 rounded-md border border-slate-200 cursor-pointer shadow-3xs transition-all flex items-center gap-1 shrink-0">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        파일 선택
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleSingleImageUpload(editingSample.id, 'front', e)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-500 text-[11px]">모달 후면 사진 갱신 (BACK)</span>
                    <div className="flex items-center gap-3 bg-white p-2 border border-slate-200/90 rounded-lg shadow-3xs">
                      <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-3xs">
                        {editingSample.imgBack ? (
                          <img src={editingSample.imgBack} referrerPolicy="no-referrer" alt="Edit Back" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] text-slate-400 font-mono tracking-tighter text-center">NO BACK</span>
                        )}
                      </div>
                      <label className="bg-slate-50 hover:bg-slate-100 text-[10px] font-bold py-1.5 px-3 rounded-md border border-slate-200 cursor-pointer shadow-3xs transition-all flex items-center gap-1 shrink-0">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        파일 선택
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleSingleImageUpload(editingSample.id, 'back', e)}
                        />
                      </label>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer buttons block */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSample(null)}
                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-3xs"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleUpdateSample}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                변경사항 저장
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AI DETAIL CUTS SUB-GALLERY OVERLAY DRAWER */}
      {viewingDetailCuts && editingSample && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-55" id="ai-detailcuts-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full flex flex-col max-h-[90vh] text-white overflow-hidden shadow-2xl">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
              <div className="space-y-1">
                <span className="text-[9px] bg-indigo-505/20 text-blue-400 font-extrabold uppercase tracking-widest font-mono">
                  Advanced Vision Analytics
                </span>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Camera className="w-4.5 h-4.5 text-indigo-400" />
                  AI 정밀 직물 패턴 & 구조 디테일 분석 컷 (7장)
                </h4>
              </div>
              <button 
                onClick={() => setViewingDetailCuts(false)} 
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg hover:bg-slate-705"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              {!editingSample.imgFront ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <AlertCircle className="w-10 h-10 text-slate-500 animate-pulse" />
                  <p className="text-sm font-bold text-slate-300">메인 의류 전면 사진이 등록되어있지 않습니다.</p>
                  <p className="text-xs text-slate-400">먼저 전면 사진을 등록하면 원사 분석 및 스티치 디테일 컷이 동적으로 시뮬레이션 추출됩니다.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Render 7 simulated segments */}
                    {[
                      { index: 1, title: "전면 전체 실루엣", tag: "Silhouette Guide", style: "scale-105 saturate-110", aspect: "aspect-[3/4]" },
                      { index: 2, title: "어깨 라인 삼중 봉제", tag: "Shoulder Stitch", style: "scale-150 uppercase shadow-inner", aspect: "aspect-[3/4]" },
                      { index: 3, title: "카라/넥라인 마감 줌", tag: "Neckline Contour", style: "scale-190 -translate-y-4", aspect: "aspect-[3/4]" },
                      { index: 4, title: "소매 단추 및 시보리 밀착탄성", tag: "Cuff Tension", style: "scale-220 origin-bottom-right rotate-2", aspect: "aspect-[3/4]" },
                      { index: 5, title: "케어라벨 및 내부 인쇄", tag: "Product Brand Tag", style: "scale-250 opacity-90 contrast-125 brightness-90", aspect: "aspect-[3/4]" },
                      { index: 6, title: "직물 마이크로 섬유 밀도", tag: "Raw Micro Fiber (400x)", style: "scale-300 contrast-150 hue-rotate-15 saturate-150", aspect: "aspect-[3/4]" },
                      { index: 7, title: "하단 헤리 마감 견고성", tag: "Bottom Hem Detail", style: "scale-200 translate-y-6 brightness-110", aspect: "aspect-[3/4]" },
                    ].map((cut) => (
                      <div key={cut.index} className="bg-slate-950 border border-slate-805 rounded-xl overflow-hidden flex flex-col group/tile shadow-sm">
                        
                        {/* Simulated high resolution crop using zoom offsets */}
                        <div className="relative aspect-[3/4] overflow-hidden bg-slate-950 flex items-center justify-center">
                          <img 
                            src={editingSample.imgFront} 
                            referrerPolicy="no-referrer" 
                            alt={cut.title} 
                            className={`w-full h-full object-cover transition-transform duration-700 group-hover/tile:scale-[3.5] pointer-events-none ${cut.style}`}
                          />
                          <div className="absolute inset-0 bg-slate-900/15 group-hover/tile:bg-transparent transition-colors" />

                          {/* Floating cut ID */}
                          <div className="absolute top-2 left-2 bg-indigo-600 text-white font-mono font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center">
                            #{cut.index}
                          </div>
                          
                          {/* Floating Tag */}
                          <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-3xs text-blue-400 font-bold text-[8.5px] px-1.5 py-0.5 rounded-full border border-slate-700 uppercase tracking-tight font-mono">
                            {cut.tag}
                          </div>
                        </div>

                        {/* Title metadata */}
                        <div className="p-3 space-y-1">
                          <h5 className="text-[11px] font-black tracking-tight text-white group-hover/tile:text-indigo-400 transition-colors">
                            {cut.title}
                          </h5>
                          <p className="text-[9.5px] text-slate-400 leading-normal">
                            {[
                              "의류 소재의 내구성과 균일한 드레이프 흐름 분석 완료.",
                              "바이어스 구조의 삼중 체인 스티칭 올풀림 위험 0% 판정.",
                              "인체공학적 카라 대칭 분석 및 비틀림 복원력 통과.",
                              "시보리 단면 및 원사 텐션 장력 강도 기기 최고 등급 부여.",
                              "오리지널 케어 라벨 일련 식별자 및 정품 규격 부착 일치.",
                              "트윌 직모 구면 섬유 밀도 조밀성 우수 (400배 스캔).",
                              "헤리 테이핑 이중 박음과 지퍼 부자재 슬라이딩 강도 고신뢰성."
                            ][cut.index - 1]}
                          </p>
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* AI helper info box inside drawer */}
                  <div className="p-3.5 bg-indigo-950/40 border border-indigo-805 text-indigo-300 rounded-xl flex items-center gap-2.5 text-[11px] font-sans">
                    <CheckCircle className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
                    <p>
                      위 정밀 디테일 컷은 <b>초고상해 대형 비전 AI 신경망</b>을 기반으로 정밀 크롭 및 오토 스포트라이팅 원단 밀도 융합 추출 장치에 의해 자동 복원/생성되었습니다. 상품 업로드 이미지 해상도와 카메라 노이즈 수준에 따라 스캔 정형성이 조정될 수 있습니다.
                    </p>
                  </div>
                </>
              )}

            </div>

            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setViewingDetailCuts(false)}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-97 text-white font-black px-5 py-2 rounded-lg text-xs cursor-pointer shadow-md transition-all"
              >
                디테일 뷰어 닫기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
