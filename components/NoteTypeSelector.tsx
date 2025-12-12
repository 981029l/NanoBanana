// Copyright (c) 2025 左岚. All rights reserved.

import React from "react";
import type { NoteType, NoteTemplate } from "../types";

const NOTE_TEMPLATES: NoteTemplate[] = [
    { type: "recommend", label: "种草推荐", icon: "💝", description: "好物分享，让人想买", promptHint: "推荐什么产品？有什么亮点？" },
    { type: "review", label: "真实测评", icon: "🔍", description: "客观分析优缺点", promptHint: "测评什么？使用感受如何？" },
    { type: "tutorial", label: "教程攻略", icon: "📚", description: "干货满满的教学", promptHint: "教什么技能？有哪些步骤？" },
    { type: "daily", label: "日常分享", icon: "🌸", description: "轻松的生活记录", promptHint: "分享什么日常？心情如何？" },
    { type: "food", label: "美食探店", icon: "🍜", description: "好吃的都在这", promptHint: "什么美食？在哪吃的？味道如何？" },
    { type: "travel", label: "旅行攻略", icon: "✈️", description: "说走就走的旅行", promptHint: "去哪玩？有什么推荐？" },
    { type: "fashion", label: "穿搭时尚", icon: "👗", description: "今日OOTD", promptHint: "什么风格？搭配技巧？" },
    { type: "custom", label: "自由创作", icon: "✨", description: "随心所欲写", promptHint: "想写什么就写什么" },
];

interface NoteTypeSelectorProps {
    selected: NoteType;
    onSelect: (type: NoteType) => void;
}

const NoteTypeSelector: React.FC<NoteTypeSelectorProps> = ({ selected, onSelect }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {NOTE_TEMPLATES.map((template) => (
                <button
                    key={template.type}
                    onClick={() => onSelect(template.type)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${selected === template.type
                        ? "border-pink-500 bg-pink-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-pink-300 hover:bg-pink-50/50"
                        }`}
                >
                    <div className="text-2xl mb-1">{template.icon}</div>
                    <div className={`text-xs font-medium ${selected === template.type ? "text-pink-600" : "text-slate-600"}`}>
                        {template.label}
                    </div>
                </button>
            ))}
        </div>
    );
};

export { NOTE_TEMPLATES };
export default NoteTypeSelector;
