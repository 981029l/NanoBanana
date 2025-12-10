
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { ImageData, GenerationHistory } from './types';
import { editImageWithGemini, editMultipleImagesWithGemini, generateImageFromText, enhancePromptWithGemini } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import MultiImageUploader from './components/MultiImageUploader';
import Header from './components/Header';
import { MagicWandIcon, ResetIcon, EyeIcon } from './components/IconComponents';
import { compressImage, getImageSize, formatFileSize } from './utils/imageUtils'; // 图片压缩工具
import { debounce, throttle } from './utils/debounce'; // 防抖和节流工具
import { dbManager, migrateFromLocalStorage } from './utils/indexedDB'; // IndexedDB 管理器
import LoadingProgress from './components/LoadingProgress'; // 加载进度组件
import ErrorAlert from './components/ErrorAlert'; // 错误提示组件

const MAX_HISTORY_ITEMS = 10;
const MAX_GENERATION_HISTORY = 20; // IndexedDB 容量大，可以存储更多历史记录

const App: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'multi' | 'text'>('single'); // 单图/多图/纯文字模式
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number>(0); // 当前选中的原图索引
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false); // 批量选择模式
  const [selectedImages, setSelectedImages] = useState<boolean[]>([]); // 每张图片的选中状态
  
  // 新增状态：比例和风格
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false); // 提示词优化状态
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [selectedStyle, setSelectedStyle] = useState<string>('None');

  // 风格列表
  const styles = [
    { name: 'None', label: '原图/无风格' },
    { name: 'Cinematic', label: '🎬 电影感' },
    { name: 'Anime', label: '🌸 动漫' },
    { name: 'Cyberpunk', label: '🌃 赛博朋克' },
    { name: 'Watercolor', label: '🎨 水彩' },
    { name: 'Oil Painting', label: '🖼️ 油画' },
    { name: '3D Render', label: '🧊 3D渲染' },
    { name: 'Pixel Art', label: '👾 像素风' },
  ];

  // 比例列表
  const ratios = [
    { value: '1:1', label: '1:1 正方形' },
    { value: '16:9', label: '16:9 横屏' },
    { value: '9:16', label: '9:16 竖屏' },
    { value: '4:3', label: '4:3 标准' },
    { value: '3:4', label: '3:4 纵向' },
  ];

  // 提示词优化处理
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsEnhancing(true);
    try {
      const enhanced = await enhancePromptWithGemini(prompt);
      setPrompt(enhanced);
    } catch (error) {
      console.error("Failed to enhance prompt", error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
  const [originalImages, setOriginalImages] = useState<ImageData[]>([]); // 多图模式
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<'analyzing' | 'generating' | 'finalizing'>('analyzing'); // 加载阶段
  const [loadingProgress, setLoadingProgress] = useState<number>(0); // 加载进度
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'split' | 'slider'>('split'); // 对比模式
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 滑块位置
  const [previewImage, setPreviewImage] = useState<string | null>(null); // 预览大图
  const [promptHistory, setPromptHistory] = useState<string[]>([]); // 提示词历史
  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]); // 生成历史
  const [showHistory, setShowHistory] = useState<boolean>(false); // 显示历史面板
  const [previousState, setPreviousState] = useState<{
    editedImage: string;
    prompt: string;
  } | null>(null); // 上一次的状态（用于撤销）

  // 节流处理的滑块位置更新（16ms ≈ 60fps）
  const throttledSetSliderPosition = useMemo(
    () => throttle((position: number) => setSliderPosition(position), 16),
    []
  );

  // 初始化 IndexedDB 并加载数据
  useEffect(() => {
    const initDB = async () => {
      try {
        await dbManager.init();
        console.log('✅ IndexedDB 初始化成功');
        
        // 尝试从 localStorage 迁移数据
        const migrationResult = await migrateFromLocalStorage();
        if (migrationResult.success && migrationResult.migratedCount > 0) {
          console.log(`🔄 已迁移 ${migrationResult.migratedCount} 条历史记录`);
        }
        
        // 加载提示词历史
        const prompts = await dbManager.getPromptHistory(MAX_HISTORY_ITEMS);
        setPromptHistory(prompts);
        
        // 加载生成历史
        const histories = await dbManager.getAllGenerationHistory(MAX_GENERATION_HISTORY);
        setGenerationHistory(histories);
        
        // 显示存储使用情况
        const storageInfo = await dbManager.getStorageEstimate();
        console.log(`💾 存储使用: ${storageInfo.usageInMB} MB / ${storageInfo.quotaInMB} MB`);
      } catch (error) {
        console.error('❌ IndexedDB 初始化失败:', error);
      }
    };
    
    initDB();
    
    // 组件卸载时关闭数据库连接
    return () => {
      dbManager.close();
    };
  }, []);


  // 保存提示词到历史
  const savePromptToHistory = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;
    
    setPromptHistory((prev) => {
      // 移除重复项（如果存在）
      const filtered = prev.filter(p => p !== promptText);
      // 添加到开头
      const newHistory = [promptText, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      // 保存到 IndexedDB
      dbManager.savePromptHistory(newHistory).catch(error => {
        console.error('Failed to save prompt history:', error);
      });
      
      return newHistory;
    });
  }, []);

  // 删除单个提示词
  const deletePromptHistoryItem = useCallback((promptToDelete: string) => {
    setPromptHistory((prev) => {
      const updated = prev.filter(p => p !== promptToDelete);
      
      dbManager.savePromptHistory(updated).catch(error => {
        console.error('Failed to delete prompt history item:', error);
      });
      
      return updated;
    });
  }, []);

  // 清除提示词历史
  const clearPromptHistory = useCallback(() => {
    setPromptHistory([]);
    dbManager.savePromptHistory([]).catch(error => {
      console.error('Failed to clear prompt history:', error);
    });
  }, []);

  // 保存生成结果到历史（带图片压缩）
  const saveToGenerationHistory = useCallback(async (original: string, 
    edited: string, 
    promptText: string,
    isMulti: boolean = false,
    allOriginals?: string[],
    isText: boolean = false
  ) => {
    try {
      // 压缩图片以节省存储空间
      const compressedEdited = await compressImage(edited, 1280, 1280, 0.75);
      const compressedOriginal = await compressImage(original, 1280, 1280, 0.75);
      
      // 如果是多图模式，也压缩所有原图
      let compressedOriginals: string[] | undefined;
      if (allOriginals && allOriginals.length > 0) {
        compressedOriginals = await Promise.all(
          allOriginals.map(img => compressImage(img, 1280, 1280, 0.75))
        );
      }
      
      const newHistory: GenerationHistory = {
        id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalImage: compressedOriginal,
        editedImage: compressedEdited,
        prompt: promptText,
        timestamp: Date.now(),
        isMultiImage: isMulti,
        originalImages: compressedOriginals,
        isTextToImage: isText,
      };
      
      // 记录压缩效果
      const originalSize = getImageSize(edited);
      const compressedSize = getImageSize(compressedEdited);
      console.log(`🗜️ 图片压缩: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (节省 ${Math.round((1 - compressedSize / originalSize) * 100)}%)`);

      // 保存到 IndexedDB
      await dbManager.saveGenerationHistory(newHistory);
      console.log(`✅ 历史记录已保存: ${newHistory.id}`);
      
      // 更新状态
      setGenerationHistory((prev) => {
        const updated = [newHistory, ...prev].slice(0, MAX_GENERATION_HISTORY);
        return updated;
      });
      
      // 显示存储使用情况
      const storageInfo = await dbManager.getStorageEstimate();
      console.log(`💾 存储使用: ${storageInfo.usageInMB} MB / ${storageInfo.quotaInMB} MB`);
    } catch (error) {
      console.error('压缩图片失败，使用原图保存:', error);
      // 如果压缩失败，使用原图保存
      const newHistory: GenerationHistory = {
        id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalImage: original,
        editedImage: edited,
        prompt: promptText,
        timestamp: Date.now(),
        isMultiImage: isMulti,
        originalImages: allOriginals,
        isTextToImage: isText,
      };
      
      try {
        await dbManager.saveGenerationHistory(newHistory);
        setGenerationHistory((prev) => [newHistory, ...prev].slice(0, MAX_GENERATION_HISTORY));
      } catch (e) {
        console.error('保存历史记录失败:', e);
      }
    }
  }, []);

  // 删除单个历史记录
  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      await dbManager.deleteGenerationHistory(id);
      setGenerationHistory((prev) => prev.filter(item => item.id !== id));
      console.log(`🗑️ 已删除历史记录: ${id}`);
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  }, []);

  // 清空所有生成历史
  const clearGenerationHistory = useCallback(async () => {
    try {
      await dbManager.clearGenerationHistory();
      setGenerationHistory([]);
      console.log('🧹 已清空所有历史记录');
    } catch (error) {
      console.error('Failed to clear generation history:', error);
    }
  }, []);

  // 从历史记录加载
  const loadFromHistory = useCallback((item: GenerationHistory) => {
    // 检查是单图、多图还是纯文字模式
    if (item.isTextToImage) {
      // 纯文字生成模式
      setMode('text');
      setOriginalImage(null);
      setOriginalImages([]);
    } else if (item.isMultiImage && item.originalImages) {
      // 多图模式
      setMode('multi');
      setOriginalImage(null);
      setOriginalImages(item.originalImages.map(dataUrl => ({
        dataUrl: dataUrl,
        base64: dataUrl.split(',')[1],
        mimeType: dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';')),
      })));
      setSelectedOriginalIndex(0);
    } else {
      // 单图模式
      setMode('single');
      setOriginalImages([]);
      setOriginalImage({
        dataUrl: item.originalImage,
        base64: item.originalImage.split(',')[1],
        mimeType: item.originalImage.substring(item.originalImage.indexOf(':') + 1, item.originalImage.indexOf(';')),
      });
    }
    
    setEditedImage(item.editedImage);
    setPrompt(item.prompt);
    setShowHistory(false);
  }, []);

  // 处理预览模态框的键盘事件和背景滚动锁定
  useEffect(() => {
    if (previewImage) {
      // 锁定背景滚动
      document.body.classList.add('modal-open');
      
      // ESC 键关闭预览
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setPreviewImage(null);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [previewImage]);

  const handleImageUpload = useCallback((imageData: ImageData) => {
    setOriginalImage(imageData);
    setEditedImage(null);
    setError(null);
    setPrompt('');
  }, []);

  const handleMultiImagesUpload = useCallback((images: ImageData[]) => {
    setOriginalImages(images);
    setSelectedOriginalIndex(0);
    setSelectedImages(new Array(images.length).fill(true)); // 默认全选
    setIsSelectionMode(false);
    setEditedImage(null);
    setError(null);
    if (images.length === 0) {
      setPrompt('');
    }
  }, []);

  const handleEditRequest = async () => {
    // 验证输入
    if (!prompt) {
      setError("请输入提示词。");
      return;
    }
    
    if (mode === 'single' && !originalImage) {
      setError("请先上传图片。");
      return;
    }
    
    if (mode === 'multi' && originalImages.length === 0) {
      setError("请至少上传一张图片。");
      return;
    }
    
    // 保存当前状态用于撤销
    if (editedImage) {
      setPreviousState({
        editedImage: editedImage,
        prompt: prompt,
      });
    }
    
    setIsLoading(true);
    setError(null);
    setEditedImage(null);
    setLoadingProgress(0);
    setLoadingStage('analyzing');

    // 模拟进度更新
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev < 20) return prev + 2; // 分析阶段慢
        if (prev < 85) return prev + 1; // 生成阶段
        return prev; // 等待完成
      });
    }, 200);

    // 阶段切换
    setTimeout(() => setLoadingStage('generating'), 1000);
    setTimeout(() => setLoadingStage('finalizing'), 4000);

    try {
      let result: string;
      
      // 应用风格到提示词 - 方案 A：强制前置
      let effectivePrompt = prompt;
      if (selectedStyle !== 'None') {
        // 将风格前置，确保 AI 优先处理
        effectivePrompt = `[Art Style: ${selectedStyle}] ${prompt}`;
      }
      
      if (mode === 'text') {
        // 纯文字生成图片模式 - 传入比例参数
        // 注意：Gemini Service 中也会处理 aspectRatio，将其转换为提示词前缀
        result = await generateImageFromText(effectivePrompt, aspectRatio);
        // 保存到历史记录，使用生成的图片作为"原图"
        saveToGenerationHistory(result, result, effectivePrompt, false, undefined, true);
      } else if (mode === 'single' && originalImage) {
        result = await editImageWithGemini(originalImage, effectivePrompt);
        saveToGenerationHistory(originalImage.dataUrl, result, effectivePrompt);
      } else {
        // 多图模式：过滤掉无效图片
        const validImages = originalImages.filter(img => img && img.base64 && img.mimeType);
        if (validImages.length === 0) {
          throw new Error("没有有效的图片数据");
        }
        result = await editMultipleImagesWithGemini(validImages, effectivePrompt);
        // 多图模式：保存所有原图
        saveToGenerationHistory(
          validImages[0].dataUrl, 
          result, 
          effectivePrompt,
          true, // isMultiImage
          validImages.map(img => img.dataUrl)
        );
      }
      
      // 完成时设置进度为 100%
      setLoadingProgress(100);
      
      setEditedImage(result);
      // 生成成功后保存提示词到历史 (保存原始输入，方便用户修改)
      savePromptToHistory(prompt);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  // 撤销到上一次的状态
  const handleUndo = useCallback(() => {
    if (previousState) {
      setEditedImage(previousState.editedImage);
      setPrompt(previousState.prompt);
      setPreviousState(null);
      setError(null);
    }
  }, [previousState]);

  // 快速重试
  const handleRetry = useCallback(() => {
    handleEditRequest();
  }, [handleEditRequest]);

  const handleReset = () => {
    setOriginalImage(null);
    setOriginalImages([]);
    setEditedImage(null);
    setError(null);
    setPrompt('');
    setIsLoading(false);
    setPreviousState(null);
  };

  // 将当前生成结果作为新原图（Loopback）
  const handleUseEditedAsOriginal = () => {
    if (!editedImage) return;
    
    const mimeType = editedImage.substring(editedImage.indexOf(':') + 1, editedImage.indexOf(';'));
    const base64 = editedImage.split(',')[1];
    
    const newImage: ImageData = {
      dataUrl: editedImage,
      base64: base64,
      mimeType: mimeType
    };
    
    if (mode === 'single') {
      setOriginalImage(newImage);
    } else {
      // 多图模式：添加到列表末尾，而不是清空
      setOriginalImages(prev => {
        const newImages = [...prev, newImage];
        // 自动选中新添加的图片
        setSelectedOriginalIndex(newImages.length - 1);
        // 更新选择状态数组
        setSelectedImages(prevSelected => [...prevSelected, true]);
        return newImages;
      });
    }
    
    setEditedImage(null);
    // 保留提示词，方便用户微调
  };

  // 只编辑当前选中的原图（多图 -> 单图）
  const handleEditSelectedOriginal = () => {
    if (mode === 'multi' && originalImages[selectedOriginalIndex]) {
      setOriginalImage(originalImages[selectedOriginalIndex]);
      setOriginalImages([]);
      setMode('single');
      setEditedImage(null);
      setSelectedOriginalIndex(0);
    }
  };

  // 移除当前选中的原图
  const handleRemoveSelectedOriginal = () => {
    if (mode !== 'multi') return;
    
    const newImages = originalImages.filter((_, i) => i !== selectedOriginalIndex);
    const newSelectedImages = selectedImages.filter((_, i) => i !== selectedOriginalIndex);
    
    if (newImages.length === 0) {
      handleReset();
    } else if (newImages.length === 1) {
      // 如果只剩一张，自动切换到单图模式
      setOriginalImage(newImages[0]);
      setOriginalImages([]);
      setSelectedImages([]);
      setMode('single');
      setSelectedOriginalIndex(0);
      setIsSelectionMode(false);
    } else {
      setOriginalImages(newImages);
      setSelectedImages(newSelectedImages);
      // 调整索引，确保不越界
      if (selectedOriginalIndex >= newImages.length) {
        setSelectedOriginalIndex(newImages.length - 1);
      }
    }
  };

  // 进入/退出选择模式
  const toggleSelectionMode = () => {
    if (!isSelectionMode) {
      // 进入选择模式，默认全选
      setSelectedImages(new Array(originalImages.length).fill(true));
    }
    setIsSelectionMode(!isSelectionMode);
  };

  // 切换单个图片的选中状态
  const toggleImageSelection = (index: number) => {
    setSelectedImages(prev => {
      const newSelected = [...prev];
      newSelected[index] = !newSelected[index];
      return newSelected;
    });
  };

  // 确认选择，只保留选中的图片
  const confirmSelection = () => {
    const selectedIndices = selectedImages.map((selected, index) => selected ? index : -1).filter(i => i !== -1);
    
    if (selectedIndices.length === 0) {
      alert('请至少选择一张图片！');
      return;
    }
    
    const newImages = selectedIndices.map(i => originalImages[i]);
    
    if (newImages.length === 1) {
      // 只选了一张，切换到单图模式
      setOriginalImage(newImages[0]);
      setOriginalImages([]);
      setSelectedImages([]);
      setMode('single');
      setSelectedOriginalIndex(0);
    } else {
      // 多张图片，更新列表
      setOriginalImages(newImages);
      setSelectedImages(new Array(newImages.length).fill(true));
      setSelectedOriginalIndex(0);
    }
    
    setIsSelectionMode(false);
    setEditedImage(null);
  };

  const handleModeSwitch = (newMode: 'single' | 'multi' | 'text') => {
    if (mode !== newMode) {
      setMode(newMode);
      handleReset();
    }
  };
  
  const singleImageSuggestions = [
    "Make it black and white",
    "Add a pirate hat",
    "Turn it into a watercolor painting",
    "Make the background a futuristic city",
    "Add a cute cartoon cat next to the main subject"
  ];

  const multiImageSuggestions = [
    "将这些图片合成为一张图",
    "用第二张图的风格编辑第一张图",
    "把所有图片中的人物合并到一个场景中",
    "将第一张图的主体放到第二张图的背景中",
    "创建一个包含所有图片元素的拼贴画"
  ];

  const textToImageSuggestions = [
    "一只可爱的橘猫在夕阳下的草地上玩耍",
    "未来科幻城市的街景，霓虹灯闪烁",
    "梦幻般的水下世界，五彩斑斓的珊瑚礁",
    "宁静的日式庭院，樱花飘落",
    "宇宙中的神秘星云和闪耀星辰"
  ];

  const promptSuggestions = mode === 'single' ? singleImageSuggestions : mode === 'multi' ? multiImageSuggestions : textToImageSuggestions;

  const handleDownloadImage = (dataUrl: string, filename: string) => {
    try {
      // 将 data URL 转换为 Blob
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      
      // 创建 Blob URL 并下载
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放 Blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('下载图片失败:', error);
      alert('下载失败，请重试');
    }
  };

  const ImageDisplay: React.FC<{ 
    src: string | null; 
    alt: string; 
    title: string; 
    isLoading?: boolean;
    isPrimary?: boolean;
    showDownload?: boolean;
  }> = ({ src, alt, title, isLoading, isPrimary = false, showDownload = false }) => (
    <div className={`image-container w-full aspect-square flex items-center justify-center group p-4`}>
      <div className="relative w-full h-full">
        <div className="flex items-center justify-between absolute top-0 left-0 right-0 z-10 p-3">
          <h3 className="image-label">{title}</h3>
          {src && !isLoading && (
            <div className="flex items-center gap-2">
              {(isPrimary || showDownload) && (
                <button 
                  onClick={() => handleDownloadImage(src, isPrimary ? 'ai-generated-image.png' : 'original-image.png')}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-purple-400 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transition-all opacity-0 group-hover:opacity-100"
                  title="下载图片"
                >
                  💾 下载
                </button>
              )}
              <button 
                onClick={() => setPreviewImage(src)}
                className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5"
              >
                <EyeIcon className="w-3.5 h-3.5" />
                查看大图
              </button>
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <svg className="loading-spinner h-16 w-16 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-500 text-sm font-medium animate-pulse">AI 正在施展魔法...</p>
          </div>
        ) : src ? (
          <img src={src} alt={alt} className="w-full h-full object-contain rounded-lg" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <MagicWandIcon className="w-24 h-24 opacity-20"/>
            <p className="text-sm">等待生成...</p>
          </div>
        )}
      </div>
    </div>
  );

  const hasImages = mode === 'single' ? originalImage !== null : originalImages.length > 0;
  
  // 获取当前显示的原图URL（用于展示和对比）
  const currentOriginalImageUrl = mode === 'single' && originalImage 
    ? originalImage.dataUrl 
    : mode === 'multi' && originalImages.length > 0 
    ? originalImages[selectedOriginalIndex]?.dataUrl 
    : null;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col items-center p-2 sm:p-4 relative pb-20 md:pb-4">
      {/* 加载进度组件 */}
      {isLoading && (
        <LoadingProgress 
          stage={loadingStage}
          progress={loadingProgress}
          estimatedTime={loadingProgress < 85 ? Math.ceil((100 - loadingProgress) / 5) : undefined}
        />
      )}
      
      <Header />
      <main className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center flex-grow relative z-10">
        {/* 桌面端顶部模式切换栏 - 隐藏在移动端 */}
        <div className="hidden md:block w-full max-w-xl mb-8 z-20 transition-all duration-300 sticky top-4">
          <div className="glass-card p-1.5 flex justify-center items-center gap-1 shadow-lg bg-white/90 backdrop-blur-md">
            <button
              onClick={() => handleModeSwitch('single')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === 'single'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md transform scale-105'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>🖼️</span> 单图编辑
            </button>
            <button
              onClick={() => handleModeSwitch('multi')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === 'multi'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md transform scale-105'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>🎨</span> 多图合成
            </button>
            <button
              onClick={() => handleModeSwitch('text')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === 'text'
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md transform scale-105'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>✨</span> 文字生图
            </button>
          </div>
        </div>

        {/* 移动端底部导航栏 - 固定在底部 */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl safe-area-bottom">
          <div className="flex items-center justify-around px-2 py-3">
            <button
              onClick={() => handleModeSwitch('single')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[70px] ${
                mode === 'single'
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg scale-110'
                  : 'text-slate-500 active:bg-slate-100'
              }`}
            >
              <span className="text-2xl">🖼️</span>
              <span className="text-[10px] font-bold">单图</span>
            </button>
            <button
              onClick={() => handleModeSwitch('multi')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[70px] ${
                mode === 'multi'
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg scale-110'
                  : 'text-slate-500 active:bg-slate-100'
              }`}
            >
              <span className="text-2xl">🎨</span>
              <span className="text-[10px] font-bold">多图</span>
            </button>
            <button
              onClick={() => handleModeSwitch('text')}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[70px] ${
                mode === 'text'
                  ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg scale-110'
                  : 'text-slate-500 active:bg-slate-100'
              }`}
            >
              <span className="text-2xl">✨</span>
              <span className="text-[10px] font-bold">文字</span>
            </button>
          </div>
        </div>

        {!hasImages ? (
          <div className="w-full flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-[400px] sm:min-h-[600px] px-2 sm:px-0">
            <div className="text-center mb-2 sm:mb-4 animate-fade-in">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-1 sm:mb-2">
                {mode === 'single' ? 'AI 图片创意编辑' : mode === 'multi' ? '多图艺术合成' : '文字生成梦想画面'}
              </h2>
              <p className="text-sm sm:text-base text-slate-500">
                {mode === 'single' ? '上传一张图片，告诉 AI 你想怎么改' : mode === 'multi' ? '上传多张图片，AI 帮你融合创造' : '输入一段文字，见证奇迹发生'}
              </p>
            </div>

            {/* 上传组件或直接进入文字生图 */}
            {mode === 'single' ? (
              <ImageUploader onImageUpload={handleImageUpload} />
            ) : mode === 'multi' ? (
              <MultiImageUploader onImagesUpload={handleMultiImagesUpload} maxImages={3} />
            ) : (
              /* 文字生图模式 - 直接显示输入区域 */
              <div className="w-full max-w-3xl mx-auto px-2 sm:px-0">
                <div className="glass-card p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                  <div className="text-center space-y-1 sm:space-y-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                      <MagicWandIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      文字生成图片
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600">
                      描述您想要的图片，AI 将为您创造独特的视觉作品
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <label className="pro-label text-sm sm:text-base">
                      <span className="pro-label-icon">📝</span>
                      请详细描述您想要的图片
                    </label>
                    
                    <div className="relative">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="例如：一只可爱的橘猫坐在窗台上，温暖的阳光洒在它的身上，背景是朦胧的城市天际线..."
                        className="pro-textarea w-full pr-12 text-sm sm:text-base min-h-[120px] sm:min-h-[140px]"
                        rows={6}
                        autoFocus
                      />
                      <button
                        onClick={handleEnhancePrompt}
                        disabled={isEnhancing || !prompt}
                        className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 p-2 sm:p-2.5 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 hover:text-purple-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        title="AI 魔法润色：让描述更生动"
                      >
                        {isEnhancing ? (
                          <svg className="animate-spin w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <span className="text-base sm:text-lg">✨</span>
                        )}
                      </button>
                    </div>

                    {/* 创作工具箱 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                      {/* 比例选择 */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          画布比例
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ratios.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => setAspectRatio(r.value)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                                aspectRatio === r.value
                                  ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 风格选择 */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          艺术风格
                        </label>
                        <select
                          value={selectedStyle}
                          onChange={(e) => setSelectedStyle(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                        >
                          {styles.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      提示：点击文本框右下角的 ✨ 可以一键优化您的描述
                    </div>
                  </div>

                  {/* 历史提示词 */}
                  {promptHistory.length > 0 && (
                    <div className="fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-slate-700">最近使用</span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {promptHistory.length}
                          </span>
                        </div>
                        <button
                          onClick={clearPromptHistory}
                          className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                          title="清除历史"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          清除
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-0 max-h-32 overflow-y-auto p-1">
                        {promptHistory.map((historyPrompt, i) => (
                          <div 
                            key={i} 
                            className="history-chip-wrapper group relative"
                          >
                            <button 
                              onClick={() => setPrompt(historyPrompt)} 
                              className="history-chip"
                              title={historyPrompt}
                            >
                              <span className="block truncate max-w-[300px]">
                                {historyPrompt}
                              </span>
                              <span className="ml-1.5 text-blue-400 opacity-60 group-hover:opacity-100">↺</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePromptHistoryItem(historyPrompt);
                              }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                              title="删除此提示词"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 精选模板 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">精选创意模板</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {textToImageSuggestions.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => setPrompt(s)} 
                          className="pro-chip"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleEditRequest}
                    disabled={isLoading || !prompt}
                    className="gradient-button w-full inline-flex items-center justify-center gap-2 text-sm sm:text-base py-3 sm:py-4 min-h-[48px] touch-manipulation active:scale-95"
                  >
                    <MagicWandIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {isLoading ? '✨ AI 创作中...' : '🎨 立即生成'}
                  </button>

                  {error && (
                    <ErrorAlert 
                      error={error}
                      onRetry={handleEditRequest}
                      onDismiss={() => setError(null)}
                    />
                  )}

                  {isLoading && (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                      <svg className="loading-spinner h-16 w-16 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-slate-500 text-sm font-medium animate-pulse">AI 正在根据您的描述创作图片...</p>
                    </div>
                  )}

                  {editedImage && !isLoading && (
                    <div className="fade-in space-y-4">
                      <div className="glass-card p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-semibold text-slate-800">🎉 生成成功！</h4>
                            <p className="text-sm text-slate-600">您可以继续调整描述生成新版本</p>
                          </div>
                        </div>
                      </div>

                      <div className="relative group">
                        <img 
                          src={editedImage} 
                          alt="生成的图片" 
                          className="w-full rounded-xl shadow-lg hover:shadow-2xl transition-shadow cursor-pointer"
                          onClick={() => setPreviewImage(editedImage)}
                        />
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setPreviewImage(editedImage)}
                            className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all flex items-center gap-1.5"
                          >
                            <EyeIcon className="w-4 h-4" />
                            查看大图
                          </button>
                          <button 
                            onClick={() => handleDownloadImage(editedImage, 'ai-generated-image.png')}
                            className="bg-gradient-to-r from-purple-500 to-blue-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-purple-400 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transition-all"
                            title="下载图片"
                          >
                            💾 下载
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleRetry}
                          disabled={isLoading || !prompt}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="使用相同提示词重新生成"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-sm font-medium">重新生成</span>
                        </button>
                        <button
                          onClick={handleReset}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 glass-button"
                        >
                          <ResetIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">开始新创作</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6 fade-in">
            {/* 顶部状态栏 */}
            <div className="glass-card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {mode === 'single' && originalImage ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-purple-100 shadow-sm flex-shrink-0">
                    <img src={originalImage.dataUrl} alt="thumbnail" className="w-full h-full object-cover" />
                  </div>
                ) : mode === 'multi' && originalImages.length > 0 ? (
                  <div className="flex gap-2">
                    {originalImages.slice(0, 3).map((img, idx) => (
                      img && img.dataUrl ? (
                        <div key={idx} className="w-12 h-12 rounded-lg overflow-hidden border-2 border-purple-100 shadow-sm flex-shrink-0">
                          <img src={img.dataUrl} alt={`图${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ) : null
                    ))}
                  </div>
                ) : null}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 text-base">AI 图像编辑器</h3>
                    <span className="pro-badge">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Beta
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">使用 Google Gemini 2.5 Flash 驱动</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {generationHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-blue-700 hover:from-blue-100 hover:to-purple-100 hover:border-blue-300"
                    title="查看生成历史"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden sm:inline">历史</span>
                    <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {generationHistory.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-2 rounded-lg transition-all"
                  title="更换图片"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 专业控制面板 */}
            <div className="pro-control-panel">
              <div className="mb-6">
                <label className="pro-label">
                  <span className="pro-label-icon">✨</span>
                  输入您的创意提示词
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="详细描述您想要的编辑效果，例如：将背景替换为紫色星空、添加科幻光效、转换为油画风格..."
                  className="pro-textarea w-full"
                  rows={4}
                  disabled={isLoading}
                />
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  提示：描述越详细，生成效果越精准
                </div>
              </div>
              
              <div className="pro-divider"></div>

              {/* 历史提示词 */}
              {promptHistory.length > 0 && (
                <div className="mb-6 fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">最近使用</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {promptHistory.length}
                      </span>
                    </div>
                    <button
                      onClick={clearPromptHistory}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                      title="清除历史"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      清除
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-0 max-h-32 overflow-y-auto p-1">
                    {promptHistory.map((historyPrompt, i) => (
                      <div 
                        key={i} 
                        className="history-chip-wrapper group relative"
                      >
                        <button 
                          onClick={() => setPrompt(historyPrompt)} 
                          disabled={isLoading}
                          className="history-chip"
                          title={historyPrompt}
                        >
                          <span className="block truncate max-w-[300px]">
                            {historyPrompt}
                          </span>
                          <span className="ml-1.5 text-blue-400 opacity-60 group-hover:opacity-100">↺</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePromptHistoryItem(historyPrompt);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                          title="删除此提示词"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">精选创意模板</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions.map((s, i) => (
                    <button 
                      key={i} 
                      onClick={() => setPrompt(s)} 
                      disabled={isLoading} 
                      className="pro-chip"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleEditRequest}
                    disabled={isLoading || !prompt}
                    className="gradient-button flex-grow inline-flex items-center justify-center gap-2 text-base"
                  >
                    <MagicWandIcon className="w-5 h-5" />
                    {isLoading ? '✨ AI 创作中...' : '🎨 立即生成'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="glass-button inline-flex items-center justify-center gap-2 sm:w-auto"
                  >
                    <ResetIcon className="w-5 h-5" />
                    更换图片
                  </button>
                </div>
                
                {/* 快速操作按钮 */}
                {editedImage && (
                  <div className="flex flex-col sm:flex-row gap-2 fade-in">
                    {previousState && (
                      <button
                        onClick={handleUndo}
                        disabled={isLoading}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="撤销到上一次结果"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="text-sm font-medium">撤销上一步</span>
                      </button>
                    )}
                    <button
                      onClick={handleRetry}
                      disabled={isLoading || !prompt}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="使用相同提示词重新生成"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-sm font-medium">{isLoading ? '重试中...' : '快速重试'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 生成历史记录面板 */}
            {showHistory && generationHistory.length > 0 && (
              <div className="glass-card p-6 fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">生成历史</h3>
                      <p className="text-sm text-slate-500">
                        共 {generationHistory.length} 条记录
                        {generationHistory.length >= MAX_GENERATION_HISTORY && (
                          <span className="ml-2 text-xs text-amber-600 font-medium">
                            (已达上限，旧记录将被自动清理)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearGenerationHistory}
                      className="text-sm text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50"
                      title="清空所有历史"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      清空历史
                    </button>
                    <button
                      onClick={() => setShowHistory(false)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                      title="关闭"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
                  {generationHistory.map((item) => (
                    <div
                      key={item.id}
                      className="history-card group relative bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all cursor-pointer"
                    >
                      {/* 图片预览 */}
                      <div className="relative aspect-video bg-slate-100">
                        <img
                          src={item.editedImage}
                          alt="Generated"
                          className="w-full h-full object-cover"
                          onClick={() => loadFromHistory(item)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {/* 多图/文字生图标识 */}
                        {item.isTextToImage ? (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-pink-500 to-orange-500 backdrop-blur-sm text-white text-xs font-medium rounded-lg flex items-center gap-1">
                            ✨ 文字生图
                          </div>
                        ) : item.isMultiImage && item.originalImages ? (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-purple-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-lg flex items-center gap-1">
                            🎨 {item.originalImages.length}图合成
                          </div>
                        ) : null}
                        
                        {/* 悬浮操作按钮 */}
                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(item.editedImage);
                            }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-all"
                            title="预览"
                          >
                            <EyeIcon className="w-4 h-4 text-slate-700" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(item.editedImage, `generated-${item.id}.png`);
                            }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-all"
                            title="下载"
                          >
                            <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('确定要删除这条历史记录吗？')) {
                                deleteHistoryItem(item.id);
                              }
                            }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-red-50 transition-all"
                            title="删除"
                          >
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* 加载按钮 */}
                        <button
                          onClick={() => loadFromHistory(item)}
                          className="absolute bottom-2 left-2 right-2 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600"
                        >
                          📥 加载此版本
                        </button>
                      </div>

                      {/* 信息区域 */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-600 line-clamp-2 flex-1" title={item.prompt}>
                            <span className="font-semibold text-slate-700">提示词：</span>
                            {item.prompt}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-blue-500">#{generationHistory.indexOf(item) + 1}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <ErrorAlert 
                error={error}
                onRetry={handleRetry}
                onDismiss={() => setError(null)}
              />
            )}

            {/* 对比模式切换按钮 */}
            {editedImage && !isLoading && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-4">
                <span className="text-xs sm:text-sm text-slate-600 font-medium">对比模式：</span>
                <div className="inline-flex rounded-xl border-2 border-slate-200 p-1 bg-white w-full sm:w-auto">
                  <button
                    onClick={() => setCompareMode('split')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      compareMode === 'split'
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <rect x="3" y="6" width="7" height="12" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="14" y="6" width="7" height="12" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="hidden sm:inline">并排对比</span>
                      <span className="sm:hidden">并排</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setCompareMode('slider')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      compareMode === 'slider'
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="hidden sm:inline">滑块对比</span>
                      <span className="sm:hidden">滑块</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* 图片对比展示区 */}
            {compareMode === 'split' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {currentOriginalImageUrl && (
                  <div className="flex flex-col gap-3">
                    <ImageDisplay 
                      src={currentOriginalImageUrl} 
                      alt="Original image" 
                      title={mode === 'single' ? "📸 原图" : `📸 原图 ${selectedOriginalIndex + 1}/${originalImages.length}`}
                      showDownload={true}
                    />
                    
                    {/* 原图操作控制栏 */}
                    {mode === 'multi' && (
                      <div className="flex gap-2 mb-1">
                        <button
                          onClick={handleEditSelectedOriginal}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-100"
                          title="只使用这张图片进行单图编辑"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          单图精修
                        </button>
                        <button
                          onClick={handleRemoveSelectedOriginal}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors border border-red-100"
                          title="从当前合成列表中移除这张图片"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          移除此图
                        </button>
                      </div>
                    )}

                    {/* 多图模式下的缩略图导航 */}
                    {mode === 'multi' && originalImages.length > 1 && (
                      <div className="space-y-3">
                        {/* 选择模式控制栏 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">
                            {isSelectionMode ? '选择要保留的图片' : '图片库'} ({originalImages.length}张)
                          </span>
                          <div className="flex gap-2">
                            {isSelectionMode ? (
                              <>
                                <button
                                  onClick={() => setSelectedImages(new Array(originalImages.length).fill(true))}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                >
                                  全选
                                </button>
                                <button
                                  onClick={() => setSelectedImages(new Array(originalImages.length).fill(false))}
                                  className="px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-colors"
                                >
                                  全不选
                                </button>
                                <button
                                  onClick={confirmSelection}
                                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-medium"
                                >
                                  确认选择
                                </button>
                                <button
                                  onClick={toggleSelectionMode}
                                  className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={toggleSelectionMode}
                                className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors font-medium"
                              >
                                选择模式
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* 缩略图网格 */}
                        <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                          {originalImages.map((img, idx) => (
                            img && img.dataUrl ? (
                              <div key={idx} className="relative flex-shrink-0">
                                <button
                                  onClick={() => isSelectionMode ? toggleImageSelection(idx) : setSelectedOriginalIndex(idx)}
                                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                    isSelectionMode
                                      ? selectedImages[idx]
                                        ? 'border-green-500 ring-2 ring-green-200'
                                        : 'border-slate-200 opacity-50'
                                      : selectedOriginalIndex === idx 
                                        ? 'border-purple-500 ring-2 ring-purple-200 scale-105 shadow-md' 
                                        : 'border-slate-200 hover:border-purple-300 opacity-70 hover:opacity-100'
                                  }`}
                                  title={isSelectionMode ? `${selectedImages[idx] ? '取消选择' : '选择'}图片 ${idx + 1}` : `切换到图片 ${idx + 1}`}
                                >
                                  <img src={img.dataUrl} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                                  {!isSelectionMode && selectedOriginalIndex === idx && (
                                    <div className="absolute inset-0 bg-purple-500/10" />
                                  )}
                                  {isSelectionMode && (
                                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full border-2 border-white bg-white/90 flex items-center justify-center">
                                      {selectedImages[idx] && (
                                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                </button>
                              </div>
                            ) : null
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <ImageDisplay 
                  src={editedImage} 
                  alt="Edited image" 
                  title={editedImage ? "✨ AI 生成结果" : "⏳ 等待生成"} 
                  isLoading={isLoading}
                  isPrimary={!!editedImage}
                />
                
                {/* 结果图操作控制栏 */}
                {editedImage && !isLoading && (
                  <button
                    onClick={handleUseEditedAsOriginal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold shadow-md hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    以此图继续创作
                  </button>
                )}
              </div>
            ) : (
              /* 滑块对比模式 */
              editedImage && !isLoading && (
                <div className="image-container w-full aspect-video relative overflow-hidden group">
                  <div className="relative w-full h-full">
                    {/* 顶部操作按钮 */}
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {currentOriginalImageUrl && (
                        <button 
                          onClick={() => setPreviewImage(currentOriginalImageUrl)}
                          className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all flex items-center gap-1.5"
                          title="查看原图"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                          原图
                        </button>
                      )}
                      <button 
                        onClick={() => setPreviewImage(editedImage)}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-purple-400 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transition-all flex items-center gap-1.5"
                        title="查看AI生成图"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        AI图
                      </button>
                      <button 
                        onClick={() => handleDownloadImage(editedImage, 'ai-generated-image.png')}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-purple-400 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transition-all"
                        title="下载AI生成图"
                      >
                        💾 下载
                      </button>
                    </div>

                    {/* 原图层 */}
                    {currentOriginalImageUrl && (
                      <div className="absolute inset-0">
                        <img 
                          src={currentOriginalImageUrl} 
                          alt="Original" 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white text-sm font-medium rounded-lg">
                          📸 原图
                        </div>
                      </div>
                    )}

                    {/* 编辑图层（可裁剪） */}
                    <div 
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                    >
                      <img 
                        src={editedImage} 
                        alt="Edited" 
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-purple-600/90 backdrop-blur-sm text-white text-sm font-medium rounded-lg">
                        ✨ AI 生成
                      </div>
                    </div>

                    {/* 滑块控制器 */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl cursor-ew-resize z-10"
                      style={{ left: `${sliderPosition}%` }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const container = e.currentTarget.parentElement;
                        if (!container) return;

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const rect = container.getBoundingClientRect();
                          const x = moveEvent.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                          throttledSetSliderPosition(percentage);
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      onTouchStart={(e) => {
                        const container = e.currentTarget.parentElement;
                        if (!container) return;

                        const handleTouchMove = (moveEvent: TouchEvent) => {
                          const rect = container.getBoundingClientRect();
                          const x = moveEvent.touches[0].clientX - rect.left;
                          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                          throttledSetSliderPosition(percentage);
                        };

                        const handleTouchEnd = () => {
                          document.removeEventListener('touchmove', handleTouchMove);
                          document.removeEventListener('touchend', handleTouchEnd);
                        };

                        document.addEventListener('touchmove', handleTouchMove);
                        document.addEventListener('touchend', handleTouchEnd);
                      }}
                    >
                      {/* 滑块手柄 */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-purple-500">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                    </div>

                    {/* 提示文字 */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full">
                      👆 拖动滑块查看对比
                    </div>
                  </div>
                </div>
              )
            )}

            {/* 编辑成功提示 */}
            {editedImage && !isLoading && (
              <div className="glass-card p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-semibold text-slate-800">🎉 生成成功！</h4>
                    <p className="text-sm text-slate-600">您可以继续调整提示词生成新版本，或点击图片查看大图</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="text-center p-4 text-gray-500 text-sm">
        Powered by Google Gemini.
      </footer>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in preview-modal-backdrop"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
            {/* 关闭按钮 */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center transition-all hover:scale-110 border border-white/20"
              title="关闭 (ESC)"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 下载按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadImage(previewImage, 'ai-generated-image.png');
              }}
              className="absolute top-4 right-20 sm:top-6 sm:right-24 z-10 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 backdrop-blur-md rounded-full flex items-center gap-2 transition-all hover:scale-105 border border-purple-400/50 text-white font-medium text-sm"
              title="下载图片"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">下载</span>
            </button>

            {/* 图片容器 */}
            <div 
              className="relative max-w-7xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={previewImage} 
                alt="预览大图" 
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl preview-modal-image"
                style={{ imageRendering: 'high-quality' }}
              />
              
              {/* 图片信息提示 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md text-white text-sm rounded-full border border-white/20">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  点击背景或按 ESC 键关闭
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
