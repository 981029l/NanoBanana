<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Nano Banana Photo Editor

基于 Google Gemini 3 Pro Image 的 AI 图片编辑器

## ✨ 核心功能

- 🎨 **单图编辑** - AI 智能编辑单张图片
- 🖼️ **多图编辑** - 批量处理多张图片
- 📝 **文字生成图** - 纯文字描述生成图片
- 🎭 **风格滤镜** - 电影感、动漫、赛博朋克等 8 种风格
- 📐 **比例控制** - 支持 1:1、16:9、9:16 等多种比例
- ✨ **提示词优化** - AI 自动优化提示词（Magic Polish）
- 📜 **历史记录** - 自动保存生成历史，支持快速回溯

## 🚀 性能优化

- **图片压缩** - 自动压缩历史记录图片，节省存储空间（最高节省 70%）
- **防抖节流** - 滑块操作节流优化（60fps），提升交互流畅度
- **智能存储** - 自动处理 localStorage 配额，防止存储溢出

## 🛠️ 本地运行

**环境要求：** Node.js

1. 安装依赖：
   ```bash
   npm install
   ```

2. 配置 API Key：
   在 `.env.local` 文件中设置 `API_KEY` 为你的 Gemini API Key

3. 启动应用：
   ```bash
   npm run dev
   ```

## 📦 技术栈

- **前端框架：** React 19 + TypeScript
- **构建工具：** Vite 6
- **AI 模型：** Google Gemini 3 Pro Image Preview
- **样式：** TailwindCSS

## 📄 版权

Copyright (c) 2025 左岚. All rights reserved.
