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
import { db, storage } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

interface SongItem {
  id: string;
  title: string;
  key: string;
  bpm?: number;
  sheetUrl: string;
}

interface Conti {
  id: string;
  title: string;
  date: string;
  songs: SongItem[];
}

export default function PraiseApp() {
  const [mounted, setMounted] = useState(false);
  const [contis, setContis] = useState<Conti[]>([]);
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

  // 1. Firebase 실시간 리스너 연결 (모든 기기 즉시 동기화)
  useEffect(() => {
    setMounted(true);
    const q = query(collection(db, 'contis'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Conti[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Conti);
      });
      setContis(list);
      if (list.length > 0) {
        setSelectedContiId((prev) => (prev ? prev : list[0].id));
      }
    });

    return () => unsubscribe();
  }, []);

  const currentConti = contis.find((c) => c.id === selectedContiId) || contis[0];

  // 새 콘티 생성 (Firebase에 저장)
  const handleAddConti = async () => {
    const title = prompt('새 예배 콘티 이름을 입력하세요:', '새 예배 콘티');
    if (!title) return;
    const newId = `conti_${Date.now()}`;
    const newConti: Conti = {
      id: newId,
      title,
      date: new Date().toISOString().split('T')[0],
      songs: [],
    };
    await setDoc(doc(db, 'contis', newId), newConti);
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
    setIsModalOpen(true);
  };

  // 이미지 최적화 및 업로드 준비
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
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            setModalSheetUrl(canvas.toDataURL('image/jpeg', 0.85));
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

  // 곡 저장 (Firebase 클라우드 스토리지 & DB 동시 저장)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !currentConti) return;

    setIsProcessing(true);
    let finalSheetUrl = modalSheetUrl;

    try {
      // Base64 이미지가 새로 들어온 경우 Firebase Storage로 업로드
      if (modalSheetUrl && modalSheetUrl.startsWith('data:image')) {
        const fileId = `sheet_${Date.now()}`;
        const storageReference = ref(storage, `sheets/${fileId}.jpg`);
        await uploadString(storageReference, modalSheetUrl, 'data_url');
        finalSheetUrl = await getDownloadURL(storageReference);
      }

      let updatedSongs: SongItem[];
      if (editingSongId) {
        updatedSongs = (currentConti.songs || []).map((s) =>
          s.id === editingSongId
            ? {
                ...s,
                title: modalTitle.trim(),
                key: modalKey,
                bpm: modalBpm ? parseInt(modalBpm, 10) : undefined,
                sheetUrl: finalSheetUrl,
              }
            : s
        );
      } else {
        const newSong: SongItem = {
          id: 'song_' + Date.now(),
          title: modalTitle.trim(),
          key: modalKey,
          bpm: modalBpm ? parseInt(modalBpm, 10) : undefined,
          sheetUrl: finalSheetUrl,
        };
        updatedSongs = [...(currentConti.songs || []), newSong];
      }

      // Firestore 동기화
      await setDoc(doc(db, 'contis', currentConti.id), {
        ...currentConti,
        songs: updatedSongs,
      });

      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다. Firebase 설정을 확인해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 캔버스 초기화
  const initCanvas = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 1100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (viewingSong) {
      const saved = localStorage.getItem(`draw_${viewingSong.id}`);
      if (saved) {
        const dImg = new Image();
        dImg.onload = () => {
          ctx.drawImage(dImg, 0, 0);
          history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        };
        dImg.src = saved;
      } else {
        history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      }
    }
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
    if (!isDrawing.current || !isDrawingMode) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSong) return;
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    try {
      localStorage.setItem(`draw_${viewingSong.id}`, canvas.toDataURL());
    } catch (e) {
      console.warn(e);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">클라우드 동기화 중...</div>;
  }

  // 뷰어 모드
  if (viewingSong) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col h-screen w-full bg-neutral-950 text-neutral-100 select-none overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewingSong(null)}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>목록으로</span>
            </button>
            <h1 className="font-bold text-base sm:text-lg text-white truncate">{viewingSong.title}</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-600 rounded-full text-white">
              {viewingSong.key} Key
            </span>
            {viewingSong.bpm && (
              <span className="hidden sm:inline px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400 rounded">
                BPM {viewingSong.bpm}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {viewingSong.sheetUrl && (
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  isDrawingMode ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{isDrawingMode ? '필기 닫기' : '악보 필기'}</span>
              </button>
            )}

            <button
              onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
              className="px-2.5 py-1 bg-neutral-800 rounded text-xs font-bold"
            >
              -
            </button>
            <span className="text-xs text-neutral-400 w-8 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
              className="px-2.5 py-1 bg-neutral-800 rounded text-xs font-bold"
            >
              +
            </button>
          </div>
        </header>

        {isDrawingMode && (
          <div className="flex items-center justify-center gap-2 py-2 bg-neutral-900 border-b border-neutral-800 px-4 z-20 flex-wrap text-xs">
            <div className="flex items-center bg-neutral-800 p-1 rounded-lg gap-1 border border-neutral-700">
              <button
                onClick={() => setCurrentTool('pen')}
                className={`px-2 py-1 rounded ${currentTool === 'pen' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400'}`}
              >
                펜
              </button>
              <button
                onClick={() => setCurrentTool('highlighter')}
                className={`px-2 py-1 rounded ${currentTool === 'highlighter' ? 'bg-yellow-500 text-black font-bold' : 'text-neutral-400'}`}
              >
                형광펜
              </button>
              <button
                onClick={() => setCurrentTool('eraser')}
                className={`px-2 py-1 rounded ${currentTool === 'eraser' ? 'bg-neutral-600 text-white font-bold' : 'text-neutral-400'}`}
              >
                지우개
              </button>
            </div>

            {['#ef4444', '#3b82f6', '#10b981', '#000000', '#eab308'].map((color) => (
              <button
                key={color}
                onClick={() => setPenColor(color)}
                style={{ backgroundColor: color }}
                className={`w-5 h-5 rounded-full border-2 ${penColor === color ? 'border-white scale-110' : 'border-transparent'}`}
              />
            ))}

            <button
              onClick={() => {
                if (history.current.length > 1) {
                  history.current.pop();
                  const prev = history.current[history.current.length - 1];
                  const ctx = canvasRef.current?.getContext('2d');
                  if (ctx && prev) ctx.putImageData(prev, 0, 0);
                }
              }}
              className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-300"
            >
              되돌리기
            </button>
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');
                if (ctx && canvas && viewingSong) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  history.current = [];
                  localStorage.removeItem(`draw_${viewingSong.id}`);
                }
              }}
              className="px-2.5 py-1 bg-neutral-800 text-red-400 border border-neutral-700 rounded"
            >
              초기화
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto flex items-center justify-center p-4 bg-neutral-950">
          {!viewingSong.sheetUrl ? (
            <div className="text-center p-8 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <p className="text-white font-bold mb-1">등록된 악보 이미지가 없습니다.</p>
              <p className="text-xs text-neutral-400">목록으로 돌아가 연필(수정) 버튼을 눌러 이미지를 등록해주세요.</p>
            </div>
          ) : (
            <div
              className="relative transition-transform duration-100 origin-center inline-block"
              style={{ transform: `scale(${scale})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={viewingSong.sheetUrl}
                alt={viewingSong.title}
                crossOrigin="anonymous"
                onLoad={initCanvas}
                className="max-h-[85vh] max-w-full object-contain rounded bg-white shadow-2xl block"
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

  // 메인 목록 렌더링
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <select
              value={selectedContiId}
              onChange={(e) => setSelectedContiId(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-white font-bold rounded-xl px-3 py-2 text-sm"
            >
              {contis.length === 0 ? (
                <option>콘티 없음</option>
              ) : (
                contis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({(c.songs || []).length}곡)
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleAddConti}
              className="flex items-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span>새 콘티</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1.5 rounded-xl font-medium">
              <Wifi className="w-3.5 h-3.5" /> 실시간 클라우드 연동됨
            </span>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>곡 및 악보 추가</span>
            </button>
          </div>
        </div>

        {currentConti && (
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            {currentConti.title}
          </h1>
        )}

        <div className="space-y-3">
          {!currentConti?.songs || currentConti.songs.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900/50 border border-neutral-800 rounded-2xl text-neutral-500 text-sm">
              등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-400 font-semibold">[+ 곡 및 악보 추가]</span> 버튼으로 새 곡을 추가해보세요.
            </div>
          ) : (
            currentConti.songs.map((song, idx) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-center font-black text-neutral-500 text-sm">{idx + 1}</span>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {song.title}
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-full">
                        {song.key} Key
                      </span>
                      {song.bpm && <span className="text-xs text-neutral-400">BPM {song.bpm}</span>}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingSong(song)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>악보 보기</span>
                  </button>
                  <button
                    onClick={() => handleOpenModal(song)}
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('곡을 삭제하시겠습니까?')) return;
                      const updated = currentConti.songs.filter((s) => s.id !== song.id);
                      await setDoc(doc(db, 'contis', currentConti.id), {
                        ...currentConti,
                        songs: updated,
                      });
                    }}
                    className="p-2 bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-500" />
                {editingSongId ? '찬양 곡 수정' : '찬양 곡 추가'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 은혜"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Key</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  >
                    {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">BPM</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
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
                          className="w-12 h-14 object-contain rounded bg-white border border-neutral-600"
                        />
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 클라우드 전송 준비 완료
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
                    disabled={isProcessing}
                    className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-200"
                  />
                  {isProcessing && <span className="text-xs text-blue-400 block animate-pulse">클라우드 업로드 및 최적화 중...</span>}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-800 rounded-xl font-semibold text-neutral-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30"
                >
                  {isProcessing ? '저장 중...' : editingSongId ? '수정 완료' : '추가 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
