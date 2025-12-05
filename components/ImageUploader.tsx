
import React, { useCallback, useState, useEffect } from 'react';
import type { ImageData } from '../types';
import { UploadIcon } from './IconComponents';

interface ImageUploaderProps {
  onImageUpload: (imageData: ImageData) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback((file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
        const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
        onImageUpload({ base64, mimeType, dataUrl });
      };
      reader.readAsDataURL(file);
    } else if (file) {
      alert("Please select a valid image file.");
    }
  }, [onImageUpload]);

  // 监听粘贴事件
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          handleFileChange(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleFileChange]);

  const onDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, [handleFileChange]);

  return (
    <div className="w-full max-w-2xl mx-auto fade-in relative z-10">
      <label
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`upload-zone flex justify-center w-full min-h-[400px] px-4 appearance-none ${isDragging ? 'dragging' : ''}`}
      >
        <span className="flex flex-col items-center justify-center space-y-4 text-center relative z-10">
          <UploadIcon className="w-20 h-20 text-purple-400" />
          <span className="font-semibold text-slate-700 text-lg">
            拖拽、粘贴图片到这里，或{' '}
            <span className="text-purple-600 underline">点击选择</span>
          </span>
          <span className="text-sm text-slate-500 bg-white/80 px-4 py-2 rounded-full border border-slate-200">
            支持 PNG, JPG, GIF 格式，最大 10MB
          </span>
        </span>
        <input
          type="file"
          name="file_upload"
          className="hidden"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
        />
      </label>
    </div>
  );
};

export default ImageUploader;
