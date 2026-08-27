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
  ChevronLeft,
  ChevronRight,
  PenTool,
  Wifi,
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
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  return trimmed;
}

export default function PraiseApp() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [contis, setContis] = useState<Conti[]>([]);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');
  const [isReordering, setIsReordering] = useState(false);

  // 관리자 수정 권한 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [isChangePwModalOpen, setIsChangePwModalOpen] = useState(false);
  const [newPwInput, setNewPwInput] = useState('');

  // 찬양 보관소 라이브러리 모달 상태
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [isSyncingLib, setIsSyncingLib] = useState(false);

  // 새 콘티 달력 모달 상태
  const [isNewContiModalOpen, setIsNewContiModalOpen] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>('');
  const [contiTitleInput, setContiTitleInput] = useState<string>('');
  const [currentCalMonth, setCurrentCalMonth] = useState<Date>(new Date());

  // 싱어 풀 상태
  const [masterSingers, setMasterSingers] = useState<string[]>([]);
  const [newSingerName, setNewSingerName] = useState('');
  const [isSingerModalOpen, setIsSingerModalOpen] = useState(false);
  const [selectedSingers, setSelectedSingers] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');

  // 플로팅 드래그 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCardWidth, setDragCardWidth] = useState<number>(0);

  // 곡 모달 상태
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
  const [processingMsg, setProcessingMsg] = useState('');

  // 뷰어 상태
  const [viewingSongId, setViewingSongId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sheet' | 'lyrics'>('sheet'); // 🌟 악보 모드 vs 가사 전용 모드
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('praise_app_theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);

    const savedAdmin = localStorage.getItem('praise_app_is_admin') === 'true';
    if (savedAdmin) setIsAdmin(true);

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

  useEffect(() => {
    setMounted(true);

    const qContis = query(collection(db, 'contis_v2'), orderBy('date', 'desc'));
    const unsubContis = onSnapshot(qContis, (snapshot) => {
      const list: Conti[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Conti));
      setContis(list);
      if (list.length > 0) {
        setSelectedContiId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0].id;
        });
      } else {
        setSelectedContiId('');
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
          headerTag: data.headerTag || '',
          title: data.title,
          key: data.key || null,
          bpm: data.bpm,
          comment: data.comment || '',
          lyrics: data.lyrics || '',
          sheetUrls: sheets,
          order: data.order ?? 0,
        });
      });
      setAllSongs(sList);
    });

    const qLib = query(collection(db, 'song_library'), orderBy('updatedAt', 'desc'));
    const unsubLib = onSnapshot(qLib, (snapshot) => {
      const libList: LibrarySong[] = [];
      snapshot.forEach((d) => {
        libList.push({ id: d.id, ...d.data() } as LibrarySong);
      });
      setLibrarySongs(libList);
    });

    const unsubMasterSingers = onSnapshot(doc(db, 'settings', 'singers_pool'), (snap) => {
      if (snap.exists()) {
        setMasterSingers(snap.data()?.list || []);
      }
    });

    return () => {
      unsubContis();
      unsubSongs();
      unsubLib();
      unsubMasterSingers();
    };
  }, []);

  useEffect(() => {
    if (allSongs.length > 0) {
      syncAllSongsToLibrary(false);
    }
  }, [allSongs]);

  const syncAllSongsToLibrary = async (showSuccessAlert = true) => {
    if (allSongs.length === 0) {
      if (showSuccessAlert) alert('동기화할 기존 콘티 곡이 없습니다.');
      return;
    }
    setIsSyncingLib(true);
    try {
      const batch = writeBatch(db);
      allSongs.forEach((song) => {
        const cleanTitle = song.title.trim();
        const cleanKey = song.key ? song.key.trim().toUpperCase() : 'NOKEY';
        const libDocId = `lib_${cleanTitle.replace(/\s+/g, '_')}_${cleanKey}`;
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
        alert('기존 콘티의 모든 찬양이 보관소로 안전하게 자동 동기화되었습니다!');
      }
    } catch (e) {
      console.error('보관소 자동 동기화 오류:', e);
    } finally {
      setIsSyncingLib(false);
    }
  };

  const currentConti = contis.find((c) => c.id === selectedContiId) || contis[0];
  const currentSongs = allSongs
    .filter((s) => s.contiId === currentConti?.id)
    .sort((a, b) => a.order - b.order);
  const viewingSong = currentSongs.find((s) => s.id === viewingSongId) || null;
  const currentSongIndex = currentSongs.findIndex((s) => s.id === viewingSongId);

  useEffect(() => {
    if (!viewingSong || viewMode === 'lyrics') return;

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
  }, [viewingSong, currentPageIndex, viewMode]);

  // 원클릭 구글 찬양 가사 검색
  const handleSearchLyricsWeb = (titleToSearch?: string) => {
    const q = (titleToSearch || viewingSong?.title || modalTitle || '').trim();
    if (!q) {
      alert('곡 제목이 없습니다.');
      return;
    }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(`${q} 찬양 가사`)}`, '_blank');
  };

  // 뷰어 내에서 직접 수정한 가사 저장
  const handleUpdateViewingSongLyrics = async (newLyrics: string) => {
    if (!viewingSong) return;
    try {
      await setDoc(doc(db, 'songs_v2', viewingSong.id), { lyrics: newLyrics }, { merge: true });
      
      const cleanTitle = viewingSong.title.trim();
      const cleanKey = viewingSong.key ? viewingSong.key.trim().toUpperCase() : 'NOKEY';
      const libDocId = `lib_${cleanTitle.replace(/\s+/g, '_')}_${cleanKey}`;
      await setDoc(doc(db, 'song_library', libDocId), { lyrics: newLyrics, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error('가사 저장 오류:', e);
    }
  };

  const handleCopyLyrics = (textToCopy: string) => {
    if (!textToCopy) {
      alert('복사할 가사가 없습니다.');
      return;
    }
    navigator.clipboard.writeText(textToCopy);
    alert('가사가 클립보드에 복사되었습니다.');
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
        alert('관리자 수정 권한이 활성화되었습니다.');
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      console.error(err);
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
    if (confirm('수정 권한을 잠그시겠습니까? (일반 뷰어 모드로 전환)')) {
      setIsAdmin(false);
      setIsReordering(false);
      localStorage.removeItem('praise_app_is_admin');
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwInput.trim()) return;
    try {
      await setDoc(doc(db, 'settings', 'admin_auth'), { password: newPwInput.trim() }, { merge: true });
      alert('관리자 비밀번호가 성공적으로 변경되었습니다.');
      setIsChangePwModalOpen(false);
      setNewPwInput('');
    } catch (err) {
      console.error(err);
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

    const songsCount = currentSongs.length;
    const confirmMsg = `정말로 [${currentConti.title}] 콘티를 삭제하시겠습니까?\n\n※ 등록된 곡 ${songsCount}곡과 필기 데이터가 모두 함께 삭제됩니다.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);
      const contiRef = doc(db, 'contis_v2', currentConti.id);
      batch.delete(contiRef);

      for (const song of currentSongs) {
        const songRef = doc(db, 'songs_v2', song.id);
        batch.delete(songRef);

        if (song.sheetUrls && song.sheetUrls.length > 0) {
          for (let p = 0; p < song.sheetUrls.length; p++) {
            const pageDrawRef = doc(db, 'drawings_v2', `${song.id}_p${p}`);
            batch.delete(pageDrawRef);
          }
        }
      }

      await batch.commit();
      if (viewingSongId) setViewingSongId(null);
      alert(`[${currentConti.title}] 콘티가 성공적으로 삭제되었습니다.`);
    } catch (err: any) {
      console.error(err);
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
    setSelectedSingers(currentConti?.assignedSingers || []);
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
    if (!confirm(`'${name}' 싱어를 전체 명단에서 삭제하시겠습니까?`)) return;
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
      console.error(err);
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
      console.error(e);
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
      console.error(e);
      alert('콘티 제목 수정 중 오류가 발생했습니다.');
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
      setModalSheetUrls(song.sheetUrls || []);
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
    setModalTitle(libSong.title);
    setModalKey(libSong.key || '');
    setModalBpm(libSong.bpm ? String(libSong.bpm) : '');
    setModalComment(libSong.comment || '');
    setModalLyrics(libSong.lyrics || '');
    setModalSheetUrls(libSong.sheetUrls || []);
    if (libSong.sheetUrls?.[0]?.startsWith('http')) {
      setModalSheetType('url');
      setModalUrlInput(libSong.sheetUrls[0]);
    } else {
      setModalSheetType('file');
      setModalUrlInput('');
    }
    alert(`[${libSong.title}] 악보와 정보가 성공적으로 불러와졌습니다.`);
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
      console.error(e);
      alert('보관소 삭제 실패');
    }
  };

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
      alert('파일 처리 오류');
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
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

      const songDocId = editingSongId || `song_${Date.now()}`;
      const maxOrder = currentSongs.length > 0 ? Math.max(...currentSongs.map((s) => s.order)) : 0;
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

      const cleanKey = modalKey.trim() ? modalKey.trim().toUpperCase() : 'NOKEY';
      const libDocId = `lib_${cleanTitle.replace(/\s+/g, '_')}_${cleanKey}`;

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
      console.error(err);
      alert('저장 실패');
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
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
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
      <div className={`min-h-screen flex flex-col items-center justify-center gap-2 ${theme === 'dark' ? 'bg-neutral-950 text-neutral-400' : 'bg-slate-50 text-slate-500'}`}>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">찬양팀 앱 불러오는 중...</p>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-100 text-slate-800';
  const cardBgClass = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm';
  const subCardBg = isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-slate-100 border-slate-200 text-slate-700';

  // ==========================================
  // 1. 악보 & 가사 뷰어 화면
  // ==========================================
  if (viewingSong) {
    const totalPages = viewingSong.sheetUrls?.length || 0;
    const currentSheetUrl = viewingSong.sheetUrls?.[currentPageIndex] || '';

    return (
      <div
        style={{ overscrollBehavior: 'none' }}
        className={`fixed inset-0 z-50 flex flex-col h-[100dvh] w-full select-none overflow-hidden touch-none ${
          isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-200 text-slate-900'
        }`}
      >
        <div className="shrink-0 z-40 w-full flex flex-col shadow-md">
          <header className={`flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b gap-2 ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
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
                <span className="hidden sm:inline">목록</span>
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
                <span className="text-[11px] font-bold px-1.5 min-w-[40px] text-center text-neutral-400">
                  {currentSongIndex + 1} / {currentSongs.length}곡
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
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-md shrink-0">
                  {viewingSong.headerTag}
                </span>
              )}

              <h1 className="font-bold text-sm sm:text-base truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs ml-1">
                {viewingSong.title}
              </h1>
              {viewingSong.key && (
                <span className="px-2 py-0.5 text-[11px] sm:text-xs font-bold bg-blue-600 rounded-md sm:rounded-full text-white shrink-0">
                  {viewingSong.key} Key
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* 🌟 악보 모드 vs 가사 전용 뷰어 토글 버튼 🌟 */}
              <button
                onClick={() => setViewMode(viewMode === 'sheet' ? 'lyrics' : 'sheet')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition active:scale-95 ${
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
                    <span>가사 보기</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-white" />
                    <span>악보 보기</span>
                  </>
                )}
              </button>

              {/* 구글 가사 검색 버튼 */}
              <button
                onClick={() => handleSearchLyricsWeb(viewingSong.title)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition active:scale-95"
                title="구글 찬양 가사 검색"
              >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">가사 검색 ↗</span>
              </button>

              {viewMode === 'sheet' && totalPages > 1 && (
                <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.max(p - 1, 0))}
                    disabled={currentPageIndex === 0}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                    title="이전 페이지"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 px-1.5 min-w-[36px] text-center">
                    {currentPageIndex + 1} / {totalPages}p
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex((p) => Math.min(p + 1, totalPages - 1))}
                    disabled={currentPageIndex === totalPages - 1}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                    title="다음 페이지"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {viewMode === 'sheet' && currentSheetUrl && (
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

              {viewMode === 'sheet' && (
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

          {viewingSong.comment && (
            <div className={`px-4 py-2 border-b text-xs flex items-center gap-2 ${
              isDark ? 'bg-blue-950/40 border-blue-900/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-bold shrink-0">진행 순서:</span>
              <span className="truncate">{viewingSong.comment}</span>
            </div>
          )}

          {viewMode === 'sheet' && isDrawingMode && (
            <div className={`flex items-center justify-between sm:justify-center gap-2 py-2 px-3 border-b overflow-x-auto text-xs no-scrollbar ${
              isDark ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-slate-200'
            }`}>
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
        </div>

        {/* 🌟 뷰어 본문 (가사 전용 모드 vs 악보 모드) 🌟 */}
        <main
          style={{ overscrollBehavior: 'contain', touchAction: 'pan-x pan-y pinch-zoom' }}
          className={`flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 pb-28 relative ${
            isDark ? 'bg-neutral-950' : 'bg-slate-200'
          }`}
        >
          {viewMode === 'lyrics' ? (
            /* 📝 가사 전용 뷰어 화면 */
            <div className={`w-full max-w-2xl h-full p-5 sm:p-6 rounded-2xl border flex flex-col shadow-2xl ${cardBgClass}`}>
              <div className="flex items-center justify-between pb-3 border-b border-neutral-700/60 mb-3">
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
                className={`w-full flex-1 p-4 rounded-xl border text-sm sm:text-base font-semibold leading-relaxed sm:leading-loose focus:outline-none focus:border-purple-500 resize-none ${
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
            /* 🎼 악보 뷰어 화면 */
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
  // 2. 메인 콘티 목록 화면
  // ==========================================
  const assignedSingers = currentConti?.assignedSingers || [];
  const customNote = currentConti?.customNote || '';

  const filteredLibrary = librarySongs.filter((s) => {
    const term = (librarySearchTerm || modalLibrarySearch).toLowerCase().trim();
    if (!term) return true;
    return (
      s.title.toLowerCase().includes(term) ||
      (s.key && s.key.toLowerCase().includes(term)) ||
      (s.lyrics && s.lyrics.toLowerCase().includes(term))
    );
  });

  return (
    <div className={`min-h-screen transition-colors duration-200 p-3 sm:p-6 md:p-8 ${bgClass}`}>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
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
                <option value="">콘티 없음</option>
              ) : (
                contis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({allSongs.filter((s) => s.contiId === c.id).length}곡)
                  </option>
                ))
              )}
            </select>

            <button
              onClick={handleOpenAddContiModal}
              className={`flex items-center justify-center gap-1 px-3 py-2 border rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${subCardBg}`}
            >
              <FolderPlus className="w-4 h-4 text-blue-500" />
              <span className="hidden xs:inline">새 콘티</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => {
                setLibrarySearchTerm('');
                setIsLibraryModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 border border-purple-500/50 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl text-xs font-bold transition active:scale-95 shrink-0"
              title="찬양팀 전체 찬양 보관소 열람"
            >
              <Library className="w-3.5 h-3.5 text-purple-400" />
              <span>찬양 보관소 ({librarySongs.length})</span>
            </button>

            <button
              onClick={() => (isAdmin ? handleLogoutAdmin() : setIsAuthModalOpen(true))}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                isAdmin
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30'
                  : subCardBg
              }`}
              title={isAdmin ? '수정 권한 잠금' : '수정 권한 얻기'}
            >
              {isAdmin ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 opacity-60" />}
              <span>{isAdmin ? '관리자 모드' : '수정 권한'}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsChangePwModalOpen(true)}
                className={`p-2 border rounded-xl transition ${subCardBg}`}
                title="관리자 비밀번호 변경"
              >
                <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${subCardBg}`}
              title="테마 모드 변경"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
              <span>{isDark ? '밝은 모드' : '어두운 모드'}</span>
            </button>

            {isAdmin && currentSongs.length > 1 && (
              <button
                onClick={() => setIsReordering(!isReordering)}
                className={`flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                  isReordering
                    ? 'bg-amber-500 border-amber-400 text-neutral-950'
                    : subCardBg
                }`}
              >
                {isReordering ? <Check className="w-3.5 h-3.5" /> : <GripVertical className="w-3.5 h-3.5" />}
                <span>{isReordering ? '완료' : '순서 편집'}</span>
              </button>
            )}

            <button
              onClick={() => handleOpenModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>곡 추가</span>
            </button>
          </div>
        </div>

        {currentConti ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" />
                <h1 className="text-lg sm:text-2xl font-black truncate">{currentConti.title}</h1>
                
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={handleEditContiTitle}
                      className={`p-1.5 border rounded-lg transition active:scale-95 ${subCardBg}`}
                      title="콘티 제목 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                    </button>
                    <button
                      onClick={handleDeleteConti}
                      className={`p-1.5 border rounded-lg transition active:scale-95 ${
                        isDark ? 'bg-neutral-800 hover:bg-red-950/70 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-slate-100 hover:bg-red-50 border-slate-200 text-slate-500 hover:text-red-600'
                      }`}
                      title="이 콘티 전체 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleOpenSingerModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold rounded-xl text-xs transition active:scale-95 shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>싱어 배정 / 관리</span>
              </button>
            </div>

            <div className={`p-3.5 sm:p-4 rounded-2xl border transition ${cardBgClass}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold flex items-center gap-1.5 opacity-80">
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                  이번 주 싱어 명단
                </span>
                {isAdmin && (
                  <span
                    onClick={handleOpenSingerModal}
                    className="text-[11px] text-blue-400 cursor-pointer hover:underline"
                  >
                    {assignedSingers.length > 0 ? '싱어 변경하기' : '+ 이번 주 싱어 지정하기'}
                  </span>
                )}
              </div>

              {assignedSingers.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {assignedSingers.map((singer) => (
                    <div
                      key={singer}
                      className="px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold flex items-center gap-1.5"
                    >
                      <Mic className="w-3 h-3" />
                      <span>{singer}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs opacity-60">이번 주 지정된 싱어가 없습니다.</p>
              )}

              {customNote && (
                <div className="mt-2.5 pt-2 border-t border-neutral-800/60 text-xs flex items-center gap-1.5 opacity-80">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="font-semibold shrink-0">메모:</span>
                  <span className="truncate">{customNote}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`p-8 border rounded-2xl text-center space-y-2 ${cardBgClass}`}>
            <p className="font-bold text-sm">등록된 예배 콘티가 없습니다.</p>
            <p className="text-xs opacity-70">상단의 [+ 새 콘티] 버튼을 눌러 새 콘티를 생성해주세요.</p>
          </div>
        )}

        {/* 곡 목록 리스트 */}
        {currentConti && (
          <div className="space-y-2.5 sm:space-y-3 relative select-none">
            {currentSongs.length === 0 ? (
              <div className={`text-center py-12 sm:py-16 border rounded-2xl text-xs sm:text-sm px-4 opacity-70 ${cardBgClass}`}>
                등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-500 font-semibold">[+ 곡 추가]</span> 버튼으로 새 곡을 추가해보세요.
              </div>
            ) : (
              currentSongs.map((song, idx) => {
                const isBeingDragged = draggedIdx === idx;
                const isDropTarget = dropTargetIdx === idx && draggedIdx !== null;

                return (
                  <div key={song.id} data-song-index={idx} className="relative">
                    {isDropTarget && !isBeingDragged && (
                      <div className="absolute -top-1.5 inset-x-0 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] z-10 animate-pulse" />
                    )}

                    <div
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border gap-3 transition-all duration-150 ${
                        isBeingDragged
                          ? 'opacity-20 border-dashed border-neutral-500 scale-[0.98]'
                          : cardBgClass
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isAdmin ? (
                          <div
                            onTouchStart={(e) => handleTouchStart(idx, e)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={endDragAction}
                            onMouseDown={(e) => handleMouseDown(idx, e)}
                            style={{ touchAction: 'none' }}
                            className="p-2 -m-2 text-neutral-400 hover:text-blue-500 active:text-blue-500 cursor-grab active:cursor-grabbing shrink-0"
                            title="길게 눌러 드래그"
                          >
                            <GripVertical className="w-5 h-5" />
                          </div>
                        ) : null}

                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isDark ? 'bg-neutral-800 text-neutral-300 border border-neutral-700/80' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {song.headerTag && (
                              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded shrink-0">
                                {song.headerTag}
                              </span>
                            )}

                            <h3 className="text-sm sm:text-base font-bold truncate max-w-[180px] sm:max-w-sm">
                              {song.title}
                            </h3>

                            {song.key && (
                              <span className={`px-2 py-0.5 text-[11px] font-bold border rounded-md shrink-0 ${
                                isDark ? 'bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                              }`}>
                                {song.key} Key
                              </span>
                            )}
                            {song.sheetUrls && song.sheetUrls.length > 1 && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded-md shrink-0 ${
                                isDark ? 'bg-purple-600/30 border-purple-500/40 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'
                              }`}>
                                <Layers className="w-3 h-3" /> {song.sheetUrls.length}장
                              </span>
                            )}
                            {song.bpm && (
                              <span className="text-[11px] opacity-70 font-medium shrink-0">
                                BPM {song.bpm}
                              </span>
                            )}
                          </div>

                          {song.comment && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 font-medium">
                              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{song.comment}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isReordering && isAdmin ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => executeReorder(idx, idx - 1)}
                              disabled={idx === 0}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                            >
                              위로
                            </button>
                            <button
                              onClick={() => executeReorder(idx, idx + 1)}
                              disabled={idx === currentSongs.length - 1}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-20 ${subCardBg}`}
                            >
                              아래로
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setViewingSongId(song.id);
                                setCurrentPageIndex(0);
                                setViewMode('sheet');
                              }}
                              className={`flex items-center justify-center gap-1 px-3 py-1.5 border rounded-xl text-xs font-bold transition active:scale-95 min-h-[34px] ${
                                isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-300' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-500" />
                              <span className="hidden xs:inline">악보 보기</span>
                            </button>
                            {isAdmin && (
                              <>
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
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {draggedIdx !== null && dragPos && currentSongs[draggedIdx] && (
          <div
            style={{
              position: 'fixed',
              left: `${dragPos.x - 30}px`,
              top: `${dragPos.y - 30}px`,
              width: `${dragCardWidth ? `${dragCardWidth}px` : '90vw'}`,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 border-blue-500 shadow-2xl scale-105 opacity-90 backdrop-blur-md ${
              isDark ? 'bg-neutral-900/95 text-white' : 'bg-white/95 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <GripVertical className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                {String(draggedIdx + 1).padStart(2, '0')}
              </div>
              <h3 className="text-sm sm:text-base font-bold truncate">
                {currentSongs[draggedIdx].headerTag ? `[${currentSongs[draggedIdx].headerTag}] ` : ''}
                {currentSongs[draggedIdx].title}
              </h3>
            </div>
            <span className="text-xs font-bold text-blue-500 px-2">이동 중...</span>
          </div>
        )}
      </div>

      {/* 찬양 보관소 모달 */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col border ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-purple-400" />
                <h2 className="text-base sm:text-lg font-bold">
                  찬양 보관소 ({librarySongs.length}곡)
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => syncAllSongsToLibrary(true)}
                  disabled={isSyncingLib}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${subCardBg}`}
                  title="기존 콘티의 모든 곡을 보관소로 가져오기"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isSyncingLib ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">전체 동기화</span>
                </button>
                <button onClick={() => setIsLibraryModalOpen(false)} className="p-1.5 opacity-70 hover:opacity-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={librarySearchTerm}
                onChange={(e) => setLibrarySearchTerm(e.target.value)}
                placeholder="보관된 찬양 제목, Key, 가사 본문 검색"
                className={`w-full border rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredLibrary.length === 0 ? (
                <div className={`p-8 rounded-xl border text-center space-y-3 ${subCardBg}`}>
                  <p className="text-xs opacity-70">보관된 찬양이 없습니다.</p>
                  <button
                    onClick={() => syncAllSongsToLibrary(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs"
                  >
                    기존 콘티 곡 모두 가져오기
                  </button>
                </div>
              ) : (
                filteredLibrary.map((libSong) => (
                  <div
                    key={libSong.id}
                    className={`flex items-center justify-between p-3 rounded-xl border gap-2 transition ${cardBgClass}`}
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
                        <span className="text-[10px] opacity-50">
                          {libSong.sheetUrls?.length || 0}장 악보
                        </span>
                      </div>
                      {libSong.lyrics && (
                        <p className="text-[11px] opacity-60 truncate mt-0.5">{libSong.lyrics}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteFromLibrary(libSong.id, libSong.title)}
                          className="p-1.5 opacity-40 hover:opacity-100 hover:text-red-500 rounded-lg"
                          title="보관소에서 영구 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 관리자 인증 모달 */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className={`rounded-2xl w-full max-w-xs p-5 shadow-2xl border ${
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
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-md shadow-blue-600/30"
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
          <div className={`rounded-2xl w-full max-w-xs p-5 shadow-2xl border ${
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
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangePwModalOpen(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold ${subCardBg}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-md shadow-blue-600/30"
                >
                  변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 새 콘티 추가 달력 모달 (950 전용) */}
      {isNewContiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 shadow-2xl border ${
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
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 ${
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
          <div className={`rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border ${
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
                    className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
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
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
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
                  type="button"
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

      {/* 🌟 모달 (곡 추가/수정 & 가사 등록 폼) 🌟 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto border ${
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
                  placeholder="직접 입력하거나 위 태그를 누르세요 (보관소에는 곡 제목만 저장됨)"
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 ${
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
                  placeholder="예: 꽃들도, 빛의 사자들이여 (헤더 없이 순수 곡명만 입력)"
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
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
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
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
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
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
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* 🌟 가사 입력 필드 및 원클릭 구글 가사 검색 🌟 */}
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
                  placeholder="가사를 입력하거나 구글에서 복사해 붙여넣으세요 (악보 뷰어에서 가사 전용 뷰어로 열람 가능)"
                  className={`w-full border rounded-xl p-3 text-xs focus:outline-none focus:border-purple-500 resize-none ${
                    isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* 3가지 악보 등록 방식 */}
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
                        className={`w-full border rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-blue-500 ${
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
                        placeholder="보관된 곡명 또는 가사 검색 (클릭 시 자동 입력)"
                        className={`w-full border rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
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
