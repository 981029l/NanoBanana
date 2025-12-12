// Copyright (c) 2025 左岚. All rights reserved.

import type { XiaohongshuNote } from "../types";

const DB_NAME = "XiaohongshuNoteDB";
const DB_VERSION = 1;
const STORE_NAME = "notes";

class NoteStorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; resolve(); };
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("DB init failed");
    return this.db;
  }

  async save(note: XiaohongshuNote): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      tx.objectStore(STORE_NAME).put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(limit: number = 20): Promise<XiaohongshuNote[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readonly");
      const index = tx.objectStore(STORE_NAME).index("timestamp");
      const request = index.openCursor(null, "prev");
      const results: XiaohongshuNote[] = [];
      let count = 0;
      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor && count < limit) { results.push(cursor.value); count++; cursor.continue(); }
        else resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const noteStorage = new NoteStorageManager();
