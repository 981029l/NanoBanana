// Copyright (c) 2025 左岚. All rights reserved.

import { GoogleGenAI } from "@google/genai";
import type { ImageData, NoteType, XiaohongshuNote } from "../types";

// 模型配置
const TEXT_MODEL = "gemini-2.5-flash"; // 文案生成模型
const IMAGE_MODEL = "gemini-3-pro-image-preview"; // 图片生成模型

const NOTE_TYPE_PROMPTS: Record<NoteType, string> = {
  recommend: "种草推荐类笔记，突出产品优点和使用体验，让人想买",
  review: "测评类笔记，客观分析优缺点，给出真实使用感受",
  tutorial: "教程攻略类笔记，步骤清晰，干货满满",
  daily: "日常分享类笔记，轻松随意，有生活气息",
  food: "美食探店/食谱类笔记，突出色香味，让人流口水",
  travel: "旅行攻略类笔记，景点推荐+实用tips",
  fashion: "穿搭时尚类笔记，突出搭配技巧和风格",
  custom: "根据用户描述自由发挥",
};

// 内容模式类型
export type ContentMode = "topic" | "image";

// 生成小红书笔记内容
export const generateXiaohongshuNote = async (
  topic: string,
  noteType: NoteType,
  image?: ImageData,
  contentMode: ContentMode = "topic"
): Promise<XiaohongshuNote> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const typeHint = NOTE_TYPE_PROMPTS[noteType];

  const systemPrompt = `你是一个专业的小红书内容创作者，擅长写出爆款笔记。请根据用户提供的主题生成小红书笔记内容。

要求：
1. 标题：15-20字，必须包含emoji，吸引眼球，可用"｜"分隔，制造悬念或引发好奇
2. 正文：300-500字，分段清晰，多用emoji点缀，语气亲切自然像朋友聊天
3. 话题标签：5-8个相关话题，不带#号
4. 内容类型：${typeHint}

输出格式（严格JSON）：
{
  "title": "标题内容",
  "content": "正文内容（用\\n换行）",
  "tags": ["标签1", "标签2", "标签3"]
}

只输出JSON，不要其他内容。`;

  try {
    const parts: any[] = [];
    
    if (image && topic.trim()) { // 同时有图片和主题
      parts.push({
        inlineData: { data: image.base64, mimeType: image.mimeType },
      });
      const modePrompt = contentMode === "topic"
        ? `请参考这张图片作为素材，但主要围绕以下主题生成小红书笔记。图片仅作为视觉参考，文案重点突出主题内容：\n主题：${topic}`
        : `请深度分析这张图片的内容、场景、细节，以图片为核心生成小红书笔记。以下主题作为补充说明：\n主题：${topic}`;
      parts.push({ text: `${systemPrompt}\n\n${modePrompt}` });
    } else if (image) { // 只有图片，无主题
      parts.push({
        inlineData: { data: image.base64, mimeType: image.mimeType },
      });
      parts.push({
        text: `${systemPrompt}\n\n请深度分析这张图片，根据图片内容生成小红书笔记。`,
      });
    } else { // 只有主题
      parts.push({
        text: `${systemPrompt}\n\n主题：${topic}`,
      });
    }

    const response = await ai.models.generateContent({
      model: image ? IMAGE_MODEL : TEXT_MODEL,
      contents: { parts },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response from AI");

    // 解析JSON（处理可能的markdown代码块）
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: parsed.title,
      content: parsed.content,
      tags: parsed.tags || [],
      timestamp: Date.now(),
      noteType,
      inputTopic: topic,
      imageUrl: image?.dataUrl,
    };
  } catch (error) {
    console.error("生成小红书笔记失败:", error);
    throw new Error(error instanceof Error ? error.message : "生成失败，请重试");
  }
};

// 优化/重写笔记内容
export const rewriteNote = async (
  note: XiaohongshuNote,
  instruction: string
): Promise<XiaohongshuNote> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `你是小红书内容优化专家。请根据指令修改以下笔记内容。

当前笔记：
标题：${note.title}
正文：${note.content}
标签：${note.tags.join(", ")}

修改指令：${instruction}

输出格式（严格JSON）：
{
  "title": "新标题",
  "content": "新正文（用\\n换行）",
  "tags": ["标签1", "标签2"]
}

只输出JSON。`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response");

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      ...note,
      title: parsed.title,
      content: parsed.content,
      tags: parsed.tags || note.tags,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("优化笔记失败:", error);
    throw new Error("优化失败，请重试");
  }
};

// 文案风格类型
export type ContentStyle = "lively" | "professional" | "literary" | "humorous";

const STYLE_PROMPTS: Record<ContentStyle, string> = {
  lively: "活泼可爱风格，多用语气词和emoji，像闺蜜聊天",
  professional: "专业干货风格，逻辑清晰，数据说话",
  literary: "文艺清新风格，用词优美，有意境",
  humorous: "幽默搞笑风格，段子手附体，让人忍俊不禁",
};

// 生成多版本标题
export const generateMultipleTitles = async (topic: string, noteType: NoteType, count: number = 3): Promise<string[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const typeHint = NOTE_TYPE_PROMPTS[noteType];

  const prompt = `你是小红书爆款标题专家。请为以下主题生成${count}个不同风格的标题。

主题：${topic}
内容类型：${typeHint}

要求：
1. 每个标题15-20字，必须包含emoji
2. 风格各异：可以是悬念式、数字式、对比式、疑问式等
3. 吸引眼球，让人想点进去看

输出格式（严格JSON数组）：
["标题1", "标题2", "标题3"]

只输出JSON数组。`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response");

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("生成多版本标题失败:", error);
    throw new Error("生成失败，请重试");
  }
};

// 切换文案风格
export const changeContentStyle = async (note: XiaohongshuNote, style: ContentStyle): Promise<XiaohongshuNote> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const styleHint = STYLE_PROMPTS[style];

  const prompt = `你是小红书内容改写专家。请将以下笔记改写为${styleHint}。

当前笔记：
标题：${note.title}
正文：${note.content}

要求：
1. 保持核心内容不变，只改变表达风格
2. 标题也要相应调整风格
3. 正文300-500字

输出格式（严格JSON）：
{
  "title": "新标题",
  "content": "新正文（用\\n换行）"
}

只输出JSON。`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response");

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();

    const parsed = JSON.parse(jsonStr);
    return { ...note, title: parsed.title, content: parsed.content, timestamp: Date.now() };
  } catch (error) {
    console.error("切换风格失败:", error);
    throw new Error("切换失败，请重试");
  }
};

// 按笔记类型定制的图片生成策略
const IMAGE_STRATEGIES: Record<NoteType, { types: string[]; style: string }> = {
  travel: {
    types: ["景点全景", "标志性建筑/地标", "当地特色街景", "自然风光", "打卡机位"],
    style: "真实旅行摄影风格，展现当地特色风貌，自然光线，高清风景照",
  },
  food: {
    types: ["菜品特写", "餐厅环境", "美食摆盘", "食材细节", "用餐氛围"],
    style: "美食摄影风格，暖色调，食物看起来诱人可口，背景虚化突出主体",
  },
  fashion: {
    types: ["全身穿搭", "单品特写", "搭配细节", "配饰展示", "街拍风格"],
    style: "时尚杂志风格，简洁背景，突出服装质感和搭配效果",
  },
  recommend: {
    types: ["产品正面图", "使用场景", "细节特写", "包装展示", "效果对比"],
    style: "产品摄影风格，干净背景，突出产品质感和卖点",
  },
  review: {
    types: ["产品全貌", "使用过程", "细节放大", "效果展示", "真实场景"],
    style: "真实测评风格，自然光线，展示产品真实状态",
  },
  tutorial: {
    types: ["步骤演示", "工具展示", "过程记录", "成果展示", "对比图"],
    style: "教程图解风格，清晰明了，重点突出",
  },
  daily: {
    types: ["生活场景", "日常瞬间", "环境氛围", "物品摆放", "自然状态"],
    style: "生活记录风格，温馨自然，有生活气息",
  },
  custom: {
    types: ["主题相关", "场景展示", "细节特写", "氛围图", "创意表达"],
    style: "小红书流行风格，精致美观，吸引眼球",
  },
};

// AI 生成单张配图（根据笔记类型和内容定制）
const generateSingleImage = async (
  ai: GoogleGenAI,
  note: XiaohongshuNote,
  imageIndex: number
): Promise<string> => {
  const strategy = IMAGE_STRATEGIES[note.noteType] || IMAGE_STRATEGIES.custom;
  const imageType = strategy.types[imageIndex % strategy.types.length];

  // 从正文中提取关键信息
  const contentSnippet = note.content.slice(0, 200);

  const prompt = `Generate a realistic, high-quality photograph for Xiaohongshu (Little Red Book).

【主题】${note.inputTopic}
【标题】${note.title}
【内容摘要】${contentSnippet}
【图片类型】第${imageIndex + 1}张：${imageType}
【风格要求】${strategy.style}

CRITICAL REQUIREMENTS:
1. The image MUST accurately represent the specific location/subject mentioned: "${note.inputTopic}"
2. If it's a travel post about a specific place (like 浙江丽水古堰画乡), show THAT exact location's characteristics
3. Include recognizable landmarks, architecture, or scenery unique to the mentioned place
4. Realistic photography style, NOT illustration or cartoon
5. Square format (1:1 aspect ratio)
6. NO text, watermarks, or logos in the image
7. High resolution, professional quality

Generate an authentic image of: ${note.inputTopic} - ${imageType}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: { parts: [{ text: prompt }] },
    config: { responseModalities: ["IMAGE"] as any },
  });

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No image");

  for (const part of parts) {
    if ((part as any).inlineData) {
      const data = (part as any).inlineData;
      return `data:${data.mimeType};base64,${data.data}`;
    }
  }
  throw new Error("No image data");
};

// AI 生成配图（单张，兼容旧接口）
export const generateNoteImage = async (note: XiaohongshuNote): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not set");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return generateSingleImage(ai, note, 0);
};

// AI 批量生成多张配图（最多5张）
export const generateMultipleImages = async (
  note: XiaohongshuNote,
  count: number = 3,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not set");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const actualCount = Math.min(count, 5); // 最多5张
  const results: string[] = [];
  let completed = 0;

  // 串行生成，确保每张图片质量
  for (let i = 0; i < actualCount; i++) {
    try {
      const img = await generateSingleImage(ai, note, i);
      results.push(img);
      completed++;
      onProgress?.(completed, actualCount);
    } catch (e) {
      console.error(`第${i + 1}张图片生成失败:`, e);
      completed++;
      onProgress?.(completed, actualCount);
    }
  }

  if (results.length === 0) throw new Error("配图生成失败");
  return results;
};
