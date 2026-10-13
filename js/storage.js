// Persistence layer: File System Access API folder (preferred) with
// localStorage mirroring as a fallback/cache, plus manual export/import.

const STORAGE_DB_NAME = "stats-viewer-db";
const STORAGE_STORE_NAME = "handles";
const STORAGE_HANDLE_KEY = "dataDir";
const STORAGE_FILE_NAME = "players-data.json";
const STORAGE_LOCAL_KEY = "statsViewerPlayers";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STORAGE_DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORAGE_STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORAGE_STORE_NAME, "readonly");
    const req = tx.objectStore(STORAGE_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORAGE_STORE_NAME, "readwrite");
    tx.objectStore(STORAGE_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const DataStore = {
  _dirHandle: null,
  supportsFileSystemAccess: "showDirectoryPicker" in window,

  async init() {
    if (!this.supportsFileSystemAccess) return;
    try {
      const handle = await idbGet(STORAGE_HANDLE_KEY);
      if (handle) {
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          this._dirHandle = handle;
        } else {
          this._pendingHandle = handle;
        }
      }
    } catch (e) {
      console.warn("Could not restore folder handle", e);
    }
  },

  get isConnected() {
    return !!this._dirHandle;
  },

  get folderName() {
    return this._dirHandle ? this._dirHandle.name : "";
  },

  get needsReconnect() {
    return !this._dirHandle && !!this._pendingHandle;
  },

  async connectFolder() {
    if (!this.supportsFileSystemAccess)
      throw new Error("File System Access API not supported in this browser.");
    // Request readwrite mode directly in the picker call - some browsers/managed
    // devices silently deny a *separate* requestPermission() call made afterward,
    // even from a real click. Asking for it up front avoids that failure mode.
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      perm = await handle.requestPermission({ mode: "readwrite" });
    }
    if (perm !== "granted") {
      throw new Error(
        "This browser (or a company security policy) blocked write access to that folder. Try a different folder, or use Export/Import instead.",
      );
    }
    this._dirHandle = handle;
    this._pendingHandle = null;
    await idbSet(STORAGE_HANDLE_KEY, handle);
  },

  async reconnectFolder() {
    if (!this._pendingHandle) return false;
    const perm = await this._pendingHandle.requestPermission({
      mode: "readwrite",
    });
    if (perm !== "granted") return false;
    this._dirHandle = this._pendingHandle;
    this._pendingHandle = null;
    return true;
  },

  async load() {
    if (this._dirHandle) {
      try {
        const fileHandle = await this._dirHandle.getFileHandle(
          STORAGE_FILE_NAME,
          { create: false },
        );
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        localStorage.setItem(STORAGE_LOCAL_KEY, text);
        return data.players || [];
      } catch (e) {
        // File doesn't exist yet in the connected folder - fall through to cache.
      }
    }
    const cached = localStorage.getItem(STORAGE_LOCAL_KEY);
    if (cached) {
      try {
        return JSON.parse(cached).players || [];
      } catch (e) {
        console.warn("Cached data was corrupt", e);
      }
    }
    return [];
  },

  async save(players) {
    const data = { version: 1, players };
    const text = JSON.stringify(data, null, 2);
    localStorage.setItem(STORAGE_LOCAL_KEY, text);
    if (this._dirHandle) {
      const fileHandle = await this._dirHandle.getFileHandle(
        STORAGE_FILE_NAME,
        { create: true },
      );
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    }
  },

  exportJson(players) {
    const data = { version: 1, players };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = STORAGE_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  },

  importJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data.players || []);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },
};
