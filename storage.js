const DB_NAME = 'neumann_os_db';
const DB_VERSION = 1;
const STORE_KEYS = ['concepts', 'edges', 'attempts', 'sessions', 'meta'];

const emptyDataset = () => ({
  concepts: [],
  edges: [],
  attempts: [],
  sessions: [],
  meta: { updatedAt: new Date().toISOString() }
});

export class Storage {
  constructor() {
    this.mode = 'idb';
    this.db = null;
    this.mem = emptyDataset();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!('indexedDB' in window)) {
      this.mode = 'localStorage';
      this.mem = this._loadLocal();
      this.initialized = true;
      return;
    }
    try {
      this.db = await this._openDB();
      this.mem = await this._loadIDBAll();
    } catch (err) {
      console.warn('IndexedDB unavailable. fallback localStorage', err);
      this.mode = 'localStorage';
      this.mem = this._loadLocal();
    }
    this.initialized = true;
  }

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORE_KEYS.forEach((k) => {
          if (!db.objectStoreNames.contains(k)) db.createObjectStore(k);
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _loadIDBAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_KEYS, 'readonly');
      const result = emptyDataset();
      let left = STORE_KEYS.length;
      STORE_KEYS.forEach((k) => {
        const req = tx.objectStore(k).get('data');
        req.onsuccess = () => {
          if (req.result) result[k] = req.result;
          left -= 1;
          if (left === 0) resolve(result);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  _saveIDBAll(data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_KEYS, 'readwrite');
      STORE_KEYS.forEach((k) => {
        tx.objectStore(k).put(data[k], 'data');
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  _loadLocal() {
    const raw = localStorage.getItem(DB_NAME);
    if (!raw) return emptyDataset();
    try {
      const parsed = JSON.parse(raw);
      return { ...emptyDataset(), ...parsed };
    } catch (err) {
      console.warn('localStorage parse error', err);
      return emptyDataset();
    }
  }

  _saveLocal(data) {
    localStorage.setItem(DB_NAME, JSON.stringify(data));
  }

  async _persist() {
    this.mem.meta.updatedAt = new Date().toISOString();
    if (this.mode === 'idb') {
      await this._saveIDBAll(this.mem);
    } else {
      this._saveLocal(this.mem);
    }
  }

  _clone() {
    return JSON.parse(JSON.stringify(this.mem));
  }

  async getAll() {
    await this.init();
    return this._clone();
  }

  async replaceAll(payload) {
    await this.init();
    this.mem = { ...emptyDataset(), ...payload };
    await this._persist();
  }

  async addConcept(concept) {
    await this.init();
    this.mem.concepts.push(concept);
    await this._persist();
    return concept;
  }

  async updateConcept(id, patch) {
    await this.init();
    const idx = this.mem.concepts.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    this.mem.concepts[idx] = { ...this.mem.concepts[idx], ...patch, updatedAt: new Date().toISOString() };
    await this._persist();
    return this.mem.concepts[idx];
  }

  async deleteConcept(id) {
    await this.init();
    this.mem.concepts = this.mem.concepts.filter((c) => c.id !== id);
    this.mem.edges = this.mem.edges.filter((e) => e.fromConceptId !== id && e.toConceptId !== id);
    await this._persist();
  }

  async addEdge(edge) {
    await this.init();
    this.mem.edges.push(edge);
    await this._persist();
    return edge;
  }

  async deleteEdge(id) {
    await this.init();
    this.mem.edges = this.mem.edges.filter((e) => e.id !== id);
    await this._persist();
  }

  async addAttempt(attempt) {
    await this.init();
    this.mem.attempts.push(attempt);
    await this._persist();
    return attempt;
  }

  async addSession(session) {
    await this.init();
    this.mem.sessions.push(session);
    await this._persist();
    return session;
  }
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
