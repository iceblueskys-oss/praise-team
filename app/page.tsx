'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Eye,
  Calendar,
  FolderPlus,
  X,
  Music,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PenTool,
  Wifi,
  Layers,
  Link as LinkIcon,
  FileText,
  ExternalLink,
  Sun,
  Moon,
  MessageSquare,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

interface SongItem {
  id: string;
  contiId: string;
  title: string;
  key: string;
  bpm?: number | null;
  comment?: string; // 진행 순서 및 연주 메모
  sheetType?: 'file' | 'url';
  sheetUrls: string[];
  order: number;
}

interface Conti {
  id: string;
  title: string;
  date: string;
}

export default function PraiseApp() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // 테마 모드
  const [contis, setContis] = useState<Conti[]>([]);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalKey, setModalKey] = useState('C');
  const [modalBpm, setModalBpm] = useState('');
  const [modalComment, setModalComment] = useState('');
  const [modalSheetType, setModalSheetType] = useState<'file' | 'url'>('file');
  const [modalSheetUrls, setModalSheetUrls] = useState<string[]>([]);
  const [modalUrlInput, setModalUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // 뷰어 상태
  const [viewingSong, setViewingSong] = useState<SongItem | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#ef4444');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const isLocalDrawing = useRef(false);

  // 테마 초기화 & PDF.js 라이브러리 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem('praise_app_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }

    if (typeof window !== 'undefined' && !(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      };
      document.body.appendChild(script);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('praise_app_theme', nextTheme);
  };

  // 1. Firebase 실시간 콘티/곡 목록 동기화
  useEffect(() => {
    setMounted(true);

    const qContis = query(collection(db, 'contis_v2'), orderBy('date', 'desc'));
    const unsubContis = onSnapshot(qContis, (snapshot) => {
      const list: Conti[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Conti));
      setContis(list);
      if (list.length > 0) {
        setSelectedContiId((prev) => (prev ? prev : list[0].id));
      }
    });

    const qSongs = query(collection(db, 'songs_v2'), orderBy('order', 'asc'));
    const unsubSongs = onSnapshot(qSongs, (snapshot) => {
      const sList: SongItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        let sheets: string[] = [];
        if (Array.isArray(data.sheetUrls)) {
          sheets = data.sheetUrls;
        } else if (data.sheetUrl) {
          sheets = [data.sheetUrl];
        }
        sList.push({
          id: d.id,
          contiId: data.contiId,
          title: data.title,
          key: data.key,
          bpm: data.bpm,
          comment: data.comment || '',
          sheetType: data.sheetType || 'file',
          sheetUrls: sheets,
          order: data.order,
        });
      });
      setAllSongs(sList);
    });

    return () => {
      unsubContis();
      unsubSongs();
    };
  }, []);

  // 2. 필기 실시간 동기화
  useEffect(() => {
    if (!viewingSong || viewingSong.sheetType === 'url') return;

    const pageDrawId = `${viewingSong.id}_p${currentPageIndex}`;
    const drawDocRef = doc(db, 'drawings_v2', pageDrawId);

    const unsubDraw = onSnapshot(drawDocRef, (docSnap) => {
      if (isLocalDrawing.current) return;

      const data = docSnap.data();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (data?.drawingData) {
        const dImg = new Image();
        dImg.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(dImg, 0, 0, canvas.width, canvas.height);
          history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        };
        dImg.src = data.drawingData;
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      }
    });

    return () => unsubDraw();
  }, [viewingSong, currentPageIndex]);

  const currentConti = contis.find((c) => c.id === selectedContiId) || contis[0];
  const currentSongs = allSongs.filter((s) => s.contiId === currentConti?.id);

  // 콘티 추가
  const handleAddConti = async () => {
    const title = prompt('새 예배 콘티 이름을 입력하세요:', '새 예배 콘티');
    if (!title) return;
    const newId = `c_${Date.now()}`;
    const newConti: Conti = {
      id: newId,
      title,
      date: new Date().toISOString().split('T')[0],
    };
    await setDoc(doc(db, 'contis_v2', newId), newConti);
    setSelectedContiId(newId);
  };

  // 모달 열기
  const handleOpenModal = (song?: SongItem) => {
    if (song) {
      setEditingSongId(song.id);
      setModalTitle(song.title);
      setModalKey(song.key);
      setModalBpm(song.bpm ? String(song.bpm) : '');
      setModalComment(song.comment || '');
      const type = song.sheetType || 'file';
      setModalSheetType(type);
      if (type === 'url') {
        setModalUrlInput(song.sheetUrls?.[0] || '');
        setModalSheetUrls([]);
      } else {
        setModalSheetUrls(song.sheetUrls || []);
        setModalUrlInput('');
      }
    } else {
      setEditingSongId(null);
      setModalTitle('');
      setModalKey('C');
      setModalBpm('');
      setModalComment('');
      setModalSheetType('file');
      setModalSheetUrls([]);
      setModalUrlInput('');
    }
    setIsProcessing(false);
    setIsModalOpen(true);
  };

  // PDF 변환
  const convertPdfToImages = async (file: File): Promise<string[]> => {
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) throw new Error('PDF 라이브러리 로딩 중');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageImages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setProcessingMsg(`PDF 변환 중... (${pageNum}/${pdf.numPages}p)`);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        pageImages.push(canvas.toDataURL('image/jpeg', 0.75));
      }
    }
    return pageImages;
  };

  // 파일 선택 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newSheets: string[] = [];

    const processImageFile = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const rawData = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let { width, height } = img;
              const MAX_WIDTH = 1100;
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
              } else {
                resolve(rawData);
              }
            } catch {
              resolve(rawData);
            }
          };
          img.onerror = () => resolve(rawData);
          img.src = rawData;
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          setProcessingMsg('PDF 악보 파싱 중...');
          const pdfSheets = await convertPdfToImages(file);
          newSheets.push(...pdfSheets);
        } else {
          setProcessingMsg('이미지 최적화 중...');
          const compressed = await processImageFile(file);
          newSheets.push(compressed);
        }
      }
      setModalSheetUrls((prev) => [...prev, ...newSheets]);
    } catch (err: any) {
      console.error(err);
      alert('파일 처리 오류: ' + (err?.message || '파일을 읽지 못했습니다.'));
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  const handleRemoveSheetPage = (indexToRemove: number) => {
    setModalSheetUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 곡 저장 (코멘트 포함)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      alert('곡 제목을 입력해주세요.');
      return;
    }

    setIsProcessing(true);

    try {
      let activeContiId = currentConti?.id;
      if (!activeContiId) {
        activeContiId = `c_${Date.now()}`;
        await setDoc(doc(db, 'contis_v2', activeContiId), {
          id: activeContiId,
          title: '새 예배 콘티',
          date: new Date().toISOString().split('T')[0],
        });
        setSelectedContiId(activeContiId);
      }

      const finalUrls =
        modalSheetType === 'url'
          ? modalUrlInput.trim()
            ? [modalUrlInput.trim()]
            : []
          : modalSheetUrls;

      const songDocId = editingSongId || `song_${Date.now()}`;
      const songData: SongItem = {
        id: songDocId,
        contiId: activeContiId,
        title: modalTitle.trim(),
        key: modalKey || 'C',
        bpm: modalBpm.trim() ? parseInt(modalBpm.trim(), 10) : null,
        comment: modalComment.trim(),
        sheetType: modalSheetType,
        sheetUrls: finalUrls,
        order: editingSongId
          ? allSongs.find((s) => s.id === editingSongId)?.order || Date.now()
          : Date.now(),
      };

      await setDoc(doc(db, 'songs_v2', songDocId), songData);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('저장 실패: ' + (err?.message || '네트워크를 확인해주세요'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 곡 삭제
  const handleDeleteSong = async (songId: string) => {
    if (!confirm('이 곡을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'songs_v2', songId));
      await deleteDoc(doc(db, 'drawings_v2', songId));
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 캔버스 초기화
  const initCanvas = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 1100;
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    isLocalDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
    } else if (currentTool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = `${penColor}55`;
      ctx.lineWidth = 24;
      ctx.lineCap = 'square';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
    }
  };

  const onDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode || !isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSong) {
      isLocalDrawing.current = false;
      return;
    }
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    try {
      const pageDrawId = `${viewingSong.id}_p${currentPageIndex}`;
      const dataUrl = canvas.toDataURL('image/png');
      await setDoc(doc(db, 'drawings_v2', pageDrawId), {
        drawingData: dataUrl,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('필기 동기화 오류:', e);
    } finally {
      isLocalDrawing.current = false;
    }
  };

  const handleClearDrawing = async () => {
    if (!confirm(`현재 페이지(${currentPageIndex + 1}p)의 필기를 모두 지우시겠습니까?`)) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSong) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [];
    try {
      const pageDrawId = `${viewingSong.id}_p${currentPageIndex}`;
      await deleteDoc(doc(db, 'drawings_v2', pageDrawId));
    } catch (e) {
      console.error(e);
    }
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-2 ${theme === 'dark' ? 'bg-neutral-950 text-neutral-400' : 'bg-slate-50 text-slate-500'}`}>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">찬양팀 앱 불러오는 중...</p>
      </div>
    );
  }

  // 테마별 공통 색상 스타일
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-100 text-slate-800';
  const cardBgClass = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm';
  const subCardBg = isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-slate-100 border-slate-200 text-slate-700';

  // ==========================================
  // 1. 악보 뷰어 화면
  // ==========================================
  if (viewingSong) {
    const isUrlSheet = viewingSong.sheetType === 'url';
    const totalPages = viewingSong.sheetUrls?.length || 0;
    const currentSheetUrl = viewingSong.sheetUrls?.[currentPageIndex] || '';

    return (
      <div className={`fixed inset-0 z-50 flex flex-col h-screen w-full select-none overflow-hidden ${isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-200 text-slate-900'}`}>
        {/* 상단 뷰어 헤더 */}
        <header className={`flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b z-20 shrink-0 gap-2 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                setViewingSong(null);
                setCurrentPageIndex(0);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border shrink-0 cursor-pointer transition ${
                isDark ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">목록</span>
            </button>
            <h1 className="font-bold text-sm sm:text-base truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs">
              {viewingSong.title}
            </h1>
            <span className="px-2 py-0.5 text-[11px] sm:text-xs font-bold bg-blue-600 rounded-md sm:rounded-full text-white shrink-0">
              {viewingSong.key}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isUrlSheet && totalPages > 1 && (
              <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.max(p - 1, 0))}
                  disabled={currentPageIndex === 0}
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-1.5 min-w-[36px] text-center">
                  {currentPageIndex + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={currentPageIndex === totalPages - 1}
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {!isUrlSheet && currentSheetUrl && (
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  isDrawingMode
                    ? 'bg-amber-500 text-neutral-950'
                    : isDark
                    ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isDrawingMode ? '필기 닫기' : '필기'}</span>
              </button>
            )}

            {!isUrlSheet && (
              <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                <button
                  onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 진행 순서 및 연주 메모 상단 알림 바 */}
        {viewingSong.comment && (
          <div className={`px-4 py-2 border-b text-xs flex items-center gap-2 z-10 shrink-0 ${isDark ? 'bg-blue-950/40 border-blue-900/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
            <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-bold shrink-0">진행 순서:</span>
            <span className="truncate">{viewingSong.comment}</span>
          </div>
        )}

        {/* 필기 서브 툴바 */}
        {isDrawingMode && !isUrlSheet && (
          <div className={`flex items-center justify-between sm:justify-center gap-2 py-2 px-3 border-b z-20 overflow-x-auto text-xs shrink-0 no-scrollbar ${isDark ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-slate-200'}`}>
            <div className={`flex items-center p-1 rounded-lg gap-1 border shrink-0 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
              <button
                onClick={() => setCurrentTool('pen')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'pen' ? 'bg-blue-600 text-white font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
              >
                펜
              </button>
              <button
                onClick={() => setCurrentTool('highlighter')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'highlighter' ? 'bg-yellow-500 text-black font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
              >
                형광펜
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'eraser' ? 'bg-neutral-600 text-white font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
              >
                지우개
              </button>
            </div>

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 ${isDark ? 'bg-neutral-800/80 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
              {['#ef4444', '#3b82f6', '#10b981', '#000000', '#eab308'].map((color) => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition ${
                    penColor === color ? 'border-blue-400 scale-110 shadow' : 'border-transparent opacity-80'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleClearDrawing}
              className={`px-2.5 py-1 border rounded-lg shrink-0 ${isDark ? 'bg-neutral-800 hover:bg-red-950/80 text-red-400 border-neutral-700' : 'bg-slate-100 hover:bg-red-100 text-red-600 border-slate-300'}`}
            >
              {currentPageIndex + 1}p 필기 초기화
            </button>
          </div>
        )}

        {/* 본문 뷰어 */}
        <main className={`flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 relative ${isDark ? 'bg-neutral-950' : 'bg-slate-200'}`}>
          {!currentSheetUrl ? (
            <div className={`text-center p-6 border rounded-2xl max-w-xs ${cardBgClass}`}>
              <p className="font-bold text-sm mb-1">등록된 악보가 없습니다.</p>
              <p className="text-xs opacity-70">수정 버튼을 눌러 악보 파일 또는 링크를 등록해주세요.</p>
            </div>
          ) : isUrlSheet ? (
            <div className={`w-full h-full max-w-4xl border rounded-2xl overflow-hidden flex flex-col shadow-2xl ${cardBgClass}`}>
              <div className={`px-4 py-2.5 border-b flex items-center justify-between text-xs ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-200'}`}>
                <span className="truncate max-w-[240px] sm:max-w-md">악보 링크: {currentSheetUrl}</span>
                <a
                  href={currentSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:underline shrink-0 ml-2 font-bold"
                >
                  <span>새 탭으로 열기</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <iframe
                src={currentSheetUrl}
                title={viewingSong.title}
                className="w-full flex-1 bg-white border-0"
              />
            </div>
          ) : (
            <div
              className="relative transition-transform duration-100 origin-center inline-block max-w-full"
              style={{ transform: `scale(${scale})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                key={currentSheetUrl}
                src={currentSheetUrl}
                alt={`${viewingSong.title} - ${currentPageIndex + 1}페이지`}
                onLoad={initCanvas}
                className="max-h-[85vh] w-auto max-w-full object-contain rounded bg-white shadow-2xl block select-none pointer-events-none"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={onDraw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={onDraw}
                onTouchEnd={stopDraw}
                style={{ mixBlendMode: 'multiply' }}
                className={`absolute inset-0 w-full h-full rounded ${
                  isDrawingMode ? 'cursor-crosshair touch-none' : 'pointer-events-none'
                }`}
              />
            </div>
          )}

          {!isUrlSheet && totalPages > 1 && (
            <div className="absolute bottom-4 inset-x-0 flex justify-center items-center gap-4 pointer-events-none">
              <button
                onClick={() => setCurrentPageIndex((p) => Math.max(p - 1, 0))}
                disabled={currentPageIndex === 0}
                className={`pointer-events-auto px-4 py-2 backdrop-blur border rounded-full text-xs font-bold shadow-xl disabled:opacity-20 active:scale-95 transition ${
                  isDark ? 'bg-neutral-900/90 border-neutral-700 text-white' : 'bg-white/90 border-slate-300 text-slate-800'
                }`}
              >
                ◀ 이전 장
              </button>
              <span className={`backdrop-blur border px-3 py-1.5 rounded-full text-xs font-bold shadow-xl ${
                isDark ? 'bg-neutral-900/90 border-neutral-700 text-blue-400' : 'bg-white/90 border-slate-300 text-blue-600'
              }`}>
                {currentPageIndex + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPageIndex((p) => Math.min(p + 1, totalPages - 1))}
                disabled={currentPageIndex === totalPages - 1}
                className={`pointer-events-auto px-4 py-2 backdrop-blur border rounded-full text-xs font-bold shadow-xl disabled:opacity-20 active:scale-95 transition ${
                  isDark ? 'bg-neutral-900/90 border-neutral-700 text-white' : 'bg-white/90 border-slate-300 text-slate-800'
                }`}
              >
                다음 장 ▶
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==========================================
  // 2. 메인 콘티 목록 화면 (다크 / 라이트 모드 지원)
  // ==========================================
  return (
    <div className={`min-h-screen transition-colors duration-200 p-3 sm:p-6 md:p-8 ${bgClass}`}>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* 상단 컨트롤 카드 */}
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-md ${cardBgClass}`}>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedContiId}
              onChange={(e) => setSelectedContiId(e.target.value)}
              className={`flex-1 sm:flex-none border font-bold rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none ${
                isDark
                  ? 'bg-neutral-800 border-neutral-700 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              {contis.length === 0 ? (
                <option value="">콘티 없음 (새 콘티 생성)</option>
              ) : (
                contis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({allSongs.filter((s) => s.contiId === c.id).length}곡)
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleAddConti}
              className={`flex items-center justify-center gap-1 px-3 py-2 border rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${subCardBg}`}
            >
              <FolderPlus className="w-4 h-4 text-blue-500" />
              <span className="hidden xs:inline">새 콘티</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* 테마 전환 버튼 (☀️ 라이트 / 🌙 다크) */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${subCardBg}`}
              title="테마 모드 변경"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
              <span>{isDark ? '밝은 모드' : '어두운 모드'}</span>
            </button>

            <span className={`hidden xs:flex items-center gap-1 text-[11px] border px-2.5 py-1.5 rounded-xl font-medium ${
              isDark ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              <Wifi className="w-3.5 h-3.5" /> 실시간 동기화
            </span>

            <button
              onClick={() => handleOpenModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>곡 추가</span>
            </button>
          </div>
        </div>

        {/* 현재 콘티 타이틀 */}
        {currentConti && (
          <div className="flex items-center justify-between px-1">
            <h1 className="text-lg sm:text-2xl font-black flex items-center gap-2">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" />
              <span className="truncate">{currentConti.title}</span>
            </h1>
          </div>
        )}

        {/* 곡 목록 카드 리스트 */}
        <div className="space-y-2.5 sm:space-y-3">
          {currentSongs.length === 0 ? (
            <div className={`text-center py-12 sm:py-16 border rounded-2xl text-xs sm:text-sm px-4 opacity-70 ${cardBgClass}`}>
              등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-500 font-semibold">[+ 곡 추가]</span> 버튼으로 새 곡을 추가해보세요.
            </div>
          ) : (
            currentSongs.map((song, idx) => (
              <div
                key={song.id}
                className={`flex flex-col xs:flex-row items-start xs:items-center justify-between p-3.5 sm:p-4 rounded-2xl border gap-3 transition ${cardBgClass}`}
              >
                {/* 곡 정보 및 코멘트 */}
                <div className="flex items-start gap-3 min-w-0 w-full xs:w-auto flex-1">
                  <span className="w-6 text-center font-black text-xs sm:text-sm shrink-0 opacity-60 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-sm">
                        {song.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-[11px] font-bold border rounded-md shrink-0 ${
                        isDark ? 'bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}>
                        {song.key} Key
                      </span>
                      {song.sheetType === 'url' ? (
                        <span className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded-md shrink-0 ${
                          isDark ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          <LinkIcon className="w-3 h-3" /> 링크
                        </span>
                      ) : (
                        song.sheetUrls && song.sheetUrls.length > 1 && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded-md shrink-0 ${
                            isDark ? 'bg-purple-600/30 border-purple-500/40 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'
                          }`}>
                            <Layers className="w-3 h-3" /> {song.sheetUrls.length}장
                          </span>
                        )
                      )}
                      {song.bpm && (
                        <span className="text-[11px] opacity-70 font-medium shrink-0">
                          BPM {song.bpm}
                        </span>
                      )}
                    </div>

                    {/* 진행 순서 및 연주 코멘트 표시 */}
                    {song.comment && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 font-medium">
                        <MessageSquare className="w-3 h-3 shrink-0" />
                        <span className="truncate">{song.comment}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 조작 버튼 그룹 */}
                <div className={`flex items-center justify-end gap-1.5 w-full xs:w-auto pt-2 xs:pt-0 border-t xs:border-t-0 ${isDark ? 'border-neutral-800' : 'border-slate-100'}`}>
                  <button
                    onClick={() => {
                      setViewingSong(song);
                      setCurrentPageIndex(0);
                    }}
                    className={`flex-1 xs:flex-none flex items-center justify-center gap-1 px-3 py-1.5 border rounded-xl text-xs font-bold transition active:scale-95 min-h-[34px] ${
                      isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span>악보 보기</span>
                  </button>
                  <button
                    onClick={() => handleOpenModal(song)}
                    className={`p-2 border rounded-xl transition active:scale-95 min-h-[34px] min-w-[34px] flex items-center justify-center ${subCardBg}`}
                    title="곡 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSong(song.id)}
                    className={`p-2 border rounded-xl transition active:scale-95 min-h-[34px] min-w-[34px] flex items-center justify-center ${
                      isDark ? 'bg-neutral-800 hover:bg-red-950/60 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-slate-100 hover:bg-red-50 border-slate-200 text-slate-500 hover:text-red-600'
                    }`}
                    title="곡 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 sm:pb-4 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-500" />
                {editingSongId ? '찬양 곡 수정' : '찬양 곡 추가'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 opacity-70 hover:opacity-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-3.5 sm:space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1">곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 은혜"
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold opacity-80 mb-1">Key</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold opacity-80 mb-1">BPM (템포)</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* 진행 순서 및 연주 메모 코멘트 입력란 */}
              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1">
                  진행 순서 / 연주 메모 (코멘트)
                </label>
                <input
                  type="text"
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="예: Intro 4마디 후 시작 · 2절 후렴 반복 · 기도 인도"
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* 악보 등록 방식 */}
              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1.5">악보 등록 방식</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setModalSheetType('file')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                      modalSheetType === 'file'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    파일 (이미지/PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalSheetType('url')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                      modalSheetType === 'url'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    웹 링크 (URL)
                  </button>
                </div>

                {modalSheetType === 'file' ? (
                  <div className="space-y-2">
                    {modalSheetUrls.length > 0 && (
                      <div className={`grid grid-cols-3 gap-2 p-2.5 border rounded-xl max-h-48 overflow-y-auto ${isDark ? 'bg-neutral-800/80 border-neutral-700' : 'bg-slate-100 border-slate-200'}`}>
                        {modalSheetUrls.map((url, index) => (
                          <div key={index} className={`relative group border rounded-lg p-1 flex flex-col items-center ${isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-300'}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${index + 1}p`}
                              className="w-full h-16 object-contain rounded bg-white"
                            />
                            <span className="text-[10px] font-bold opacity-80 mt-1">
                              {index + 1} 페이지
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSheetPage(index)}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow"
                              title="이 페이지 삭제"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*,application/pdf,.pdf"
                      multiple
                      onChange={handleFileChange}
                      className={`w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 file:bg-neutral-800 file:text-neutral-200'
                          : 'text-slate-600 file:bg-slate-200 file:text-slate-800'
                      }`}
                    />
                    {isProcessing && (
                      <span className="text-xs text-blue-500 block animate-pulse">
                        {processingMsg || '악보 처리 중...'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      value={modalUrlInput}
                      onChange={(e) => setModalUrlInput(e.target.value)}
                      placeholder="https://example.com/score.png 또는 악보 링크"
                      className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-[11px] opacity-60 block mt-1.5">
                      구글 드라이브, 이미지 링크, 악보 웹페이지 URL을 붙여넣으세요.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30"
                >
                  {isProcessing ? '처리 중...' : editingSongId ? '수정 완료' : '추가 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
