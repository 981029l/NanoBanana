// Copyright (c) 2025 左岚. All rights reserved.

import React from 'react';

interface ErrorAlertProps {
  message?: string; // 兼容 App.tsx 传入的 message
  error?: string; // 兼容旧接口
  onClose?: () => void; // 兼容 App.tsx 传入的 onClose
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, error, onClose, onRetry, onDismiss }) => {
  const errorText = message || error || "未知错误"; // 兼容两种传参方式
  const handleDismiss = onClose || onDismiss; // 兼容两种关闭回调

  // 错误类型识别和友好提示
  const getErrorInfo = (errorMessage: string) => {
    const lowerError = (errorMessage || "").toLowerCase();

    // 网络错误
    if (lowerError.includes('network') || lowerError.includes('fetch failed') || lowerError.includes('failed to fetch')) {
      return {
        icon: '🌐',
        title: '网络连接失败',
        message: '无法连接到服务器，请检查您的网络连接后重试',
        suggestion: '请确保网络畅通，或稍后再试',
        type: 'network',
        color: 'orange',
      };
    }

    // API 错误
    if (lowerError.includes('api') || lowerError.includes('500') || lowerError.includes('503')) {
      return {
        icon: '⚠️',
        title: 'AI 服务暂时不可用',
        message: '服务器正在维护或负载过高，请稍后重试',
        suggestion: '通常几分钟后即可恢复，请耐心等待',
        type: 'api',
        color: 'red',
      };
    }

    // 认证错误
    if (lowerError.includes('api_key') || lowerError.includes('api key') || lowerError.includes('unauthorized') || lowerError.includes('401')) {
      return {
        icon: '🔑',
        title: 'API 密钥无效',
        message: 'API 密钥未设置或已过期',
        suggestion: '请检查 .env.local 文件中的 GEMINI_API_KEY 配置',
        type: 'auth',
        color: 'yellow',
      };
    }

    // 配额错误
    if (lowerError.includes('quota') || lowerError.includes('limit') || lowerError.includes('429')) {
      return {
        icon: '📊',
        title: 'API 配额已用尽',
        message: '今日 API 调用次数已达上限',
        suggestion: '请明天再试，或升级您的 API 套餐',
        type: 'quota',
        color: 'purple',
      };
    }

    // 图片错误
    if (lowerError.includes('image') || lowerError.includes('file')) {
      return {
        icon: '🖼️',
        title: '图片处理失败',
        message: '图片格式不支持或文件损坏',
        suggestion: '请确保图片格式为 JPG、PNG 或 WebP，且文件小于 10MB',
        type: 'image',
        color: 'blue',
      };
    }

    // 超时错误
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return {
        icon: '⏱️',
        title: '请求超时',
        message: '服务器响应时间过长',
        suggestion: '请重试，或尝试使用更简单的提示词',
        type: 'timeout',
        color: 'orange',
      };
    }

    // 提示词错误
    if (lowerError.includes('prompt') || lowerError.includes('invalid')) {
      return {
        icon: '📝',
        title: '提示词无效',
        message: '提示词包含不支持的内容或格式错误',
        suggestion: '请修改提示词，避免使用特殊字符或敏感词汇',
        type: 'prompt',
        color: 'yellow',
      };
    }

    // 默认错误
    return {
      icon: '❌',
      title: '操作失败',
      message: errorMessage || '发生未知错误',
      suggestion: '请重试，如果问题持续存在，请联系技术支持',
      type: 'unknown',
      color: 'red',
    };
  };

  const errorInfo = getErrorInfo(errorText);

  // 颜色配置
  const colorClasses = {
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      border: 'border-red-300',
      icon: 'bg-red-500',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'bg-red-500 hover:bg-red-600',
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      border: 'border-orange-300',
      icon: 'bg-orange-500',
      title: 'text-orange-800',
      message: 'text-orange-700',
      button: 'bg-orange-500 hover:bg-orange-600',
    },
    yellow: {
      bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
      border: 'border-yellow-300',
      icon: 'bg-yellow-500',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      button: 'bg-yellow-500 hover:bg-yellow-600',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      border: 'border-blue-300',
      icon: 'bg-blue-500',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'bg-blue-500 hover:bg-blue-600',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      border: 'border-purple-300',
      icon: 'bg-purple-500',
      title: 'text-purple-800',
      message: 'text-purple-700',
      button: 'bg-purple-500 hover:bg-purple-600',
    },
  };

  const colors = colorClasses[errorInfo.color as keyof typeof colorClasses] || colorClasses.red;

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-6 shadow-xl animate-shake`}>
      <div className="flex items-start gap-4">
        {/* 图标 */}
        <div className={`${colors.icon} w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-lg animate-bounce-once`}>
          {errorInfo.icon}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className={`text-xl font-bold ${colors.title} mb-2`}>
            {errorInfo.title}
          </h3>

          {/* 错误信息 */}
          <p className={`${colors.message} text-base mb-3 leading-relaxed`}>
            {errorInfo.message}
          </p>

          {/* 建议 */}
          <div className="bg-white/60 rounded-lg p-3 mb-4 border border-gray-200">
            <p className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-base">💡</span>
              <span>{errorInfo.suggestion}</span>
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 flex-wrap">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`${colors.button} text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105 flex items-center gap-2`}
              >
                <span>🔄</span>
                <span>重试</span>
              </button>
            )}

            {handleDismiss && (
              <button
                onClick={handleDismiss}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105"
              >
                关闭
              </button>
            )}

            {/* 查看详情按钮（可选） */}
            <button
              onClick={() => {
                console.group('🔍 错误详情');
                console.error('错误类型:', errorInfo.type);
                console.error('原始错误:', errorText);
                console.error('时间:', new Date().toLocaleString());
                console.groupEnd();
                alert('错误详情已输出到控制台（F12）');
              }}
              className="bg-white hover:bg-gray-50 text-gray-600 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 border border-gray-300 hover:border-gray-400"
            >
              查看详情
            </button>
          </div>
        </div>

        {/* 关闭按钮 */}
        {handleDismiss && (
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
