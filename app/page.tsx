'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Calendar,
  FolderPlus,
  X,
  Music,
  ChevronLeft,
  ChevronRight,
  PenTool,
  Layers,
  FileText,
  Sun,
  Moon,
  MessageSquare,
  SkipBack,
  SkipForward,
  GripVertical,
  Check,
  Users,
  Mic,
  Globe,
  Search,
  Lock,
  Unlock,
  KeyRound,
  Library,
  ArrowDownToLine,
  RefreshCw,
  Tag,
  Copy,
  BookOpen,
  SlidersHorizontal,
  Home as HomeIcon,
  Bell,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ArrowRight,
  ClipboardPaste,
  Image as ImageIcon,
  History,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings,
  Palette,
  ExternalLink,
  Wand2,
  Youtube,
  Minimize2,
  Maximize2,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  getDoc,
  getDocs,
} from 'firebase/firestore';

interface CustomTag {
  name: string;
  color: string;
}

interface SongItem {
  id: string;
  contiId: string;
  headerTag?: string;
  title: string;
  key?: string | null;
  bpm?: number | null;
  comment?: string;
  lyrics?: string;
  youtubeUrl?: string;
  sheetUrls: string[];
  order: number;
}

interface LibrarySong {
  id: string;
  title: string;
  key?: string | null;
  bpm?: number | null;
  comment?: string;
  lyrics?: string;
  youtubeUrl?: string;
  sheetUrls: string[];
  updatedAt: number;
}

interface Conti {
  id: string;
  title: string;
  date: string;
  assignedSingers?: string[];
  customNote?: string;
  notice?: string;
  attendance?: Record<string, 'yes' | 'no' | 'maybe'>;
}

const TAG_COLOR_THEMES: Record<string, { light: { bg: string; text: string; border: string }; dark: { bg: string; text: string; border: string }; label: string }> = {
  amber: {
    light: { bg: 'bg-[#F4ECE1]', text: 'text-[#8C6D3E]', border: 'border-[#DEC8A2]' },
    dark: { bg: 'bg-[#42331E]/50', text: 'text-[#E5C492]', border: 'border-[#7A5E33]/50' },
    label: '샴페인 골드',
  },
  blue: {
    light: { bg: 'bg-[#EBF1F5]', text: 'text-[#416279]', border: 'border-[#CBDCE6]' },
    dark: { bg: 'bg-[#1D2F3B]/50', text: 'text-[#96B8CE]', border: 'border-[#325268]/50' },
    label: '웨이브 블루',
  },
  purple: {
    light: { bg: 'bg-[#F2EDF6]', text: 'text-[#6F5B8B]', border: 'border-[#DDD2E8]' },
    dark: { bg: 'bg-[#322345]/50', text: 'text-[#C5B3DC]', border: 'border-[#584175]/50' },
    label: '소프트 라벤더',
  },
  emerald: {
    light: { bg: 'bg-[#ECF3ED]', text: 'text-[#446F54]', border: 'border-[#C8DFCD]' },
    dark: { bg: 'bg-[#1C3626]/50', text: 'text-[#9ACDB0]', border: 'border-[#2F573C]/50' },
    label: '세이지 그린',
  },
  rose: {
    light: { bg: 'bg-[#F8EAE8]', text: 'text-[#9E4E4E]', border: 'border-[#ECCBC9]' },
    dark: { bg: 'bg-[#471E1E]/50', text: 'text-[#E5A1A1]', border: 'border-[#783636]/50' },
    label: '더스티 로즈',
  },
  indigo: {
    light: { bg: 'bg-[#EAEBED]', text: 'text-[#545C6D]', border: 'border-[#CAD0DC]' },
    dark: { bg: 'bg-[#212633]/50', text: 'text-[#A6B2C8]', border: 'border-[#3B455C]/50' },
    label: '어쿠스틱 슬레이트',
  },
};

const DEFAULT_CUSTOM_TAGS: CustomTag[] = [
  { name: '입례', color: 'blue' },
  { name: '송영', color: 'indigo' },
  { name: '경배와찬양', color: 'amber' },
  { name: '기도송', color: 'purple' },
  { name: '헌금', color: 'emerald' },
  { name: '파송', color: 'rose' },
  { name: '특송', color: 'amber' },
  { name: '회중찬양', color: 'blue' },
  { name: '결단곡', color: 'rose' },
];

function getUpcomingSunday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + daysUntilSunday);
  return sunday;
}

function formatDateToStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function formatDateToTitle(d: Date, typeSuffix = '950'): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${date} ${typeSuffix}`;
}

function formatImageUrl(url: string): string {
  const trimmed = url ? url.trim() : '';
  if (!trimmed) return '';
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return trimmed;
}

function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match =
    trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/) ||
    trimmed.match(/youtube\.com\/shorts\/([\w-]{11})/);
  return match ? match[1] : null;
}

function getSafeDocId(title: string, key?: string | null): string {
  const cleanTitle = (title || 'untitled').trim();
  const cleanKey = (key || 'NOKEY').trim();
  const rawId = `lib_${cleanTitle}_${cleanKey}`;
  return rawId.replace(/[\/\s#?\[\]]/g, '_');
}

function formatAndFixLyrics(input: string): string {
  if (!input) return '';
  let text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length >= 3) {
    return text.trim();
  }

  text = text
    .replace(/\s*(\([0-9]+\)|\[[0-9]+\]|[0-9]\.|\bV[1-4]\b|\bChorus\b|\[후렴\]|\[Bridge\]|후렴:)\s*/gi, '\n\n$1 ')
    .replace(/([,.~!?])\s+/g, '$1\n')
    .replace(/(하네|있네|리라|도다|니다|소서|노라|옵소서|주시네|채우네|임하네|찬양해|예배해|사랑해|영원히|예수님|하나님|성령님|할렐루야|아멘)\s+/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [contis, setContis] = useState<Conti[]>([]);
  const [currentSongs, setCurrentSongs] = useState<SongItem[]>([]);
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');
  const [isReordering, setIsReordering] = useState(false);

  const [viewLevel, setViewLevel] = useState<'home' | 'detail'>('home');
  const [activeTab, setActiveTab] = useState<'conti' | 'library'>('conti');
  const [showPastContis, setShowPastContis] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [myAttendanceName, setMyAttendanceName] = useState('');
  const [myAttendanceStatus, setMyAttendanceStatus] = useState<'yes' | 'no' | 'maybe'>('yes');

  const [expandedLyricsSongId, setExpandedLyricsSongId] = useState<string | null>(null);
  const [lyricsFontSize, setLyricsFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [isChangePwModalOpen, setIsChangePwModalOpen] = useState(false);
  const [newPwInput, setNewPwInput] = useState('');

  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [isSyncingLib, setIsSyncingLib] = useState(false);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const [previewLibSong, setPreviewLibSong] = useState<LibrarySong | null>(null);

  const [isNewContiModalOpen, setIsNewContiModalOpen] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>('');
  const [contiTitleInput, setContiTitleInput] = useState<string>('');
  const [currentCalMonth, setCurrentCalMonth] = useState<Date>(new Date());

  const [masterSingers, setMasterSingers] = useState<string[]>([]);
  const [newSingerName, setNewSingerName] = useState('');
  const [isSingerModalOpen, setIsSingerModalOpen] = useState(false);
  const [selectedSingers, setSelectedSingers] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');

  const [masterTags, setMasterTags] = useState<CustomTag[]>(DEFAULT_CUSTOM_TAGS);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>('amber');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const [searchModalTitle, setSearchModalTitle] = useState<string | null>(null);

  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [batchImportInput, setBatchImportInput] = useState('');

  const [activePipVideoId, setActivePipVideoId] = useState<string | null>(null);
  const [activePipTitle, setActivePipTitle] = useState<string>('');
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number }>({ x: 20, y: 80 });
  const isDraggingPip = useRef(false);
  const pipDragStart = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCardWidth, setDragCardWidth] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [modalHeaderTag, setModalHeaderTag] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalKey, setModalKey] = useState('');
  const [modalBpm, setModalBpm] = useState('');
  const [modalComment, setModalComment] = useState('');
  const [modalLyrics, setModalLyrics] = useState('');
  const [modalYoutubeUrl, setModalYoutubeUrl] = useState('');
  const [isModalLibraryOpen, setIsModalLibraryOpen] = useState(false);
  const [modalSheetUrls, setModalSheetUrls] = useState<string[]>([]);
  const [modalLibrarySearch, setModalLibrarySearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [viewingSongId, setViewingSongId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sheet' | 'lyrics'>('sheet');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'breath' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#B89C70');
  const [showViewerControls, setShowViewerControls] = useState(true);
  const [sheetImgError, setSheetImgError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const isLocalDrawing = useRef(false);

  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const isPanning = useRef(false);
  const startPanPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1.0);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    let wakeLock: any = null;
    async function requestWakeLock() {
      if (viewingSongId && 'wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock 에러:', err);
        }
      }
    }
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [viewingSongId]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('praise_app_theme', next);
      } catch (e) {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    setSheetImgError(false);
  }, [viewingSongId, currentPageIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !viewingSongId || viewMode === 'lyrics') return;

    let startDist = 0;
    let startScale = 1.0;
    let lastTap = 0;

    const onGestureStart = (e: any) => e.preventDefault();
    const onGestureChange = (e: any) => e.preventDefault();

    const onTouchStartNative = (e: TouchEvent) => {
      if (isDrawingMode) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        startDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        startScale = scale;
        return;
      }

      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          e.preventDefault();
          setScale((prev) => (prev > 1.05 ? 1.0 : 1.8));
          setPosition({ x: 0, y: 0 });
          lastTap = 0;
          return;
        }
        lastTap = now;
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (isDrawingMode) return;

      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / startDist;
        const nextScale = Math.max(0.8, Math.min(3.5, startScale * factor));
        setScale(nextScale);
        if (nextScale <= 1.0) setPosition({ x: 0, y: 0 });
      }
    };

    const onTouchEndNative = (e: TouchEvent) => {
      if (e.touches.length < 2) startDist = 0;
    };

    container.addEventListener('touchstart', onTouchStartNative, { passive: false });
    container.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    container.addEventListener('touchend', onTouchEndNative);
    container.addEventListener('gesturestart', onGestureStart, { passive: false });
    container.addEventListener('gesturechange', onGestureChange, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStartNative);
      container.removeEventListener('touchmove', onTouchMoveNative);
      container.removeEventListener('touchend', onTouchEndNative);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
    };
  }, [viewingSongId, viewMode, isDrawingMode, scale]);

  const handleToggleLyricsExpand = (songId: string) => {
    setExpandedLyricsSongId((prev) => (prev === songId ? null : songId));
  };

  const handleOpenSearchGuide = (titleToSearch?: string) => {
    const q = (titleToSearch || modalTitle || viewingSong?.title || '').trim();
    if (!q) {
      alert('곡 제목을 먼저 입력해주세요.');
      return;
    }
    setSearchModalTitle(q);
  };

  const handleOpenPipPlayer = (youtubeUrl?: string, songTitle?: string) => {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      alert('등록된 올바른 유튜브 영상 링크가 없습니다. 곡 수정에서 링크를 등록해주세요.');
      return;
    }
    setActivePipVideoId(videoId);
    setActivePipTitle(songTitle || '찬양 영상');
    setIsPipMinimized(false);
  };

  const handleStartPipDrag = (clientX: number, clientY: number) => {
    isDraggingPip.current = true;
    pipDragStart.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: pipPosition.x,
      startY: pipPosition.y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingPip.current) return;
      const dx = e.clientX - pipDragStart.current.mouseX;
      const dy = e.clientY - pipDragStart.current.mouseY;
      setPipPosition({
        x: Math.max(10, Math.min(window.innerWidth - 260, pipDragStart.current.startX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 180, pipDragStart.current.startY + dy)),
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingPip.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - pipDragStart.current.mouseX;
      const dy = t.clientY - pipDragStart.current.mouseY;
      setPipPosition({
        x: Math.max(10, Math.min(window.innerWidth - 260, pipDragStart.current.startX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 180, pipDragStart.current.startY + dy)),
      });
    };
    const onEnd = () => {
      isDraggingPip.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const handlePasteLyricsDirect = async (targetSongId?: string) => {
    let rawText = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        rawText = await navigator.clipboard.readText();
      }
    } catch (e) {
      console.warn('클립보드 접근 제한');
    }

    if (!rawText || !rawText.trim()) {
      const promptText = window.prompt('복사하신 찬양 가사를 여기에 붙여넣어 주세요:');
      if (promptText) rawText = promptText;
    }

    if (!rawText || !rawText.trim()) {
      alert('붙여넣을 가사가 없습니다.');
      return;
    }

    const fixedText = formatAndFixLyrics(rawText);

    if (targetSongId) {
      try {
        await setDoc(doc(db, 'songs_v2', targetSongId), { lyrics: fixedText }, { merge: true });
        const targetSong = currentSongs.find((s) => s.id === targetSongId);
        if (targetSong) {
          const libDocId = getSafeDocId(targetSong.title, targetSong.key);
          await setDoc(doc(db, 'song_library', libDocId), { lyrics: fixedText, updatedAt: Date.now() }, { merge: true });
        }
        alert('가사가 깔끔하게 줄바꿈되어 등록되었습니다!');
      } catch (err) {
        alert('가사 저장 오류');
      }
    } else {
      setModalLyrics(fixedText);
      alert('가사가 입력창에 줄바꿈되어 들어갔습니다!');
    }
  };

  const handleCopyLyrics = (textToCopy: string) => {
    if (!textToCopy) {
      alert('복사할 가사가 없습니다.');
      return;
    }
    navigator.clipboard.writeText(textToCopy);
    alert('가사가 복사되었습니다.');
  };

  const handlePasteClipboardUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.startsWith('http')) {
        const formatted = formatImageUrl(text.trim());
        setModalSheetUrls((prev) => [...prev, formatted]);
        alert('악보 주소가 등록되었습니다!');
      } else {
        alert('클립보드에 올바른 이미지 주소(http로 시작)가 없습니다.');
      }
    } catch (e) {
      const directUrl = prompt('악보 이미지 주소(URL)를 붙여넣어 주세요:');
      if (directUrl && directUrl.trim()) {
        const formatted = formatImageUrl(directUrl.trim());
        setModalSheetUrls((prev) => [...prev, formatted]);
      }
    }
  };

  const loadLibrarySongs = useCallback(async () => {
    try {
      const qLib = query(collection(db, 'song_library'), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(qLib);
      const libList: LibrarySong[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        let sheets: string[] = [];
        if (Array.isArray(data?.sheetUrls)) {
          sheets = data.sheetUrls.map(formatImageUrl).filter(Boolean);
        } else if (data?.sheetUrl && typeof data.sheetUrl === 'string') {
          sheets = [formatImageUrl(data.sheetUrl.trim())].filter(Boolean);
        }
        libList.push({
          id: d.id,
          title: data?.title || '',
          key: data?.key || null,
          bpm: data?.bpm || null,
          comment: data?.comment || '',
          lyrics: data?.lyrics || '',
          youtubeUrl: data?.youtubeUrl || '',
          sheetUrls: sheets,
          updatedAt: data?.updatedAt || Date.now(),
        });
      });
      setLibrarySongs(libList);
      setIsLibraryLoaded(true);
      return libList;
    } catch (e) {
      console.error('보관소 불러오기 실패:', e);
      return [];
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'library' && !isLibraryLoaded) {
      loadLibrarySongs();
    }
  }, [activeTab, isLibraryLoaded, loadLibrarySongs]);

  const syncAllSongsToLibrary = async (showSuccessAlert = true) => {
    if (currentSongs.length === 0) {
      if (showSuccessAlert) alert('동기화할 콘티 곡이 없습니다.');
      return;
    }
    setIsSyncingLib(true);
    try {
      const batch = writeBatch(db);
      currentSongs.forEach((song) => {
        const cleanTitle = (song.title || '').trim();
        if (!cleanTitle) return;
        const libDocId = getSafeDocId(cleanTitle, song.key);
        const libRef = doc(db, 'song_library', libDocId);

        batch.set(
          libRef,
          {
            id: libDocId,
            title: cleanTitle,
            key: song.key || null,
            bpm: song.bpm || null,
            comment: song.comment || '',
            lyrics: song.lyrics || '',
            youtubeUrl: song.youtubeUrl || '',
            sheetUrls: song.sheetUrls || [],
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      });
      await batch.commit();
      await loadLibrarySongs();
      if (showSuccessAlert) {
        alert('찬양이 보관소로 안전하게 동기화되었습니다!');
      }
    } catch (e) {
      console.error('보관소 동기화 오류:', e);
    } finally {
      setIsSyncingLib(false);
    }
  };

  const handleBatchImportEvernote = async () => {
    if (!batchImportInput.trim() || !currentConti) {
      alert('붙여넣을 에버노트 텍스트가 없습니다.');
      return;
    }

    const lines = batchImportInput.split('\n').map((l) => l.trim()).filter(Boolean);
    const ignoreKeywords = ['기도', '멘트', '설교', '축도', '사회자', '목사님', '성경봉독'];
    const keyRegex = /\b([A-G][b#]?(?:m)?)\s*(?:Key|키)?\b/i;
    const tagRegex = /^<([^>]+)>|^\[([^\]]+)\]/;
    const songFormRegex = /^(?:IN|INTRO|OUT|OUTRO|V\d*|C|CHORUS|B|BRIDGE|RIT|\-|\s)+$/i;

    const parsedList: { title: string; key: string | null; headerTag: string; comment: string }[] = [];
    let currentTag = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      const tagMatch = line.match(tagRegex);
      if (tagMatch && line.replace(tagRegex, '').trim() === '') {
        currentTag = tagMatch[1] || tagMatch[2] || '';
        continue;
      }

      if (songFormRegex.test(line) && parsedList.length > 0) {
        const lastSong = parsedList[parsedList.length - 1];
        lastSong.comment = lastSong.comment ? `${lastSong.comment} / ${line}` : line;
        continue;
      }

      if (ignoreKeywords.some((kw) => line.includes(kw))) {
        continue;
      }

      let songTag = currentTag;
      if (tagMatch) {
        songTag = tagMatch[1] || tagMatch[2] || currentTag;
        line = line.replace(tagRegex, '').trim();
      }

      line = line.replace(/^[0-9]+[\.\)\-\s]+/, '').trim();

      let comment = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        line = parts[0].trim();
        comment = parts.slice(1).join(' - ').trim();
      }

      let songKey: string | null = null;
      const keyMatch = line.match(keyRegex);
      if (keyMatch) {
        songKey = keyMatch[1].toUpperCase();
        line = line.replace(keyRegex, '').trim();
      }

      const cleanTitle = line.trim();
      if (!cleanTitle) continue;

      parsedList.push({
        title: cleanTitle,
        key: songKey,
        headerTag: songTag,
        comment,
      });
    }

    if (parsedList.length === 0) {
      alert('인식 가능한 찬양 곡을 찾지 못했습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const activeLib = isLibraryLoaded ? librarySongs : await loadLibrarySongs();
      const batch = writeBatch(db);
      let startOrder = currentSongs.length > 0 ? Math.max(...currentSongs.map((s) => s.order || 0)) + 10 : 10;
      let matchedCount = 0;

      parsedList.forEach((item, idx) => {
        const songDocId = `song_${Date.now()}_${idx}`;
        const newSongRef = doc(db, 'songs_v2', songDocId);

        const libDocId = getSafeDocId(item.title, item.key);
        const foundInLib = activeLib.find((l) => {
          if (l.id === libDocId) return true;
          const cleanA = (l.title || '').replace(/\s+/g, '').toLowerCase();
          const cleanB = item.title.replace(/\s+/g, '').toLowerCase();
          if (cleanA === cleanB) {
            if (!item.key || !l.key || item.key.toUpperCase() === l.key.toUpperCase()) {
              return true;
            }
          }
          return false;
        });

        let finalKey = item.key;
        let finalSheets: string[] = [];
        let finalLyrics = '';
        let finalYoutubeUrl = '';
        let finalBpm: number | null = null;

        if (foundInLib) {
          matchedCount++;
          if (!finalKey && foundInLib.key) finalKey = foundInLib.key;
          finalSheets = foundInLib.sheetUrls || [];
          finalLyrics = foundInLib.lyrics || '';
          finalYoutubeUrl = foundInLib.youtubeUrl || '';
          finalBpm = foundInLib.bpm || null;
        }

        batch.set(newSongRef, {
          id: songDocId,
          contiId: currentConti.id,
          headerTag: item.headerTag,
          title: item.title,
          key: finalKey,
          bpm: finalBpm,
          comment: item.comment,
          lyrics: finalLyrics,
          youtubeUrl: finalYoutubeUrl,
          sheetUrls: finalSheets,
          order: startOrder + idx * 10,
        });

        batch.set(
          doc(db, 'song_library', libDocId),
          {
            id: libDocId,
            title: item.title,
            key: finalKey,
            bpm: finalBpm,
            comment: item.comment,
            lyrics: finalLyrics,
            youtubeUrl: finalYoutubeUrl,
            sheetUrls: finalSheets,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      setIsBatchImportModalOpen(false);
      setBatchImportInput('');
      alert(
        `${parsedList.length}곡이 등록되었습니다!\n(보관소에서 악보/정보 자동 매칭: ${matchedCount}곡)`
      );
    } catch (err: any) {
      alert('일괄 등록 중 오류 발생: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🌟 공지사항 저장 핸들러
  const handleSaveNotice = async () => {
    if (!currentConti) return;
    try {
      await setDoc(doc(db, 'contis_v2', currentConti.id), { notice: noticeInput.trim() }, { merge: true });
      setIsNoticeModalOpen(false);
      alert('공지사항이 등록되었습니다.');
    } catch (e) {
      alert('공지사항 저장 실패');
    }
  };

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
              const MAX_WIDTH = 1000;
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
                resolve(canvas.toDataURL('image/jpeg', 0.68));
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
        const compressed = await processImageFile(file);
        newSheets.push(compressed);
      }
      setModalSheetUrls((prev) => [...prev, ...newSheets]);
    } catch (err: any) {
      alert('파일 처리 오류');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveSheetPage = (indexToRemove: number) => {
    setModalSheetUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
        const defaultSunday = getUpcomingSunday();
        activeContiId = `c_${Date.now()}`;
        await setDoc(doc(db, 'contis_v2', activeContiId), {
          id: activeContiId,
          title: formatDateToTitle(defaultSunday, '950'),
          date: formatDateToStr(defaultSunday),
          assignedSingers: [],
          customNote: '',
          notice: '',
          attendance: {},
        });
        setSelectedContiId(activeContiId);
      }

      const finalSheets = modalSheetUrls.map(formatImageUrl).filter(Boolean);

      if (editingSongId) {
        const oldSong = currentSongs.find((s) => s.id === editingSongId);
        if (oldSong && (oldSong.title !== modalTitle.trim() || oldSong.key !== (modalKey.trim() || null))) {
          const oldLibDocId = getSafeDocId(oldSong.title, oldSong.key);
          const newLibDocId = getSafeDocId(modalTitle.trim(), modalKey.trim());
          if (oldLibDocId !== newLibDocId) {
            try {
              await deleteDoc(doc(db, 'song_library', oldLibDocId));
            } catch (e) {}
          }
        }
      }

      const songDocId = editingSongId || `song_${Date.now()}`;
      const maxOrder = currentSongs.length > 0 ? Math.max(...currentSongs.map((s) => s.order || 0)) : 0;
      const songOrder = editingSongId
        ? currentSongs.find((s) => s.id === editingSongId)?.order ?? maxOrder + 10
        : maxOrder + 10;

      const cleanTitle = modalTitle.trim();
      const cleanHeader = modalHeaderTag.trim();

      const songData: SongItem = {
        id: songDocId,
        contiId: activeContiId,
        headerTag: cleanHeader,
        title: cleanTitle,
        key: modalKey.trim() ? modalKey.trim() : null,
        bpm: modalBpm.trim() ? parseInt(modalBpm.trim(), 10) : null,
        comment: modalComment.trim(),
        lyrics: modalLyrics,
        youtubeUrl: modalYoutubeUrl.trim(),
        sheetUrls: finalSheets,
        order: songOrder,
      };

      await setDoc(doc(db, 'songs_v2', songDocId), songData);

      const libDocId = getSafeDocId(cleanTitle, modalKey);
      await setDoc(
        doc(db, 'song_library', libDocId),
        {
          id: libDocId,
          title: cleanTitle,
          key: modalKey.trim() ? modalKey.trim() : null,
          bpm: modalBpm.trim() ? parseInt(modalBpm.trim(), 10) : null,
          comment: modalComment.trim(),
          lyrics: modalLyrics,
          youtubeUrl: modalYoutubeUrl.trim(),
          sheetUrls: finalSheets,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      if (isLibraryLoaded) {
        setLibrarySongs((prev) => {
          const filtered = prev.filter((s) => s.id !== libDocId);
          return [
            {
              id: libDocId,
              title: cleanTitle,
              key: modalKey.trim() ? modalKey.trim() : null,
              bpm: modalBpm.trim() ? parseInt(modalBpm.trim(), 10) : null,
              comment: modalComment.trim(),
              lyrics: modalLyrics,
              youtubeUrl: modalYoutubeUrl.trim(),
              sheetUrls: finalSheets,
              updatedAt: Date.now(),
            },
            ...filtered,
          ];
        });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert('저장 실패: ' + (err?.message || '네트워크 상태 확인'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (!confirm('이 곡을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'songs_v2', songId));
      await deleteDoc(doc(db, 'drawings_v2', songId));
      if (viewingSongId === songId) setViewingSongId(null);
    } catch (e) {
      alert('삭제 중 오류 발생');
    }
  };

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
    if (!isDrawingMode || viewMode === 'lyrics') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);

    if (currentTool === 'breath') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = penColor;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x - 6, y - 10);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 9, y - 14);
      ctx.stroke();

      isDrawing.current = true;
      stopDraw();
      return;
    }

    isDrawing.current = true;
    isLocalDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
    } else if (currentTool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = `${penColor}33`;
      ctx.lineWidth = 24;
      ctx.lineCap = 'square';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
    }
  };

  const onDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode || !isDrawing.current || viewMode === 'lyrics' || currentTool === 'breath') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = async () => {
    if (!isDrawing.current || viewMode === 'lyrics') return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSongId) {
      isLocalDrawing.current = false;
      return;
    }
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    try {
      const pageDrawId = `${viewingSongId}_p${currentPageIndex}`;
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
    if (!confirm(`현재 페이지(${currentPageIndex + 1}p)의 필기를 지우시겠습니까?`)) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !viewingSongId) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [];
    try {
      const pageDrawId = `${viewingSongId}_p${currentPageIndex}`;
      await deleteDoc(doc(db, 'drawings_v2', pageDrawId));
    } catch (e) {
      console.error(e);
    }
  };

  const renderCalendarDays = () => {
    const year = currentCalMonth.getFullYear();
    const month = currentCalMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-9" />);
    }

    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = formatDateToStr(dateObj);
      const isSunday = dateObj.getDay() === 0;
      const isSelected = calendarSelectedDate === dateStr;

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleSelectCalendarDate(dateObj)}
          className={`h-9 w-full rounded-xl flex flex-col items-center justify-center font-semibold text-xs transition-all ${
            isSelected
              ? 'bg-[#B89C70] text-white font-bold shadow-md shadow-[#B89C70]/25 scale-105'
              : isSunday
              ? isDark
                ? 'text-[#E07A5F] hover:bg-[#2F2C28] font-bold'
                : 'text-[#D96A4E] hover:bg-[#FBEBE7] font-bold'
              : isDark
              ? 'text-neutral-200 hover:bg-[#2F2C28]'
              : 'text-[#3E3A36] hover:bg-[#EFECE4]'
          }`}
        >
          <span>{d}</span>
          {isSunday && !isSelected && (
            <span className="w-1 h-1 bg-[#D96A4E] rounded-full mt-0.5"></span>
          )}
        </button>
      );
    }
    return days;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] dark:bg-[#1A1816] text-[#7F7B74] text-sm font-medium">
        950 찬양팀 Hub 불러오는 중...
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-[#1A1816] text-[#EDEAE1]' : 'bg-[#F7F5F0] text-[#2C2A28]';
  const cardBgClass = isDark ? 'bg-[#242220] border-[#38342F] shadow-md' : 'bg-white border-[#E8E3D8] shadow-[0_4px_16px_rgba(160,145,120,0.08)]';
  const subCardBg = isDark ? 'bg-[#2F2C29] border-[#443F38] text-neutral-200 hover:bg-[#3A3630]' : 'bg-[#F0EDE5] border-[#E2DDD2] text-[#4A4641] hover:bg-[#E8E4DA]';
  const inputBgClass = isDark ? 'bg-[#2A2724] border-[#3D3833] text-white placeholder-neutral-500' : 'bg-[#FCFAF7] border-[#DDD7CB] text-[#2C2A28] placeholder-[#9E988D]';

  const textTitleClass = isDark ? 'text-[#EDEAE1]' : 'text-[#2C2A28]';
  const textSubClass = isDark ? 'text-[#9E988D]' : 'text-[#7F7B74]';
  const goldAccentText = isDark ? 'text-[#D4AF77]' : 'text-[#9C7E52]';
  const goldAccentBtn = 'bg-[#B89C70] hover:bg-[#A88B58] text-white';

  return (
    <div className={`min-h-[100dvh] transition-colors duration-200 pb-28 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden pt-[max(env(safe-area-inset-top),20px)] ${bgClass}`}>
      <div className="max-w-xl mx-auto space-y-4 w-full">
        <header className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-[#B89C70]/15 shrink-0 border border-[#DEC8A2]/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/praise-team/apple-touch-icon.png?v=3" alt="찬양팀 Hub 아이콘" className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('/praise-team/')) {
                    target.src = '/apple-touch-icon.png?v=3';
                  }
                }}
              />
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight leading-none ${textTitleClass}`}>950 찬양팀</h1>
              <p className={`text-xs mt-1 font-semibold ${textSubClass}`}>Worship Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddContiModal}
              className={`flex items-center gap-1.5 px-3.5 py-2 ${goldAccentBtn} rounded-2xl text-xs font-bold shadow-sm transition active:scale-95`}
            >
              <FolderPlus className="w-4 h-4" />
              <span>새 콘티</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className={`p-2 rounded-2xl border transition active:scale-95 ${subCardBg}`}
              title="설정 및 관리"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {activeTab === 'conti' && viewLevel === 'home' && (
          <div className="space-y-4">
            <div className={`rounded-3xl border p-4 space-y-3 ${cardBgClass}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${isDark ? 'bg-[#42331E]/60' : 'bg-[#F4ECE1]'}`}>
                  <Bell className="w-4 h-4 text-[#A88B58]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${textSubClass}`}>찬양팀 공지사항</span>
                    {currentConti && (
                      <button
                        onClick={() => {
                          setNoticeInput(currentNotice);
                          setIsNoticeModalOpen(true);
                        }}
                        className={`text-xs font-bold ${goldAccentText} hover:underline`}
                      >
                        공지 작성 ↗
                      </button>
                    )}
                  </div>
                  <p className={`text-sm font-medium mt-1 whitespace-pre-wrap leading-relaxed ${textTitleClass}`}>
                    {currentNotice || '등록된 예배 공지사항이 없습니다.'}
                  </p>
                </div>
              </div>

              {currentConti && (
                <div className={`border-t pt-3 flex items-center justify-between gap-2 flex-wrap ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className={`px-2.5 py-1 rounded-xl flex items-center gap-1 ${isDark ? 'bg-[#1C3626]/60 text-[#9ACDB0]' : 'bg-[#ECF3ED] text-[#446F54]'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> 참석 {yesCount}
                    </span>
                    <span className={`px-2.5 py-1 rounded-xl flex items-center gap-1 ${isDark ? 'bg-[#471E1E]/60 text-[#E5A1A1]' : 'bg-[#F8EAE8] text-[#9E4E4E]'}`}>
                      <XCircle className="w-3.5 h-3.5" /> 불참 {noCount}
                    </span>
                    <span className={`px-2.5 py-1 rounded-xl flex items-center gap-1 ${isDark ? 'bg-[#42331E]/60 text-[#E5C492]' : 'bg-[#F4ECE1] text-[#8C6D3E]'}`}>
                      <HelpCircle className="w-3.5 h-3.5" /> 미정 {maybeCount}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className={`px-3 py-1.5 ${goldAccentBtn} rounded-xl text-xs font-bold shadow-xs transition active:scale-95`}
                  >
                    출석 체크
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className={`text-sm font-bold flex items-center gap-1.5 ${textTitleClass}`}>
                  <Calendar className="w-4 h-4 text-[#B89C70]" />
                  다가오는 예배 일정
                </h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${isDark ? 'bg-[#42331E]/60 text-[#E5C492]' : 'bg-[#F4ECE1] text-[#8C6D3E]'}`}>
                  {upcomingContis.length}개 예정
                </span>
              </div>

              {upcomingContis.length === 0 ? (
                <div className={`text-center py-10 border rounded-3xl text-sm px-4 ${cardBgClass} ${textSubClass}`}>
                  예정된 예배 일정이 없습니다. 상단 <span className="text-[#A88B58] font-bold">[+ 새 콘티]</span>를 눌러 다가올 예배를 등록해보세요.
                </div>
              ) : (
                upcomingContis.map((c) => {
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedContiId(c.id);
                        setViewLevel('detail');
                      }}
                      className={`p-4 rounded-3xl border transition active:scale-[0.99] cursor-pointer hover:border-[#B89C70]/60 flex items-center justify-between gap-3 ${cardBgClass}`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-lg ${isDark ? 'bg-[#42331E]/60 text-[#E5C492]' : 'bg-[#F4ECE1] text-[#8C6D3E]'}`}>
                            {c.date}
                          </span>
                        </div>

                        <h3 className={`text-base font-bold truncate ${goldAccentText}`}>
                          {c.title}
                        </h3>

                        {c.assignedSingers && c.assignedSingers.length > 0 && (
                          <div className={`flex items-center gap-1.5 text-xs truncate ${textSubClass}`}>
                            <Mic className="w-3.5 h-3.5 text-[#B89C70] shrink-0" />
                            <span className="truncate">싱어: {c.assignedSingers.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div className={`flex items-center gap-1 ${goldAccentText} font-bold text-xs shrink-0 pl-2`}>
                        <span>콘티 보기</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {pastContis.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPastContis(!showPastContis)}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between transition active:scale-98 ${subCardBg}`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#7F7B74]" />
                    <span className={`text-xs sm:text-sm font-bold ${textTitleClass}`}>
                      지난 예배 콘티 ({pastContis.length}개)
                    </span>
                  </div>
                  {showPastContis ? (
                    <ChevronUp className="w-4 h-4 text-[#7F7B74]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#7F7B74]" />
                  )}
                </button>

                {showPastContis && (
                  <div className="space-y-2 pl-1">
                    {pastContis.map((c) => {
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContiId(c.id);
                            setViewLevel('detail');
                          }}
                          className={`p-3.5 rounded-2xl border transition active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 ${cardBgClass}`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${isDark ? 'bg-[#2A2724] text-neutral-300' : 'bg-[#EFECE4] text-[#7F7B74]'}`}>
                                {c.date}
                              </span>
                            </div>
                            <h4 className={`text-sm font-bold truncate ${textTitleClass}`}>
                              {c.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1 text-[#7F7B74] font-semibold text-xs shrink-0">
                            <span>보기</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'conti' && viewLevel === 'detail' && currentConti && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
              <button
                onClick={() => setViewLevel('home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold transition active:scale-95 ${subCardBg}`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>목록으로</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBatchImportModalOpen(true)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-2xl text-xs font-bold transition active:scale-95 shadow-xs ${
                    isDark ? 'bg-[#3A3022] border-[#735A33] text-[#E5C492]' : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                  }`}
                  title="에버노트 텍스트 붙여넣기로 일괄 생성 및 보관소 자동 매칭"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>에버노트 일괄등록</span>
                </button>

                <button
                  onClick={() => handleOpenModal()}
                  className={`flex items-center gap-1 px-3.5 py-1.5 ${goldAccentBtn} rounded-2xl text-xs font-bold shadow-xs transition active:scale-95`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>곡 추가</span>
                </button>
              </div>
            </div>

            <div className={`p-4 rounded-3xl border space-y-2.5 ${cardBgClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-[#B89C70]" />
                  <h2 className={`text-base font-bold truncate ${textTitleClass}`}>{currentConti.title}</h2>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleEditContiTitle}
                      className={`p-1 border rounded-lg transition ${subCardBg}`}
                      title="콘티 제목 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#B89C70]" />
                    </button>
                    <button
                      onClick={handleDeleteConti}
                      className={`p-1 border rounded-lg transition ${isDark ? 'bg-[#2F2C29] text-[#E5A1A1] hover:text-rose-200' : 'bg-[#F8EAE8] text-[#9E4E4E] hover:text-[#D96A4E]'}`}
                      title="이 콘티 전체 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleOpenSingerModal}
                  className={`text-xs font-bold ${goldAccentText} hover:underline shrink-0`}
                >
                  + 싱어 관리
                </button>
              </div>

              {assignedSingers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedSingers.map((singer) => (
                    <span
                      key={singer}
                      className={`px-2.5 py-0.5 rounded-lg font-bold text-xs flex items-center gap-1 ${isDark ? 'bg-[#42331E]/60 text-[#E5C492] border border-[#735A33]/50' : 'bg-[#F4ECE1] text-[#8C6D3E] border border-[#DEC8A2]'}`}
                    >
                      <Mic className="w-3 h-3" /> {singer}
                    </span>
                  ))}
                </div>
              )}

              {customNote && (
                <p className={`text-xs pt-1 border-t ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'} ${textSubClass}`}>
                  📝 {customNote}
                </p>
              )}
            </div>

            <div className="space-y-2.5 relative select-none w-full">
              {currentSongs.length === 0 ? (
                <div className={`text-center py-12 border rounded-3xl text-sm px-4 ${cardBgClass} ${textSubClass}`}>
                  등록된 찬양 곡이 없습니다. 상단 <span className="text-[#A88B58] font-bold">[에버노트 일괄등록]</span>을 눌러 콘티를 바로 붙여넣어 보세요.
                </div>
              ) : (
                currentSongs.map((song, idx) => {
                  const isBeingDragged = draggedIdx === idx;
                  const isDropTarget = dropTargetIdx === idx && draggedIdx !== null;
                  const isLyricsExpanded = expandedLyricsSongId === song.id;
                  const tagStyle = getTagStyle(song.headerTag);

                  return (
                    <div key={song.id} data-song-index={idx} className="relative flex flex-col w-full">
                      {isDropTarget && !isBeingDragged && (
                        <div className="absolute -top-1 inset-x-0 h-1 bg-[#B89C70] rounded-full z-10 animate-pulse" />
                      )}

                      <div
                        className={`flex flex-col border transition-all duration-150 overflow-hidden w-full ${
                          isLyricsExpanded ? 'rounded-3xl ring-2 ring-[#B89C70]/70' : 'rounded-3xl'
                        } ${
                          isBeingDragged
                            ? 'opacity-20 border-dashed border-neutral-500 scale-[0.98]'
                            : cardBgClass
                        }`}
                      >
                        <div className="flex items-center justify-between p-3.5 sm:p-4 gap-2.5 w-full">
                          <div
                            onClick={() => {
                              setViewingSongId(song.id);
                              setCurrentPageIndex(0);
                              setViewMode('sheet');
                              setShowViewerControls(true);
                              setScale(1.0);
                              setPosition({ x: 0, y: 0 });
                            }}
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onTouchStart={(e) => handleTouchStart(idx, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={endDragAction}
                              onMouseDown={(e) => handleMouseDown(idx, e)}
                              style={{ touchAction: 'none' }}
                              className={`p-1 -m-1 cursor-grab active:cursor-grabbing shrink-0 transition ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#9E988D] hover:text-[#B89C70]'}`}
                              title="길게 눌러 순서 변경"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>

                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-xs ${
                              isDark
                                ? 'bg-[#3A3022] border-[#735A33]/60 text-[#E5C492]'
                                : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                            }`}>
                              {idx + 1}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {song.headerTag && tagStyle && (
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border shrink-0 shadow-xs ${tagStyle.bg} ${tagStyle.text} ${tagStyle.border}`}>
                                    {song.headerTag}
                                  </span>
                                )}

                                <h3 className={`text-sm sm:text-base font-bold truncate transition group-hover:text-[#A88B58] ${textTitleClass}`}>
                                  {song.title}
                                </h3>

                                {song.key && (
                                  <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border shrink-0 shadow-xs ${
                                    isDark
                                      ? 'bg-[#3A3022] border-[#735A33]/60 text-[#E5C492]'
                                      : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                                  }`}>
                                    {song.key} Key
                                  </span>
                                )}

                                {song.sheetUrls && song.sheetUrls.length > 1 && (
                                  <span className={`flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold rounded-lg shrink-0 border ${
                                    isDark
                                      ? 'bg-[#2A2724] border-[#3D3833] text-neutral-300'
                                      : 'bg-[#EFECE4] border-[#DDD7CB] text-[#7F7B74]'
                                  }`}>
                                    <Layers className="w-3 h-3" /> {song.sheetUrls.length}p
                                  </span>
                                )}
                              </div>

                              {song.comment && (
                                <div className={`flex items-center gap-1 text-xs font-semibold ${goldAccentText}`}>
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{song.comment}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {song.youtubeUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPipPlayer(song.youtubeUrl, song.title);
                                }}
                                className="p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center shadow-xs bg-[#F8EAE8] dark:bg-[#471E1E]/60 border-[#ECCBC9] dark:border-[#783636]/60 text-[#9E4E4E] dark:text-[#E5A1A1] hover:bg-[#F2D7D4]"
                                title="유튜브 미니플레이어 재생"
                              >
                                <Youtube className="w-4 h-4 text-[#D96A4E]" />
                              </button>
                            )}

                            {isReordering ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => executeReorder(idx, idx - 1)}
                                  disabled={idx === 0}
                                  className={`px-2.5 py-1 rounded-xl border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                                >
                                  위로
                                </button>
                                <button
                                  onClick={() => executeReorder(idx, idx + 1)}
                                  disabled={idx === currentSongs.length - 1}
                                  className={`px-2.5 py-1 rounded-xl border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                                >
                                  아래로
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleToggleLyricsExpand(song.id)}
                                  className={`flex items-center justify-center gap-1 px-3 py-1.5 border rounded-2xl text-xs font-bold transition active:scale-95 shadow-xs ${
                                    isLyricsExpanded
                                      ? 'bg-[#B89C70] border-[#B89C70] text-white shadow-sm'
                                      : isDark
                                      ? 'bg-[#322345] border-[#584175]/60 text-[#C5B3DC] hover:bg-[#3D2C54]'
                                      : 'bg-[#F2EDF6] border-[#DDD2E8] text-[#6F5B8B] hover:bg-[#E8DFF0]'
                                  }`}
                                  title={isLyricsExpanded ? '가사 접기' : '가사 펼치기'}
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>{isLyricsExpanded ? '닫기' : '가사'}</span>
                                </button>

                                <button
                                  onClick={() => handleOpenModal(song)}
                                  className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center shadow-xs ${
                                    isDark
                                      ? 'bg-[#2F2C29] border-[#443F38] text-neutral-200 hover:text-white hover:bg-[#3A3630]'
                                      : 'bg-white border-[#E2DDD2] text-[#4A4641] hover:text-[#2C2A28] hover:bg-[#F0EDE5]'
                                  }`}
                                  title="곡 수정"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song.id)}
                                  className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center shadow-xs ${
                                    isDark
                                      ? 'bg-[#471E1E]/60 border-[#783636]/60 text-[#E5A1A1] hover:bg-[#592626]/60'
                                      : 'bg-[#F8EAE8] border-[#ECCBC9] text-[#9E4E4E] hover:bg-[#F2D7D4]'
                                  }`}
                                  title="곡 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isLyricsExpanded && (
                          <div className={`border-t px-4 py-3.5 space-y-3 ${
                            isDark ? 'bg-[#1C1B19] border-[#38342F]' : 'bg-[#FAF8F5] border-[#E8E3D8]'
                          }`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold flex items-center gap-1 ${goldAccentText}`}>
                                  <BookOpen className="w-3.5 h-3.5" /> 찬양 가사
                                </span>

                                <div className={`flex items-center rounded-xl p-0.5 text-xs font-bold border ${isDark ? 'bg-[#2A2724] border-[#3D3833]' : 'bg-white border-[#E2DDD2]'}`}>
                                  <button
                                    onClick={() => handleChangeFontSize('sm')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'sm' ? 'bg-[#B89C70] text-white' : textSubClass}`}
                                  >
                                    소
                                  </button>
                                  <button
                                    onClick={() => handleChangeFontSize('base')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'base' ? 'bg-[#B89C70] text-white' : textSubClass}`}
                                  >
                                    중
                                  </button>
                                  <button
                                    onClick={() => handleChangeFontSize('lg')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'lg' ? 'bg-[#B89C70] text-white' : textSubClass}`}
                                  >
                                    대
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePasteLyricsDirect(song.id)}
                                  className={`text-xs font-bold px-2.5 py-1 rounded-xl ${goldAccentBtn} flex items-center gap-1 shadow-xs transition active:scale-95`}
                                  title="복사한 가사 원본 공백 그대로 붙여넣기"
                                >
                                  <ClipboardPaste className="w-3.5 h-3.5 text-white" />
                                  <span>가사 붙여넣기</span>
                                </button>
                                {song.lyrics && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLyrics(song.lyrics || '')}
                                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 transition active:scale-95 ${subCardBg}`}
                                  >
                                    <Copy className={`w-3.5 h-3.5 ${goldAccentText}`} />
                                    <span>복사</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenSearchGuide(song.title)}
                                  className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 transition active:scale-95 shadow-xs ${
                                    isDark
                                      ? 'bg-[#1D2F3B]/60 border-[#325268]/50 text-[#96B8CE] hover:bg-[#253B4A]/60'
                                      : 'bg-[#EBF1F5] border-[#CBDCE6] text-[#416279] hover:bg-[#DDE7ED]'
                                  }`}
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  <span>가사 찾기 ↗</span>
                                </button>
                              </div>
                            </div>

                            {song.lyrics ? (
                              <div 
                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                className={`font-normal leading-relaxed p-4 rounded-2xl border max-h-80 overflow-y-auto font-sans tracking-normal ${
                                  lyricsFontSize === 'sm' ? 'text-xs' : lyricsFontSize === 'lg' ? 'text-base font-medium' : 'text-sm'
                                } ${isDark ? 'bg-[#242220] border-[#38342F] text-neutral-100' : 'bg-white border-[#E8E3D8] text-[#2C2A28]'}`}
                              >
                                {song.lyrics}
                              </div>
                            ) : (
                              <div className={`py-6 text-center rounded-2xl border border-dashed space-y-2 ${isDark ? 'border-[#3D3833] bg-[#242220]' : 'border-[#DDD7CB] bg-white'}`}>
                                <p className={`text-xs font-medium ${textSubClass}`}>등록된 가사가 없습니다.</p>
                                <p className="text-[11px] text-[#9E988D]">가사를 복사한 후 상단 <span className={`font-bold ${goldAccentText}`}>[가사 붙여넣기]</span>를 누르세요.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                  <Library className={`w-5 h-5 ${goldAccentText}`} />
                  찬양 보관소 ({librarySongs.length}곡)
                </h2>
                <p className={`text-xs mt-0.5 font-semibold ${textSubClass}`}>콘티에 자주 사용하는 곡들을 검색해 보세요</p>
              </div>

              <button
                onClick={() => syncAllSongsToLibrary(true)}
                disabled={isSyncingLib}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold border transition active:scale-95 ${subCardBg}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${goldAccentText} ${isSyncingLib ? 'animate-spin' : ''}`} />
                <span>동기화</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#9E988D]" />
              <input
                type="text"
                value={librarySearchTerm}
                onChange={(e) => setLibrarySearchTerm(e.target.value)}
                placeholder="찬양 제목, Key, 가사 본문 검색"
                className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
              />
            </div>

            <div className="space-y-2.5">
              {filteredLibrary.length === 0 ? (
                <div className={`p-12 rounded-3xl border text-center text-sm ${cardBgClass} ${textSubClass}`}>
                  검색된 찬양이 없습니다.
                </div>
              ) : (
                filteredLibrary.map((libSong) => (
                  <div
                    key={libSong.id}
                    onClick={() => setPreviewLibSong(libSong)}
                    className={`flex items-center justify-between p-4 rounded-3xl border gap-2.5 cursor-pointer transition active:scale-[0.99] hover:border-[#B89C70]/60 ${cardBgClass}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm sm:text-base truncate ${textTitleClass}`}>
                          {libSong.title}
                        </span>
                        {libSong.key && (
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${
                            isDark ? 'bg-[#3A3022] border-[#735A33]/50 text-[#E5C492]' : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                          }`}>
                            {libSong.key} Key
                          </span>
                        )}
                        {libSong.bpm && (
                          <span className={`text-xs font-semibold ${textSubClass}`}>♩ {libSong.bpm}</span>
                        )}
                        <span className="text-xs text-[#9E988D] font-medium">악보 {libSong.sheetUrls?.length || 0}장</span>
                      </div>
                      {libSong.lyrics && (
                        <p className={`text-xs truncate mt-1 ${textSubClass}`}>{libSong.lyrics}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {libSong.youtubeUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPipPlayer(libSong.youtubeUrl, libSong.title);
                          }}
                          className="p-1.5 border rounded-xl bg-[#F8EAE8] dark:bg-[#471E1E]/60 border-[#ECCBC9] dark:border-[#783636]/60 text-[#9E4E4E] dark:text-[#E5A1A1] hover:bg-[#F2D7D4] transition shadow-xs"
                          title="유튜브 미니플레이어 재생"
                        >
                          <Youtube className="w-4 h-4 text-[#D96A4E]" />
                        </button>
                      )}
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border shrink-0 ${
                        isDark ? 'bg-[#3A3022] border-[#735A33]/50 text-[#E5C492]' : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                      }`}>
                        보기
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🌟 추가된 모달: 공지사항 작성 모달 🌟 */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border space-y-3.5 ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h3 className={`font-bold text-base flex items-center gap-2 ${textTitleClass}`}>
                <Bell className="w-4 h-4 text-[#A88B58]" />
                찬양팀 공지사항 작성
              </h3>
              <button onClick={() => setIsNoticeModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              rows={5}
              value={noticeInput}
              onChange={(e) => setNoticeInput(e.target.value)}
              placeholder="찬양팀원들에게 전달할 예배 공지사항을 입력하세요."
              className={`w-full border rounded-2xl p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#B89C70] resize-none ${inputBgClass}`}
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${subCardBg}`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveNotice}
                className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
              >
                공지 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 플로팅 탭바 */}
      <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className={`pointer-events-auto flex items-center gap-1 p-1.5 rounded-full border shadow-xl backdrop-blur-2xl ${
          isDark ? 'bg-[#242220]/95 border-[#38342F]' : 'bg-white/95 border-[#E2DDD2]'
        }`}>
          <button
            onClick={() => {
              setActiveTab('conti');
              setViewLevel('home');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
              activeTab === 'conti'
                ? `${goldAccentBtn} shadow-xs`
                : textSubClass
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            <span>예배 일정</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
              activeTab === 'library'
                ? 'bg-[#7D6AA8] text-white shadow-xs'
                : textSubClass
            }`}
          >
            <Library className="w-4 h-4" />
            <span>찬양 보관소</span>
          </button>
        </div>
      </nav>

      {activePipVideoId && !viewingSongId && (
        <div
          style={{
            transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0px)`,
            touchAction: 'none',
          }}
          className={`fixed top-0 left-0 z-[100] transition-shadow shadow-2xl rounded-2xl border overflow-hidden backdrop-blur-md ${
            isDark ? 'bg-[#242220]/95 border-[#38342F]' : 'bg-white/95 border-[#DEC8A2]'
          }`}
        >
          <div
            onMouseDown={(e) => handleStartPipDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                handleStartPipDrag(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            className={`flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b ${
              isDark ? 'bg-[#2A2724] border-[#38342F] text-white' : 'bg-[#F4ECE1] border-[#E8DFC8] text-[#2C2A28]'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <Youtube className="w-4 h-4 text-[#D96A4E] shrink-0" />
              <span className="text-xs font-bold truncate max-w-[130px]">{activePipTitle}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsPipMinimized(!isPipMinimized)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[#7F7B74]"
                title={isPipMinimized ? '확대' : '최소화'}
              >
                {isPipMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setActivePipVideoId(null)}
                className="p-1 rounded-lg hover:bg-[#D96A4E] hover:text-white text-[#7F7B74] transition"
                title="닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isPipMinimized && (
            <div className="w-[240px] sm:w-[280px] h-[135px] sm:h-[158px] bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activePipVideoId}?autoplay=1&enablejsapi=1`}
                title={activePipTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          )}
        </div>
      )}

      {isBatchImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-lg p-5 shadow-2xl border space-y-3.5 ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h3 className={`font-bold text-base flex items-center gap-2 ${textTitleClass}`}>
                <FileSpreadsheet className={`w-5 h-5 ${goldAccentText}`} />
                에버노트 콘티 텍스트 일괄 등록
              </h3>
              <button onClick={() => setIsBatchImportModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${textSubClass}`}>
              에버노트 본문 전체를 복사해서 아래에 붙여넣으세요. <br />
              보관소에 있는 곡은 <span className={`font-bold ${goldAccentText}`}>악보, 가사, 유튜브 링크</span>가 자동으로 연결됩니다.
            </p>

            <textarea
              rows={8}
              value={batchImportInput}
              onChange={(e) => setBatchImportInput(e.target.value)}
              placeholder={`<입례> 지금까지 에벤에셀\n<회중찬양>\n1.주 믿는 사람 일어나(찬357)\n2.우릴 사용하소서 Bb\nIN - V C C\n<기도송>주께 기도드리오니\n축복합니다 E\n<결단곡>\n교회여일어나라 A`}
              className={`w-full border rounded-2xl p-3.5 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#B89C70] resize-none ${inputBgClass}`}
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBatchImportModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${subCardBg}`}
              >
                취소
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleBatchImportEvernote}
                className={`flex-1 py-2.5 ${goldAccentBtn} disabled:opacity-50 rounded-xl font-bold text-xs text-white shadow-xs`}
              >
                {isProcessing ? '자동 등록 및 보관소 매칭 중...' : '콘티 곡으로 한 번에 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {searchModalTitle && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border space-y-4 ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h3 className={`font-bold text-sm flex items-center gap-2 ${textTitleClass}`}>
                <Globe className={`w-4 h-4 ${goldAccentText}`} />
                가사 검색 안내
              </h3>
              <button onClick={() => setSearchModalTitle(null)} className="p-1 text-[#9E988D]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${textSubClass}`}>
              홈 화면 앱에서 구글로 바로 이동하면 앱이 멈추는 현상을 방지하기 위해 아래 버튼을 눌러 이동해 주세요.
            </p>

            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${searchModalTitle} 찬양 가사`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSearchModalTitle(null)}
              className={`w-full py-3 ${goldAccentBtn} rounded-2xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition`}
            >
              <span>구글에서 [{searchModalTitle}] 검색</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => setSearchModalTitle(null)}
              className={`w-full py-2.5 rounded-2xl text-xs font-bold ${subCardBg}`}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {isNewContiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Calendar className="w-4 h-4 text-[#B89C70]" />
                950 콘티 날짜 선택
              </h2>
              <button onClick={() => setIsNewContiModalOpen(false)} className="p-1 text-[#9E988D] hover:text-[#4A4641]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateConti} className="mt-3 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className={`font-bold text-sm ${textTitleClass}`}>
                  {currentCalMonth.getFullYear()}년 {currentCalMonth.getMonth() + 1}월
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentCalMonth(
                        new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1)
                      )
                    }
                    className={`p-1.5 rounded-xl border ${subCardBg}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentCalMonth(
                        new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1)
                      )
                    }
                    className={`p-1.5 rounded-xl border ${subCardBg}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`grid grid-cols-7 gap-1 text-center text-xs font-bold ${textSubClass}`}>
                <span className="text-[#D96A4E]">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span>토</span>
              </div>

              <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>

              <div className="pt-1">
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>
                  생성될 콘티 제목
                </label>
                <input
                  type="text"
                  required
                  value={contiTitleInput}
                  onChange={(e) => setContiTitleInput(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNewContiModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  콘티 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 shadow-2xl max-h-[90vh] overflow-y-auto border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Music className="w-4 h-4 text-[#B89C70]" />
                {editingSongId ? '찬양 곡 수정' : '찬양 곡 추가'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#9E988D] hover:text-[#4A4641]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-3.5 space-y-3.5 text-xs sm:text-sm">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-bold flex items-center gap-1.5 ${textSubClass}`}>
                    <Tag className="w-3.5 h-3.5 text-[#A88B58]" />
                    예배 순서 태그 (선택)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(true)}
                    className={`text-xs font-bold ${goldAccentText} hover:underline flex items-center gap-1`}
                  >
                    <Settings className="w-3 h-3" />
                    <span>태그 색상/목록 관리</span>
                  </button>
                </div>

                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {masterTags.map((t) => {
                    const themeObj = TAG_COLOR_THEMES[t.color] || TAG_COLOR_THEMES.amber;
                    const style = isDark ? themeObj.dark : themeObj.light;
                    const isSelected = modalHeaderTag === t.name;

                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => setModalHeaderTag(t.name)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition shadow-xs ${
                          isSelected
                            ? 'ring-2 ring-[#B89C70] scale-105 ' + style.bg + ' ' + style.text + ' ' + style.border
                            : style.bg + ' ' + style.text + ' ' + style.border + ' opacity-85 hover:opacity-100'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                  {modalHeaderTag && (
                    <button
                      type="button"
                      onClick={() => setModalHeaderTag('')}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold border border-red-500/40 text-[#D96A4E] hover:bg-red-50"
                    >
                      선택 해제
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={modalHeaderTag}
                  onChange={(e) => setModalHeaderTag(e.target.value)}
                  placeholder="직접 입력하거나 위 태그를 터치하세요"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>순수 곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 은혜"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />  
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>Key (선택)</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] font-semibold ${inputBgClass}`}
                  >
                    <option value="">- 선택 안 함 -</option>
                    {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                      <option key={k} value={k}>
                        {k} Key
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>BPM (템포, 선택)</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>
                  진행 순서 / 연주 메모 (선택)
                </label>
                <input
                  type="text"
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="예: Intro 4마디 후 시작 · 후렴 반복"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-bold flex items-center gap-1 ${textSubClass}`}>
                    <Youtube className="w-3.5 h-3.5 text-[#D96A4E]" /> 유튜브 영상 링크 (선택)
                  </label>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${modalTitle} ${modalKey ? `${modalKey} Key` : ''} 찬양`.trim()
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#D96A4E] hover:underline flex items-center gap-1"
                  >
                    <span>유튜브 검색 ↗</span>
                  </a>
                </div>
                <input
                  type="url"
                  value={modalYoutubeUrl}
                  onChange={(e) => setModalYoutubeUrl(e.target.value)}
                  placeholder="예: https://www.youtube.com/watch?v=... 또는 공유 링크"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#D96A4E] ${inputBgClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className={`text-xs font-bold flex items-center gap-1 ${textSubClass}`}>
                    <BookOpen className="w-3.5 h-3.5 text-[#8E7DBE]" /> 찬양 가사 (선택)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!modalLyrics.trim()) {
                          alert('정돈할 가사가 없습니다.');
                          return;
                        }
                        setModalLyrics(formatAndFixLyrics(modalLyrics));
                      }}
                      className={`text-xs font-bold px-2 py-1 border rounded-lg flex items-center gap-1 transition active:scale-95 ${
                        isDark ? 'bg-[#42331E]/60 text-[#E5C492] border-[#735A33]/50' : 'bg-[#F4ECE1] text-[#8C6D3E] border-[#DEC8A2]'
                      }`}
                      title="한 줄로 붙은 가사를 소절 단위로 줄바꿈"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>줄바꿈 정돈</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePasteLyricsDirect()}
                      className={`text-xs font-bold px-2.5 py-1 border rounded-lg flex items-center gap-1 transition active:scale-95 ${
                        isDark ? 'bg-[#322345]/60 text-[#C5B3DC] border-[#584175]/50' : 'bg-[#F2EDF6] text-[#6F5B8B] border-[#DDD2E8]'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>가사 붙여넣기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSearchGuide(modalTitle)}
                      className={`text-xs font-bold px-2.5 py-1 border rounded-lg flex items-center gap-1 transition active:scale-95 shadow-xs ${
                        isDark ? 'bg-[#1D2F3B]/60 border-[#325268]/50 text-[#96B8CE]' : 'bg-[#EBF1F5] border-[#CBDCE6] text-[#416279]'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>가사 찾기 ↗</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={modalLyrics}
                  onChange={(e) => setModalLyrics(e.target.value)}
                  placeholder="가사를 복사한 후 상단 [가사 붙여넣기]를 누르세요. 줄바꿈이 뭉개진 경우 [줄바꿈 정돈]을 누르면 소절별로 자동 분리됩니다."
                  style={{ whiteSpace: 'pre-wrap' }}
                  className={`w-full border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#B89C70] resize-none ${inputBgClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-bold ${textSubClass}`}>악보 등록</label>
                  <button
                    type="button"
                    onClick={() => setIsModalLibraryOpen(!isModalLibraryOpen)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition shadow-xs ${
                      isModalLibraryOpen
                        ? 'bg-[#7D6AA8] border-[#7D6AA8] text-white'
                        : subCardBg
                    }`}
                  >
                    <Library className="w-3.5 h-3.5 inline mr-1" />
                    <span>{isModalLibraryOpen ? '보관함 닫기' : `보관함에서 불러오기 (${librarySongs.length})`}</span>
                  </button>
                </div>

                {isModalLibraryOpen && (
                  <div className={`p-2.5 rounded-2xl border mb-2.5 space-y-2 ${isDark ? 'bg-[#1A1816] border-[#38342F]' : 'bg-[#FAF8F5] border-[#E8E3D8]'}`}>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9E988D]" />
                      <input
                        type="text"
                        value={modalLibrarySearch}
                        onChange={(e) => setModalLibrarySearch(e.target.value)}
                        placeholder="보관된 곡명 검색"
                        className={`w-full border rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
                      {filteredLibrary.length === 0 ? (
                        <p className="text-center py-3 text-xs text-[#9E988D]">보관된 곡이 없습니다.</p>
                      ) : (
                        filteredLibrary.map((libSong) => (
                          <div
                            key={libSong.id}
                            onClick={() => handleSelectFromLibrary(libSong)}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition active:scale-[0.99] ${cardBgClass}`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`font-bold text-xs truncate block ${textTitleClass}`}>{libSong.title}</span>
                              <div className={`flex items-center gap-1.5 text-[10px] mt-0.5 ${textSubClass}`}>
                                {libSong.key && <span className={`font-bold ${goldAccentText}`}>{libSong.key} Key</span>}
                                <span>악보 {libSong.sheetUrls?.length || 0}장</span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg ${goldAccentBtn} font-bold text-[11px] flex items-center gap-1 shrink-0 shadow-xs`}>
                              <ArrowDownToLine className="w-3 h-3 text-white" /> 선택
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <a
                      href={googleSearchSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isDark ? 'bg-[#1D2F3B]/60 border-[#325268]/50 text-[#96B8CE]' : 'bg-[#EBF1F5] border-[#CBDCE6] text-[#416279]'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>구글 악보 찾기 ↗</span>
                    </a>
                    <button
                      type="button"
                      onClick={handlePasteClipboardUrl}
                      className={`flex-1 py-2 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isDark ? 'bg-[#322345]/60 border-[#584175]/50 text-[#C5B3DC]' : 'bg-[#F2EDF6] border-[#DDD2E8] text-[#6F5B8B]'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>복사한 주소 넣기</span>
                    </button>
                  </div>

                  <label className="w-full py-2.5 px-4 bg-[#588B76] hover:bg-[#47705F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-98">
                    <ImageIcon className="w-4 h-4" />
                    <span>악보 사진 / 파일 선택 (PC · 모바일)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {isProcessing && (
                    <span className={`text-xs ${goldAccentText} block animate-pulse font-bold text-center`}>
                      악보 최적화 처리 중...
                    </span>
                  )}

                  {modalSheetUrls.length > 0 && (
                    <div className={`grid grid-cols-3 gap-2 p-2.5 border rounded-2xl max-h-48 overflow-y-auto ${
                      isDark ? 'bg-[#1A1816] border-[#38342F]' : 'bg-[#EDEAE1] border-[#E2DDD2]'
                    }`}>
                      {modalSheetUrls.map((url, index) => (
                        <div key={index} className="relative group border rounded-xl p-1 flex flex-col items-center bg-white shadow-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${index + 1}p`}
                            className="w-full h-16 object-contain rounded-lg bg-white"
                          />
                          <span className="text-[11px] font-bold text-[#3E3A36] mt-1">
                            {index + 1} 페이지
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSheetPage(index)}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-[#D96A4E] text-white rounded-full shadow"
                            title="삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 ${goldAccentBtn} disabled:opacity-50 rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  {isProcessing ? '처리 중...' : editingSongId ? '수정 완료' : '콘티에 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTagModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Palette className="w-4 h-4 text-[#B89C70]" />
                예배 순서 태그 & 색상 관리
              </h2>
              <button onClick={() => setIsTagModalOpen(false)} className="p-1 text-[#9E988D] hover:text-[#4A4641]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-4 text-xs sm:text-sm">
              <form onSubmit={handleAddTag} className={`space-y-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#1A1816] border-[#38342F]' : 'bg-[#FCFAF7] border-[#E8E3D8]'}`}>
                <label className={`block text-xs font-bold ${textSubClass}`}>
                  새 태그 추가 (괄호 없이 자유롭게 입력)
                </label>
                
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="예: 묵도, 결단찬양, 헌금송, 앙코르"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />

                <div className="space-y-1.5">
                  <span className={`text-[11px] font-bold block ${textSubClass}`}>태그 색상 선택:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(TAG_COLOR_THEMES).map(([colorKey, themeObj]) => {
                      const style = isDark ? themeObj.dark : themeObj.light;
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setNewTagColor(colorKey)}
                          className={`px-2 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition shadow-xs ${style.bg} ${style.text} ${style.border} ${
                            newTagColor === colorKey ? 'ring-2 ring-[#B89C70] scale-102' : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          {newTagColor === colorKey && <Check className="w-3 h-3" />}
                          <span>{themeObj.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-2 ${goldAccentBtn} text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-98`}
                >
                  + 태그 추가하기
                </button>
              </form>

              <div className="space-y-2">
                <span className={`text-xs font-bold block ${textSubClass}`}>
                  등록된 전체 태그 목록 ({masterTags.length}개)
                </span>
                <div className={`flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2 border rounded-2xl ${isDark ? 'bg-[#1A1816] border-[#38342F]' : 'bg-white border-[#E8E3D8]'}`}>
                  {masterTags.map((t) => {
                    const themeObj = TAG_COLOR_THEMES[t.color] || TAG_COLOR_THEMES.amber;
                    const style = isDark ? themeObj.dark : themeObj.light;
                    return (
                      <span
                        key={t.name}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-xs ${style.bg} ${style.text} ${style.border}`}
                      >
                        <span>{t.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(t.name)}
                          className="hover:opacity-75 ml-0.5"
                          title="태그 삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition ${subCardBg}`}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSingerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Mic className="w-4 h-4 text-[#B89C70]" />
                싱어 배정 & 관리
              </h2>
              <button onClick={() => setIsSingerModalOpen(false)} className="p-1 text-[#9E988D] hover:text-[#4A4641]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className={`block text-xs font-bold mb-2 ${textSubClass}`}>
                  이번 주 찬양 싱어 선택
                </label>
                {masterSingers.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs text-[#7F7B74] ${subCardBg}`}>
                    등록된 싱어가 없습니다. 아래에서 싱어를 먼저 추가해주세요.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {masterSingers.map((singer) => {
                      const isChecked = selectedSingers.includes(singer);
                      return (
                        <button
                          key={singer}
                          type="button"
                          onClick={() => handleToggleSinger(singer)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition ${
                            isChecked
                              ? `${goldAccentBtn} border-[#B89C70] shadow-xs`
                              : subCardBg
                          }`}
                        >
                          <span className="truncate">{singer}</span>
                          {isChecked && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${isDark ? 'bg-[#1A1816] border-[#38342F]' : 'bg-[#FCFAF7] border-[#E8E3D8]'}`}>
                <span className={`text-xs font-bold block ${textSubClass}`}>찬양팀 싱어 명단 추가</span>
                <form onSubmit={handleAddMasterSinger} className="flex gap-2">
                  <input
                    type="text"
                    value={newSingerName}
                    onChange={(e) => setNewSingerName(e.target.value)}
                    placeholder="새 싱어 이름"
                    className={`flex-1 border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                  />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 ${goldAccentBtn} rounded-xl text-xs font-bold shrink-0`}
                  >
                    추가
                  </button>
                </form>

                {masterSingers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {masterSingers.map((singer) => (
                      <span
                        key={singer}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border font-semibold ${
                          isDark ? 'bg-[#2A2724] border-[#3D3833] text-neutral-200' : 'bg-white border-[#E8E3D8] text-[#3E3A36]'
                        }`}
                      >
                        <span>{singer}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMasterSinger(singer)}
                          className="text-[#9E988D] hover:text-[#D96A4E]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>
                  이번 주 콘티 특이사항 메모
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="예: 13:00 찬양팀 모임 / 단체복: 흰색"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSingerModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  onClick={handleSaveContiSingers}
                  className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  배정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Lock className={`w-4 h-4 ${goldAccentText}`} />
                관리자 인증
              </h2>
              <button onClick={() => setIsAuthModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="mt-3.5 space-y-3">
              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>비밀번호</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  인증하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <SlidersHorizontal className="w-4 h-4 text-[#B89C70]" />
                설정 및 모드
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs sm:text-sm">
              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  if (isAdmin) handleLogoutAdmin();
                  else setIsAuthModalOpen(true);
                }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between font-bold transition ${cardBgClass}`}
              >
                <div className="flex items-center gap-2.5">
                  {isAdmin ? <Unlock className="w-4 h-4 text-[#588B76]" /> : <Lock className="w-4 h-4 text-[#9E988D]" />}
                  <span>{isAdmin ? '관리자 모드 (활성화)' : '관리자 인증'}</span>
                </div>
                <span className="text-xs text-[#7F7B74]">{isAdmin ? '잠금' : '인증'}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      setIsChangePwModalOpen(true);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition ${cardBgClass}`}
                  >
                    <KeyRound className="w-4 h-4 text-[#B89C70]" />
                    <span>비밀번호 변경</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      setIsReordering(!isReordering);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition ${
                      isReordering ? 'bg-[#42331E]/60 border-[#735A33]/50 text-[#E5C492]' : cardBgClass
                    }`}
                  >
                    <GripVertical className="w-4 h-4" />
                    <span>{isReordering ? '곡 순서 편집 종료' : '곡 순서 편집 모드'}</span>
                  </button>
                </>
              )}

              <button
                onClick={toggleTheme}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between font-bold transition ${cardBgClass}`}
              >
                <div className="flex items-center gap-2.5">
                  {isDark ? <Sun className="w-4 h-4 text-[#A88B58]" /> : <Moon className="w-4 h-4 text-[#7D6AA8]" />}
                  <span>화면 테마</span>
                </div>
                <span className="text-xs text-[#7F7B74]">{isDark ? '에스프레소 다크' : '웜 샴페인 라이트'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {previewLibSong && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-3.5 sm:p-6">
          <div className={`rounded-3xl w-full max-w-xl p-5 shadow-2xl border flex flex-col max-h-[90vh] ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'} shrink-0`}>
              <div className="flex items-center gap-2 min-w-0">
                <Music className="w-4 h-4 text-[#B89C70]" />
                <h2 className={`text-base font-bold truncate ${textTitleClass}`}>{previewLibSong.title}</h2>
                {previewLibSong.key && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${
                    isDark ? 'bg-[#3A3022] border-[#735A33]/50 text-[#E5C492]' : 'bg-[#F4ECE1] border-[#DEC8A2] text-[#8C6D3E]'
                  }`}>
                    {previewLibSong.key} Key
                  </span>
                )}
              </div>
              <button onClick={() => setPreviewLibSong(null)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-3.5 pr-1">
              {previewLibSong.sheetUrls && previewLibSong.sheetUrls.length > 0 ? (
                <div className="space-y-2">
                  <span className={`text-xs font-bold block ${textSubClass}`}>등록된 악보 ({previewLibSong.sheetUrls.length}장)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewLibSong.sheetUrls.map((url, idx) => (
                      <div key={idx} className="border border-[#E2DDD2] rounded-2xl p-1 bg-white flex flex-col items-center shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${idx + 1}p`} className="w-full h-auto max-h-56 object-contain rounded-xl" />
                        <span className="text-xs font-bold text-[#3E3A36] mt-1">{idx + 1} 페이지</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#9E988D]">등록된 악보 이미지가 없습니다.</p>
              )}

              <div className={`space-y-1.5 pt-2 border-t ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${goldAccentText}`}>
                    <BookOpen className="w-3.5 h-3.5" /> 찬양 가사
                  </span>
                  {previewLibSong.lyrics && (
                    <button
                      onClick={() => handleCopyLyrics(previewLibSong.lyrics || '')}
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl ${goldAccentBtn} flex items-center gap-1 shadow-xs`}
                    >
                      <Copy className="w-3.5 h-3.5" /> 복사
                    </button>
                  )}
                </div>
                {previewLibSong.lyrics ? (
                  <div 
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    className={`p-3.5 rounded-2xl border text-sm font-normal leading-relaxed ${
                      isDark ? 'bg-[#1A1816] border-[#38342F] text-neutral-100' : 'bg-[#FCFAF7] border-[#E8E3D8] text-[#2C2A28]'
                    }`}
                  >
                    {previewLibSong.lyrics}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">등록된 가사가 없습니다.</p>
                )}
              </div>
            </div>

            <div className={`pt-3 border-t flex justify-between items-center shrink-0 ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <button
                onClick={() => {
                  handleDeleteFromLibrary(previewLibSong.id, previewLibSong.title);
                  setPreviewLibSong(null);
                }}
                className="px-3 py-1.5 text-xs text-[#D96A4E] hover:bg-[#F8EAE8] rounded-xl font-bold"
              >
                보관소에서 삭제
              </button>
              <button
                onClick={() => setPreviewLibSong(null)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold ${subCardBg}`}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {isChangePwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <KeyRound className="w-4 h-4 text-[#B89C70]" />
                비밀번호 변경
              </h2>
              <button onClick={() => setIsChangePwModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="mt-3.5 space-y-3">
              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>새 비밀번호</label>
                <input
                  type="password"
                  required
                  value={newPwInput}
                  onChange={(e) => setNewPwInput(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangePwModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${cardBgClass}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-[#38342F]' : 'border-[#E8E3D8]'}`}>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textTitleClass}`}>
                <Users className="w-4 h-4 text-[#B89C70]" />
                예배 참석 여부
              </h2>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="p-1 text-[#9E988D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5">
              <div>
                <label className={`block text-xs font-bold mb-1 ${textSubClass}`}>이름 (또는 직분)</label>
                <input
                  type="text"
                  value={myAttendanceName}
                  onChange={(e) => setMyAttendanceName(e.target.value)}
                  placeholder="예: 김지은 싱어"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#B89C70] ${inputBgClass}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${textSubClass}`}>참석 상태 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMyAttendanceStatus('yes')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      myAttendanceStatus === 'yes'
                        ? 'bg-[#588B76] border-[#588B76] text-white shadow-xs'
                        : subCardBg
                    }`}
                  >
                    참석
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyAttendanceStatus('no')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      myAttendanceStatus === 'no'
                        ? 'bg-[#D96A4E] border-[#D96A4E] text-white shadow-xs'
                        : subCardBg
                    }`}
                  >
                    불참
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyAttendanceStatus('maybe')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      myAttendanceStatus === 'maybe'
                        ? 'bg-[#B89C70] border-[#B89C70] text-white shadow-xs'
                        : subCardBg
                    }`}
                  >
                    미정
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  onClick={() => handleSubmitAttendance(myAttendanceStatus)}
                  className={`flex-1 py-2.5 ${goldAccentBtn} rounded-xl font-bold text-xs text-white shadow-xs`}
                >
                  출석 제출
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
