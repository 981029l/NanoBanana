// Copyright (c) 2025 左岚. All rights reserved.

export interface ImageData {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

export interface GenerationHistory {
  id: string;
  originalImage: string;
  originalImages?: string[];
  editedImage: string;
  prompt: string;
  timestamp: number;
  isMultiImage?: boolean;
  isTextToImage?: boolean;
}

// 小红书笔记内容类型
export type NoteType = 'recommend' | 'review' | 'tutorial' | 'daily' | 'food' | 'travel' | 'fashion' | 'custom';

// 小红书笔记模板配置
export interface NoteTemplate {
  type: NoteType;
  label: string;
  icon: string;
  description: string;
  promptHint: string;
}

// 生成的小红书笔记内容
export interface XiaohongshuNote {
  id: string;
  title: string; // 标题（带emoji）
  content: string; // 正文内容
  tags: string[]; // 话题标签
  timestamp: number;
  noteType: NoteType;
  inputTopic: string; // 用户输入的主题
  imageUrl?: string; // 关联图片（封面）
  imageUrls?: string[]; // 多张配图
}

// 小红书内容生成历史
export interface NoteHistory {
  id: string;
  note: XiaohongshuNote;
  timestamp: number;
}
