// Copyright (c) 2025 左岚. All rights reserved.

import React from "react";

type NavTab = "home" | "create" | "profile";

interface BottomNavBarProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-safe">
            <div className="relative flex items-end justify-center w-full max-w-md px-4 pb-2">
                {/* 背景容器 */}
                <div className="relative flex items-center justify-around w-full bg-white rounded-full shadow-lg px-6 py-3" style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
                    {/* 左侧 - 首页 */}
                    <button
                        onClick={() => onTabChange("home")}
                        className={`flex flex-col items-center gap-1 px-6 py-1 transition-all ${activeTab === "home" ? "text-yellow-500" : "text-gray-400"}`}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <circle cx="12" cy="13" r="2" fill={activeTab === "home" ? "currentColor" : "none"} />
                        </svg>
                    </button>

                    {/* 中间占位 */}
                    <div className="w-16" />

                    {/* 右侧 - 我的 */}
                    <button
                        onClick={() => onTabChange("profile")}
                        className={`flex flex-col items-center gap-1 px-6 py-1 transition-all ${activeTab === "profile" ? "text-yellow-500" : "text-gray-400"}`}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                            <path d="M8 22h8" strokeWidth="3" />
                        </svg>
                    </button>
                </div>

                {/* 中间突出的黄色按钮 */}
                <button
                    onClick={() => onTabChange("create")}
                    className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 bg-yellow-400 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 hover:bg-yellow-300"
                    style={{ boxShadow: "0 4px 15px rgba(250, 204, 21, 0.4)" }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
            </div>
        </nav>
    );
};

export default BottomNavBar;
