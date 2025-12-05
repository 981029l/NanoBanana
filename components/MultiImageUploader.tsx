import React, { useCallback, useState, useEffect } from 'react';
import type { ImageData } from '../types';

interface MultiImageUploaderProps {
  onImagesUpload: (images: ImageData[]) => void;
  maxImages?: number;
}

const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({ 
  onImagesUpload, 
  maxImages = 3 
}) => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const processFile = async (file: File): Promise<ImageData | null> => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件！');
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = file.type;

        resolve({
          dataUrl,
          base64,
          mimeType,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // 转换为数组以便处理
    const filesArray = Array.from(files);
    
    // 异步处理所有文件
    const newImages: ImageData[] = [];
    for (const file of filesArray) {
      const imageData = await processFile(file);
      if (imageData) {
        newImages.push(imageData);
      }
    }

    if (newImages.length === 0) return;

    // 使用函数式更新确保获取最新状态
    setImages(currentImages => {
      const remainingSlots = maxImages - currentImages.length;
      
      if (remainingSlots <= 0) {
        alert(`最多只能上传 ${maxImages} 张图片！`);
        return currentImages;
      }

      // 只添加允许的数量
      const imagesToAdd = newImages.slice(0, remainingSlots);
      const updatedImages = [...currentImages, ...imagesToAdd];
      
      // 通知父组件
      onImagesUpload(updatedImages);
      
      // 如果有图片被拒绝，提示用户
      if (newImages.length > remainingSlots) {
        alert(`只能再添加 ${remainingSlots} 张图片，已自动限制数量`);
      }
      
      return updatedImages;
    });
  }, [maxImages, onImagesUpload]);

  // 监听粘贴事件
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        // 过滤出图片文件
        const imageFiles: File[] = [];
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          }
        }
        
        if (imageFiles.length > 0) {
          e.preventDefault();
          // 创建一个 DataTransfer 对象来模拟 FileList
          const dt = new DataTransfer();
          imageFiles.forEach(file => dt.items.add(file));
          handleFilesSelected(dt.files);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    onImagesUpload(updatedImages);
  };

  const clearAllImages = () => {
    setImages([]);
    onImagesUpload([]);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {images.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-sm font-bold">
                {images.length}
              </span>
              已上传 {images.length}/{maxImages} 张图片
            </h3>
            <button
              onClick={clearAllImages}
              className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空全部
            </button>
          </div>

          {/* 图片预览网格 */}
          <div className="grid grid-cols-3 gap-4">
            {images.map((img, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-200 group hover:border-purple-400 hover:shadow-xl transition-all transform hover:scale-105"
              >
                <img
                  src={img.dataUrl}
                  alt={`图片 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <button
                    onClick={() => removeImage(index)}
                    className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all transform hover:scale-125 shadow-lg"
                    title="删除此图片"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-purple-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-lg shadow-md">
                  #{index + 1}
                </div>
              </div>
            ))}

            {/* 空位占位符（如果还能添加） */}
            {images.length < maxImages && (
              Array.from({ length: maxImages - images.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center gap-2 transition-all hover:border-purple-300 hover:bg-purple-50/30"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <span className="text-slate-400 text-lg font-bold">+</span>
                  </div>
                  <span className="text-slate-400 text-xs font-medium">空位 {images.length + index + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 上传区域 */}
      {images.length < maxImages && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`glass-card transition-all duration-300 ${
            isDragging ? 'border-purple-400 bg-purple-50 scale-105' : 'border-slate-200'
          } hover:border-purple-300 hover:shadow-xl p-16 flex flex-col items-center justify-center cursor-pointer min-h-[400px]`}
          onClick={() => document.getElementById('multi-file-input')?.click()}
        >
          <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
            <div className="w-28 h-28 mx-auto mb-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center shadow-lg">
              <svg className="w-14 h-14 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-slate-800 mb-3 text-center">
              {images.length === 0 ? '上传多张图片' : `继续添加图片 (${maxImages - images.length} 张)`}
            </h2>

            <p className="text-slate-500 mb-2 text-center max-w-md">
              {images.length === 0 
                ? `拖拽或点击上传 2-${maxImages} 张图片进行 AI 合成`
                : `还可以添加 ${maxImages - images.length} 张图片`
              }
            </p>
            
            <p className="text-xs text-blue-600 font-medium mb-6 text-center">
              💡 提示：可以一次选择多张图片（按住 Ctrl/Cmd 多选）
            </p>

            <div className="flex justify-center">
              <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-full hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105 shadow-lg">
                {images.length === 0 ? '📁 选择图片' : '➕ 继续添加'}
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4 text-center">
              支持 JPG、PNG、GIF 等格式
            </p>
          </div>

          <input
            id="multi-file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default MultiImageUploader;
