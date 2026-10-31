/* Tiện ích chung: định danh, chuỗi, số, bộ sinh số ngẫu nhiên xác định (seed). */
(function (g) {
  const U = {};

  U.uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 9);

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Chuẩn hóa để so sánh: bỏ dấu, chữ thường, gọn khoảng trắng. */
  U.fold = (s) =>
    String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();

  /** Đọc số kiểu Việt Nam (0,25) hoặc kiểu quốc tế (0.25). Trả NaN nếu không đọc được. */
  U.num = (s) => {
    if (typeof s === 'number') return s;
    const t = String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.');
    const m = t.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  };

  U.round2 = (n) => Math.round(n * 100) / 100;
  U.fmt = (n) => (n == null || isNaN(n) ? '' : String(U.round2(n)).replace('.', ','));
  U.same = (a, b) => Math.abs(a - b) < 0.0051;

  U.roman = (n) => {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
    return r;
  };
  U.fromRoman = (s) => {
    const v = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let t = 0;
    s = String(s).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const a = v[s[i]] || 0, b = v[s[i + 1]] || 0;
      t += a < b ? -a : a;
    }
    return t;
  };

  /* ---- Bộ sinh số ngẫu nhiên có seed (mulberry32) ---- */
  U.rng = (seed) => {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = (...parts) => {
    let h = 2166136261;
    const s = parts.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.shuffle = (arr, rnd) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.factorial = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

  U.letters = 'ABCDEFGH';

  /* ---- Ảnh: đọc kích thước từ dữ liệu base64 (PNG/JPEG/GIF) ---- */
  U.dataUriInfo = (src) => {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(src || '');
    if (!m) return null;
    return { type: m[1].toLowerCase(), b64: m[2] };
  };
  U.b64ToBytes = (b64) => {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  };
  U.imageSize = (src) => {
    const info = U.dataUriInfo(src);
    if (!info) return null;
    const b = U.b64ToBytes(info.b64.slice(0, 120000 * 4 / 3));
    try {
      if (info.type === 'image/png') {
        return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
      }
      if (info.type === 'image/gif') return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
      if (info.type === 'image/jpeg' || info.type === 'image/jpg') {
        let i = 2;
        while (i < b.length) {
          if (b[i] !== 0xff) { i++; continue; }
          const mk = b[i + 1];
          if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
            return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
          }
          i += 2 + ((b[i + 2] << 8) | b[i + 3]);
        }
      }
    } catch (e) { /* bỏ qua */ }
    return null;
  };

  g.U = U;
  if (typeof module !== 'undefined') module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
