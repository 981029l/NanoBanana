// Copyright (c) 2025 左岚. All rights reserved.

import React from "react";
import type { XiaohongshuNote } from "../types";

interface NotePreviewProps {
    note: XiaohongshuNote;
    onCopyAll: () => void;
    onCopyTitle: () => void;
    onCopyContent: () => void;
    onCopyTags: () => void;
}

// 下载单张图片
const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
};

// 下载所有图片
const downloadAllImages = (urls: string[], prefix: string = "小红书配图") => {
    urls.forEach((url, i) => {
        setTimeout(() => downloadImage(url, `${prefix}_${i + 1}.png`), i * 300); // 间隔下载避免浏览器阻止
    });
};

const NotePreview: React.FC<NotePreviewProps> = ({ note, onCopyAll, onCopyTitle, onCopyContent, onCopyTags }) => {
    const allImages = note.imageUrls?.length ? note.imageUrls : note.imageUrl ? [note.imageUrl] : [];

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-md mx-auto">
            {/* 模拟小红书头部 */}
            <div className="bg-gradient-to-r from-red-500 to-pink-500 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">📝</div>
                <div className="flex-1">
                    <div className="text-white font-medium text-sm">小红书笔记预览</div>
                    <div className="text-white/70 text-xs">点击下方按钮复制内容</div>
                </div>
            </div>

            {/* 图片区域 - 支持多图 */}
            {(note.imageUrls?.length || note.imageUrl) && (
                <div className="bg-slate-100">
                    {note.imageUrls && note.imageUrls.length > 1 ? (
                        <div className="grid grid-cols-3 gap-1 p-1">
                            {note.imageUrls.map((url, i) => (
                                <div key={i} className={`${i === 0 ? "col-span-2 row-span-2" : ""} aspect-square overflow-hidden rounded-lg relative group/img`}>
                                    <img src={url} alt={`配图${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                                    <button
                                        onClick={() => downloadImage(url, `小红书配图_${i + 1}.png`)}
                                        className="absolute bottom-1 right-1 w-6 h-6 bg-black/50 text-white rounded text-xs opacity-0 group-hover/img:opacity-100 transition-opacity"
                                        title="下载此图"
                                    >
                                        ↓
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : note.imageUrl ? (
                        <div className="aspect-square">
                            <img src={note.imageUrl} alt="笔记配图" className="w-full h-full object-cover" />
                        </div>
                    ) : null}
                    {allImages.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs text-slate-400">共 {allImages.length} 张配图</span>
                            <button
                                onClick={() => downloadAllImages(allImages)}
                                className="text-xs px-3 py-1 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-all"
                            >
                                📥 下载全部图片
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 内容区域 */}
            <div className="p-4 space-y-4">
                {/* 标题 */}
                <div className="group">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">标题 <span className={note.title.length > 20 ? "text-orange-500" : "text-slate-400"}>({note.title.length}字)</span></span>
                        <button onClick={onCopyTitle} className="text-xs text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity">复制</button>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 leading-snug">{note.title}</h2>
                </div>

                {/* 正文 */}
                <div className="group">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">正文 <span className={note.content.length > 1000 ? "text-orange-500" : "text-slate-400"}>({note.content.length}字)</span></span>
                        <button onClick={onCopyContent} className="text-xs text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity">复制</button>
                    </div>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</div>
                </div>

                {/* 话题标签 */}
                <div className="group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">话题标签</span>
                        <button onClick={onCopyTags} className="text-xs text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity">复制</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {note.tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded-full">#{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* 一键复制按钮 */}
            <div className="p-4 pt-0">
                <button
                    onClick={onCopyAll}
                    className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                    📋 一键复制全部内容
                </button>
            </div>
        </div>
    );
};

export default NotePreview;
