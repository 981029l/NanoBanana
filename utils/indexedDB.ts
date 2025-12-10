// Copyright (c) 2025 左岚. All rights reserved.

import type { GenerationHistory } from '../types';

const DB_NAME = 'NanoBananaDB';
const DB_VERSION = 1;
const STORE_NAME = 'generationHistory';
const PROMPT_STORE_NAME = 'promptHistory';

/**
 * IndexedDB 数据库管理类
 */
class IndexedDBManager {
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建生成历史存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('📦 创建 generationHistory 存储');
        }

        // 创建提示词历史存储
        if (!db.objectStoreNames.contains(PROMPT_STORE_NAME)) {
          const promptStore = db.createObjectStore(PROMPT_STORE_NAME, { autoIncrement: true });
          promptStore.createIndex('prompt', 'prompt', { unique: false });
          console.log('📦 创建 promptHistory 存储');
        }
      };
    });
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('数据库初始化失败');
    }
    return this.db;
  }

  /**
   * 保存生成历史记录
   */
  async saveGenerationHistory(history: GenerationHistory): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(history);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有生成历史记录（按时间倒序）
   */
  async getAllGenerationHistory(limit?: number): Promise<GenerationHistory[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // 倒序

      const results: GenerationHistory[] = [];
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && (!limit || count < limit)) {
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除指定的生成历史记录
   */
  async deleteGenerationHistory(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有生成历史记录
   */
  async clearGenerationHistory(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 保存提示词历史
   */
  async savePromptHistory(prompts: string[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PROMPT_STORE_NAME);
      
      // 先清空
      store.clear();
      
      // 再保存
      prompts.forEach(prompt => {
        store.add({ prompt, timestamp: Date.now() });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 获取提示词历史
   */
  async getPromptHistory(limit: number = 10): Promise<string[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PROMPT_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as Array<{ prompt: string; timestamp: number }>;
        // 按时间倒序排列，取最新的 limit 条
        const prompts = results
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit)
          .map(item => item.prompt);
        resolve(prompts);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取数据库使用情况（估算）
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number; usageInMB: string; quotaInMB: string }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usage,
        quota,
        usageInMB: (usage / (1024 * 1024)).toFixed(2),
        quotaInMB: (quota / (1024 * 1024)).toFixed(2),
      };
    }
    return { usage: 0, quota: 0, usageInMB: '0', quotaInMB: '0' };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 IndexedDB 连接已关闭');
    }
  }
}

// 导出单例
export const dbManager = new IndexedDBManager();

/**
 * 从 localStorage 迁移数据到 IndexedDB
 */
export const migrateFromLocalStorage = async (): Promise<{ success: boolean; migratedCount: number }> => {
  try {
    console.log('🔄 开始从 localStorage 迁移数据...');
    
    // 迁移生成历史
    const generationHistoryKey = 'nano-banana-generation-history';
    const localData = localStorage.getItem(generationHistoryKey);
    let migratedCount = 0;
    
    if (localData) {
      const histories: GenerationHistory[] = JSON.parse(localData);
      console.log(`📦 发现 ${histories.length} 条历史记录`);
      
      for (const history of histories) {
        await dbManager.saveGenerationHistory(history);
        migratedCount++;
      }
      
      // 迁移成功后删除 localStorage 数据
      localStorage.removeItem(generationHistoryKey);
      console.log(`✅ 成功迁移 ${migratedCount} 条历史记录`);
    }
    
    // 迁移提示词历史
    const promptHistoryKey = 'nano-banana-prompt-history';
    const promptData = localStorage.getItem(promptHistoryKey);
    
    if (promptData) {
      const prompts: string[] = JSON.parse(promptData);
      await dbManager.savePromptHistory(prompts);
      localStorage.removeItem(promptHistoryKey);
      console.log(`✅ 成功迁移 ${prompts.length} 条提示词历史`);
    }
    
    return { success: true, migratedCount };
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    return { success: false, migratedCount: 0 };
  }
};
