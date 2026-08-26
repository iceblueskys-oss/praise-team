'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Link2, Music2, Image as ImageIcon } from 'lucide-react';

export interface SongData {
  id: string;
  title: string;
  artist: string;
  originalKey: string;
  targetKey: string;
  bpm: number;
  arrangementNotes: string;
  sheetSource?: {
    type: 'image_file' | 'url';
    url: string;
    fileName?: string;
  };
}

interface Props {
  isOpen: boolean;
  initialData?: SongData | null;
  onClose: () => void;
  onSave: (song: Omit<SongData, 'id'> & { id?: string }) => void;
}

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export default function SongModal({ isOpen, initialData, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [originalKey, setOriginalKey] = useState('C');
  const [targetKey, setTargetKey] = useState('C');
  const [bpm, setBpm] = useState<number>(80);
  const [arrangementNotes, setArrangementNotes] = useState('');
  const [sheetTab, setSheetTab] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setArtist(initialData.artist);
      setOriginalKey(initialData.originalKey);
      setTargetKey(initialData.targetKey);
      setBpm(initialData.bpm || 80);
      setArrangementNotes(initialData.arrangementNotes || '');
      if (initialData.sheetSource?.type === 'url') {
        setSheetTab('link');
        setLinkUrl(initialData.sheetSource.url);
        setSelectedFilePreview(null);
      } else if (initialData.sheetSource?.type === 'image_file') {
        setSheetTab('file');
        setSelectedFilePreview(initialData.sheetSource.url);
        setFileName(initialData.sheetSource.fileName || '기존 등록된 이미지 악보');
      }
    } else {
      setTitle('');
      setArtist('');
      setOriginalKey('C');
      setTargetKey('C');
      setBpm(80);
      setArrangementNotes('');
      setSelectedFilePreview(null);
      setLinkUrl('');
      setFileName('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setSelectedFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let sheetSource = undefined;
    if (sheetTab === 'file' && selectedFilePreview) {
      sheetSource = { type: 'image_file' as const, url: selectedFilePreview, fileName };
    } else if (sheetTab === 'link' && linkUrl.trim()) {
      sheetSource = { type: 'url' as const, url: linkUrl.trim() };
    }

    onSave({
      id: initialData?.id,
      title,
      artist: artist || '미지정',
      originalKey,
      targetKey,
      bpm,
      arrangementNotes,
      sheetSource,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">{initialData ? '곡 및 악보 수정' : '새 곡 및 악보 추가'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">곡 제목 *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 꽃들도" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">아티스트</label>
              <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="예: JWorship" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">원곡 Key</label>
              <select value={originalKey} onChange={(e) => setOriginalKey(e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                {KEYS.map((k) => <option key={k} value={k}>{k} Key</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">진행 Key</label>
              <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-blue-300 font-semibold focus:outline-none focus:border-blue-500">
                {KEYS.map((k) => <option key={k} value={k}>{k} Key</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">BPM</label>
              <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">진행 및 송폼 메모</label>
            <input type="text" value={arrangementNotes} onChange={(e) => setArrangementNotes(e.target.value)} placeholder="예: Intro 4마디 후 1절 시작" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>

          <div className="pt-2 border-t border-neutral-800">
            <label className="text-xs font-semibold text-neutral-300 block mb-2">악보 파일 / 링크 변경</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setSheetTab('file')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold ${sheetTab === 'file' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                <ImageIcon className="w-4 h-4" />
                <span>이미지 파일</span>
              </button>
              <button type="button" onClick={() => setSheetTab('link')} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold ${sheetTab === 'link' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                <Link2 className="w-4 h-4" />
                <span>웹 링크(URL)</span>
              </button>
            </div>

            {sheetTab === 'file' ? (
              <div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-neutral-700 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer bg-neutral-800/40 hover:bg-neutral-800/80">
                  <Upload className="w-5 h-5 text-neutral-400 mb-1" />
                  <p className="text-xs text-neutral-300 font-medium truncate max-w-[280px]">{fileName || '클릭하여 악보 이미지 파일 선택'}</p>
                </div>
              </div>
            ) : (
              <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com/score.jpg" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg text-sm">취소</button>
            <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow">저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}
