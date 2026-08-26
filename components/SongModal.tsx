'use client';

import React, { useState, useEffect } from 'react';
import { X, Music, Link as LinkIcon, FileText, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';

export interface SongData {
  id?: string;
  title: string;
  key: string;
  bpm?: number;
  sheetType: 'image_file' | 'url';
  sheetUrl: string;
}

interface SongModalProps {
  isOpen: boolean;
  initialData?: SongData | null;
  onClose: () => void;
  onSave: (song: SongData) => void;
}

export default function SongModal({ isOpen, initialData, onClose, onSave }: SongModalProps) {
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('C');
  const [bpm, setBpm] = useState<string>('');
  const [sheetType, setSheetType] = useState<'image_file' | 'url'>('image_file');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setKey(initialData.key || 'C');
      setBpm(initialData.bpm ? String(initialData.bpm) : '');
      setSheetType(initialData.sheetType || 'image_file');
      setSheetUrl(initialData.sheetUrl || '');
    } else {
      setTitle('');
      setKey('C');
      setBpm('');
      setSheetType('image_file');
      setSheetUrl('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // 이미지 파일 선택 시 즉시 안정적인 Base64 데이터로 변환
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const MAX_SIZE = 1600;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setSheetUrl(dataUrl);
          } else {
            setSheetUrl(event.target?.result as string);
          }
        } catch (err) {
          console.error(err);
          setSheetUrl(event.target?.result as string);
        } finally {
          setIsProcessingImage(false);
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        alert('이미지를 불러오는데 실패했습니다.');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsProcessingImage(false);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('곡 제목을 입력해주세요.');
      return;
    }
    if (isProcessingImage) {
      alert('이미지 처리 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    onSave({
      id: initialData?.id,
      title: title.trim(),
      key,
      bpm: bpm ? parseInt(bpm, 10) : undefined,
      sheetType,
      sheetUrl: sheetUrl.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 text-neutral-100 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-500" />
            {initialData ? '찬양 곡 수정' : '찬양 곡 추가'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">곡 제목 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 꽃들도, 은혜"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Key</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="예: 72"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">악보 등록 방식</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSheetType('image_file')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition ${
                  sheetType === 'image_file'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                악보 이미지 파일
              </button>
              <button
                type="button"
                onClick={() => setSheetType('url')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition ${
                  sheetType === 'url'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                웹 링크 (URL)
              </button>
            </div>

            {sheetType === 'image_file' ? (
              <div className="space-y-2">
                {sheetUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sheetUrl}
                        alt="악보 미리보기"
                        className="w-12 h-14 object-contain rounded border border-neutral-600 bg-white shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 악보 이미지 준비 완료
                        </span>
                        <span className="text-[11px] text-neutral-400 block truncate">
                          다른 파일로 변경하려면 아래에서 선택
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheetUrl('')}
                      className="p-1.5 bg-neutral-700 hover:bg-red-950/60 text-neutral-300 hover:text-red-400 rounded-lg transition shrink-0 ml-2"
                      title="이미지 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-neutral-800/60 border border-dashed border-neutral-700 rounded-xl text-neutral-400">
                    <ImageIcon className="w-4 h-4 text-neutral-500 shrink-0 ml-1" />
                    <span className="text-xs">악보 이미지 파일을 첨부해주세요.</span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isProcessingImage}
                  className="w-full text-xs text-neutral-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 file:cursor-pointer"
                />
                {isProcessingImage && (
                  <span className="text-xs text-blue-400 block animate-pulse">악보 이미지 최적화 중...</span>
                )}
              </div>
            ) : (
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://example.com/sheet.png"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-semibold text-neutral-300 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isProcessingImage}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 rounded-xl font-semibold text-white shadow-lg shadow-blue-600/30 transition"
            >
              {initialData ? '수정 완료' : '추가 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
