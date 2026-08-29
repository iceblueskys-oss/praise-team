보내주신 스크린샷을 보면 4번 곡(예수 이름으로) 영역에서 [기도송] 태그와 곡 제목, 그리고 아래의 밴드만 할땐 높여서 코멘트 영역이 서로 겹치거나 글자가 뭉개지는 현상이 발생하고 있습니다.
이 원인은 모바일 화면 폭이 좁은데 flex-wrap이나 truncate 처리가 빠져 있거나, 여러 개의 텍스트 요소가 한 줄에 강제로 들어가면서 레이아웃 공간을 초과했기 때문입니다.
이 문제를 해결하기 위해 곡 제목 영역의 레이아웃 구조를 flex-col(세로 정렬) 및 반응형 줄바꿈 구조로 탄탄하게 개편했습니다.
app/page.tsx (모바일 텍스트 겹침 완벽 해결 전체 교체 코드)
GitHub 저장소의 app/page.tsx 파일을 열고 아래 코드로 전체 교체 후 커밋해 주세요:
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Eye,
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
  Link as LinkIcon,
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
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Home,
  Bell,
  CheckCircle2,
  XCircle,
  HelpCircle,
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

export default function PraiseApp() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [contis, setContis] = useState<Conti[]>([]);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');
  const [isReordering, setIsReordering] = useState(false);

  const [activeTab, setActiveTab] = useState<'conti' | 'library'>('conti');
  const [isHeaderCardExpanded, setIsHeaderCardExpanded] = useState(false);
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

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
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
  const [modalSheetType, setModalSheetType] = useState<'file' | 'url' | 'library'>('file');
  const [modalSheetUrls, setModalSheetUrls] = useState<string[]>([]);
  const [modalUrlInput, setModalUrlInput] = useState('');
  const [modalLibrarySearch, setModalLibrarySearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [viewingSongId, setViewingSongId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sheet' | 'lyrics'>('sheet');
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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('praise_app_theme', next);
      } catch (e) {}
      return next;
    });
  }, []);

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
    alert('가사가 클립보드에 복사되었습니다.');
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
      const currentAttendance = currentConti.attendance || {};
      const updatedAttendance = { ...currentAttendance, [name]: status };

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

      if (authPasswordInput.trim() === correctPw) {
        setIsAdmin(true);
        localStorage.setItem('praise_app_is_admin', 'true');
        setIsAuthModalOpen(false);
        setAuthPasswordInput('');
        alert('관리자 모드가 활성화되었습니다.');
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      if (authPasswordInput.trim() === '1234') {
        setIsAdmin(true);
        localStorage.setItem('praise_app_is_admin', 'true');
        setIsAuthModalOpen(false);
        setAuthPasswordInput('');
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
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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
    setIsNewContiModalOpen(false);
  };

  const handleDeleteConti = async () => {
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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
      alert(`[${currentConti.title}] 콘티가 삭제되었습니다.`);
    } catch (err: any) {
      alert('콘티 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenSearchWeb = (engine: 'google' | 'daum') => {
    const term = `${modalTitle} ${modalKey ? `${modalKey} Key` : ''} 악보`.trim();
    if (!modalTitle.trim()) {
      alert('곡 제목을 먼저 입력해주세요.');
      return;
    }
    const url =
      engine === 'google'
        ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`
        : `https://search.daum.net/search?w=img&q=${encodeURIComponent(term)}`;
    window.open(url, '_blank');
  };

  const handleOpenSingerModal = () => {
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    const t = e.touches[0];
    startDragAction(idx, t.clientX, t.clientY, e.currentTarget);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIdx === null) return;
    const t = e.touches[0];
    updateDragPos(t.clientX, t.clientY);
  };

  const handleMouseDown = (idx: number, e: React.MouseEvent) => {
    if (!isAdmin) return;
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
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
    if (song) {
      setEditingSongId(song.id);
      setModalHeaderTag(song.headerTag || '');
      setModalTitle(song.title);
      setModalKey(song.key || '');
      setModalBpm(song.bpm ? String(song.bpm) : '');
      setModalComment(song.comment || '');
      setModalLyrics(song.lyrics || '');
      setModalSheetUrls(Array.isArray(song.sheetUrls) ? song.sheetUrls : []);
      setModalSheetType(song.sheetUrls?.[0]?.startsWith('http') ? 'url' : 'file');
      setModalUrlInput(song.sheetUrls?.[0]?.startsWith('http') ? song.sheetUrls[0] : '');
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
      setModalUrlInput('');
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
    if (libSong.sheetUrls?.[0]?.startsWith('http')) {
      setModalSheetType('url');
      setModalUrlInput(libSong.sheetUrls[0]);
    } else {
      setModalSheetType('file');
      setModalUrlInput('');
    }
    alert(`[${libSong.title}] 정보가 불러와졌습니다.`);
  };

  const handleDeleteFromLibrary = async (libId: string, libTitle: string) => {
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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

      let finalSheets: string[] = [];
      if (modalSheetType === 'url') {
        const formatted = formatImageUrl(modalUrlInput);
        if (formatted) finalSheets = [formatted];
      } else {
        finalSheets = modalSheetUrls;
      }

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
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
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
          className={`h-9 w-full rounded-xl flex flex-col items-center justify-center font-bold text-xs transition ${
            isSelected
              ? 'bg-blue-600 text-white shadow-md scale-105'
              : isSunday
              ? isDark
                ? 'text-red-400 hover:bg-neutral-800 font-black'
                : 'text-red-600 hover:bg-slate-100 font-black'
              : isDark
              ? 'text-neutral-300 hover:bg-neutral-800'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>{d}</span>
          {isSunday && !isSelected && (
            <span className="w-1 h-1 bg-red-500 rounded-full mt-0.5"></span>
          )}
        </button>
      );
    }
    return days;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300 text-xs font-bold">
        앱 불러오는 중...
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-100 text-slate-900';
  const cardBgClass = isDark ? 'bg-neutral-900/90 border-neutral-800 backdrop-blur-md' : 'bg-white/95 border-slate-200/90 shadow-sm backdrop-blur-md';
  const subCardBg = isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-slate-100 border-slate-200 text-slate-700';

  // ==========================================
  // 1. 악보 & 가사 뷰어 화면 (다이나믹 아일랜드 대응 패딩 적용)
  // ==========================================
  if (viewingSong) {
    const totalPages = viewingSong.sheetUrls?.length || 0;
    const currentSheetUrl = viewingSong.sheetUrls?.[currentPageIndex] || '';

    return (
      <div
        style={{ overscrollBehavior: 'none' }}
        className={`fixed inset-0 z-50 flex flex-col h-[100dvh] w-full select-none overflow-hidden touch-none pt-[env(safe-area-inset-top)] ${
          isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-200 text-slate-900'
        }`}
      >
        <div className="shrink-0 z-40 w-full flex flex-col shadow-md">
          <header className={`flex flex-col md:flex-row md:items-center md:justify-between px-3 py-2 border-b gap-2 ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={() => {
                    setViewingSongId(null);
                    setCurrentPageIndex(0);
                    setViewMode('sheet');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border shrink-0 cursor-pointer transition ${
                    isDark ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>목록</span>
                </button>

                <div className={`flex items-center rounded-lg border p-0.5 shrink-0 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                  <button
                    onClick={handlePrevSong}
                    disabled={currentSongIndex <= 0}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30 hover:text-blue-500"
                    title="이전 곡"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold px-1 min-w-[36px] text-center text-neutral-400">
                    {currentSongIndex + 1}/{currentSongs.length}
                  </span>
                  <button
                    onClick={handleNextSong}
                    disabled={currentSongIndex >= currentSongs.length - 1}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30 hover:text-blue-500"
                    title="다음 곡"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {viewingSong.headerTag && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded shrink-0">
                    {viewingSong.headerTag}
                  </span>
                )}

                <h1 className="font-bold text-xs sm:text-sm truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                  {viewingSong.title}
                </h1>
              </div>

              {viewingSong.key && (
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-blue-600 rounded text-white shrink-0">
                  {viewingSong.key} Key
                </span>
              )}
            </div>

            <div className="flex items-center justify-between md:justify-end gap-1.5 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-neutral-800/40">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode(viewMode === 'sheet' ? 'lyrics' : 'sheet')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition active:scale-95 ${
                    viewMode === 'lyrics'
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : isDark
                      ? 'bg-purple-950/40 border-purple-800 text-purple-300 hover:bg-purple-900/50'
                      : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                  }`}
                  title={viewMode === 'sheet' ? '가사 전용 뷰어로 전환' : '악보 보기로 전환'}
                >
                  {viewMode === 'sheet' ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                      <span>가사</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-white" />
                      <span>악보</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleSearchLyricsWeb(viewingSong.title)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition active:scale-95"
                  title="구글 찬양 가사 검색"
                >
                  <Globe className="w-3 h-3 text-blue-400" />
                  <span>가사 검색 ↗</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {viewMode === 'sheet' && totalPages > 1 && (
                  <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                    <button
                      onClick={() => setCurrentPageIndex((p) => Math.max(p - 1, 0))}
                      disabled={currentPageIndex === 0}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-blue-400 px-1 min-w-[28px] text-center">
                      {currentPageIndex + 1}/{totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPageIndex((p) => Math.min(p + 1, totalPages - 1))}
                      disabled={currentPageIndex === totalPages - 1}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {viewMode === 'sheet' && currentSheetUrl && (
                  <button
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                      isDrawingMode
                        ? 'bg-amber-500 text-neutral-950'
                        : isDark
                        ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    <PenTool className="w-3 h-3" />
                    <span>{isDrawingMode ? '닫기' : '필기'}</span>
                  </button>
                )}

                {viewMode === 'sheet' && (
                  <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                    <button
                      onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {viewingSong.comment && (
            <div className={`px-4 py-1.5 border-b text-[11px] sm:text-xs flex items-center gap-2 ${
              isDark ? 'bg-blue-950/40 border-blue-900/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <MessageSquare className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="font-bold shrink-0">진행 순서:</span>
              <span className="truncate">{viewingSong.comment}</span>
            </div>
          )}

          {viewMode === 'sheet' && isDrawingMode && (
            <div className={`flex items-center justify-between sm:justify-center gap-2 py-1.5 px-3 border-b overflow-x-auto text-xs no-scrollbar ${
              isDark ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-slate-200'
            }`}>
              <div className={`flex items-center p-0.5 rounded-lg gap-1 border shrink-0 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                <button
                  onClick={() => setCurrentTool('pen')}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${currentTool === 'pen' ? 'bg-blue-600 text-white font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
                >
                  펜
                </button>
                <button
                  onClick={() => setCurrentTool('highlighter')}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${currentTool === 'highlighter' ? 'bg-yellow-500 text-black font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
                >
                  형광펜
                </button>
                <button
                  onClick={() => setCurrentTool('eraser')}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${currentTool === 'eraser' ? 'bg-neutral-600 text-white font-bold' : isDark ? 'text-neutral-400' : 'text-slate-600'}`}
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
                    className={`w-3.5 h-3.5 rounded-full border-2 transition ${
                      penColor === color ? 'border-blue-400 scale-110 shadow' : 'border-transparent opacity-80'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleClearDrawing}
                className={`px-2 py-0.5 border rounded-lg text-[11px] shrink-0 ${isDark ? 'bg-neutral-800 hover:bg-red-950/80 text-red-400 border-neutral-700' : 'bg-slate-100 hover:bg-red-100 text-red-600 border-slate-300'}`}
              >
                {currentPageIndex + 1}p 필기 초기화
              </button>
            </div>
          )}
        </div>

        <main
          style={{ overscrollBehavior: 'contain', touchAction: 'pan-x pan-y pinch-zoom' }}
          className={`flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 pb-28 relative ${
            isDark ? 'bg-neutral-950' : 'bg-slate-200'
          }`}
        >
          {viewMode === 'lyrics' ? (
            <div className={`w-full max-w-2xl h-full p-4 sm:p-6 rounded-2xl border flex flex-col shadow-2xl ${cardBgClass}`}>
              <div className="flex items-center justify-between pb-2 border-b border-neutral-700/60 mb-2">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  찬양 가사 뷰어
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSearchLyricsWeb(viewingSong.title)}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  >
                    구글에서 가사 복사 ↗
                  </button>
                  <button
                    onClick={() => handleCopyLyrics(viewingSong.lyrics || '')}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border border-purple-500/40 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>가사 복사</span>
                  </button>
                </div>
              </div>

              <textarea
                value={viewingSong.lyrics || ''}
                onChange={(e) => handleUpdateViewingSongLyrics(e.target.value)}
                placeholder="등록된 가사가 없습니다. '구글에서 가사 복사' 버튼을 눌러 가사를 복사한 뒤 여기에 붙여넣으세요."
                className={`w-full flex-1 p-3 sm:p-4 rounded-xl border text-sm sm:text-base font-semibold leading-relaxed sm:leading-loose focus:outline-none focus:border-purple-500 resize-none ${
                  isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          ) : !currentSheetUrl ? (
            <div className={`text-center p-6 border rounded-2xl max-w-xs ${cardBgClass}`}>
              <p className="font-bold text-sm mb-1">등록된 악보가 없습니다.</p>
              <p className="text-xs opacity-70">수정 버튼을 눌러 악보 파일 또는 링크를 등록해주세요.</p>
            </div>
          ) : (
            <div
              className="relative transition-transform duration-100 origin-center inline-block max-w-full my-auto"
              style={{ transform: `scale(${scale})` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                key={currentSheetUrl}
                src={currentSheetUrl}
                alt={`${viewingSong.title} - ${currentPageIndex + 1}페이지`}
                onLoad={initCanvas}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded bg-white shadow-2xl block select-none pointer-events-none"
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

        <footer className="fixed bottom-0 inset-x-0 z-40 flex justify-center items-center pb-[max(env(safe-area-inset-bottom),16px)] pt-2 px-4 pointer-events-none bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 p-1.5 rounded-full backdrop-blur-xl border shadow-2xl bg-neutral-900/90 border-neutral-700/80">
            <button
              onClick={handlePrevSong}
              disabled={currentSongIndex <= 0}
              className="px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-20 active:scale-95 transition flex items-center gap-1.5"
            >
              <SkipBack className="w-4 h-4 text-blue-400" />
              <span className="hidden xs:inline">이전 곡</span>
            </button>

            {viewMode === 'sheet' && totalPages > 1 && (
              <div className="flex items-center gap-1 px-1 border-x border-neutral-700/80">
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.max(p - 1, 0))}
                  disabled={currentPageIndex === 0}
                  className="px-2.5 py-1.5 rounded-full text-xs font-bold text-neutral-300 hover:text-white disabled:opacity-20 transition"
                >
                  ◀ 이전 장
                </button>
                <span className="text-xs font-black text-blue-400 px-1 min-w-[36px] text-center">
                  {currentPageIndex + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPageIndex((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={currentPageIndex === totalPages - 1}
                  className="px-2.5 py-1.5 rounded-full text-xs font-bold text-neutral-300 hover:text-white disabled:opacity-20 transition"
                >
                  다음 장 ▶
                </button>
              </div>
            )}

            <button
              onClick={handleNextSong}
              disabled={currentSongIndex >= currentSongs.length - 1}
              className="px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-20 active:scale-95 transition flex items-center gap-1.5"
            >
              <span className="hidden xs:inline">다음 곡</span>
              <SkipForward className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // 2. 메인 화면 (다이나믹 아일랜드 대응 패딩 적용)
  // ==========================================
  const assignedSingers = Array.isArray(currentConti?.assignedSingers) ? currentConti.assignedSingers : [];
  const customNote = currentConti?.customNote || '';
  const currentNotice = currentConti?.notice || '';
  const currentAttendance = currentConti?.attendance || {};

  const yesCount = Object.values(currentAttendance).filter((v) => v === 'yes').length;
  const noCount = Object.values(currentAttendance).filter((v) => v === 'no').length;
  const maybeCount = Object.values(currentAttendance).filter((v) => v === 'maybe').length;

  const filteredLibrary = librarySongs.filter((s) => {
    const term = (librarySearchTerm || modalLibrarySearch).toLowerCase().trim();
    if (!term) return true;
    return (
      (s.title || '').toLowerCase().includes(term) ||
      (s.key || '').toLowerCase().includes(term) ||
      (s.lyrics || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className={`min-h-[100dvh] transition-colors duration-200 pb-28 p-3 sm:p-6 w-full max-w-[100vw] overflow-x-hidden pt-[max(env(safe-area-inset-top),16px)] ${bgClass}`}>
      <div className="max-w-2xl mx-auto space-y-3.5 w-full">
        
        {/* 앱 스타일 상단 바 */}
        <header className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight leading-none">찬양팀</h1>
              <p className="text-[10px] font-semibold opacity-50 mt-0.5">Worship Sheet App</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>곡 추가</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className={`p-2 border rounded-xl transition active:scale-95 ${subCardBg}`}
              title="설정 및 관리"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 탭 콘텐츠: 콘티 뷰 */}
        {activeTab === 'conti' && (
          <>
            {/* 콘티 선택 & 생성 드롭다운 바 */}
            <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-2xl border shadow-sm ${cardBgClass}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
                  value={selectedContiId}
                  onChange={(e) => setSelectedContiId(e.target.value)}
                  className={`w-full border font-bold rounded-xl px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none truncate ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-white focus:border-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {contis.length === 0 ? (
                    <option value="">콘티 없음</option>
                  ) : (
                    contis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({allSongs.filter((s) => s.contiId === c.id).length}곡)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                onClick={handleOpenAddContiModal}
                className={`ml-2 px-2.5 py-1.5 border rounded-xl text-xs font-bold shrink-0 transition active:scale-95 flex items-center gap-1 ${subCardBg}`}
                title="새 콘티 생성"
              >
                <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden xs:inline">새 콘티</span>
              </button>
            </div>

            {/* 공지사항 & 참석 여부 패널 */}
            {currentConti && (
              <div className={`rounded-2xl border p-3.5 space-y-3 ${cardBgClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold opacity-70">예배 공지사항</span>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setNoticeInput(currentNotice);
                              setIsNoticeModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-blue-400 hover:underline"
                          >
                            공지 작성 ↗
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-semibold mt-0.5 whitespace-pre-wrap leading-relaxed opacity-90">
                        {currentNotice || '등록된 공지사항이 없습니다.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-800/40 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold opacity-70 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-400" /> 이번 주 참석 여부
                    </span>
                    <button
                      onClick={() => setIsAttendanceModalOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
                    >
                      출석 체크하기
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 참석 ({yesCount})
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> 불참 ({noCount})
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> 미정 ({maybeCount})
                    </span>
                  </div>

                  {Object.keys(currentAttendance).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1 text-[11px]">
                      {Object.entries(currentAttendance).map(([name, status]) => (
                        <span
                          key={name}
                          className={`px-2 py-0.5 rounded-lg border font-medium ${
                            status === 'yes'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                              : status === 'no'
                              ? 'bg-red-500/10 border-red-500/20 text-red-300'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          }`}
                        >
                          {name} ({status === 'yes' ? '참석' : status === 'no' ? '불참' : '미정'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 콘티 싱어 / 특이사항 슬림 카드 */}
            {currentConti && (
              <div className={`rounded-2xl border transition-all overflow-hidden ${cardBgClass}`}>
                <div
                  onClick={() => setIsHeaderCardExpanded(!isHeaderCardExpanded)}
                  className="flex items-center justify-between p-2.5 px-3.5 cursor-pointer hover:bg-neutral-800/30 transition text-xs select-none"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-5 h-5 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Mic className="w-3 h-3 text-blue-500" />
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-[11px] font-medium opacity-85">
                      {assignedSingers.length > 0 ? (
                        <span className="font-bold text-blue-400 truncate">
                          싱어: {assignedSingers.join(', ')}
                        </span>
                      ) : (
                        <span className="opacity-60">싱어 미지정</span>
                      )}
                      {customNote && (
                        <span className="opacity-60 truncate">| {customNote}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold opacity-60 shrink-0 ml-2">
                    <span>{isHeaderCardExpanded ? '접기' : '상세'}</span>
                    {isHeaderCardExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {isHeaderCardExpanded && (
                  <div className={`p-3.5 border-t space-y-2.5 text-xs ${
                    isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold opacity-70 block">이번 주 찬양 싱어</span>
                      {isAdmin && (
                        <button
                          onClick={handleOpenSingerModal}
                          className="text-[11px] font-bold text-blue-400 hover:underline"
                        >
                          싱어 배정 / 명단 관리 ↗
                        </button>
                      )}
                    </div>

                    {assignedSingers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedSingers.map((singer) => (
                          <span
                            key={singer}
                            className="px-2.5 py-0.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center gap-1"
                          >
                            <Mic className="w-3 h-3" />
                            {singer}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] opacity-60">지정된 싱어가 없습니다.</p>
                    )}

                    {customNote && (
                      <div className="pt-2 border-t border-neutral-800/60 flex items-start gap-1.5 text-xs opacity-90">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>{customNote}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 곡 목록 리스트 (모바일 텍스트 겹침 완벽 방지 레이아웃) */}
            {currentConti ? (
              <div className="space-y-2.5 relative select-none w-full">
                {currentSongs.length === 0 ? (
                  <div className={`text-center py-14 border rounded-2xl text-xs sm:text-sm px-4 opacity-70 ${cardBgClass}`}>
                    등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-500 font-bold">[+ 곡 추가]</span>를 눌러보세요.
                  </div>
                ) : (
                  currentSongs.map((song, idx) => {
                    const isBeingDragged = draggedIdx === idx;
                    const isDropTarget = dropTargetIdx === idx && draggedIdx !== null;
                    const isLyricsExpanded = expandedLyricsSongId === song.id;

                    return (
                      <div key={song.id} data-song-index={idx} className="relative flex flex-col w-full">
                        {isDropTarget && !isBeingDragged && (
                          <div className="absolute -top-1 inset-x-0 h-1 bg-blue-500 rounded-full z-10 animate-pulse" />
                        )}

                        <div
                          className={`flex flex-col border transition-all duration-150 overflow-hidden w-full ${
                            isLyricsExpanded ? 'rounded-2xl shadow-md ring-1 ring-purple-500/40' : 'rounded-2xl'
                          } ${
                            isBeingDragged
                              ? 'opacity-20 border-dashed border-neutral-500 scale-[0.98]'
                              : cardBgClass
                          }`}
                        >
                          <div className="flex items-center justify-between p-3 sm:p-3.5 gap-2 w-full">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {isAdmin ? (
                                <div
                                  onTouchStart={(e) => handleTouchStart(idx, e)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={endDragAction}
                                  onMouseDown={(e) => handleMouseDown(idx, e)}
                                  style={{ touchAction: 'none' }}
                                  className="p-1 -m-1 text-neutral-400 hover:text-blue-500 active:text-blue-500 cursor-grab active:cursor-grabbing shrink-0"
                                  title="길게 눌러 드래그"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              ) : null}

                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-xs shrink-0">
                                {idx + 1}
                              </div>

                              {/* 🌟 텍스트 겹침 방지 세로 정렬 구조 🌟 */}
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {song.headerTag && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/40 rounded shrink-0">
                                      {song.headerTag}
                                    </span>
                                  )}

                                  <h3 className="text-xs sm:text-sm font-bold truncate max-w-[140px] xs:max-w-[190px] sm:max-w-sm">
                                    {song.title}
                                  </h3>

                                  {song.key && (
                                    <span className={`px-1.5 py-0.2 text-[10px] font-bold border rounded shrink-0 ${
                                      isDark ? 'bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                                    }`}>
                                      {song.key} Key
                                    </span>
                                  )}
                                  {song.sheetUrls && song.sheetUrls.length > 1 && (
                                    <span className={`flex items-center gap-0.5 px-1 py-0.2 text-[10px] font-bold border rounded opacity-75 shrink-0 ${
                                      isDark ? 'border-neutral-700' : 'border-slate-200'
                                    }`}>
                                      <Layers className="w-2.5 h-2.5" /> {song.sheetUrls.length}p
                                    </span>
                                  )}
                                </div>

                                {song.comment && (
                                  <div className="flex items-center gap-1 text-[11px] text-blue-500 dark:text-blue-400 font-medium mt-0.5">
                                    <MessageSquare className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{song.comment}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isReordering && isAdmin ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => executeReorder(idx, idx - 1)}
                                    disabled={idx === 0}
                                    className={`px-2 py-1 rounded-lg border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                                  >
                                    위로
                                  </button>
                                  <button
                                    onClick={() => executeReorder(idx, idx + 1)}
                                    disabled={idx === currentSongs.length - 1}
                                    className={`px-2 py-1 rounded-lg border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                                  >
                                    아래로
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleToggleLyricsExpand(song.id)}
                                    className={`flex items-center justify-center gap-0.5 px-2.5 py-1.5 border rounded-xl text-xs font-bold transition active:scale-95 ${
                                      isLyricsExpanded
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                        : isDark
                                        ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-purple-300'
                                        : 'bg-slate-100 hover:bg-purple-50 border-slate-300 text-purple-700'
                                    }`}
                                    title={isLyricsExpanded ? '가사 접기' : '가사 펼치기'}
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span className="hidden xs:inline">{isLyricsExpanded ? '닫기' : '가사'}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setViewingSongId(song.id);
                                      setCurrentPageIndex(0);
                                      setViewMode('sheet');
                                    }}
                                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 border rounded-xl text-xs font-bold transition active:scale-95 ${
                                      isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-100 border-blue-200 text-blue-700'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                                    <span>악보</span>
                                  </button>

                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() => handleOpenModal(song)}
                                        className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center ${subCardBg}`}
                                        title="곡 수정"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSong(song.id)}
                                        className={`p-1.5 border rounded-xl transition active:scale-95 flex items-center justify-center ${
                                          isDark ? 'bg-neutral-800 hover:bg-red-950/60 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-slate-100 hover:bg-red-50 border-slate-200 text-slate-500 hover:text-red-600'
                                        }`}
                                        title="곡 삭제"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* 가사 아코디언 본문 */}
                          {isLyricsExpanded && (
                            <div className={`border-t px-3.5 py-3 space-y-2.5 ${
                              isDark ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50/80 border-slate-200'
                            }`}>
                              <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" /> 찬양 가사
                                  </span>

                                  <div className={`flex items-center rounded-lg border p-0.5 text-[10px] font-bold ${
                                    isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-200 border-slate-300'
                                  }`}>
                                    <button
                                      onClick={() => handleChangeFontSize('sm')}
                                      className={`px-1.5 py-0.2 rounded transition ${lyricsFontSize === 'sm' ? 'bg-purple-600 text-white' : 'opacity-60'}`}
                                    >
                                      소
                                    </button>
                                    <button
                                      onClick={() => handleChangeFontSize('base')}
                                      className={`px-1.5 py-0.2 rounded transition ${lyricsFontSize === 'base' ? 'bg-purple-600 text-white' : 'opacity-60'}`}
                                    >
                                      중
                                    </button>
                                    <button
                                      onClick={() => handleChangeFontSize('lg')}
                                      className={`px-1.5 py-0.2 rounded transition ${lyricsFontSize === 'lg' ? 'bg-purple-600 text-white' : 'opacity-60'}`}
                                    >
                                      대
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  {song.lyrics && (
                                    <button
                                      onClick={() => handleCopyLyrics(song.lyrics || '')}
                                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 transition ${
                                        isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-white border-slate-300 text-slate-800'
                                      }`}
                                    >
                                      <Copy className="w-3 h-3 text-purple-500" />
                                      <span>복사</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleSearchLyricsWeb(song.title)}
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 transition ${
                                      isDark ? 'bg-neutral-800 border-neutral-700 text-blue-400' : 'bg-white border-slate-300 text-blue-600'
                                    }`}
                                  >
                                    <Globe className="w-3 h-3" />
                                    <span>구글 검색 ↗</span>
                                  </button>
                                </div>
                              </div>

                              {song.lyrics ? (
                                <div className={`font-medium leading-relaxed whitespace-pre-wrap p-3 rounded-xl border max-h-72 overflow-y-auto ${
                                  lyricsFontSize === 'sm' ? 'text-xs' : lyricsFontSize === 'lg' ? 'text-base font-semibold' : 'text-sm'
                                } ${isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`}>
                                  {song.lyrics}
                                </div>
                              ) : (
                                <div className={`py-5 text-center rounded-xl border border-dashed space-y-2 ${
                                  isDark ? 'border-neutral-800 bg-neutral-900/40 text-neutral-400' : 'border-slate-300 bg-white/60 text-slate-600'
                                }`}>
                                  <p className="text-xs font-semibold">등록된 가사가 없습니다.</p>
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => handleSearchLyricsWeb(song.title)}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm"
                                    >
                                      구글에서 가사 찾기 ↗
                                    </button>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleOpenModal(song)}
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-sm"
                                      >
                                        + 가사 직접 등록
                                      </button>
                                    )}
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
            ) : null}
          </>
        )}

        {/* 탭 콘텐츠: 찬양 보관소 뷰 */}
        {activeTab === 'library' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold flex items-center gap-1.5">
                  <Library className="w-4 h-4 text-purple-400" />
                  찬양 보관소 ({librarySongs.length}곡)
                </h2>
                <p className="text-[11px] opacity-60 mt-0.5">등록된 찬양을 검색하고 미리보세요</p>
              </div>

              <button
                onClick={() => syncAllSongsToLibrary(true)}
                disabled={isSyncingLib}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${subCardBg}`}
              >
                <RefreshCw className={`w-3 h-3 text-purple-400 ${isSyncingLib ? 'animate-spin' : ''}`} />
                <span>동기화</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={librarySearchTerm}
                onChange={(e) => setLibrarySearchTerm(e.target.value)}
                placeholder="찬양 제목, Key, 가사 본문 검색"
                className={`w-full border rounded-2xl pl-9 pr-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-purple-500 shadow-sm ${
                  isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="space-y-2">
              {filteredLibrary.length === 0 ? (
                <div className={`p-10 rounded-2xl border text-center space-y-2 ${cardBgClass}`}>
                  <p className="text-xs opacity-60">검색된 찬양이 없습니다.</p>
                </div>
              ) : (
                filteredLibrary.map((libSong) => (
                  <div
                    key={libSong.id}
                    onClick={() => setPreviewLibSong(libSong)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border gap-2 cursor-pointer transition active:scale-[0.99] hover:border-purple-500/50 ${cardBgClass}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm truncate">{libSong.title}</span>
                        {libSong.key && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded">
                            {libSong.key} Key
                          </span>
                        )}
                        {libSong.bpm && (
                          <span className="text-[10px] opacity-70 font-medium">BPM {libSong.bpm}</span>
                        )}
                        <span className="text-[10px] opacity-50">{libSong.sheetUrls?.length || 0}장 악보</span>
                      </div>
                      {libSong.lyrics && (
                        <p className="text-[11px] opacity-60 truncate mt-1">{libSong.lyrics}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-purple-400 px-2.5 py-1 rounded-lg bg-purple-500/10">
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

      {/* 하단 고정 네이티브 앱 플로팅 독 (Floating Tab Bar) */}
      <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className={`pointer-events-auto flex items-center gap-1 p-1.5 rounded-3xl border shadow-2xl backdrop-blur-xl ${
          isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('conti')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 ${
              activeTab === 'conti'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>예배 콘티</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 ${
              activeTab === 'library'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>찬양 보관소</span>
          </button>
        </div>
      </nav>

      {/* 공지사항 작성 모달 */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-500" />
                예배 공지사항 작성
              </h2>
              <button onClick={() => setIsNoticeModalOpen(false)} className="p-1 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                rows={5}
                value={noticeInput}
                onChange={(e) => setNoticeInput(e.target.value)}
                placeholder="예: 이번 주 리허설은 오전 9시까지 연습실로 모입니다."
                className={`w-full border rounded-2xl p-3 text-xs sm:text-sm focus:outline-none focus:border-amber-500 resize-none ${
                  isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-xs ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotice}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-xs text-neutral-950 shadow-md"
                >
                  공지 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 참석 여부 체크 모달 */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-500" />
                이번 주 예배 참석 여부
              </h2>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="p-1 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">이름 (또는 직분)</label>
                <input
                  type="text"
                  value={myAttendanceName}
                  onChange={(e) => setMyAttendanceName(e.target.value)}
                  placeholder="예: 김지은 싱어"
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1.5">참석 상태 선택</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMyAttendanceStatus('yes')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      myAttendanceStatus === 'yes'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
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
                        ? 'bg-red-600 border-red-500 text-white shadow-md'
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
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                        : subCardBg
                    }`}
                  >
                    미정
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-xs ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitAttendance(myAttendanceStatus)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white shadow-md shadow-blue-600/30"
                >
                  출석 제출
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 앱 설정 모달 */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                앱 설정 및 관리
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-1.5 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  if (isAdmin) handleLogoutAdmin();
                  else setIsAuthModalOpen(true);
                }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between font-bold transition ${cardBgClass}`}
              >
                <div className="flex items-center gap-2.5">
                  {isAdmin ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 opacity-60" />}
                  <span>{isAdmin ? '관리자 모드 (활성화됨)' : '관리자 수정 권한 얻기'}</span>
                </div>
                <span className="text-[11px] opacity-60">{isAdmin ? '잠금' : '인증'}</span>
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
                    <KeyRound className="w-4 h-4 text-blue-500" />
                    <span>관리자 비밀번호 변경</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      setIsReordering(!isReordering);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center gap-2.5 font-bold transition ${
                      isReordering ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : cardBgClass
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
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
                  <span>테마 모드</span>
                </div>
                <span className="text-[11px] opacity-60">{isDark ? '어두운 모드' : '밝은 모드'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 보관소 미리보기 모달 */}
      {previewLibSong && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6">
          <div className={`rounded-3xl w-full max-w-2xl p-5 shadow-2xl border flex flex-col max-h-[90vh] ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Music className="w-5 h-5 text-purple-400 shrink-0" />
                <h2 className="text-base sm:text-lg font-bold truncate">{previewLibSong.title}</h2>
                {previewLibSong.key && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-lg">
                    {previewLibSong.key} Key
                  </span>
                )}
              </div>
              <button onClick={() => setPreviewLibSong(null)} className="p-1.5 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-4 pr-1">
              {previewLibSong.sheetUrls && previewLibSong.sheetUrls.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold opacity-80 block">등록된 악보 ({previewLibSong.sheetUrls.length}장)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewLibSong.sheetUrls.map((url, idx) => (
                      <div key={idx} className="border rounded-2xl p-1 bg-white flex flex-col items-center shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${idx + 1}p`} className="w-full h-auto max-h-60 object-contain rounded-xl" />
                        <span className="text-[10px] font-bold text-slate-600 mt-1">{idx + 1} 페이지</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs opacity-60">등록된 악보 이미지가 없습니다.</p>
              )}

              <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> 찬양 가사
                  </span>
                  {previewLibSong.lyrics && (
                    <button
                      onClick={() => handleCopyLyrics(previewLibSong.lyrics || '')}
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                        isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-slate-100 border-slate-300 text-slate-800'
                      }`}
                    >
                      <Copy className="w-3 h-3" /> 복사
                    </button>
                  )}
                </div>
                {previewLibSong.lyrics ? (
                  <div className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                    isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {previewLibSong.lyrics}
                  </div>
                ) : (
                  <p className="text-xs opacity-60">등록된 가사가 없습니다.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-between items-center shrink-0">
              {isAdmin && (
                <button
                  onClick={() => {
                    handleDeleteFromLibrary(previewLibSong.id, previewLibSong.title);
                    setPreviewLibSong(null);
                  }}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-xl font-bold"
                >
                  보관소에서 삭제
                </button>
              )}
              <button
                onClick={() => setPreviewLibSong(null)}
                className={`ml-auto px-4 py-2 rounded-xl text-xs font-bold ${subCardBg}`}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 인증 모달 */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-500" />
                관리자 수정 권한 인증
              </h2>
              <button onClick={() => setIsAuthModalOpen(false)} className="p-1 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">관리자 비밀번호</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={authPasswordInput}
                  onChange={(e) => setAuthPasswordInput(e.target.value)}
                  placeholder="비밀번호 입력 (기본: 1234)"
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white shadow-md shadow-blue-600/30"
                >
                  인증하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {isChangePwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-500" />
                관리자 비밀번호 변경
              </h2>
              <button onClick={() => setIsChangePwModalOpen(false)} className="p-1 opacity-70 hover:opacity-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  required
                  value={newPwInput}
                  onChange={(e) => setNewPwInput(e.target.value)}
                  placeholder="변경할 새 비밀번호 입력"
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangePwModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white shadow-md shadow-blue-600/30"
                >
                  변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 새 콘티 추가 달력 모달 */}
      {isNewContiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 shadow-2xl border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                950 콘티 날짜 선택
              </h2>
              <button
                onClick={() => setIsNewContiModalOpen(false)}
                className="p-1.5 opacity-70 hover:opacity-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateConti} className="mt-4 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="font-black text-sm">
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
                    className={`p-1.5 rounded-lg border ${subCardBg}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentCalMonth(
                        new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1)
                      )
                    }
                    className={`p-1.5 rounded-lg border ${subCardBg}`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold opacity-60">
                <span className="text-red-500">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span>토</span>
              </div>

              <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>

              <div className="pt-1">
                <label className="block text-[11px] font-semibold opacity-70 mb-1">
                  생성될 콘티 제목
                </label>
                <input
                  type="text"
                  required
                  value={contiTitleInput}
                  onChange={(e) => setContiTitleInput(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs font-bold focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewContiModalOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-xs text-white shadow-lg shadow-blue-600/30"
                >
                  콘티 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 싱어 관리 모달 */}
      {isSingerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Mic className="w-5 h-5 text-blue-500" />
                이번 주 싱어 배정 & 싱어 명단
              </h2>
              <button
                onClick={() => setIsSingerModalOpen(false)}
                className="p-1.5 opacity-70 hover:opacity-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold opacity-80 mb-2">
                  이번 주 찬양 싱어 선택 (클릭하여 토글)
                </label>
                {masterSingers.length === 0 ? (
                  <div className={`p-4 rounded-xl border text-center text-xs opacity-60 ${subCardBg}`}>
                    등록된 전체 싱어가 없습니다. 아래에서 싱어를 먼저 추가해주세요.
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
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                              : isDark
                              ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                              : 'bg-slate-100 border-slate-300 text-slate-700'
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

              <div className={`p-3 rounded-2xl border space-y-2.5 ${isDark ? 'bg-neutral-800/50 border-neutral-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold block opacity-90">찬양팀 싱어 전체 명단 관리</span>
                
                <form onSubmit={handleAddMasterSinger} className="flex gap-2">
                  <input
                    type="text"
                    value={newSingerName}
                    onChange={(e) => setNewSingerName(e.target.value)}
                    placeholder="새 싱어 이름 입력"
                    className={`flex-1 border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>추가</span>
                  </button>
                </form>

                {masterSingers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {masterSingers.map((singer) => (
                      <span
                        key={singer}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border ${
                          isDark ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{singer}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMasterSinger(singer)}
                          className="text-neutral-500 hover:text-red-500 ml-0.5"
                          title="명단에서 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1">
                  이번 주 콘티 특이사항 메모
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="예: 13:00 찬양팀 모임 / 단체복: 흰색 상의"
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSingerModalOpen(false)}
                  className={`flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  onClick={handleSaveContiSingers}
                  className="flex-1 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30"
                >
                  배정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 (곡 추가/수정) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border ${
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
                <label className="block text-xs font-semibold opacity-80 mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  예배 순서 헤더 (선택 - 예: 입례, 파송, 헌금)
                </label>
                <div className="flex gap-1.5 mb-1.5 flex-wrap">
                  {['<입례>', '<송영>', '<경배와찬양>', '<기도송>', '<헌금>', '<파송>', '<특송>'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setModalHeaderTag(tag)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition ${
                        modalHeaderTag === tag
                          ? 'bg-amber-500 border-amber-400 text-neutral-950 font-black'
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
                      className="px-2 py-1 rounded-lg text-xs font-semibold border border-red-500/40 text-red-400"
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
                  className={`w-full border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:border-amber-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1">순수 곡 제목 *</label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="예: 꽃들도, 빛의 사자들이여"
                  className={`w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold opacity-80 mb-1">Key (선택)</label>
                  <select
                    value={modalKey}
                    onChange={(e) => setModalKey(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
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
                  <label className="block text-xs font-semibold opacity-80 mb-1">BPM (템포, 선택)</label>
                  <input
                    type="number"
                    value={modalBpm}
                    onChange={(e) => setModalBpm(e.target.value)}
                    placeholder="예: 72"
                    className={`w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1">
                  진행 순서 / 연주 메모 (선택)
                </label>
                <input
                  type="text"
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="예: Intro 4마디 후 시작 · 2절 후렴 반복"
                  className={`w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold opacity-80">찬양 가사 (선택)</label>
                  <button
                    type="button"
                    onClick={() => handleSearchLyricsWeb(modalTitle)}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    title="구글에서 찬양 가사 검색 후 복사해 오기"
                  >
                    <Globe className="w-3 h-3" />
                    <span>구글 가사 검색 ↗</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={modalLyrics}
                  onChange={(e) => setModalLyrics(e.target.value)}
                  placeholder="가사를 입력하거나 구글에서 복사해 붙여넣으세요"
                  className={`w-full border rounded-xl p-3 text-base sm:text-xs focus:outline-none focus:border-purple-500 resize-none ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-80 mb-1.5">악보 등록 방식</label>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setModalSheetType('file')}
                    className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border transition ${
                      modalSheetType === 'file'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>파일 첨부</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalSheetType('url')}
                    className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border transition ${
                      modalSheetType === 'url'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>링크/주소</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalSheetType('library')}
                    className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border transition ${
                      modalSheetType === 'library'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  >
                    <Library className="w-3.5 h-3.5" />
                    <span>보관함 ({librarySongs.length})</span>
                  </button>
                </div>

                {modalSheetType === 'file' && (
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
                      accept="image/*"
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
                        악보 처리 중...
                      </span>
                    )}
                  </div>
                )}

                {modalSheetType === 'url' && (
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSearchWeb('google')}
                        className="flex-1 py-2 px-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>구글 악보 찾기 ↗</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSearchWeb('daum')}
                        className="flex-1 py-2 px-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>다음 악보 찾기 ↗</span>
                      </button>
                    </div>

                    <div>
                      <input
                        type="url"
                        value={modalUrlInput}
                        onChange={(e) => setModalUrlInput(e.target.value)}
                        placeholder="구글 드라이브 링크 또는 이미지 주소 붙여넣기"
                        className={`w-full border rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-blue-500 ${
                          isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {modalSheetType === 'library' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        value={modalLibrarySearch}
                        onChange={(e) => setModalLibrarySearch(e.target.value)}
                        placeholder="보관된 곡명 검색 (클릭 시 자동 입력)"
                        className={`w-full border rounded-xl pl-8 pr-3 py-2 text-base sm:text-xs focus:outline-none focus:border-blue-500 ${
                          isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <div className={`max-h-48 overflow-y-auto space-y-1.5 p-1.5 border rounded-xl ${
                      isDark ? 'bg-neutral-800/50 border-neutral-700' : 'bg-slate-50 border-slate-200'
                    }`}>
                      {filteredLibrary.length === 0 ? (
                        <p className="text-center py-4 text-xs opacity-60">검색된 보관 곡이 없습니다.</p>
                      ) : (
                        filteredLibrary.map((libSong) => (
                          <div
                            key={libSong.id}
                            onClick={() => handleSelectFromLibrary(libSong)}
                            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer hover:border-purple-500 hover:scale-[1.01] transition ${cardBgClass}`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-xs truncate block">{libSong.title}</span>
                              <div className="flex items-center gap-1.5 text-[10px] opacity-70 mt-0.5">
                                {libSong.key && <span className="font-semibold text-blue-400">{libSong.key} Key</span>}
                                {libSong.bpm && <span>BPM {libSong.bpm}</span>}
                                <span>악보 {libSong.sheetUrls?.length || 0}장</span>
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded bg-purple-600/30 text-purple-300 font-bold text-[10px] flex items-center gap-1 shrink-0">
                              <ArrowDownToLine className="w-3 h-3" /> 가져오기
                            </span>
                          </div>
                        ))
                      )}
                    </div>
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
                  {isProcessing ? '처리 중...' : editingSongId ? '수정 완료' : '콘티에 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

