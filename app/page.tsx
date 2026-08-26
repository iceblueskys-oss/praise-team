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
  Image as ImageIcon,
  CheckCircle2,
  ChevronLeft,
  PenTool,
  Wifi,
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
  sheetUrl: string;
  order: number;
}

interface Conti {
  id: string;
  title: string;
  date: string;
}

export default function PraiseApp() {
  const [mounted, setMounted] = useState(false);
  const [contis, setContis] = useState<Conti[]>([]);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalKey, setModalKey] = useState('C');
  const [modalBpm, setModalBpm] = useState('');
  const [modalSheetUrl, setModalSheetUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 뷰어 및 필기 상태
  const [viewingSong, setViewingSong] = useState<SongItem | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#ef4444');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const isLocalDrawing = useRef(false);

  // 1. Firebase 실시간 동기화
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
      snapshot.forEach((d) => sList.push({ id: d.id, ...d.data() } as SongItem));
      setAllSongs(sList);
    });

    return () => {
      unsubContis();
      unsubSongs();
    };
  }, []);

  // 2. 실시간 악보 필기 동기화
  useEffect(() => {
    if (!viewingSong) return;

    const drawDocRef = doc(db, 'drawings_v2', viewingSong.id);
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
  }, [viewingSong]);

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
      setModalSheetUrl(song.sheetUrl || '');
    } else {
      setEditingSongId(null);
      setModalTitle('');
      setModalKey('C');
      setModalBpm('');
      setModalSheetUrl('');
    }
    setIsProcessing(false);
    setIsModalOpen(true);
  };

  // 이미지 선택 및 리사이징 압축
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
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
            setModalSheetUrl(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            setModalSheetUrl(rawData);
          }
        } catch {
          setModalSheetUrl(rawData);
        } finally {
          setIsProcessing(false);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  // 곡 저장
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

      const songDocId = editingSongId || `song_${Date.now()}`;
      const songData: SongItem = {
        id: songDocId,
        contiId: activeContiId,
        title: modalTitle.trim(),
        key: modalKey || 'C',
        bpm: modalBpm.trim() ? parseInt(modalBpm.trim(), 10) : null,
        sheetUrl: modalSheetUrl || '',
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
      const dataUrl = canvas.toDataURL('image/png');
      await setDoc(doc(db, 'drawings_v2', viewingSong.id), {
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
    if (!confirm('작성된 필기를 모두 지우시겠습니까? 모든 기기에서도 함께 삭제됩니다.')) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSong) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [];
    try {
      await deleteDoc(doc(db, 'drawings_v2', viewingSong.id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 gap-2">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs">클라우드 동기화 중...</p>
      </div>
    );
  }

  // ==========================================
  // 1. 악보 뷰어 화면 (모바일 & 태블릿 최적화)
  // ==========================================
  if (viewingSong) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col h-screen w-full bg-neutral-950 text-neutral-100 select-none overflow-hidden">
        {/* 상단 뷰어 네비게이션 헤더 */}
        <header className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-neutral-900 border-b border-neutral-800 z-20 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setViewingSong(null)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700 shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">목록으로</span>
            </button>
            <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">
              {viewingSong.title}
            </h1>
            <span className="px-2 py-0.5 text-[11px] sm:text-xs font-bold bg-blue-600 rounded-md sm:rounded-full text-white shrink-0">
              {viewingSong.key}
            </span>
            {viewingSong.bpm && (
              <span className="hidden md:inline px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400 rounded shrink-0">
                BPM {viewingSong.bpm}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {viewingSong.sheetUrl && (
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  isDrawingMode ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isDrawingMode ? '필기 닫기' : '필기'}</span>
              </button>
            )}

            <div className="flex items-center bg-neutral-800 rounded-lg border border-neutral-700 p-0.5">
              <button
                onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
                className="w-7 h-7 flex items-center justify-center text-xs font-bold text-neutral-300 hover:text-white"
              >
                -
              </button>
              <span className="text-[11px] text-neutral-400 w-9 text-center hidden xs:inline-block">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
                className="w-7 h-7 flex items-center justify-center text-xs font-bold text-neutral-300 hover:text-white"
              >
                +
              </button>
            </div>
          </div>
        </header>

        {/* 필기 서브 툴바 (모바일 가로 스크롤 및 컴팩트 배치) */}
        {isDrawingMode && (
          <div className="flex items-center justify-between sm:justify-center gap-2 py-2 px-3 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 z-20 overflow-x-auto text-xs shrink-0 no-scrollbar">
            <div className="flex items-center bg-neutral-800 p-1 rounded-lg gap-1 border border-neutral-700 shrink-0">
              <button
                onClick={() => setCurrentTool('pen')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'pen' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400'}`}
              >
                펜
              </button>
              <button
                onClick={() => setCurrentTool('highlighter')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'highlighter' ? 'bg-yellow-500 text-black font-bold' : 'text-neutral-400'}`}
              >
                형광펜
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`px-2.5 py-1 rounded transition ${currentTool === 'eraser' ? 'bg-neutral-600 text-white font-bold' : 'text-neutral-400'}`}
              >
                지우개
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-neutral-800/80 px-2 py-1 rounded-lg border border-neutral-700 shrink-0">
              {['#ef4444', '#3b82f6', '#10b981', '#ffffff', '#eab308'].map((color) => (
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
              className="px-2.5 py-1 bg-neutral-800 hover:bg-red-950/80 text-red-400 border border-neutral-700 rounded-lg shrink-0"
            >
              초기화
            </button>
          </div>
        )}

        {/* 악보 본문 뷰어 */}
        <main className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 bg-neutral-950">
          {!viewingSong.sheetUrl ? (
            <div className="text-center p-6 bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xs">
              <p className="text-white font-bold text-sm mb-1">등록된 악보 이미지가 없습니다.</p>
              <p className="text-xs text-neutral-400">목록에서 수정 버튼을 눌러 악보를 등록해주세요.</p>
            </div>
          ) : (
            <div
              className="relative transition-transform duration-100 origin-center inline-block max-w-full"
              style={{ transform: `scale(${scale})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={viewingSong.sheetUrl}
                alt={viewingSong.title}
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
        </main>
      </div>
    );
  }

  // ==========================================
  // 2. 메인 콘티 목록 화면 (모바일 & 태블릿 최적화)
  // ==========================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-3 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* 상단 컨트롤 카드 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
          {/* 콘티 셀렉트 및 새 콘티 버튼 */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedContiId}
              onChange={(e) => setSelectedContiId(e.target.value)}
              className="flex-1 sm:flex-none bg-neutral-800 border border-neutral-700 text-white font-bold rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-blue-500"
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
              className="flex items-center justify-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span className="hidden xs:inline">새 콘티</span>
            </button>
          </div>

          {/* 클라우드 상태 배지 및 곡 추가 버튼 */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1.5 rounded-xl font-medium">
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
            <h1 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" />
              <span className="truncate">{currentConti.title}</span>
            </h1>
          </div>
        )}

        {/* 곡 목록 카드 리스트 */}
        <div className="space-y-2.5 sm:space-y-3">
          {currentSongs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-neutral-900/50 border border-neutral-800/80 rounded-2xl text-neutral-500 text-xs sm:text-sm px-4">
              등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-400 font-semibold">[+ 곡 추가]</span> 버튼으로 새 곡을 추가해보세요.
            </div>
          ) : (
            currentSongs.map((song, idx) => (
              <div
                key={song.id}
                className="flex flex-col xs:flex-row items-start xs:items-center justify-between p-3.5 sm:p-4 bg-neutral-900 border border-neutral-800/90 rounded-2xl gap-3 hover:border-neutral-700 transition"
              >
                {/* 곡 정보 */}
                <div className="flex items-center gap-3 min-w-0 w-full xs:w-auto">
                  <span className="w-6 text-center font-black text-neutral-500 text-xs sm:text-sm shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-sm">
                        {song.title}
                      </h3>
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-md shrink-0">
                        {song.key} Key
                      </span>
                      {song.bpm && (
                        <span className="text-[11px] text-neutral-400 font-medium shrink-0">
                          BPM {song.bpm}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 조작 버튼 그룹 */}
                <div className="flex items-center justify-end gap-1.5 w-full xs:w-auto pt-2 xs:pt-0 border-t xs:border-t-0 border-neutral-800/80">
                  <button
                    onClick={() => setViewingSong(song)}
                    className="flex-1 xs:flex-none flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-bold transition active:scale-95 min-h-[34px]"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>악보 보기</span>
                  </button>
                  <button
                    onClick={() => handleOpenModal(song)}
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-neutral-300 transition active:scale-95 min-h-[34px] min-w-[34px] flex items-center justify-center"
                    title="곡 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSong(song.id)}
                    className="p-2 bg-neutral-800 hover:bg-red-950/60 border border-neutral-700 text-neutral-400 hover:text-red-400 rounded-xl transition active:scale-95 min-h-[34px] min-w-[34px] flex items-center justify-center"
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

      {/* ==========================================
          3. 모달 팝업 (모바일 바텀 시트 반응형)
         ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 text-neutral-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-800">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-500" />
                {editingSongId ? '찬양 곡 수정' : '찬양 곡 추가'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-3.5 sm:space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 은혜"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Key</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  >
                    {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">BPM (템포)</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">악보 이미지 파일</label>
                <div className="space-y-2">
                  {modalSheetUrl ? (
                    <div className="flex items-center justify-between p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={modalSheetUrl}
                          alt="악보 미리보기"
                          className="w-10 h-12 sm:w-12 sm:h-14 object-contain rounded bg-white border border-neutral-600 shrink-0"
                        />
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 준비 완료
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalSheetUrl('')}
                        className="p-1.5 text-neutral-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 bg-neutral-800/60 border border-dashed border-neutral-700 rounded-xl text-neutral-400">
                      <ImageIcon className="w-4 h-4 text-neutral-500 ml-1" />
                      <span className="text-xs">파일을 선택해 악보를 등록해주세요.</span>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 sm:py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-semibold text-neutral-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30"
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
