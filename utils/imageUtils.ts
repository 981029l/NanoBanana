// Copyright (c) 2025 左岚. All rights reserved.

/**
 * 压缩图片到指定质量和最大尺寸
 * @param dataUrl - 原始图片的 data URL
 * @param maxWidth - 最大宽度（默认 1920）
 * @param maxHeight - 最大高度（默认 1920）
 * @param quality - 压缩质量 0-1（默认 0.8）
 * @returns 压缩后的 data URL
 */
export const compressImage = async (
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // 计算缩放比例
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      // 创建 canvas 进行压缩
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法获取 Canvas 上下文'));
        return;
      }
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height);
      
      // 导出压缩后的图片
      try {
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };
    
    img.src = dataUrl;
  });
};

/**
 * 获取图片的文件大小（字节）
 * @param dataUrl - 图片的 data URL
 * @returns 文件大小（字节）
 */
export const getImageSize = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  
  // Base64 编码后的大小约为原始大小的 4/3
  return Math.floor((base64.length * 3) / 4);
};

/**
 * 格式化文件大小显示
 * @param bytes - 字节数
 * @returns 格式化后的字符串（如 "1.5 MB"）
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
