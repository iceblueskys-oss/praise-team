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
  PlusCircle,
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
  writeBatch,
  getDoc,
} from 'firebase/firestore';

interface SongItem {
  id: string;
  contiId: string;
  headerTag?: string;
  title: string;
  key?: string | null;
  bpm?: number | null;
  comment?: string;
  lyrics?: string;
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
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  return trimmed;
}

function getSafeDocId(title: string, key?: string | null): string {
  const cleanTitle = (title || 'untitled').trim();
  const cleanKey = (key || 'NOKEY').trim();
  const rawId = `lib_${cleanTitle}_${cleanKey}`;
  return rawId.replace(/[\/\s#?\[\]]/g, '_');
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [contis, setContis] = useState<Conti[]>([]);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
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
  const [modalSheetType, setModalSheetType] = useState<'file' | 'library'>('file');
  const [modalSheetUrls, setModalSheetUrls] = useState<string[]>([]);
  const [modalLibrarySearch, setModalLibrarySearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 악보 뷰어 상태
  const [viewingSongId, setViewingSongId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sheet' | 'lyrics'>('sheet');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#EF4444');
  const [showViewerControls, setShowViewerControls] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const isLocalDrawing = useRef(false);

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
    setScale(1.0);
  }, [viewingSongId, currentPageIndex]);

  const handleToggleLyricsExpand = (songId: string) => {
    setExpandedLyricsSongId((prev) => (prev === songId ? null : songId));
  };

  const handleSearchLyricsWeb = (titleToSearch?: string) => {
    const q = (titleToSearch || modalTitle || '').trim();
    if (!q) {
      alert('곡 제목이 없습니다.');
      return;
    }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(`${q} 찬양 가사`)}`, '_blank');
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

  const syncAllSongsToLibrary = async (showSuccessAlert = true) => {
    if (allSongs.length === 0) {
      if (showSuccessAlert) alert('동기화할 기존 콘티 곡이 없습니다.');
      return;
    }
    setIsSyncingLib(true);
    try {
      const batch = writeBatch(db);
      allSongs.forEach((song) => {
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
            sheetUrls: song.sheetUrls || [],
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      });
      await batch.commit();
      if (showSuccessAlert) {
        alert('찬양이 보관소로 안전하게 동기화되었습니다!');
      }
    } catch (e) {
      console.error('보관소 동기화 오류:', e);
    } finally {
      setIsSyncingLib(false);
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('praise_app_theme') as 'dark' | 'light';
        if (savedTheme) setTheme(savedTheme);

        const savedAdmin = localStorage.getItem('praise_app_is_admin') === 'true';
        if (savedAdmin) setIsAdmin(true);

        const savedFontSize = localStorage.getItem('praise_lyrics_font_size') as 'sm' | 'base' | 'lg';
        if (savedFontSize) setLyricsFontSize(savedFontSize);

        const savedMyName = localStorage.getItem('praise_user_my_name');
        if (savedMyName) setMyAttendanceName(savedMyName);
      }
    } catch (e) {}
    setMounted(true);
  }, []);

  const handleChangeFontSize = (size: 'sm' | 'base' | 'lg') => {
    setLyricsFontSize(size);
    try {
      localStorage.setItem('praise_lyrics_font_size', size);
    } catch (e) {}
  };

  useEffect(() => {
    if (!mounted) return;

    let unsubContis = () => {};
    let unsubSongs = () => {};
    let unsubLib = () => {};
    let unsubSingers = () => {};

    try {
      const qContis = query(collection(db, 'contis_v2'), orderBy('date', 'desc'));
      unsubContis = onSnapshot(qContis, (snapshot) => {
        const list: Conti[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data?.title || '',
            date: data?.date || '',
            assignedSingers: Array.isArray(data?.assignedSingers) ? data.assignedSingers : [],
            customNote: data?.customNote || '',
            notice: data?.notice || '',
            attendance: data?.attendance && typeof data.attendance === 'object' ? data.attendance : {},
          });
        });
        setContis(list);
        if (list.length > 0) {
          setSelectedContiId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            return list[0].id;
          });
        }
      });

      const qSongs = query(collection(db, 'songs_v2'), orderBy('order', 'asc'));
      unsubSongs = onSnapshot(qSongs, (snapshot) => {
        const sList: SongItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          let sheets: string[] = [];
          if (Array.isArray(data?.sheetUrls)) {
            sheets = data.sheetUrls;
          } else if (data?.sheetUrl) {
            sheets = [data.sheetUrl];
          }
          sList.push({
            id: d.id,
            contiId: data?.contiId || '',
            headerTag: data?.headerTag || '',
            title: data?.title || '',
            key: data?.key || null,
            bpm: data?.bpm || null,
            comment: data?.comment || '',
            lyrics: data?.lyrics || '',
            sheetUrls: sheets,
            order: data?.order ?? 0,
          });
        });
        setAllSongs(sList);
      });

      const qLib = query(collection(db, 'song_library'), orderBy('updatedAt', 'desc'));
      unsubLib = onSnapshot(qLib, (snapshot) => {
        const libList: LibrarySong[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          libList.push({
            id: d.id,
            title: data?.title || '',
            key: data?.key || null,
            bpm: data?.bpm || null,
            comment: data?.comment || '',
            lyrics: data?.lyrics || '',
            sheetUrls: Array.isArray(data?.sheetUrls) ? data.sheetUrls : [],
            updatedAt: data?.updatedAt || Date.now(),
          });
        });
        setLibrarySongs(libList);
      });

      unsubSingers = onSnapshot(doc(db, 'settings', 'singers_pool'), (snap) => {
        if (snap.exists()) {
          const rawList = snap.data()?.list;
          setMasterSingers(Array.isArray(rawList) ? rawList : []);
        }
      });
    } catch (err) {
      console.error('Firebase 로드 실패:', err);
    }

    return () => {
      unsubContis();
      unsubSongs();
      unsubLib();
      unsubSingers();
    };
  }, [mounted]);

  useEffect(() => {
    if (!viewingSongId || viewMode === 'lyrics') return;

    const pageDrawId = `${viewingSongId}_p${currentPageIndex}`;
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
  }, [viewingSongId, currentPageIndex, viewMode]);

  const currentConti = contis.find((c) => c.id === selectedContiId) || contis[0];
  const currentSongs = allSongs
    .filter((s) => s.contiId === currentConti?.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const viewingSong = currentSongs.find((s) => s.id === viewingSongId) || null;
  const currentSongIndex = currentSongs.findIndex((s) => s.id === viewingSongId);

// 🌟 콘티 세부 정보 변수 정의 추가
  const assignedSingers = Array.isArray(currentConti?.assignedSingers) ? currentConti.assignedSingers : [];
  const customNote = currentConti?.customNote || '';
  const currentNotice = currentConti?.notice || '';
  const currentAttendance = currentConti?.attendance || {};

  const yesCount = Object.values(currentAttendance).filter((v) => v === 'yes').length;
  const noCount = Object.values(currentAttendance).filter((v) => v === 'no').length;
  const maybeCount = Object.values(currentAttendance).filter((v) => v === 'maybe').length;

  // 날짜 기준 콘티 분리 (오늘 이후 = 다가올 일정, 오늘 이전 = 지난 콘티)
  const todayStr = formatDateToStr(new Date());
  const upcomingContis = contis.filter((c) => (c.date || '') >= todayStr);
  const pastContis = contis.filter((c) => (c.date || '') < todayStr);

  const handleUpdateViewingSongLyrics = async (newLyrics: string) => {
    if (!viewingSong) return;
    try {
      await setDoc(doc(db, 'songs_v2', viewingSong.id), { lyrics: newLyrics }, { merge: true });
      const libDocId = getSafeDocId(viewingSong.title, viewingSong.key);
      await setDoc(doc(db, 'song_library', libDocId), { lyrics: newLyrics, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error('가사 저장 오류:', e);
    }
  };

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

  const handleSubmitAttendance = async (status: 'yes' | 'no' | 'maybe') => {
    if (!currentConti) return;
    const name = myAttendanceName.trim();
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      const currentAtt = currentConti.attendance || {};
      const updatedAttendance = { ...currentAtt, [name]: status };

      await setDoc(doc(db, 'contis_v2', currentConti.id), { attendance: updatedAttendance }, { merge: true });
      try {
        localStorage.setItem('praise_user_my_name', name);
      } catch (e) {}

      setIsAttendanceModalOpen(false);
      alert(`[${name}]님의 참석 여부가 반영되었습니다!`);
    } catch (e) {
      alert('참석 여부 저장 실패');
    }
  };

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const snap = await getDoc(doc(db, 'settings', 'admin_auth'));
      const correctPw = snap.exists() ? snap.data()?.password : '1234';

      if (authPasswordInput.trim() === correctPw || authPasswordInput.trim() === '1234') {
        setIsAdmin(true);
        localStorage.setItem('praise_app_is_admin', 'true');
        setIsAuthModalOpen(false);
        setAuthPasswordInput('');
        alert('관리자 인증이 완료되었습니다.');
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      if (authPasswordInput.trim() === '1234') {
        setIsAdmin(true);
        localStorage.setItem('praise_app_is_admin', 'true');
        setIsAuthModalOpen(false);
        setAuthPasswordInput('');
        alert('관리자 인증이 완료되었습니다.');
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    }
  };

  const handleLogoutAdmin = () => {
    if (confirm('수정 권한을 잠그시겠습니까? (일반 모드로 전환)')) {
      setIsAdmin(false);
      setIsReordering(false);
      try {
        localStorage.removeItem('praise_app_is_admin');
      } catch (e) {}
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwInput.trim()) return;
    try {
      await setDoc(doc(db, 'settings', 'admin_auth'), { password: newPwInput.trim() }, { merge: true });
      alert('관리자 비밀번호가 변경되었습니다.');
      setIsChangePwModalOpen(false);
      setNewPwInput('');
    } catch (err) {
      alert('비밀번호 변경 실패');
    }
  };

  const handleOpenAddContiModal = () => {
    const defaultSunday = getUpcomingSunday();
    const dateStr = formatDateToStr(defaultSunday);
    setCalendarSelectedDate(dateStr);
    setContiTitleInput(formatDateToTitle(defaultSunday, '950'));
    setCurrentCalMonth(new Date(defaultSunday.getFullYear(), defaultSunday.getMonth(), 1));
    setIsNewContiModalOpen(true);
  };

  const handleSelectCalendarDate = (dateObj: Date) => {
    const dateStr = formatDateToStr(dateObj);
    setCalendarSelectedDate(dateStr);
    setContiTitleInput(formatDateToTitle(dateObj, '950'));
  };

  const handleConfirmCreateConti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contiTitleInput.trim() || !calendarSelectedDate) {
      alert('콘티 제목과 날짜를 확인해주세요.');
      return;
    }

    try {
      const newId = `c_${Date.now()}`;
      const newConti: Conti = {
        id: newId,
        title: contiTitleInput.trim(),
        date: calendarSelectedDate,
        assignedSingers: [],
        customNote: '',
        notice: '',
        attendance: {},
      };

      await setDoc(doc(db, 'contis_v2', newId), newConti);
      setSelectedContiId(newId);
      setViewLevel('detail');
      setIsNewContiModalOpen(false);
    } catch (err) {
      alert('콘티 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteConti = async () => {
    if (!currentConti) return;
    if (!confirm(`정말로 [${currentConti.title}] 콘티를 삭제하시겠습니까?`)) return;

    try {
      const batch = writeBatch(db);
      const contiRef = doc(db, 'contis_v2', currentConti.id);
      batch.delete(contiRef);

      for (const song of currentSongs) {
        const songRef = doc(db, 'songs_v2', song.id);
        batch.delete(songRef);
      }

      await batch.commit();
      if (viewingSongId) setViewingSongId(null);
      setViewLevel('home');
      alert(`[${currentConti.title}] 콘티가 삭제되었습니다.`);
    } catch (err: any) {
      alert('콘티 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenSingerModal = () => {
    setSelectedSingers(Array.isArray(currentConti?.assignedSingers) ? currentConti.assignedSingers : []);
    setNoteInput(currentConti?.customNote || '');
    setIsSingerModalOpen(true);
  };

  const handleAddMasterSinger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSingerName.trim()) return;
    const name = newSingerName.trim();
    if (masterSingers.includes(name)) {
      alert('이미 등록된 싱어입니다.');
      return;
    }
    const updated = [...masterSingers, name];
    await setDoc(doc(db, 'settings', 'singers_pool'), { list: updated });
    setNewSingerName('');
  };

  const handleDeleteMasterSinger = async (name: string) => {
    if (!confirm(`'${name}' 싱어를 명단에서 삭제하시겠습니까?`)) return;
    const updated = masterSingers.filter((n) => n !== name);
    await setDoc(doc(db, 'settings', 'singers_pool'), { list: updated });
    setSelectedSingers((prev) => prev.filter((n) => n !== name));
  };

  const handleToggleSinger = (name: string) => {
    if (selectedSingers.includes(name)) {
      setSelectedSingers(selectedSingers.filter((n) => n !== name));
    } else {
      setSelectedSingers([...selectedSingers, name]);
    }
  };

  const handleSaveContiSingers = async () => {
    if (!currentConti) return;
    try {
      await setDoc(
        doc(db, 'contis_v2', currentConti.id),
        {
          assignedSingers: selectedSingers,
          customNote: noteInput.trim(),
        },
        { merge: true }
      );
      setIsSingerModalOpen(false);
    } catch (err) {
      alert('싱어 저장 실패');
    }
  };

  const startDragAction = (idx: number, clientX: number, clientY: number, targetEl: HTMLElement) => {
    const card = targetEl.closest('[data-song-index]') as HTMLElement;
    if (card) setDragCardWidth(card.offsetWidth);
    setDraggedIdx(idx);
    setDropTargetIdx(idx);
    setDragPos({ x: clientX, y: clientY });
  };

  const updateDragPos = (clientX: number, clientY: number) => {
    if (draggedIdx === null) return;
    setDragPos({ x: clientX, y: clientY });

    const element = document.elementFromPoint(clientX, clientY);
    const cardEl = element?.closest('[data-song-index]');
    if (cardEl) {
      const targetIndex = Number(cardEl.getAttribute('data-song-index'));
      if (!isNaN(targetIndex) && targetIndex !== dropTargetIdx) {
        setDropTargetIdx(targetIndex);
      }
    }
  };

  const endDragAction = async () => {
    if (draggedIdx !== null && dropTargetIdx !== null && draggedIdx !== dropTargetIdx) {
      await executeReorder(draggedIdx, dropTargetIdx);
    }
    setDraggedIdx(null);
    setDropTargetIdx(null);
    setDragPos(null);
  };

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    const t = e.touches[0];
    startDragAction(idx, t.clientX, t.clientY, e.currentTarget);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIdx === null) return;
    const t = e.touches[0];
    updateDragPos(t.clientX, t.clientY);
  };

  const handleMouseDown = (idx: number, e: React.MouseEvent) => {
    startDragAction(idx, e.clientX, e.clientY, e.currentTarget);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (draggedIdx !== null) updateDragPos(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (draggedIdx !== null) endDragAction();
    };

    if (draggedIdx !== null) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggedIdx, dropTargetIdx]);

  const executeReorder = async (fromIdx: number, toIdx: number) => {
    const updated = [...currentSongs];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    try {
      const batch = writeBatch(db);
      updated.forEach((song, newIdx) => {
        const songRef = doc(db, 'songs_v2', song.id);
        batch.update(songRef, { order: (newIdx + 1) * 10 });
      });
      await batch.commit();
    } catch (e) {
      alert('순서 저장 실패');
    }
  };

  const handlePrevSong = () => {
    if (currentSongIndex > 0) {
      setViewingSongId(currentSongs[currentSongIndex - 1].id);
      setCurrentPageIndex(0);
    }
  };

  const handleNextSong = () => {
    if (currentSongIndex < currentSongs.length - 1) {
      setViewingSongId(currentSongs[currentSongIndex + 1].id);
      setCurrentPageIndex(0);
    }
  };

  const handleEditContiTitle = async () => {
    if (!currentConti) return;
    const newTitle = prompt('콘티 제목을 수정하세요:', currentConti.title);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentConti.title) return;

    try {
      await setDoc(
        doc(db, 'contis_v2', currentConti.id),
        { title: newTitle.trim() },
        { merge: true }
      );
    } catch (e) {
      alert('콘티 제목 수정 오류');
    }
  };

  const handleOpenModal = (song?: SongItem) => {
    if (song) {
      setEditingSongId(song.id);
      setModalHeaderTag(song.headerTag || '');
      setModalTitle(song.title);
      setModalKey(song.key || '');
      setModalBpm(song.bpm ? String(song.bpm) : '');
      setModalComment(song.comment || '');
      setModalLyrics(song.lyrics || '');
      setModalSheetUrls(Array.isArray(song.sheetUrls) ? song.sheetUrls : []);
      setModalSheetType('file');
    } else {
      setEditingSongId(null);
      setModalHeaderTag('');
      setModalTitle('');
      setModalKey('');
      setModalBpm('');
      setModalComment('');
      setModalLyrics('');
      setModalSheetType('file');
      setModalSheetUrls([]);
    }
    setModalLibrarySearch('');
    setIsProcessing(false);
    setIsModalOpen(true);
  };
  
  const handleSelectFromLibrary = (libSong: LibrarySong) => {
    setModalTitle(libSong.title || '');
    setModalKey(libSong.key || '');
    setModalBpm(libSong.bpm ? String(libSong.bpm) : '');
    setModalComment(libSong.comment || '');
    setModalLyrics(libSong.lyrics || '');
    setModalSheetUrls(Array.isArray(libSong.sheetUrls) ? libSong.sheetUrls : []);
    alert(`[${libSong.title}] 정보가 불러와졌습니다.`);
  };

  const handleDeleteFromLibrary = async (libId: string, libTitle: string) => {
    if (!confirm(`찬양 보관소에서 [${libTitle}] 곡을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'song_library', libId));
    } catch (e) {
      alert('보관소 삭제 실패');
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

      const finalSheets = modalSheetUrls;

      if (editingSongId) {
        const oldSong = allSongs.find((s) => s.id === editingSongId);
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
        ? allSongs.find((s) => s.id === editingSongId)?.order ?? maxOrder + 10
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
        lyrics: modalLyrics.trim(),
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
          lyrics: modalLyrics.trim(),
          sheetUrls: finalSheets,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

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
      ctx.strokeStyle = `${penColor}22`;
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
    if (!isDrawingMode || !isDrawing.current || viewMode === 'lyrics') return;
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
              ? 'bg-[#4A90E2] text-white font-bold shadow-md shadow-blue-500/20 scale-105'
              : isSunday
              ? isDark
                ? 'text-[#FF7675] hover:bg-neutral-800 font-bold'
                : 'text-[#E74C3C] hover:bg-rose-50 font-bold'
              : isDark
              ? 'text-neutral-200 hover:bg-neutral-800'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>{d}</span>
          {isSunday && !isSelected && (
            <span className="w-1 h-1 bg-[#E74C3C] rounded-full mt-0.5"></span>
          )}
        </button>
      );
    }
    return days;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-neutral-950 text-slate-500 dark:text-neutral-400 text-sm font-medium">
        찬양팀 Hub 불러오는 중...
      </div>
    );
  }

  // 🌟 파스텔 톤 팔레트 설정 🌟
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-[#F4F6F9] text-slate-800';
  const cardBgClass = isDark ? 'bg-[#1C1C1E] border-neutral-800/80 shadow-sm' : 'bg-white border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)]';
  const subCardBg = isDark ? 'bg-[#2C2C2E] border-neutral-700 text-neutral-200 hover:bg-[#38383A]' : 'bg-[#EDF2F7] border-slate-200/60 text-slate-700 hover:bg-[#E2E8F0]';
  const inputBgClass = isDark ? 'bg-[#2C2C2E] border-neutral-700 text-white placeholder-neutral-500' : 'bg-[#F8FAFC] border-slate-200 text-slate-900 placeholder-slate-400';

  return (
    <div className={`min-h-[100dvh] transition-colors duration-200 pb-28 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden pt-[max(env(safe-area-inset-top),20px)] ${bgClass}`}>
      <div className="max-w-xl mx-auto space-y-4 w-full">
        
        {/* 파스텔 헤더 */}
        <header className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#68A5E8] to-[#9B83C5] flex items-center justify-center text-white shadow-md shadow-blue-500/15">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none text-slate-800 dark:text-white">찬양팀 Hub</h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 font-semibold">Worship Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddContiModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4A90E2] hover:bg-[#3B82F6] text-white rounded-2xl text-xs font-bold shadow-sm transition active:scale-95"
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
            {/* 공지사항 카드 (파스텔 앰버 악센트) */}
            <div className={`rounded-3xl border p-4 space-y-3 ${cardBgClass}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-2xl bg-[#FEF3E2] flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-[#F39C12]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-neutral-400">찬양팀 공지사항</span>
                    {currentConti && (
                      <button
                        onClick={() => {
                          setNoticeInput(currentNotice);
                          setIsNoticeModalOpen(true);
                        }}
                        className="text-xs font-bold text-[#4A90E2] hover:underline"
                      >
                        공지 작성 ↗
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-neutral-200">
                    {currentNotice || '등록된 예배 공지사항이 없습니다.'}
                  </p>
                </div>
              </div>

              {currentConti && (
                <div className="border-t border-slate-100 dark:border-neutral-800 pt-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-xl bg-[#E8F7EE] text-[#2E7D32] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 참석 {yesCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-[#FEECEC] text-[#C53030] flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> 불참 {noCount}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-[#FEF3E2] text-[#D97706] flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> 미정 {maybeCount}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className="px-3 py-1.5 bg-[#4A90E2] hover:bg-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
                  >
                    출석 체크
                  </button>
                </div>
              )}
            </div>

            {/* 🌟 1. 다가올 예배 일정 목록 🌟 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#4A90E2]" />
                  다가오는 예배 일정
                </h2>
                <span className="text-xs text-[#4A90E2] font-bold bg-[#EBF3FB] px-2 py-0.5 rounded-lg">
                  {upcomingContis.length}개 예정
                </span>
              </div>

              {upcomingContis.length === 0 ? (
                <div className={`text-center py-10 border rounded-3xl text-sm px-4 text-slate-500 dark:text-neutral-400 ${cardBgClass}`}>
                  예정된 예배 일정이 없습니다. 상단 <span className="text-[#4A90E2] font-bold">[+ 새 콘티]</span>를 눌러 다가올 예배를 등록해보세요.
                </div>
              ) : (
                upcomingContis.map((c) => {
                  const songCount = allSongs.filter((s) => s.contiId === c.id).length;
                  const singers = c.assignedSingers || [];

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedContiId(c.id);
                        setViewLevel('detail');
                      }}
                      className={`p-4 rounded-3xl border transition active:scale-[0.99] cursor-pointer hover:border-[#4A90E2]/50 flex items-center justify-between gap-3 ${cardBgClass}`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 text-xs font-bold bg-[#EBF3FB] text-[#2B6CB0] rounded-lg">
                            {c.date}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
                            {songCount}곡 수록
                          </span>
                        </div>

                        <h3 className="text-base font-bold truncate text-[#4A90E2]">
                          {c.title}
                        </h3>

                        {singers.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-400 truncate">
                            <Mic className="w-3.5 h-3.5 text-[#4A90E2] shrink-0" />
                            <span className="truncate">싱어: {singers.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[#4A90E2] font-bold text-xs shrink-0 pl-2">
                        <span>콘티 보기</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 🌟 2. 지난 콘티 보관함 (접기/펼치기 지원) 🌟 */}
            {pastContis.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPastContis(!showPastContis)}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between transition active:scale-98 ${subCardBg}`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-neutral-300">
                      지난 예배 콘티 ({pastContis.length}개)
                    </span>
                  </div>
                  {showPastContis ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showPastContis && (
                  <div className="space-y-2 pl-1">
                    {pastContis.map((c) => {
                      const songCount = allSongs.filter((s) => s.contiId === c.id).length;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContiId(c.id);
                            setViewLevel('detail');
                          }}
                          className={`p-3.5 rounded-2xl border opacity-75 hover:opacity-100 transition active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 ${cardBgClass}`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 rounded-md">
                                {c.date}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {songCount}곡
                              </span>
                            </div>
                            <h4 className="text-sm font-bold truncate text-slate-700 dark:text-neutral-300">
                              {c.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1 text-slate-500 font-semibold text-xs shrink-0">
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

        {/* 콘티 상세 곡 목록 */}
        {activeTab === 'conti' && viewLevel === 'detail' && currentConti && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setViewLevel('home')}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold transition active:scale-95 ${subCardBg}`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>목록으로</span>
              </button>

              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-[#4A90E2] hover:bg-[#3B82F6] text-white rounded-2xl text-xs font-bold shadow-xs transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>곡 추가</span>
              </button>
            </div>

            <div className={`p-4 rounded-3xl border space-y-2.5 ${cardBgClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-[#4A90E2] shrink-0" />
                  <h2 className="text-base font-bold truncate text-slate-800 dark:text-white">{currentConti.title}</h2>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleEditContiTitle}
                      className={`p-1 border rounded-lg transition ${subCardBg}`}
                      title="콘티 제목 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#4A90E2]" />
                    </button>
                    <button
                      onClick={handleDeleteConti}
                      className={`p-1 border rounded-lg transition ${
                        isDark ? 'bg-[#2C2C2E] text-neutral-400 hover:text-[#FF7675]' : 'bg-slate-100 text-slate-500 hover:text-[#E74C3C]'
                      }`}
                      title="이 콘티 전체 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleOpenSingerModal}
                  className="text-xs font-bold text-[#4A90E2] hover:underline shrink-0"
                >
                  + 싱어 관리
                </button>
              </div>

              {assignedSingers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedSingers.map((singer) => (
                    <span
                      key={singer}
                      className="px-2.5 py-0.5 rounded-lg bg-[#EBF3FB] text-[#2B6CB0] font-bold text-xs flex items-center gap-1"
                    >
                      <Mic className="w-3 h-3" /> {singer}
                    </span>
                  ))}
                </div>
              )}

              {customNote && (
                <p className="text-xs text-slate-500 dark:text-neutral-400 pt-1 border-t border-slate-100 dark:border-neutral-800">
                  📝 {customNote}
                </p>
              )}
            </div>

            <div className="space-y-2.5 relative select-none w-full">
              {currentSongs.length === 0 ? (
                <div className={`text-center py-12 border rounded-3xl text-sm px-4 text-slate-500 dark:text-neutral-400 ${cardBgClass}`}>
                  등록된 찬양 곡이 없습니다. 상단 <span className="text-[#4A90E2] font-bold">[+ 곡 추가]</span>를 눌러보세요.
                </div>
              ) : (
                currentSongs.map((song, idx) => {
                  const isBeingDragged = draggedIdx === idx;
                  const isDropTarget = dropTargetIdx === idx && draggedIdx !== null;
                  const isLyricsExpanded = expandedLyricsSongId === song.id;

                  return (
                    <div key={song.id} data-song-index={idx} className="relative flex flex-col w-full">
                      {isDropTarget && !isBeingDragged && (
                        <div className="absolute -top-1 inset-x-0 h-1 bg-[#4A90E2] rounded-full z-10 animate-pulse" />
                      )}

                      <div
                        className={`flex flex-col border transition-all duration-150 overflow-hidden w-full ${
                          isLyricsExpanded ? 'rounded-3xl ring-2 ring-[#8E74AE]/40' : 'rounded-3xl'
                        } ${
                          isBeingDragged
                            ? 'opacity-20 border-dashed border-neutral-400 scale-[0.98]'
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
                              className="p-1 -m-1 text-slate-400 hover:text-[#4A90E2] cursor-grab active:cursor-grabbing shrink-0"
                              title="길게 눌러 순서 변경"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>

                            <div className="w-7 h-7 rounded-xl bg-[#EBF3FB] text-[#2B6CB0] flex items-center justify-center font-bold text-xs shrink-0">
                              {idx + 1}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {song.headerTag && (
                                  <span className="px-2 py-0.5 text-xs font-bold bg-[#FEF3E2] text-[#D97706] rounded-lg shrink-0">
                                    {song.headerTag}
                                  </span>
                                )}

                                <h3 className="text-sm sm:text-base font-bold truncate text-slate-800 dark:text-white group-hover:text-[#4A90E2] transition">
                                  {song.title}
                                </h3>

                                {song.key && (
                                  <span className="px-2 py-0.5 text-xs font-bold bg-[#EBF3FB] text-[#2B6CB0] rounded-lg shrink-0">
                                    {song.key} Key
                                  </span>
                                )}
                                {song.sheetUrls && song.sheetUrls.length > 1 && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 rounded-lg shrink-0">
                                    <Layers className="w-3 h-3" /> {song.sheetUrls.length}p
                                  </span>
                                )}
                              </div>

                              {song.comment && (
                                <div className="flex items-center gap-1 text-xs text-[#4A90E2] font-semibold">
                                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{song.comment}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
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
                                  className={`flex items-center justify-center gap-1 px-3 py-1.5 border rounded-2xl text-xs font-bold transition active:scale-95 ${
                                    isLyricsExpanded
                                      ? 'bg-[#8E74AE] border-[#8E74AE] text-white shadow-xs'
                                      : 'bg-[#F3E8FF] border-[#E9D8FD] text-[#6B46C1] hover:bg-[#E9D8FD]'
                                  }`}
                                  title={isLyricsExpanded ? '가사 접기' : '가사 펼치기'}
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>{isLyricsExpanded ? '닫기' : '가사'}</span>
                                </button>

                                <button
                                  onClick={() => handleOpenModal(song)}
                                  className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center ${subCardBg}`}
                                  title="곡 수정"
                                >
                                  <Edit3 className="w-4 h-4 text-slate-700 dark:text-neutral-300" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song.id)}
                                  className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center ${
                                    isDark ? 'bg-[#2C2C2E] border-neutral-700 text-neutral-400 hover:text-[#FF7675]' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-[#E74C3C]'
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
                            isDark ? 'bg-black/40 border-white/5' : 'bg-[#FAF8FF] border-purple-100'
                          }`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#8E74AE] flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" /> 찬양 가사
                                </span>

                                <div className="flex items-center rounded-xl bg-purple-100/60 dark:bg-white/10 p-0.5 text-xs font-bold">
                                  <button
                                    onClick={() => handleChangeFontSize('sm')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'sm' ? 'bg-[#8E74AE] text-white' : 'text-slate-600 dark:text-neutral-400'}`}
                                  >
                                    소
                                  </button>
                                  <button
                                    onClick={() => handleChangeFontSize('base')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'base' ? 'bg-[#8E74AE] text-white' : 'text-slate-600 dark:text-neutral-400'}`}
                                  >
                                    중
                                  </button>
                                  <button
                                    onClick={() => handleChangeFontSize('lg')}
                                    className={`px-2 py-0.5 rounded-lg transition ${lyricsFontSize === 'lg' ? 'bg-[#8E74AE] text-white' : 'text-slate-600 dark:text-neutral-400'}`}
                                  >
                                    대
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {song.lyrics && (
                                  <button
                                    onClick={() => handleCopyLyrics(song.lyrics || '')}
                                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 transition ${subCardBg}`}
                                  >
                                    <Copy className="w-3.5 h-3.5 text-[#8E74AE]" />
                                    <span>복사</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleSearchLyricsWeb(song.title)}
                                  className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#EBF3FB] text-[#2B6CB0] hover:bg-[#DCEBF9] flex items-center gap-1 transition"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  <span>구글 검색 ↗</span>
                                </button>
                              </div>
                            </div>

                            {song.lyrics ? (
                              <div className={`font-normal leading-relaxed whitespace-pre-wrap p-3.5 rounded-2xl border max-h-80 overflow-y-auto ${
                                lyricsFontSize === 'sm' ? 'text-xs' : lyricsFontSize === 'lg' ? 'text-base font-semibold' : 'text-sm'
                              } ${isDark ? 'bg-[#1C1C1E] border-neutral-800 text-neutral-100' : 'bg-white border-purple-100 text-slate-800'}`}>
                                {song.lyrics}
                              </div>
                            ) : (
                              <div className="py-6 text-center rounded-2xl border border-dashed border-purple-200 dark:border-white/10 space-y-2">
                                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">등록된 가사가 없습니다.</p>
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={() => handleSearchLyricsWeb(song.title)}
                                    className="px-3 py-1 bg-[#4A90E2] text-white rounded-xl text-xs font-bold shadow-xs"
                                  >
                                    구글 검색 ↗
                                  </button>
                                  <button
                                    onClick={() => handleOpenModal(song)}
                                    className="px-3 py-1 bg-[#8E74AE] text-white rounded-xl text-xs font-bold shadow-xs"
                                  >
                                    + 가사 등록
                                  </button>
                                </div>
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

        {/* 탭 콘텐츠: 찬양 보관소 뷰 */}
        {activeTab === 'library' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                  <Library className="w-5 h-5 text-[#8E74AE]" />
                  찬양 보관소 ({librarySongs.length}곡)
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 font-semibold">콘티에 자주 사용하는 곡들을 검색해 보세요</p>
              </div>

              <button
                onClick={() => syncAllSongsToLibrary(true)}
                disabled={isSyncingLib}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold border transition active:scale-95 ${subCardBg}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#8E74AE] ${isSyncingLib ? 'animate-spin' : ''}`} />
                <span>동기화</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 dark:text-neutral-500" />
              <input
                type="text"
                value={librarySearchTerm}
                onChange={(e) => setLibrarySearchTerm(e.target.value)}
                placeholder="찬양 제목, Key, 가사 본문 검색"
                className={`w-full border rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8E74AE] ${inputBgClass}`}
              />
            </div>

            <div className="space-y-2.5">
              {filteredLibrary.length === 0 ? (
                <div className={`p-12 rounded-3xl border text-center text-slate-500 dark:text-neutral-400 text-sm ${cardBgClass}`}>
                  검색된 찬양이 없습니다.
                </div>
              ) : (
                filteredLibrary.map((libSong) => (
                  <div
                    key={libSong.id}
                    onClick={() => setPreviewLibSong(libSong)}
                    className={`flex items-center justify-between p-4 rounded-3xl border gap-2.5 cursor-pointer transition active:scale-[0.99] hover:border-[#8E74AE]/40 ${cardBgClass}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base truncate text-slate-800 dark:text-white">{libSong.title}</span>
                        {libSong.key && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-[#EBF3FB] text-[#2B6CB0] rounded-lg">
                            {libSong.key} Key
                          </span>
                        )}
                        {libSong.bpm && (
                          <span className="text-xs text-slate-500 dark:text-neutral-400 font-semibold">♩ {libSong.bpm}</span>
                        )}
                        <span className="text-xs text-slate-400 dark:text-neutral-500 font-medium">악보 {libSong.sheetUrls?.length || 0}장</span>
                      </div>
                      {libSong.lyrics && (
                        <p className="text-xs text-slate-500 dark:text-neutral-400 truncate mt-1">{libSong.lyrics}</p>
                      )}
                    </div>

                    <span className="text-xs font-bold text-[#8E74AE] px-3 py-1.5 rounded-xl bg-[#F3E8FF] shrink-0">
                      보기
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* 하단 고정 플로팅 탭바 */}
      <nav className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className={`pointer-events-auto flex items-center gap-1 p-1.5 rounded-full border shadow-xl backdrop-blur-2xl ${
          isDark ? 'bg-[#1C1C1E]/90 border-white/10' : 'bg-white/95 border-slate-200'
        }`}>
          <button
            onClick={() => {
              setActiveTab('conti');
              setViewLevel('home');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
              activeTab === 'conti'
                ? 'bg-[#4A90E2] text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            <span>예배 일정</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
              activeTab === 'library'
                ? 'bg-[#8E74AE] text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>찬양 보관소</span>
          </button>
        </div>
      </nav>

      {/* 🌟 전역 모달들 🌟 */}

      {/* 1. 새 콘티 추가 달력 모달 */}
      {isNewContiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4A90E2]" />
                950 콘티 날짜 선택
              </h2>
              <button onClick={() => setIsNewContiModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateConti} className="mt-3 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-sm">
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

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 dark:text-neutral-500">
                <span className="text-[#E74C3C]">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span>토</span>
              </div>

              <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>

              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-600 dark:text-neutral-400 mb-1">
                  생성될 콘티 제목
                </label>
                <input
                  type="text"
                  required
                  value={contiTitleInput}
                  onChange={(e) => setContiTitleInput(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] rounded-xl font-bold text-xs text-white shadow-xs"
                >
                  콘티 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 곡 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 shadow-2xl max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Music className="w-4 h-4 text-[#4A90E2]" />
                {editingSongId ? '찬양 곡 수정' : '찬양 곡 추가'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-3.5 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#F39C12]" />
                  예배 순서 태그 (선택)
                </label>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {['<입례>', '<송영>', '<경배와찬양>', '<기도송>', '<헌금>', '<파송>', '<특송>'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setModalHeaderTag(tag)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
                        modalHeaderTag === tag
                          ? 'bg-[#FEF3E2] border-[#F39C12] text-[#D97706]'
                          : subCardBg
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {modalHeaderTag && (
                    <button
                      type="button"
                      onClick={() => setModalHeaderTag('')}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold border border-red-500/40 text-red-500"
                    >
                      초기화
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={modalHeaderTag}
                  onChange={(e) => setModalHeaderTag(e.target.value)}
                  placeholder="직접 입력하거나 위 태그를 누르세요"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#F39C12] ${inputBgClass}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">순수 곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 은혜"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
                />  
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Key (선택)</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90E2] font-semibold ${inputBgClass}`}
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">BPM (템포, 선택)</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">
                  진행 순서 / 연주 메모 (선택)
                </label>
                <input
                  type="text"
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="예: Intro 4마디 후 시작 · 후렴 반복"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">찬양 가사 (선택)</label>
                  <button
                    type="button"
                    onClick={() => handleSearchLyricsWeb(modalTitle)}
                    className="text-xs font-bold text-[#4A90E2] hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>구글 가사 검색 ↗</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={modalLyrics}
                  onChange={(e) => setModalLyrics(e.target.value)}
                  placeholder="가사를 입력하거나 구글에서 복사해 붙여넣으세요"
                  className={`w-full border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#8E74AE] resize-none ${inputBgClass}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-2">악보 등록</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setModalSheetType('file')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold border transition ${
                      modalSheetType === 'file'
                        ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-xs'
                        : subCardBg
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>파일 / 갤러리 사진 첨부</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSheetType('library')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold border transition ${
                      modalSheetType === 'library'
                        ? 'bg-[#8E74AE] border-[#8E74AE] text-white shadow-xs'
                        : subCardBg
                    }`}
                  >
                    <Library className="w-4 h-4" />
                    <span>보관함 ({librarySongs.length})</span>
                  </button>
                </div>

                {modalSheetType === 'file' && (
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <a
                        href={googleSearchSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 bg-[#EBF3FB] text-[#2B6CB0] border border-[#CBD5E0] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#DCEBF9] transition"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>구글 악보 찾기 ↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={handlePasteClipboardUrl}
                        className="flex-1 py-2 px-3 bg-[#F3E8FF] text-[#6B46C1] border border-[#E9D8FD] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#E9D8FD] transition"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>복사한 주소 넣기</span>
                      </button>
                    </div>

                    <label className="w-full py-2.5 px-4 bg-[#52B788] hover:bg-[#40916C] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-98">
                      <ImageIcon className="w-4 h-4" />
                      <span>모바일 갤러리 / 악보 사진 선택</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {isProcessing && (
                      <span className="text-xs text-[#4A90E2] block animate-pulse font-bold text-center">
                        악보 최적화 처리 중...
                      </span>
                    )}

                    {modalSheetUrls.length > 0 && (
                      <div className={`grid grid-cols-3 gap-2 p-2.5 border rounded-2xl max-h-48 overflow-y-auto ${
                        isDark ? 'bg-[#2C2C2E] border-neutral-700' : 'bg-slate-100 border-slate-200'
                      }`}>
                        {modalSheetUrls.map((url, index) => (
                          <div key={index} className="relative group border rounded-xl p-1 flex flex-col items-center bg-white shadow-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${index + 1}p`}
                              className="w-full h-16 object-contain rounded-lg bg-white"
                            />
                            <span className="text-[11px] font-bold text-slate-700 mt-1">
                              {index + 1} 페이지
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSheetPage(index)}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-[#EF4444] text-white rounded-full shadow"
                              title="삭제"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {modalSheetType === 'library' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 dark:text-neutral-500" />
                      <input
                        type="text"
                        value={modalLibrarySearch}
                        onChange={(e) => setModalLibrarySearch(e.target.value)}
                        placeholder="보관된 곡명 검색"
                        className={`w-full border rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#8E74AE] ${inputBgClass}`}
                      />
                    </div>

                    <div className={`max-h-48 overflow-y-auto space-y-1.5 p-1.5 border rounded-2xl ${
                      isDark ? 'bg-[#2C2C2E] border-neutral-700' : 'bg-[#FAF8FF] border-purple-100'
                    }`}>
                      {filteredLibrary.length === 0 ? (
                        <p className="text-center py-4 text-xs text-slate-400">보관된 곡이 없습니다.</p>
                      ) : (
                        filteredLibrary.map((libSong) => (
                          <div
                            key={libSong.id}
                            onClick={() => handleSelectFromLibrary(libSong)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition active:scale-[0.99] ${cardBgClass}`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-xs truncate block text-slate-800 dark:text-white">{libSong.title}</span>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                                {libSong.key && <span className="font-bold text-[#4A90E2]">{libSong.key} Key</span>}
                                {libSong.bpm && <span>♩ {libSong.bpm}</span>}
                                <span>악보 {libSong.sheetUrls?.length || 0}장</span>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-[#8E74AE] text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs">
                              <ArrowDownToLine className="w-3 h-3 text-white" /> 가져오기
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] disabled:opacity-50 rounded-xl font-bold text-xs text-white shadow-xs"
                >
                  {isProcessing ? '처리 중...' : editingSongId ? '수정 완료' : '콘티에 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 싱어 관리 모달 */}
      {isSingerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#4A90E2]" />
                싱어 배정 & 관리
              </h2>
              <button onClick={() => setIsSingerModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-2">
                  이번 주 찬양 싱어 선택
                </label>
                {masterSingers.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs text-slate-500 ${subCardBg}`}>
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
                              ? 'bg-[#4A90E2] border-[#4A90E2] text-white shadow-xs'
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

              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${isDark ? 'bg-[#2C2C2E] border-neutral-700' : 'bg-[#F8FAFC] border-slate-200'}`}>
                <span className="text-xs font-bold block text-slate-700 dark:text-neutral-300">찬양팀 싱어 명단 추가</span>
                <form onSubmit={handleAddMasterSinger} className="flex gap-2">
                  <input
                    type="text"
                    value={newSingerName}
                    onChange={(e) => setNewSingerName(e.target.value)}
                    placeholder="새 싱어 이름"
                    className={`flex-1 border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#4A90E2] hover:bg-[#3B82F6] text-white rounded-xl text-xs font-bold shrink-0"
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
                          isDark ? 'bg-[#1C1C1E] border-neutral-700 text-neutral-200' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{singer}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMasterSinger(singer)}
                          className="text-slate-400 hover:text-[#EF4444]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">
                  이번 주 콘티 특이사항 메모
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="예: 13:00 찬양팀 모임 / 단체복: 흰색"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] rounded-xl font-bold text-xs text-white shadow-xs"
                >
                  배정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. 관리자 인증 모달 */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#4A90E2]" />
                관리자 인증
              </h2>
              <button onClick={() => setIsAuthModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">비밀번호</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  placeholder="기본 비밀번호: 1234"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] rounded-xl font-bold text-xs text-white shadow-xs"
                >
                  인증하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 앱 설정 모달 */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#4A90E2]" />
                설정 및 모드
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-1 text-slate-400">
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
                  {isAdmin ? <Unlock className="w-4 h-4 text-[#52B788]" /> : <Lock className="w-4 h-4 text-slate-400" />}
                  <span>{isAdmin ? '관리자 모드 (활성화)' : '관리자 인증'}</span>
                </div>
                <span className="text-xs text-slate-400">{isAdmin ? '잠금' : '인증'}</span>
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
                    <KeyRound className="w-4 h-4 text-[#4A90E2]" />
                    <span>비밀번호 변경</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      setIsReordering(!isReordering);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition ${
                      isReordering ? 'bg-[#FEF3E2] border-[#F39C12] text-[#D97706]' : cardBgClass
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
                  {isDark ? <Sun className="w-4 h-4 text-[#F39C12]" /> : <Moon className="w-4 h-4 text-[#8E74AE]" />}
                  <span>화면 테마</span>
                </div>
                <span className="text-xs text-slate-400">{isDark ? '어두운 모드' : '밝은 모드'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 보관소 미리보기 모달 */}
      {previewLibSong && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-3.5 sm:p-6">
          <div className={`rounded-3xl w-full max-w-xl p-5 shadow-2xl border flex flex-col max-h-[90vh] ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Music className="w-4 h-4 text-[#8E74AE] shrink-0" />
                <h2 className="text-base font-bold truncate">{previewLibSong.title}</h2>
                {previewLibSong.key && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-[#EBF3FB] text-[#2B6CB0] rounded-lg">
                    {previewLibSong.key} Key
                  </span>
                )}
              </div>
              <button onClick={() => setPreviewLibSong(null)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-3.5 pr-1">
              {previewLibSong.sheetUrls && previewLibSong.sheetUrls.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 block">등록된 악보 ({previewLibSong.sheetUrls.length}장)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewLibSong.sheetUrls.map((url, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl p-1 bg-white flex flex-col items-center shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${idx + 1}p`} className="w-full h-auto max-h-56 object-contain rounded-xl" />
                        <span className="text-xs font-bold text-slate-700 mt-1">{idx + 1} 페이지</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">등록된 악보 이미지가 없습니다.</p>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8E74AE] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> 찬양 가사
                  </span>
                  {previewLibSong.lyrics && (
                    <button
                      onClick={() => handleCopyLyrics(previewLibSong.lyrics || '')}
                      className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#8E74AE] text-white flex items-center gap-1 shadow-xs"
                    >
                      <Copy className="w-3 h-3 text-white" /> 복사
                    </button>
                  )}
                </div>
                {previewLibSong.lyrics ? (
                  <div className={`p-3.5 rounded-2xl border text-sm font-normal leading-relaxed whitespace-pre-wrap ${
                    isDark ? 'bg-[#2C2C2E] border-neutral-700 text-white' : 'bg-[#FAF8FF] border-purple-100 text-slate-800'
                  }`}>
                    {previewLibSong.lyrics}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">등록된 가사가 없습니다.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center shrink-0">
              <button
                onClick={() => {
                  handleDeleteFromLibrary(previewLibSong.id, previewLibSong.title);
                  setPreviewLibSong(null);
                }}
                className="px-3 py-1.5 text-xs text-[#EF4444] hover:bg-red-50 rounded-xl font-bold"
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

      {/* 7. 비밀번호 변경 모달 */}
      {isChangePwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#4A90E2]" />
                비밀번호 변경
              </h2>
              <button onClick={() => setIsChangePwModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  required
                  value={newPwInput}
                  onChange={(e) => setNewPwInput(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] rounded-xl font-bold text-xs text-white shadow-xs"
                >
                  변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. 출석 체크 모달 */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-[#1C1C1E] border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4A90E2]" />
                예배 참석 여부
              </h2>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">이름 (또는 직분)</label>
                <input
                  type="text"
                  value={myAttendanceName}
                  onChange={(e) => setMyAttendanceName(e.target.value)}
                  placeholder="예: 김지은 싱어"
                  className={`w-full border rounded-xl px-3.5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#4A90E2] ${inputBgClass}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1.5">참석 상태 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMyAttendanceStatus('yes')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      myAttendanceStatus === 'yes'
                        ? 'bg-[#52B788] border-[#52B788] text-white shadow-xs'
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
                        ? 'bg-[#EF4444] border-[#EF4444] text-white shadow-xs'
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
                        ? 'bg-[#F39C12] border-[#F39C12] text-white shadow-xs'
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
                  className="flex-1 py-2.5 bg-[#4A90E2] hover:bg-[#3B82F6] rounded-xl font-bold text-xs text-white shadow-xs"
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
