'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Music2,
  FolderPlus,
  Image as ImageIcon,
  Link2,
} from 'lucide-react';
import SongModal, { SongData } from '@/components/SongModal';

const UniversalScoreViewer = dynamic(() => import('@/components/UniversalScoreViewer'), {
  ssr: false,
});

interface Setlist {
  id: string;
  title: string;
  songs: SongData[];
}

const DEFAULT_SETLISTS: Setlist[] = [
  {
    id: 'setlist-1',
    title: '2026.08.30 주일 3부 예배',
    songs: [
      {
        id: 's-1',
        title: '꽃들도 (花も)',
        artist: 'JWorship',
        originalKey: 'E',
        targetKey: 'E',
        bpm: 72,
        arrangementNotes: 'Intro 4마디 후 시작',
      },
    ],
  },
];

export default function Home() {
  const [setlists, setSetlists] = useState<Setlist[]>(DEFAULT_SETLISTS);
  const [activeSetlistId, setActiveSetlistId] = useState<string>('setlist-1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [activeViewerSong, setActiveViewerSong] = useState<SongData | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 로컬 브라우저 자동 저장/로드
  useEffect(() => {
    const saved = localStorage.getItem('praise_hub_setlists_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSetlists(parsed);
        if (parsed.length > 0) setActiveSetlistId(parsed[0].id);
      } catch (e) {
        console.error(e);
      }
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('praise_hub_setlists_v2', JSON.stringify(setlists));
    }
  }, [setlists, isMounted]);

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];

  // 셋리스트 추가
  const handleCreateSetlist = () => {
    const name = prompt('새 콘티의 이름을 입력하세요:', '2026.09.06 주일 예배');
    if (!name) return;
    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      title: name,
      songs: [],
    };
    setSetlists([...setlists, newSetlist]);
    setActiveSetlistId(newSetlist.id);
  };

  // 셋리스트 삭제
  const handleDeleteSetlist = (id: string) => {
    if (setlists.length <= 1) {
      alert('최소 1개의 콘티는 있어야 합니다.');
      return;
    }
    if (confirm('이 콘티를 삭제하시겠습니까?')) {
      const remaining = setlists.filter((s) => s.id !== id);
      setSetlists(remaining);
      setActiveSetlistId(remaining[0].id);
    }
  };

  // 곡 추가 및 수정 저장
  const handleSaveSong = (songData: Omit<SongData, 'id'> & { id?: string }) => {
    setSetlists((prev) =>
      prev.map((setlist) => {
        if (setlist.id !== activeSetlistId) return setlist;

        if (songData.id) {
          // 기존 곡 수정
          return {
            ...setlist,
            songs: setlist.songs.map((s) => (s.id === songData.id ? { ...s, ...songData } : s)),
          };
        } else {
          // 새 곡 추가
          const newSong: SongData = {
            ...songData,
            id: `song-${Date.now()}`,
          };
          return { ...setlist, songs: [...setlist.songs, newSong] };
        }
      })
    );
  };

  const handleRemoveSong = (songId: string) => {
    setSetlists((prev) =>
      prev.map((setlist) => {
        if (setlist.id !== activeSetlistId) return setlist;
        return {
          ...setlist,
          songs: setlist.songs.filter((s) => s.id !== songId),
        };
      })
    );
  };

  if (!isMounted) return null;

  if (activeViewerSong) {
    return (
      <UniversalScoreViewer
        sheetSource={activeViewerSong.sheetSource}
        songTitle={activeViewerSong.title}
        targetKey={activeViewerSong.targetKey}
        bpm={activeViewerSong.bpm}
        onBack={() => setActiveViewerSong(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 상단 셋리스트 탭 & 추가 버튼 */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {setlists.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSetlistId(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  s.id === activeSetlistId
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {s.title} ({s.songs.length})
              </button>
            ))}
          </div>

          <button
            onClick={handleCreateSetlist}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 shrink-0"
          >
            <FolderPlus className="w-4 h-4 text-blue-400" />
            <span>+ 새 콘티 만들기</span>
          </button>
        </div>

        {/* 현재 활성 셋리스트 정보 카드 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/90 p-5 rounded-2xl border border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>현재 선택된 예배 콘티</span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">{activeSetlist.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingSong(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>곡 및 악보 추가</span>
            </button>
            <button
              onClick={() => handleDeleteSetlist(activeSetlist.id)}
              className="p-2 text-neutral-500 hover:text-red-400 bg-neutral-800 rounded-xl transition"
              title="콘티 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 곡 목록 리스트 */}
        <div className="space-y-3">
          {activeSetlist.songs.map((song, index) => (
            <div
              key={song.id}
              className="flex items-center justify-between p-4 rounded-xl border bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-bold text-neutral-500 text-sm w-4">{index + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Music2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <h3 className="font-bold text-white text-base truncate">{song.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-blue-300 font-semibold border border-neutral-700">
                      {song.targetKey} Key
                    </span>
                    {song.sheetSource?.type === 'image_file' && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        <ImageIcon className="w-3 h-3" /> 이미지 악보
                      </span>
                    )}
                    {song.sheetSource?.type === 'url' && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                        <Link2 className="w-3 h-3" /> 링크 악보
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 truncate">
                    {song.artist} {song.arrangementNotes && `· ${song.arrangementNotes}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  onClick={() => setActiveViewerSong(song)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>악보 보기</span>
                </button>
                <button
                  onClick={() => {
                    setEditingSong(song);
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition"
                  title="악보/곡 정보 수정"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRemoveSong(song.id)}
                  className="p-2 text-neutral-400 hover:text-red-400 bg-neutral-800 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {activeSetlist.songs.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-sm">
              이 콘티에 등록된 곡이 없습니다. 상단의 &apos;곡 및 악보 추가&apos; 버튼을 눌러보세요.
            </div>
          )}
        </div>

        <SongModal
          isOpen={isModalOpen}
          initialData={editingSong}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSong(null);
          }}
          onSave={handleSaveSong}
        />
      </div>
    </main>
  );
}
