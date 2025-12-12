// Copyright (c) 2025 左岚. All rights reserved.

import React, { useState, useCallback, useEffect } from "react";
import type { ImageData, NoteType, XiaohongshuNote } from "./types";
import { generateXiaohongshuNote, rewriteNote, generateMultipleTitles, changeContentStyle, generateMultipleImages, generateNoteImage, type ContentStyle } from "./services/xiaohongshuService";
import NoteTypeSelector, { NOTE_TEMPLATES } from "./components/NoteTypeSelector";
import NotePreview from "./components/NotePreview";

import MultiImageUpload from "./components/MultiImageUpload";
import ErrorAlert from "./components/ErrorAlert";
import { noteStorage } from "./utils/noteStorage";

const MAX_HISTORY = 20;

// 快捷模板
const QUICK_TEMPLATES = [
  { label: "iPhone 16测评", topic: "iPhone 16 Pro Max 使用一个月真实感受，拍照、续航、信号全方位体验" },
  { label: "咖啡探店", topic: "发现一家超治愈的咖啡店，环境氛围感拉满，咖啡也很好喝" },
  { label: "护肤分享", topic: "换季护肤心得，敏感肌亲测有效的护肤流程和产品推荐" },
  { label: "健身打卡", topic: "坚持健身3个月的变化，分享我的训练计划和饮食搭配" },
  { label: "旅行攻略", topic: "周末2天1夜短途旅行，人少景美的小众目的地推荐" },
];

// 底部导航Tab类型
type NavTab = "home" | "history" | "settings";

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>("");
  const [noteType, setNoteType] = useState<NoteType>("recommend");
  const [generatedNote, setGeneratedNote] = useState<XiaohongshuNote | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("AI 正在创作中...");
  const [error, setError] = useState<string | null>(null);
  const [rewriteInput, setRewriteInput] = useState<string>("");
  const [showRewrite, setShowRewrite] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<XiaohongshuNote[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [contentMode, setContentMode] = useState<"topic" | "image">("topic");
  const [altTitles, setAltTitles] = useState<string[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageProgress, setImageProgress] = useState<{ completed: number; total: number } | null>(null);
  const [imageCount, setImageCount] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<NavTab>("home"); // 底部导航当前Tab
  const [fullscreenPreview, setFullscreenPreview] = useState<boolean>(false); // 全屏预览模式

  const currentTemplate = NOTE_TEMPLATES.find((t) => t.type === noteType);

  // 风格选项
  const STYLE_OPTIONS: { value: ContentStyle; label: string; icon: string }[] = [
    { value: "lively", label: "活泼", icon: "🎀" },
    { value: "professional", label: "专业", icon: "📊" },
    { value: "literary", label: "文艺", icon: "🌸" },
    { value: "humorous", label: "幽默", icon: "😂" },
  ];

  // 加载历史记录（从 IndexedDB）
  useEffect(() => {
    noteStorage.init().then(() => {
      noteStorage.getAll(MAX_HISTORY).then(setHistory).catch(console.error);
    });
  }, []);

  // 保存到历史（IndexedDB）
  const saveToHistory = useCallback(async (note: XiaohongshuNote) => {
    try {
      await noteStorage.save(note);
      setHistory((prev) => [note, ...prev.filter((n) => n.id !== note.id)].slice(0, MAX_HISTORY));
    } catch (e) {
      console.error("保存历史失败:", e);
    }
  }, []);

  // 删除历史记录（IndexedDB）
  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      await noteStorage.delete(id);
      setHistory((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("删除历史失败:", e);
    }
  }, []);

  // 从历史加载
  const loadFromHistory = useCallback((note: XiaohongshuNote) => {
    setGeneratedNote(note);
    setTopic(note.inputTopic);
    setNoteType(note.noteType);
  }, []);

  // 加载文案轮播
  const loadingTexts = ["AI 正在分析主题...", "正在构思爆款标题...", "撰写走心文案中...", "添加话题标签...", "即将完成..."];

  // 生成笔记
  const handleGenerate = useCallback(async () => {
    if (!topic.trim() && images.length === 0) { // 主题和图片至少要有一个
      setError("请输入笔记主题或上传图片");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedNote(null);
    setLoadingText(loadingTexts[0]);

    // 轮播加载文案
    let textIndex = 0;
    const textInterval = setInterval(() => {
      textIndex = (textIndex + 1) % loadingTexts.length;
      setLoadingText(loadingTexts[textIndex]);
    }, 1500);

    try {
      const note = await generateXiaohongshuNote(topic, noteType, images[0] || undefined, contentMode);

      // 如果用户没上传图片，自动生成配图（用户选择的数量）
      if (images.length === 0) {
        setLoadingText(`正在生成配图 (0/${imageCount})...`);
        setImageProgress({ completed: 0, total: imageCount });
        try {
          const generatedImages = await generateMultipleImages(note, imageCount, (completed, total) => {
            setLoadingText(`正在生成配图 (${completed}/${total})...`);
            setImageProgress({ completed, total });
          });
          note.imageUrls = generatedImages;
          note.imageUrl = generatedImages[0];
        } catch (imgErr: any) {
          console.error("配图生成失败，但笔记已生成:", imgErr);
        }
        setImageProgress(null);
      } else {
        // 用户上传了图片，使用用户的图片
        note.imageUrls = images.map(img => img.dataUrl);
        note.imageUrl = images[0].dataUrl;
      }

      setGeneratedNote(note);
      saveToHistory(note);
    } catch (err: any) {
      const errMsg = err?.message || String(err) || "未知错误";
      setError(errMsg);
    } finally {
      clearInterval(textInterval);
      setIsLoading(false);
    }
  }, [topic, noteType, images, saveToHistory]);

  // 优化笔记
  const handleRewrite = useCallback(async () => {
    if (!generatedNote || !rewriteInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const newNote = await rewriteNote(generatedNote, rewriteInput);
      setGeneratedNote(newNote);
      setRewriteInput("");
      setShowRewrite(false);
    } catch (err: any) {
      setError(err.message || "优化失败");
    } finally {
      setIsLoading(false);
    }
  }, [generatedNote, rewriteInput]);

  // 复制功能
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  }, []);

  const handleCopyAll = useCallback(() => {
    if (!generatedNote) return;
    const tagsText = generatedNote.tags.map((t) => `#${t}`).join(" ");
    const fullText = `${generatedNote.title}\n\n${generatedNote.content}\n\n${tagsText}`;
    copyToClipboard(fullText, "全部内容");
  }, [generatedNote, copyToClipboard]);

  const handleCopyTitle = useCallback(() => {
    if (generatedNote) copyToClipboard(generatedNote.title, "标题");
  }, [generatedNote, copyToClipboard]);

  const handleCopyContent = useCallback(() => {
    if (generatedNote) copyToClipboard(generatedNote.content, "正文");
  }, [generatedNote, copyToClipboard]);

  const handleCopyTags = useCallback(() => {
    if (generatedNote) {
      const tagsText = generatedNote.tags.map((t) => `#${t}`).join(" ");
      copyToClipboard(tagsText, "话题标签");
    }
  }, [generatedNote, copyToClipboard]);

  // 重置
  const handleReset = useCallback(() => {
    setGeneratedNote(null);
    setTopic("");
    setImages([]);
    setError(null);
    setShowRewrite(false);
    setRewriteInput("");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50">
      {/* 复制成功提示 */}
      {copySuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
          ✅ {copySuccess}已复制
        </div>
      )}

      {/* 头部 */}
      {/* 头部 */}
      <header className="bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 px-4 shadow-lg safe-area-top">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
            <span>📕</span> 小红书 AI 写手
          </h1>
          <p className="text-white/80 text-xs mt-1">一键生成爆款笔记</p>
        </div>
      </header>



      <main className="max-w-4xl mx-auto p-3 pb-24">
        {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

        {/* 历史Tab */}
        {activeTab === "history" && (
          <div className="space-y-3 mt-4">
            <h2 className="font-bold text-lg text-slate-800">📜 历史记录</h2>
            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-2">📝</div>
                <div>暂无历史记录</div>
              </div>
            ) : (
              history.map((note) => (
                <div key={note.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-sm font-medium text-slate-800 line-clamp-2">{note.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(note.timestamp).toLocaleString()}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { loadFromHistory(note); setActiveTab("home"); }} className="text-xs px-3 py-1.5 bg-pink-500 text-white rounded-lg">加载</button>
                    <button onClick={() => deleteFromHistory(note.id)} className="text-xs px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg">删除</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 设置Tab */}
        {activeTab === "settings" && (
          <div className="space-y-4 mt-4">
            <h2 className="font-bold text-lg text-slate-800">⚙️ 设置</h2>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">默认配图数量</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setImageCount(n)} className={`w-8 h-8 rounded-lg text-sm ${imageCount === n ? "bg-pink-500 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="text-sm text-slate-700 mb-2">添加到主屏幕</div>
                <p className="text-xs text-slate-400">在浏览器菜单中选择"添加到主屏幕"，即可像 App 一样使用</p>
              </div>
              <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
                Powered by Gemini AI · 左岚出品<br />v1.0.0
              </div>
            </div>
          </div>
        )}

        {/* 首页Tab - 输入区域 */}
        {activeTab === "home" && !generatedNote && (
          <div className="space-y-4 mt-4">
            {/* 笔记类型选择 */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              <label className="text-sm font-medium text-slate-700 mb-2 block">选择笔记类型</label>
              <NoteTypeSelector selected={noteType} onSelect={setNoteType} />
            </div>

            {/* 主题输入 */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {currentTemplate?.icon} 输入笔记主题
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={currentTemplate?.promptHint || "描述你想写的内容..."}
                className="w-full p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-pink-500 text-slate-800 placeholder:text-slate-400 text-sm"
                rows={3}
              />
              <div className="text-xs text-slate-400 mt-2">💡 描述越详细，生成越精准（可只上传图片）</div>
              {/* 快捷模板 */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => setTopic(tpl.topic)} className="text-xs px-2.5 py-1 bg-pink-50 text-pink-600 rounded-full active:bg-pink-100">
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 配图设置 */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">添加配图（可选）</label>
                <MultiImageUpload images={images} onUpload={setImages} maxImages={5} />
              </div>

              {/* 内容模式切换 - 仅当同时有图片和主题时显示 */}
              {images.length > 0 && topic.trim() && (
                <div className="border-t border-slate-100 pt-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">🎯 内容生成模式</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setContentMode("topic")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${contentMode === "topic"
                        ? "bg-pink-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-pink-100"
                        }`}
                    >
                      📝 以主题为主
                    </button>
                    <button
                      onClick={() => setContentMode("image")}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${contentMode === "image"
                        ? "bg-pink-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-pink-100"
                        }`}
                    >
                      🖼️ 以图片为主
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {contentMode === "topic" ? "图片作为参考素材，文案围绕主题展开" : "深度分析图片内容，主题作为补充说明"}
                  </div>
                </div>
              )}

              {/* AI 生成配图数量选择 */}
              {images.length === 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">🎨 AI 自动生成配图数量</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => setImageCount(num)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${imageCount === num
                          ? "bg-pink-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-pink-100"
                          }`}
                      >
                        {num}张
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">不上传图片时，AI 将根据笔记内容自动生成配图</div>
                </div>
              )}
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || (!topic.trim() && images.length === 0)}
              className="w-full py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {loadingText}
                </span>
              ) : images.length > 0 && topic.trim() ? (
                contentMode === "topic" ? "✨ 图文结合生成（主题优先）" : "✨ 图文结合生成（图片优先）"
              ) : images.length > 0 ? (
                "✨ 识图生成笔记"
              ) : (
                "✨ 生成小红书笔记"
              )}
            </button>
          </div>
        )}

        {/* 首页Tab - 结果展示 */}
        {activeTab === "home" && generatedNote && (
          <div className="space-y-4 mt-4">
            {/* 全屏预览按钮 */}
            <button onClick={() => setFullscreenPreview(true)} className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-sm">
              📱 全屏预览
            </button>

            {/* 预览卡片 */}
            <NotePreview
              note={generatedNote}
              onCopyAll={handleCopyAll}
              onCopyTitle={handleCopyTitle}
              onCopyContent={handleCopyContent}
              onCopyTags={handleCopyTags}
            />

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button onClick={() => setShowRewrite(!showRewrite)} className="flex-1 py-2.5 bg-white border border-pink-500 text-pink-500 font-medium rounded-lg text-sm active:bg-pink-50">✏️ 优化</button>
              <button onClick={handleGenerate} disabled={isLoading} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm disabled:opacity-50 active:bg-slate-50">🔄 重新生成</button>
              <button onClick={handleReset} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm active:bg-slate-50">🆕 新笔记</button>
            </div>

            {/* AI 增强功能 */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
              <label className="text-sm font-medium text-slate-700 block">🤖 AI 增强功能</label>

              {/* 生成备选标题 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">换个标题试试</span>
                  <button
                    onClick={async () => {
                      if (!generatedNote) return;
                      setIsGeneratingTitles(true);
                      try {
                        const titles = await generateMultipleTitles(generatedNote.inputTopic, generatedNote.noteType, 3);
                        setAltTitles(titles);
                      } catch (e) {
                        setError("生成标题失败");
                      } finally {
                        setIsGeneratingTitles(false);
                      }
                    }}
                    disabled={isGeneratingTitles}
                    className="text-xs px-3 py-1 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 disabled:opacity-50"
                  >
                    {isGeneratingTitles ? "生成中..." : "生成3个备选"}
                  </button>
                </div>
                {altTitles.length > 0 && (
                  <div className="space-y-2">
                    {altTitles.map((title, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (generatedNote) {
                            setGeneratedNote({ ...generatedNote, title });
                            saveToHistory({ ...generatedNote, title });
                          }
                        }}
                        className="w-full text-left text-sm p-2 bg-slate-50 rounded-lg hover:bg-pink-50 border border-slate-200 hover:border-pink-300 transition-all"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 风格切换 */}
              <div>
                <span className="text-xs text-slate-500 block mb-2">切换文案风格</span>
                <div className="flex gap-2 flex-wrap">
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.value}
                      onClick={async () => {
                        if (!generatedNote || isLoading) return;
                        setIsLoading(true);
                        setLoadingText(`切换为${style.label}风格...`);
                        try {
                          const newNote = await changeContentStyle(generatedNote, style.value);
                          setGeneratedNote(newNote);
                          saveToHistory(newNote);
                        } catch (e) {
                          setError("切换风格失败");
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                      className="text-xs px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-pink-100 hover:text-pink-600 disabled:opacity-50 transition-all"
                    >
                      {style.icon} {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI 生成配图 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">AI 生成配图</span>
                  <button
                    onClick={async () => {
                      if (!generatedNote) return;
                      setIsGeneratingImage(true);
                      try {
                        const imageUrl = await generateNoteImage(generatedNote);
                        setGeneratedNote({ ...generatedNote, imageUrl });
                        saveToHistory({ ...generatedNote, imageUrl });
                      } catch (e) {
                        setError("配图生成失败，请重试");
                      } finally {
                        setIsGeneratingImage(false);
                      }
                    }}
                    disabled={isGeneratingImage}
                    className="text-xs px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
                  >
                    {isGeneratingImage ? "生成中..." : "🎨 生成配图"}
                  </button>
                </div>
              </div>
            </div>

            {/* 优化输入框 */}
            {showRewrite && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-200 space-y-3">
                <label className="text-sm font-medium text-slate-700">告诉 AI 如何优化</label>
                <textarea
                  value={rewriteInput}
                  onChange={(e) => setRewriteInput(e.target.value)}
                  placeholder="例如：标题再吸引人一点、正文加点幽默感、多加几个emoji..."
                  className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
                  rows={2}
                />
                <button
                  onClick={handleRewrite}
                  disabled={isLoading || !rewriteInput.trim()}
                  className="w-full py-2 bg-pink-500 text-white font-medium rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-all"
                >
                  {isLoading ? "优化中..." : "确认优化"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部导航栏 */}
      <nav className="bottom-nav">
        <div className="flex justify-around items-center py-2">
          <button
            onClick={() => { setActiveTab("home"); setGeneratedNote(null); }}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${activeTab === "home" ? "text-pink-500" : "text-slate-400"}`}
          >
            <span className="text-xl">✏️</span>
            <span className="text-xs">创作</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${activeTab === "history" ? "text-pink-500" : "text-slate-400"}`}
          >
            <span className="text-xl">📜</span>
            <span className="text-xs">历史</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${activeTab === "settings" ? "text-pink-500" : "text-slate-400"}`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">设置</span>
          </button>
        </div>
      </nav>

      {/* 全屏预览模式 */}
      {fullscreenPreview && generatedNote && (
        <div className="fullscreen-preview">
          <div className="sticky top-0 bg-white/95 backdrop-blur border-b p-3 flex items-center justify-between z-10">
            <button onClick={() => setFullscreenPreview(false)} className="text-slate-600 text-lg">← 返回</button>
            <span className="font-medium">笔记预览</span>
            <button onClick={handleCopyAll} className="text-pink-500 font-medium">复制全部</button>
          </div>
          <div className="p-4 pb-20">
            <NotePreview
              note={generatedNote}
              onCopyAll={handleCopyAll}
              onCopyTitle={handleCopyTitle}
              onCopyContent={handleCopyContent}
              onCopyTags={handleCopyTags}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
