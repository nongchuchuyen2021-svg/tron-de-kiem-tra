/* Ma trận đề kiểm tra: nhận dạng từ bảng/văn bản, chuẩn hóa, kiểm tra tính hợp lệ.
   Một dòng ma trận: {id, part, type, topic, level, count, points, positions}
     - count: số câu;  points: tổng điểm của dòng;  positions: vị trí câu (vd "1-4, 7"), có thể để trống. */
(function (g) {
  const M = {};

  M.TYPES = { mcq: 'Trắc nghiệm nhiều lựa chọn', tf: 'Trắc nghiệm đúng/sai', short: 'Trả lời ngắn', essay: 'Tự luận' };
  M.TYPE_SHORT = { mcq: 'Nhiều lựa chọn', tf: 'Đúng/sai', short: 'Trả lời ngắn', essay: 'Tự luận' };

  /** Nhận dạng dạng câu hỏi từ một đoạn văn bản (tiêu đề phần, cột "Dạng"...). */
  M.detectType = (text) => {
    const t = U.fold(text);
    if (!t) return null;
    if (/dung\s*\/?\s*sai|dung hoac sai|\by a\)|moi y a/.test(t)) return 'tf';
    if (/tra loi ngan/.test(t)) return 'short';
    if (/tu luan/.test(t)) return 'essay';
    if (/nhieu lua chon|nhieu phuong an|chon mot phuong an|chi chon mot|\bmcq\b/.test(t)) return 'mcq';
    if (/trac nghiem/.test(t)) return 'mcq';
    return null;
  };

  const LEVEL_NAMES = ['nhan biet', 'biet', 'thong hieu', 'hieu', 'van dung cao', 'van dung', 'nb', 'th', 'vd', 'vdc'];
  const isLevelHeader = (c) => LEVEL_NAMES.includes(U.fold(c).replace(/[()\s]*$/, ''));

  const HEAD_KEYS = [
    ['perq', /diem\s*(\/|moi|mot|tung)\s*cau|diem moi cau|diem\/cau/],
    ['points', /^(tong )?diem$|^diem( so)?$|tong diem/],
    ['count', /so cau|so luong|so y/],
    ['positions', /vi tri|cau so|^stt cau|thu tu cau|so thu tu/],
    ['level', /muc do|^muc$/],
    ['topic', /chu de|noi dung|don vi kien thuc|kien thuc|^bai$|chuong|^bai hoc/],
    ['type', /^dang|loai cau|dang cau|hinh thuc/],
    ['part', /^phan$|^phan |^part/],
  ];

  function headKey(cell) {
    const t = U.fold(cell);
    if (!t) return null;
    for (const [k, re] of HEAD_KEYS) if (re.test(t)) return k;
    return null;
  }

  /** Đọc chuỗi vị trí "1-4, 7, 9" thành mảng số. */
  M.parsePositions = (s) => {
    const out = [];
    String(s || '')
      .split(/[;,\s]+/)
      .forEach((tok) => {
        const m = tok.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
        if (m) { for (let i = +m[1]; i <= +m[2] && i < 1000; i++) out.push(i); }
        else if (/^\d+$/.test(tok)) out.push(+tok);
      });
    return out;
  };

  M.newRow = (o) => Object.assign({ id: U.uid('m'), part: '', type: 'mcq', topic: '', level: '', count: 1, points: 0, positions: '' }, o || {});

  /** Ma trận theo mẫu CV 7991/5512: tiêu đề nhiều tầng (TNKQ → Nhiều lựa chọn / Đúng-Sai / Trả lời ngắn / Tự luận,
      mỗi dạng có 3 cột Biết–Hiểu–Vận dụng). Ô gộp đã được bung ra. Trả về null nếu bảng không có dạng này. */
  function fromMultiHeader(rows) {
    let lr = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) if (rows[i].filter(isLevelHeader).length >= 6) { lr = i; break; }
    if (lr < 1) return null;
    const typeOf = (txt) => {
      const t = U.fold(txt);
      if (/\btong\b/.test(t)) return 'sum';
      if (/dung\W*sai/.test(t)) return 'tf';
      if (/tra loi ngan/.test(t)) return 'short';
      if (/tu luan/.test(t)) return 'essay';
      if (/nhieu lua chon|nhieu phuong an/.test(t)) return 'mcq';
      return null;
    };
    const levelCols = [];
    rows[lr].forEach((c, i) => {
      if (!isLevelHeader(c)) return;
      let type = null;
      for (let r = lr - 1; r >= 0 && !type; r--) type = typeOf(rows[r][i] || '');
      if (type && type !== 'sum') levelCols.push({ i, type, name: c.replace(/[()]/g, '').trim() });
    });
    if (levelCols.length < 3) return null;
    const firstLv = Math.min(...levelCols.map((x) => x.i));
    const topicCols = [];
    for (let i = 0; i < firstLv; i++) {
      const h = U.fold(rows.slice(0, lr).map((r) => r[i] || '').join(' '));
      if (/chu de|chuong/.test(h) && !topicCols.some((x) => x.kind === 'cd')) topicCols.push({ i, kind: 'cd' });
      else if (/noi dung|don vi|kien thuc/.test(h)) topicCols.push({ i, kind: 'unit' });
    }
    if (!topicCols.length) return null;
    const topicCol = (topicCols.find((x) => x.kind === 'cd') || topicCols[0]).i;

    // điểm mỗi câu (ý) của từng dạng: lấy từ dòng "Tổng số điểm" / "Tổng số câu" nếu có
    let ptsRow = null, cntRow = null;
    rows.forEach((r, i) => {
      if (i <= lr) return;
      const f = U.fold(r.find(Boolean) || '');
      if (/^tong so diem/.test(f)) ptsRow = r;
      else if (/^tong so cau/.test(f)) cntRow = r;
    });
    const perUnit = {};
    ['mcq', 'tf', 'short', 'essay'].forEach((ty) => {
      const cols = levelCols.filter((x) => x.type === ty);
      if (!cols.length) return;
      const units = cntRow ? U.sum(cols, (c) => Math.max(0, U.num(cntRow[c.i]) || 0)) : 0;
      const pts = ptsRow ? Math.max(0, U.num(ptsRow[cols[0].i]) || 0) : 0;
      perUnit[ty] = units > 0 && pts > 0 ? pts / units : { mcq: 0.25, tf: 0.25, short: 0.5, essay: 0 }[ty];
    });

    const warnings = [];
    const acc = new Map();
    for (let r = lr + 1; r < rows.length; r++) {
      const cells = rows[r];
      const first = U.fold(cells.find(Boolean) || '');
      if (!first) continue;
      if (/^(tong|cong|ty le)\b/.test(first)) break;
      const topic = cells[topicCol] || cells[topicCols[0].i] || '';
      if (!topic) continue;
      levelCols.forEach((lc) => {
        const n = U.num(cells[lc.i]);
        if (!(n > 0)) return;
        const k = lc.type + '|' + U.fold(topic);
        if (!acc.has(k)) acc.set(k, { type: lc.type, topic, lv: {} });
        const a = acc.get(k);
        a.lv[lc.name] = (a.lv[lc.name] || 0) + n;
      });
    }
    const rank = (n) => { const f = U.fold(n); return /cao/.test(f) ? 4 : /^(van dung|vd)/.test(f) ? 3 : /^(hieu|thong hieu|th)$/.test(f) ? 2 : 1; };
    const out = [];
    let tfNote = false;
    acc.forEach((a) => {
      const entries = Object.entries(a.lv);
      if (a.type === 'tf') {
        // ô Đúng/Sai trong ma trận là số Ý (4 ý = 1 câu): gộp theo chủ đề, mức độ lấy mức có nhiều ý nhất
        const yTot = U.sum(entries, (e) => e[1]);
        const best = entries.slice().sort((x, y) => y[1] - x[1] || rank(y[0]) - rank(x[0]))[0][0];
        const count = U.round2(yTot / 4);
        if (Math.abs(count - Math.round(count)) > 1e-6) warnings.push(`Đúng/Sai "${a.topic}": ${yTot} ý chưa chia hết cho 4 (= ${count} câu). Hãy chỉnh lại số câu.`);
        tfNote = true;
        out.push(M.newRow({ part: '', type: 'tf', topic: a.topic, level: best, count, points: U.round2(yTot * perUnit.tf) }));
      } else {
        entries.sort((x, y) => rank(x[0]) - rank(y[0])).forEach(([lvl, n]) => out.push(M.newRow({ part: '', type: a.type, topic: a.topic, level: lvl, count: n, points: U.round2(n * perUnit[a.type]) })));
      }
    });
    const order = { mcq: 0, tf: 1, short: 2, essay: 3 };
    out.sort((x, y) => order[x.type] - order[y.type]);
    if (tfNote) warnings.push('Ma trận ghi câu Đúng/Sai theo số ý: web đã đổi 4 ý = 1 câu và gộp các mức độ của cùng chủ đề (lấy mức có nhiều ý nhất). Hãy kiểm tra lại.');
    if (!out.length) return { rows: [], warnings: ['Đã nhận ra bảng ma trận nhưng không có ô số câu nào > 0.'] };
    M.normalizeParts(out);
    return { rows: out, warnings };
  }

  /** Chuyển bảng 2 chiều (mảng các mảng ô) thành các dòng ma trận. */
  M.fromTable = (table) => {
    const warnings = [];
    const rows = (table || []).map((r) => r.map((c) => String(c == null ? '' : c).replace(/\s+/g, ' ').trim()));
    const multi = fromMultiHeader(rows);
    if (multi) return multi;
    // 1) tìm dòng tiêu đề
    let hi = -1, best = 0;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const keys = rows[i].map(headKey).filter(Boolean);
      const lv = rows[i].filter(isLevelHeader).length;
      const score = new Set(keys).size + (lv ? 2 : 0);
      if (score > best) { best = score; hi = i; }
    }
    if (hi < 0 || best < 2) return { rows: [], warnings: ['Không tìm thấy dòng tiêu đề cột của ma trận (cần các cột như Chủ đề, Mức độ, Số câu, Điểm).'] };
    const head = rows[hi];
    // tiêu đề có thể nằm trên 2 dòng (dòng trên là nhóm "Mức độ", dòng dưới là Biết/Hiểu/Vận dụng)
    let levelCols = [];
    const scanLevels = (r) => r.forEach((c, i) => { if (isLevelHeader(c)) levelCols.push({ i, name: c.replace(/[()]/g, '').trim() }); });
    scanLevels(head);
    if (levelCols.length < 2) levelCols = [];
    let dataStart = hi + 1;
    if (!levelCols.length && rows[hi + 1] && !rows[hi + 1].some((c) => /^d+([.,]d+)?$/.test(c))) {
      scanLevels(rows[hi + 1]);
      if (levelCols.length >= 2) dataStart = hi + 2; else levelCols = [];
    }
    const col = {};
    head.forEach((c, i) => { const k = headKey(c); if (k && col[k] == null) col[k] = i; });
    // ghép tiêu đề dòng dưới nếu có (vd "Số câu", "Điểm" ở dòng 2)
    if (dataStart === hi + 2) rows[hi + 1].forEach((c, i) => { const k = headKey(c); if (k && col[k] == null) col[k] = i; });
    const wide = levelCols.length > 0 && col.level == null;

    const out = [];
    let curPart = '', curType = null, curTopic = '', curLevel = '', sectionType = null;
    let partCount = 0;
    const partOf = (label, type) => {
      if (label) return label;
      return '';
    };
    for (let r = dataStart; r < rows.length; r++) {
      const cells = rows[r];
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) continue;
      const first = U.fold(nonEmpty[0]);
      if (/^(tong|cong|ty le|tong cong)\b/.test(first)) continue; // dòng tổng
      // dòng tiêu đề phần: chỉ có một ô có nội dung hoặc ô đầu dạng "Phần I..."
      const looksSection = (nonEmpty.length === 1 || (nonEmpty.length <= 2 && !cells.some((c) => /^\d+([.,]\d+)?$/.test(c)))) && /^(phan|i{1,3}v?|iv|v)\b[.)\s:]/i.test(nonEmpty[0] + ' ');
      if (looksSection) {
        const label = (nonEmpty[0].match(/^(ph[aầ]n\s+[IVX\d]+)/i) || [])[1];
        curPart = label ? label.replace(/^ph[aầ]n/i, 'Phần') : curPart;
        sectionType = M.detectType(nonEmpty.join(' ')) || sectionType;
        curType = sectionType;
        continue;
      }
      const get = (k) => (col[k] != null ? cells[col[k]] || '' : '');
      const pCell = get('part');
      if (pCell) { curPart = pCell; const t = M.detectType(pCell); if (t) curType = t; }
      const tCell = get('type');
      if (tCell) { curType = M.detectType(tCell) || curType; }
      const topic = get('topic');
      if (topic) curTopic = topic;
      const posStr = get('positions');
      const pts = U.num(get('points'));
      const perq = U.num(get('perq'));

      if (wide) {
        const rowTotal = U.sum(levelCols, (lc) => { const n = U.num(cells[lc.i]); return n > 0 ? n : 0; });
        let any = false;
        levelCols.forEach((lc) => {
          const n = U.num(cells[lc.i]);
          if (!(n > 0)) return;
          any = true;
          let points = 0;
          if (perq > 0) points = perq * n;
          else if (pts > 0 && rowTotal > 0) points = (pts * n) / rowTotal;
          out.push(M.newRow({ part: curPart, type: curType || 'mcq', topic: curTopic, level: lc.name, count: n, points: U.round2(points), positions: '', _noType: !curType }));
        });
        if (!any && nonEmpty.length > 1 && topic) warnings.push(`Dòng "${topic}" không có số câu ở các cột mức độ.`);
      } else {
        const level = get('level');
        if (level) curLevel = level;
        let count = U.num(get('count'));
        const positions = posStr;
        if (!(count > 0) && positions) count = M.parsePositions(positions).length;
        if (!(count > 0)) {
          if (nonEmpty.length > 1) warnings.push(`Bỏ qua dòng "${nonEmpty.join(' | ').slice(0, 60)}": không đọc được số câu.`);
          continue;
        }
        let points = pts;
        if (!(points >= 0) || isNaN(points)) points = perq > 0 ? perq * count : 0;
        out.push(M.newRow({ part: curPart, type: curType || 'mcq', topic: curTopic, level: curLevel || level, count, points: U.round2(points), positions: String(positions || ''), _noType: !curType }));
      }
    }
    if (out.some((x) => x._noType)) warnings.push('Không xác định được dạng câu hỏi ở một số dòng (đang tạm đặt là "Nhiều lựa chọn"). Hãy kiểm tra cột "Dạng".');
    out.forEach((x) => delete x._noType);
    if (out.some((x) => !x.points)) warnings.push('Một số dòng chưa có điểm. Hãy nhập điểm vào bảng.');
    M.normalizeParts(out);
    return { rows: out, warnings };
  };

  /** Điền tên phần còn thiếu theo thứ tự xuất hiện của từng dạng câu. */
  M.normalizeParts = (rows) => {
    const seen = [];
    rows.forEach((r) => {
      const label = (r.part || '').trim();
      const key = label || 'type:' + r.type;
      if (!seen.includes(key)) seen.push(key);
    });
    rows.forEach((r) => {
      if (!r.part || !r.part.trim()) r.part = 'Phần ' + U.roman(seen.indexOf('type:' + r.type) + 1);
    });
    return rows;
  };

  /** Phân tích văn bản dán vào (tách bằng Tab, | hoặc ;). */
  M.fromText = (text) => {
    const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { rows: [], warnings: ['Chưa có nội dung ma trận.'] };
    const sample = lines.slice(0, 6).join('\n');
    let sep = /\t/.test(sample) ? '\t' : /\|/.test(sample) ? '|' : /;/.test(sample) ? ';' : null;
    let table;
    if (sep) {
      table = lines
        .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)) // dòng phân cách markdown
        .map((l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(sep));
    } else {
      table = lines.map((l) => l.split(/\s{2,}/));
    }
    return M.fromTable(table);
  };

  /** Dựng ma trận trực tiếp từ đề (chế độ không cần tệp ma trận): gom câu theo phần × dạng × chủ đề × mức độ. */
  M.fromExam = (exam) => {
    const map = new Map();
    exam.questions.forEach((q) => {
      const k = [q.part, q.type, U.fold(q.topic), U.fold(q.level)].join('|');
      if (!map.has(k)) {
        const p = exam.parts.find((x) => x.id === q.part);
        map.set(k, M.newRow({ id: 'a' + map.size, part: (p && p.name) || '', type: q.type, topic: q.topic, level: q.level, count: 0, points: 0 }));
      }
      const r = map.get(k);
      r.count++;
      r.points = U.round2(r.points + (+q.points || 0));
    });
    return [...map.values()];
  };

  M.totals = (rows) => {
    const t = { count: 0, points: 0, byType: {}, parts: [] };
    rows.forEach((r) => {
      const c = +r.count || 0, p = +r.points || 0;
      t.count += c; t.points += p;
      const b = (t.byType[r.type] = t.byType[r.type] || { count: 0, points: 0 });
      b.count += c; b.points += p;
      if (!t.parts.includes(r.part)) t.parts.push(r.part);
    });
    t.points = U.round2(t.points);
    return t;
  };

  /** Khóa nhóm tiêu chí: dạng | chủ đề | mức độ (đã chuẩn hóa). */
  M.key = (type, topic, level) => [type, U.fold(topic), U.fold(level)].join('|');
  M.keyOf = (r) => M.key(r.type, r.topic, r.level);

  /** Gộp các dòng ma trận cùng khóa (cùng dạng, chủ đề, mức độ). */
  M.groups = (rows) => {
    const map = new Map();
    rows.forEach((r) => {
      const k = M.keyOf(r);
      if (!map.has(k)) map.set(k, { key: k, type: r.type, topic: r.topic, level: r.level, part: r.part, count: 0, points: 0, positions: [], rowIds: [] });
      const g1 = map.get(k);
      g1.count += +r.count || 0;
      g1.points += +r.points || 0;
      g1.positions.push(...M.parsePositions(r.positions));
      g1.rowIds.push(r.id);
    });
    return [...map.values()];
  };

  /** Kiểm tra bản thân ma trận. Trả về danh sách vấn đề {level:'error'|'warn', text}. */
  M.validate = (rows) => {
    const issues = [];
    if (!rows.length) { issues.push({ level: 'error', text: 'Ma trận chưa có dòng nào.' }); return issues; }
    const posSeen = new Map();
    rows.forEach((r, i) => {
      const where = `Dòng ${i + 1}`;
      if (!U.fold(r.topic)) issues.push({ level: 'error', text: `${where}: chưa có chủ đề.` });
      if (!U.fold(r.level)) issues.push({ level: 'error', text: `${where}: chưa có mức độ nhận thức.` });
      if (!(+r.count > 0)) issues.push({ level: 'error', text: `${where}: số câu phải lớn hơn 0.` });
      if (!(+r.points >= 0)) issues.push({ level: 'error', text: `${where}: điểm không hợp lệ.` });
      const ps = M.parsePositions(r.positions);
      if (ps.length && ps.length !== +r.count) issues.push({ level: 'error', text: `${where}: có ${ps.length} vị trí nhưng số câu là ${r.count}.` });
      ps.forEach((p) => {
        if (posSeen.has(p)) issues.push({ level: 'warn', text: `Vị trí câu ${p} xuất hiện ở nhiều dòng (dòng ${posSeen.get(p)} và ${i + 1}); chỉ hợp lệ nếu đề đánh số lại theo từng phần.` });
        else posSeen.set(p, i + 1);
      });
    });
    const t = M.totals(rows);
    if (!U.same(t.points, 10)) issues.push({ level: 'warn', text: `Tổng điểm ma trận là ${U.fmt(t.points)} (thường là 10). Hãy kiểm tra nếu đây không phải chủ ý.` });
    return issues;
  };

  g.Matrix = M;
  if (typeof module !== 'undefined') module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
