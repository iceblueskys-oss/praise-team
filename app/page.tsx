'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Eye, Calendar, FolderPlus } from 'lucide-react';
import SongModal, { SongData } from '@/components/SongModal';
import UniversalScoreViewer from '@/components/UniversalScoreViewer';

interface SongItem extends SongData {
  id: string;
}

interface Conti {
  id: string;
  title: string;
  date: string;
  songs: SongItem[];
}

const DB_NAME = 'PraiseTeamDB_v2';
const STORE_NAME = 'contis_store';

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromDB(): Promise<Conti[] | null> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('main_data');
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error('DB Load Error:', e);
    return null;
  }
}

async function saveToDB(contis: Conti[]): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: 'main_data', data: contis });
  } catch (e) {
    console.error('DB Save Error:', e);
  }
}

export default function Home() {
  const [contis, setContis] = useState<Conti[]>([]);
  const [selectedContiId, setSelectedContiId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongItem | null>(null);
  const [viewingSongId, setViewingSongId] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      const dbData = await loadFromDB();
      if (dbData && dbData.length > 0) {
        setContis(dbData);
        setSelectedContiId(dbData[0].id);
      } else {
        const defaultConti: Conti = {
          id: 'conti_1',
          title: '2026.08.30 주일 3부 예배',
          date: '2026-08-30',
          songs: [],
        };
        setContis([defaultConti]);
        setSelectedContiId(defaultConti.id);
        await saveToDB([defaultConti]);
      }
    }
    loadData();
  }, []);

  const currentConti = contis.find((c) => c.id === selectedContiId) || contis[0];
  const activeViewingSong = currentConti?.songs?.find((s) => s.id === viewingSongId) || null;

  // 콘티 추가
  const handleAddConti = async () => {
    const title = prompt('새 예배 콘티 이름을 입력하세요:', '새 예배 콘티');
    if (!title) return;
    const newConti: Conti = {
      id: `conti_${Date.now()}`,
      title,
      date: new Date().toISOString().split('T')[0],
      songs: [],
    };
    const updated = [newConti, ...contis];
    setContis(updated);
    setSelectedContiId(newConti.id);
    await saveToDB(updated);
  };

  // 곡 추가 및 수정 저장 (완전 동기화)
  const handleSaveSong = async (songData: SongData) => {
    if (!currentConti) return;

    let updatedSongs: SongItem[];

    if (songData.id) {
      // 기존 곡 수정
      updatedSongs = currentConti.songs.map((s) =>
        s.id === songData.id
          ? {
              ...s,
              title: songData.title,
              key: songData.key,
              bpm: songData.bpm,
              sheetType: songData.sheetType,
              sheetUrl: songData.sheetUrl,
            }
          : s
      );
    } else {
      // 신규 곡 추가
      const newSong: SongItem = {
        id: `song_${Date.now()}`,
        title: songData.title,
        key: songData.key,
        bpm: songData.bpm,
        sheetType: songData.sheetType,
        sheetUrl: songData.sheetUrl,
      };
      updatedSongs = [...currentConti.songs, newSong];
    }

    const updatedContis = contis.map((c) =>
      c.id === currentConti.id ? { ...c, songs: updatedSongs } : c
    );

    setContis(updatedContis);
    await saveToDB(updatedContis);
    setEditingSong(null);
  };

  // 곡 삭제
  const handleDeleteSong = async (songId: string) => {
    if (!confirm('이 곡을 콘티에서 삭제하시겠습니까?')) return;
    const updatedSongs = currentConti.songs.filter((s) => s.id !== songId);
    const updatedContis = contis.map((c) =>
      c.id === currentConti.id ? { ...c, songs: updatedSongs } : c
    );
    setContis(updatedContis);
    await saveToDB(updatedContis);
    if (viewingSongId === songId) setViewingSongId(null);
  };

  // 뷰어가 활성화되었을 때
  if (activeViewingSong) {
    return (
      <UniversalScoreViewer
        sheetSource={
          activeViewingSong.sheetUrl
            ? { type: activeViewingSong.sheetType, url: activeViewingSong.sheetUrl }
            : undefined
        }
        songTitle={activeViewingSong.title}
        targetKey={activeViewingSong.key}
        bpm={activeViewingSong.bpm}
        onBack={() => setViewingSongId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 상단 네비게이션 & 콘티 선택 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <select
              value={selectedContiId}
              onChange={(e) => setSelectedContiId(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-white font-bold rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {contis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.songs.length}곡)
                </option>
              ))}
            </select>
            <button
              onClick={handleAddConti}
              className="flex items-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold transition"
            >
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span>새 콘티</span>
            </button>
          </div>

          <button
            onClick={() => {
              setEditingSong(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>곡 및 악보 추가</span>
          </button>
        </div>

        {/* 콘티 타이틀 */}
        {currentConti && (
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-500" />
              {currentConti.title}
            </h1>
          </div>
        )}

        {/* 곡 목록 */}
        <div className="space-y-3">
          {!currentConti?.songs || currentConti.songs.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900/50 border border-neutral-800/80 rounded-2xl text-neutral-500 text-sm">
              등록된 찬양 곡이 없습니다. 상단 <span className="text-blue-400 font-semibold">[+ 곡 및 악보 추가]</span> 버튼으로 새 곡을 추가해보세요.
            </div>
          ) : (
            currentConti.songs.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-center font-black text-neutral-500 text-sm">{index + 1}</span>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {song.title}
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-full">
                        {song.key} Key
                      </span>
                      {song.bpm && (
                        <span className="text-xs text-neutral-400 font-medium">BPM {song.bpm}</span>
                      )}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingSongId(song.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 rounded-xl text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>악보 보기</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingSong(song);
                      setIsModalOpen(true);
                    }}
                    className="p-2 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 rounded-xl text-neutral-400 hover:text-white transition"
                    title="곡 수정"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteSong(song.id)}
                    className="p-2 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 rounded-xl text-neutral-400 hover:text-red-400 transition"
                    title="곡 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
  );
}
