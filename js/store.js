/* Lưu dữ liệu phiên làm việc trong trình duyệt (IndexedDB) để chuyển bước không phải nhập lại,
   và xuất/nhập "dự án" (.json) để tạo lại đúng bộ mã đề. Dữ liệu không rời khỏi máy người dùng. */
(function (g) {
  const Store = { state: null };
  const DB = 'tron-de-kiem-tra', KV = 'kv', KEY = 'session';

  Store.defaults = () => ({
    v: 1,
    step: 2,
    meta: Doc.defaultMeta(),
    matrix: { rows: [], confirmed: false, source: '', auto: true },
    exam: null,
    config: {
      count: 3, startCode: 101, codes: ['101', '102', '103'],
      shuffleQ: true, shuffleOpt: true, keepParts: true, tfShuffle: false, withinLevel: false, balanceAnswers: true,
      seed: Math.floor(Math.random() * 2147483646) + 1,
    },
    result: null,
  });

  function open() {
    return new Promise((resolve, reject) => {
      if (!g.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(KV);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const idb = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KV, mode);
      const r = fn(tx.objectStore(KV));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  };

  Store.load = async () => {
    try {
      const saved = await idb('readonly', (s) => s.get(KEY));
      if (saved && saved.v === 1) {
        Store.state = Object.assign(Store.defaults(), saved);
        Store.state.config = Object.assign(Store.defaults().config, saved.config);
        Store.state.meta = Object.assign(Doc.defaultMeta(), saved.meta);
        return true;
      }
    } catch (e) { /* trình duyệt chặn lưu trữ: vẫn dùng được, chỉ không nhớ phiên */ }
    Store.state = Store.defaults();
    return false;
  };

  let timer = null;
  Store.save = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await idb('readwrite', (s) => s.put(JSON.parse(JSON.stringify(Store.state)), KEY)); Store.saveError = false; } catch (e) { Store.saveError = true; }
    }, 400);
  };

  Store.clear = async () => {
    try { await idb('readwrite', (s) => s.delete(KEY)); } catch (e) { /* bỏ qua */ }
    Store.state = Store.defaults();
  };

  Store.exportProject = () => JSON.stringify({ app: 'tron-de-kiem-tra', exportedAt: new Date().toISOString(), state: Store.state }, null, 1);
  Store.importProject = (text) => {
    const o = JSON.parse(text);
    if (!o || o.app !== 'tron-de-kiem-tra' || !o.state) throw new Error('Tệp không phải dự án của website Trộn đề kiểm tra.');
    Store.state = Object.assign(Store.defaults(), o.state);
    return Store.state;
  };

  g.Store = Store;
})(window);
