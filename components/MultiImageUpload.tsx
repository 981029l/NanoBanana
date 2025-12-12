// Copyright (c) 2025 左岚. All rights reserved.

import React, { useCallback, useState, useEffect, useRef } from "react";
import type { ImageData } from "../types";

interface MultiImageUploadProps {
    images: ImageData[];
    onUpload: (images: ImageData[]) => void;
    maxImages?: number;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({ images, onUpload, maxImages = 9 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const processFiles = useCallback((files: File[]) => { // 处理文件列表
        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return;

        const remaining = maxImages - images.length;
        const toProcess = imageFiles.slice(0, remaining);

        Promise.all(
            toProcess.map((file) => new Promise<ImageData>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    resolve({ dataUrl, base64: dataUrl.split(",")[1], mimeType: file.type });
                };
                reader.readAsDataURL(file);
            }))
        ).then((newImages) => onUpload([...images, ...newImages]));
    }, [images, onUpload, maxImages]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(Array.from(e.target.files || []));
    }, [processFiles]);

    const handleDrop = useCallback((e: React.DragEvent) => { // 拖拽放下
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    }, [processFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => { // 拖拽悬停
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => { // 拖拽离开
        e.preventDefault();
        setIsDragging(false);
    }, []);

    useEffect(() => { // 粘贴板监听
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const files: File[] = [];
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
            if (files.length > 0) processFiles(files);
        };

        document.addEventListener("paste", handlePaste);
        return () => document.removeEventListener("paste", handlePaste);
    }, [processFiles]);

    const handleRemove = useCallback((index: number) => {
        onUpload(images.filter((_, i) => i !== index));
    }, [images, onUpload]);

    return (
        <div className="space-y-3">
            <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`grid grid-cols-3 gap-2 p-2 rounded-lg transition-all ${isDragging ? "bg-pink-50 border-2 border-dashed border-pink-400" : ""}`}
            >
                {images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                        <img src={img.dataUrl} alt={`配图${i + 1}`} className="w-full h-full object-cover" />
                        <button
                            onClick={() => handleRemove(i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {images.length < maxImages && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-pink-400 hover:bg-pink-50/50 transition-all">
                        <div className="text-2xl">+</div>
                        <div className="text-xs text-slate-400 text-center">点击/拖拽/粘贴</div>
                        <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                    </label>
                )}
            </div>
            <div className="text-xs text-slate-400">已添加 {images.length}/{maxImages} 张 | 支持拖拽、Ctrl+V粘贴</div>
        </div>
    );
};

export default MultiImageUpload;
