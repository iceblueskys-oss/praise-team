'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  Maximize,
  Minimize,
  Sun,
  PenTool,
  Highlighter,
  Eraser,
  RotateCcw,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface Props {
  sheetSource?: { type: 'image_file' | 'url'; url: string; fileName?: string };
  songTitle: string;
  targetKey: string;
  bpm?: number;
  onBack: () => void;
}

type ToolType = 'pen' | 'highlighter' | 'eraser';

export default function UniversalScoreViewer({
  sheetSource,
  songTitle,
  targetKey,
  bpm,
  onBack,
}: Props) {
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [penColor, setPenColor] = useState('#ef4444');
  const [penSize] = useState(3);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => setWakeLockActive(false));
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    }
  }, []);

  useEffect(() => {
    requestWakeLock();
    return () => {
      wakeLockRef.current?.release();
    };
  }, [requestWakeLock]);

  const hexToRgba = (hex: string, alpha: number) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((char) => char + char).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const syncCanvasWithImage = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth || img.clientWidth;
      canvas.height = img.naturalHeight || img.clientHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const savedDrawing = localStorage.getItem(`drawing_${songTitle}`);
      if (savedDrawing) {
        const imgData = new Image();
        imgData.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgData, 0, 0);
          history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        };
        imgData.src = savedDrawing;
      } else {
        history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      }
    }
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.current.push(currentState);
    if (history.current.length > 25) history.current.shift();
    localStorage.setItem(`drawing_${songTitle}`, canvas.toDataURL());
  };

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = penSize * 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (currentTool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = hexToRgba(penColor === '#000000' ? '#eab308' : penColor, 0.4);
      ctx.lineWidth = penSize * 8;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize * 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    saveToHistory();
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.current.length <= 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    history.current.pop();
    const prevState = history.current[history.current.length - 1];
    ctx.putImageData(prevState, 0, 0);
    localStorage.setItem(`drawing_${songTitle}`, canvas.toDataURL());
  };

  const handleClearAll = () => {
    if (!confirm('작성한 필기를 모두 지우시겠습니까?')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    localStorage.removeItem(`drawing_${songTitle}`);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const isImageSheet =
    sheetSource?.url &&
    (sheetSource.url.startsWith('data:image') || sheetSource.url.match(/\.(jpeg|jpg|png|gif|webp)$/i));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col h-screen w-full bg-neutral-950 text-neutral-100 select-none overflow-hidden"
    >
      <header className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>콘티 목록</span>
          </button>
          <h1 className="font-bold text-base sm:text-lg text-white truncate max-w-[180px] sm:max-w-xs">
            {songTitle}
          </h1>
          <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-600 rounded-full text-white">
            {targetKey} Key
          </span>
          {bpm && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium bg-neutral-800 rounded text-neutral-400">
              BPM {bpm}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isImageSheet && (
            <button
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
                isDrawingMode
                  ? 'bg-amber-500 text-neutral-950'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{isDrawingMode ? '필기 닫기' : '악보 필기'}</span>
            </button>
          )}

          <div
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${
              wakeLockActive ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-neutral-500'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{wakeLockActive ? '화면 켜짐 유지' : '일반'}</span>
          </div>

          <button
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-neutral-300"
          >
            -
          </button>
          <span className="text-xs text-neutral-400 w-8 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-neutral-300"
          >
            +
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {isDrawingMode && isImageSheet && (
        <div className="flex items-center justify-center gap-3 py-2 bg-neutral-900 border-b border-neutral-800 px-4 flex-wrap z-10 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center bg-neutral-800 p-1 rounded-lg gap-1 border border-neutral-700">
            <button
              onClick={() => setCurrentTool('pen')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded ${
                currentTool === 'pen' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>펜</span>
            </button>
            <button
              onClick={() => setCurrentTool('highlighter')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded ${
                currentTool === 'highlighter'
                  ? 'bg-yellow-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>형광펜(투명)</span>
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded ${
                currentTool === 'eraser' ? 'bg-neutral-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>지우개</span>
            </button>
          </div>

          {currentTool !== 'eraser' && (
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-700">
              {['#ef4444', '#3b82f6', '#10b981', '#000000', '#eab308', '#a855f7'].map((color) => (
                <button
                  key={color}
                  onClick={() => setPenColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-5 h-5 rounded-full border-2 transition ${
                    penColor === color ? 'border-white scale-110 shadow' : 'border-transparent opacity-70'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>되돌리기</span>
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-red-950/60 text-red-400 border border-neutral-700 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>모두 지우기</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-neutral-950">
        {!sheetSource?.url ? (
          <div className="text-center text-neutral-500 text-sm">등록된 악보 이미지나 링크가 없습니다.</div>
        ) : isImageSheet ? (
          <div
            className="relative transition-transform duration-100 origin-center flex items-center justify-center"
            style={{ transform: `scale(${scale})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={sheetSource.url}
              alt={songTitle}
              onLoad={syncCanvasWithImage}
              className="max-h-[85vh] max-w-full object-contain rounded shadow-2xl bg-white select-none pointer-events-none"
            />
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ mixBlendMode: 'multiply' }}
              className={`absolute inset-0 w-full h-full rounded ${
                isDrawingMode
                  ? currentTool === 'eraser'
                    ? 'cursor-cell'
                    : 'cursor-crosshair touch-none'
                  : 'pointer-events-none'
              }`}
            />
          </div>
        ) : (
          <div className="w-full h-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700 flex items-center justify-between text-xs text-neutral-300">
              <span className="truncate">링크: {sheetSource.url}</span>
              <a
                href={sheetSource.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:underline shrink-0 ml-2"
              >
                <span>새 탭 열기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <iframe src={sheetSource.url} title={songTitle} className="w-full flex-1 bg-white border-0" />
          </div>
        )}
      </main>
    </div>
  );
}
