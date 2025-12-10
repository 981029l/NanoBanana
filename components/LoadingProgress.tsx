// Copyright (c) 2025 左岚. All rights reserved.

import React, { useEffect, useState } from 'react';

interface LoadingProgressProps {
  stage: 'analyzing' | 'generating' | 'finalizing'; // 当前阶段
  progress?: number; // 可选的进度百分比 (0-100)
  estimatedTime?: number; // 预估剩余时间（秒）
  onCancel?: () => void; // 取消回调
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ 
  stage, 
  progress, 
  estimatedTime,
  onCancel 
}) => {
  const [dots, setDots] = useState('');

  // 动画点点点效果
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 阶段配置
  const stageConfig = {
    analyzing: {
      icon: '🔍',
      text: '正在分析图片',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500',
    },
    generating: {
      icon: '🎨',
      text: 'AI 正在创作',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500',
    },
    finalizing: {
      icon: '✨',
      text: '即将完成',
      color: 'text-green-400',
      bgColor: 'bg-green-500',
    },
  };

  const config = stageConfig[stage];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 overflow-hidden">
      {/* 动态网格背景 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-grid-pattern animate-grid-flow"></div>
      </div>

      {/* 旋转光环 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-96 h-96">
          {/* 外圈 */}
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-spin-slow"></div>
          <div className="absolute inset-8 rounded-full border-4 border-blue-500/30 animate-spin-reverse"></div>
          <div className="absolute inset-16 rounded-full border-4 border-pink-500/30 animate-spin-slow"></div>
          
          {/* 发光点 */}
          <div className="absolute top-0 left-1/2 w-4 h-4 -ml-2 -mt-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50 animate-orbit"></div>
          <div className="absolute top-1/2 right-0 w-4 h-4 -mr-2 -mt-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 animate-orbit-reverse"></div>
          <div className="absolute bottom-0 left-1/2 w-4 h-4 -ml-2 -mb-2 bg-pink-500 rounded-full shadow-lg shadow-pink-500/50 animate-orbit"></div>
        </div>
      </div>

      {/* 中心内容 */}
      <div className="relative z-10 text-center animate-float-gentle">
        {/* 主图标 - 3D 旋转效果 */}
        <div className="relative inline-block mb-8">
          <div className="text-9xl animate-3d-rotate filter drop-shadow-2xl">
            {config.icon}
          </div>
          {/* 倒影效果 */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 text-9xl opacity-20 blur-sm scale-y-[-1]">
            {config.icon}
          </div>
        </div>

        {/* 文字 */}
        <h2 className={`text-5xl font-black mb-4 ${config.color} animate-pulse-glow`}>
          {config.text}
        </h2>
        
        {/* 动态描述 */}
        <p className="text-xl text-gray-300 mb-8 animate-type-writer">
          {stage === 'analyzing' && '正在分析您的创意'}
          {stage === 'generating' && 'AI 正在施展魔法'}
          {stage === 'finalizing' && '添加最后的点睛之笔'}
          {dots}
        </p>

        {/* 创意进度指示器 - 圆形脉冲 */}
        <div className="flex justify-center items-center gap-8 mb-8">
          <div className={`w-20 h-20 rounded-full ${stage === 'analyzing' ? 'bg-blue-500 scale-125' : 'bg-gray-700'} transition-all duration-500 flex items-center justify-center text-2xl animate-pulse-ring`}>
            🔍
          </div>
          <div className={`w-20 h-20 rounded-full ${stage === 'generating' ? 'bg-purple-500 scale-125' : 'bg-gray-700'} transition-all duration-500 flex items-center justify-center text-2xl animate-pulse-ring`}>
            🎨
          </div>
          <div className={`w-20 h-20 rounded-full ${stage === 'finalizing' ? 'bg-green-500 scale-125' : 'bg-gray-700'} transition-all duration-500 flex items-center justify-center text-2xl animate-pulse-ring`}>
            ✨
          </div>
        </div>

        {/* 波纹进度 */}
        <div className="relative w-64 h-2 mx-auto bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer-fast"></div>
          </div>
        </div>

        {/* 百分比 */}
        {progress !== undefined && (
          <div className="mt-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-x">
            {Math.round(progress)}%
          </div>
        )}

        {/* 漂浮粒子 */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-purple-500/30 rounded-full animate-float-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* 底部提示 */}
      {estimatedTime !== undefined && estimatedTime > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-gray-400 text-lg animate-fade-in-up">
          <div className="flex items-center gap-3 bg-black/50 px-6 py-3 rounded-full backdrop-blur-sm border border-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
            <span>预计 {estimatedTime} 秒后完成</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingProgress;
