/* Đọc tệp đầu vào: Word (.docx), Excel (.xlsx/.xls/.csv), PDF có lớp văn bản, văn bản thuần.
   Không có OCR: PDF quét ảnh sẽ được báo rõ, không giả vờ nhập thành công. */
(function (g) {
  const R = {};
  R.MAX_BYTES = 25 * 1024 * 1024;

  R.ext = (name) => ((/\.([a-z0-9]+)$/i.exec(name || '') || [])[1] || '').toLowerCase();

  R.check = function (file, allowed) {
    const e = R.ext(file.name);
    if (e === 'doc') return 'Tệp .doc (Word đời cũ) chưa đọc được. Hãy mở bằng Word, chọn Lưu thành → định dạng .docx rồi tải lại.';
    if (!allowed.includes(e)) return `Định dạng ".${e || '?'}" chưa được hỗ trợ ở mục này. Hãy dùng: ${allowed.map((x) => '.' + x).join(', ')} hoặc dán trực tiếp nội dung.`;
    if (file.size > R.MAX_BYTES) return `Tệp quá lớn (${(file.size / 1048576).toFixed(1)} MB). Giới hạn là ${R.MAX_BYTES / 1048576} MB. Hãy tách nhỏ hoặc nén bớt hình ảnh trong tệp.`;
    if (file.size === 0) return 'Tệp trống (0 byte). Hãy chọn đúng tệp có nội dung.';
    return null;
  };

  R.textToBlocks = (text) =>
    String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.replace(/\t+/g, '  ').trim())
      .filter(Boolean)
      .map((l) => ({ kind: 'p', html: U.esc(l), text: l }));

  /* ---------------- Word ---------------- */
  function pngFromDataUri(uri) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 400; c.height = img.naturalHeight || 300;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = uri;
    });
  }

  /** Đọc khối tiêu đề (các bảng/đoạn ở đầu đề, trước "PHẦN I"/"Câu 1") từ word/document.xml thành mô hình tài liệu,
      để các mã đề giữ đúng mẫu tiêu đề của đề gốc. Trả về null nếu không có bảng tiêu đề. */
  R.docxHeader = function (xml) {
    try {
      const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const body = doc.getElementsByTagNameNS(NS, 'body')[0];
      if (!body) return null;
      const kids = (el, name) => [...el.childNodes].filter((n) => n.nodeType === 1 && n.localName === name);
      const attr = (el, name) => (el ? el.getAttributeNS(NS, name) || el.getAttribute('w:' + name) : null);
      const first = (el, name) => kids(el, name)[0] || null;
      const on = (rpr, name) => { const e = rpr && first(rpr, name); if (!e) return false; const v = attr(e, 'val'); return v !== '0' && v !== 'false' && v !== 'nil'; };
      const textOf = (p) => [...p.getElementsByTagNameNS(NS, 't')].map((t) => t.textContent).join('');
      const TWIP_MM = 56.7;
      const para = (p) => {
        const ppr = first(p, 'pPr');
        const jc = ppr && first(ppr, 'jc');
        const sp = ppr && first(ppr, 'spacing');
        const al = jc ? attr(jc, 'val') : '';
        const runs = [];
        kids(p, 'r').forEach((r) => {
          const rpr = first(r, 'rPr');
          const s = [...r.childNodes].map((n) => (n.localName === 't' ? n.textContent : n.localName === 'tab' ? '	' : '')).join('');
          if (!s) return;
          const sz = rpr && first(rpr, 'sz');
          const run = { t: 'text', s, b: on(rpr, 'b'), i: on(rpr, 'i') };
          if (sz && +attr(sz, 'val')) run.size = +attr(sz, 'val') / 2;
          runs.push(run);
        });
        return { k: 'p', runs, align: { center: 'center', right: 'right', both: 'justify' }[al] || 'left', sb: sp ? (+attr(sp, 'before') || 0) / 20 : 0, sa: sp ? (+attr(sp, 'after') || 0) / 20 : 0 };
      };
      const table = (tbl) => {
        const grid = first(tbl, 'tblGrid');
        const cols = kids(grid, 'gridCol').map((c) => (+attr(c, 'w') || 0) / TWIP_MM);
        const rows = kids(tbl, 'tr').map((tr) => ({
          cells: kids(tr, 'tc').map((tc) => {
            const tcpr = first(tc, 'tcPr');
            const gs = tcpr && first(tcpr, 'gridSpan');
            const blocks = kids(tc, 'p').map(para);
            return Object.assign({ blocks }, gs && +attr(gs, 'val') > 1 ? { span: +attr(gs, 'val') } : {});
          }),
        }));
        return { k: 'table', border: 'none', cols, rows };
      };
      const out = [];
      let hasTable = false;
      for (const n of [...body.childNodes]) {
        if (n.nodeType !== 1) continue;
        if (n.localName === 'tbl') { out.push(table(n)); hasTable = true; continue; }
        if (n.localName !== 'p') continue;
        const t = textOf(n).trim();
        if (/^(PHẦN|Phần)\s+[IVXLC\d]+(?![A-Za-z])|^Câu\s*\d+/i.test(t)) break;
        if (t) out.push(para(n)); else if (out.length) out.push({ k: 'p', runs: [] });
      }
      while (out.length && out[out.length - 1].k === 'p' && !out[out.length - 1].runs.length) out.pop();
      return hasTable && out.length && out.length <= 12 ? out : null;
    } catch (e) { return null; }
  };

  R.readDocx = async function (file, onProgress) {
    const warnings = [];
    let header = null, fontSize = null;
    onProgress && onProgress('Đang đọc tệp Word…');
    const buf = await file.arrayBuffer();
    let data = buf;
    try {
      const zip = await JSZip.loadAsync(buf);
      const f = zip.file('word/document.xml');
      if (f) {
        let xml = await f.async('string');
        header = R.docxHeader(xml);
        fontSize = R.mainSize([...xml.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => [+m[1] / 2, 1]));
        let n = 0;
        const flat = (m) => {
          n++;
          const text = [...m.matchAll(/<m:t[^>]*>([^<]*)<\/m:t>/g)].map((x) => x[1]).join('');
          return `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
        };
        xml = xml.replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>/g, flat).replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/g, flat);
        if (n) {
          zip.file('word/document.xml', xml);
          data = await zip.generateAsync({ type: 'arraybuffer' });
          warnings.push(`Có ${n} công thức Word (Equation). Công thức được chuyển thành văn bản thuần (mất bố cục phân số, căn…). Hãy kiểm tra và sửa lại các câu có công thức.`);
        }
      }
    } catch (e) { data = buf; }
    let unsupported = 0;
    onProgress && onProgress('Đang chuyển nội dung Word sang dữ liệu câu hỏi…');
    const res = await mammoth.convertToHtml(
      { arrayBuffer: data },
      {
        styleMap: ['u => u'],
        convertImage: mammoth.images.imgElement(async (img) => {
          const b64 = await img.read('base64');
          const ct = (img.contentType || '').toLowerCase();
          const uri = `data:${ct};base64,${b64}`;
          if (/^image\/(png|jpe?g|gif)$/.test(ct)) return { src: uri };
          try { return { src: await pngFromDataUri(uri) }; } catch (e) { unsupported++; return { src: '', alt: '[hình ảnh không đọc được]' }; }
        }),
      }
    );
    if (unsupported) warnings.push(`${unsupported} hình ảnh có định dạng chưa hỗ trợ (ví dụ EMF/WMF) nên không hiển thị. Hãy chèn lại hình dưới dạng PNG/JPG trong Word.`);
    const msgs = [...new Set(res.messages.filter((m) => m.type === 'warning' && !/Unrecognised paragraph style|Unrecognised run style/.test(m.message)).map((m) => m.message))];
    if (msgs.length) warnings.push('Một số thành phần Word không đọc được (ví dụ khung văn bản, hình vẽ): ' + msgs.slice(0, 3).join('; ') + '.');
    const blocks = H.parseBlocks(res.value);
    if (!blocks.length) throw new Error('Tệp Word không có nội dung văn bản đọc được.');
    if (/<img/i.test(res.value)) warnings.push('Tệp có hình ảnh: hình được giữ cùng câu hỏi. Hãy xem lại ở danh sách câu hỏi.');
    return { blocks, warnings, html: res.value, header, fontSize };
  };

  /** Cỡ chữ chiếm nhiều nhất trong đề gốc. items: [[cỡ chữ, số ký tự]]. Trả về null nếu không xác định được. */
  R.mainSize = function (items) {
    const tally = {};
    items.forEach(([size, n]) => { if (size >= 9 && size <= 14) tally[size] = (tally[size] || 0) + n; });
    const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    return best ? +best : null;
  };

  /* ---------------- PDF ---------------- */
  /** Dựng lại khối tiêu đề (trường/tổ bên trái, tên kỳ thi/môn/thời gian bên phải, dòng họ tên – lớp – mã đề)
      từ các dòng chữ trang 1 của PDF, theo vị trí ngang. Trả về null nếu không nhận ra mẫu. */
  R.pdfHeader = function (rows, pageW) {
    const rowText = (r) => r.parts.map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim();
    const stop = rows.findIndex((r) => /^(PHẦN|Phần)\s+[IVXLC\d]+(?![A-Za-z])|^Câu\s*\d+/i.test(rowText(r)));
    const head = stop < 0 ? [] : rows.slice(0, stop).filter((r) => rowText(r));
    const idRow = head.slice().reverse().find((r) => /Họ\s*và\s*tên/i.test(rowText(r)));
    if (!idRow) return null;
    const top = head.slice(0, head.indexOf(idRow));
    const left = [], right = [];
    top.forEach((r) => {
      const l = r.parts.filter((x) => x.x + x.w / 2 < pageW * 0.5).map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim();
      const rt = r.parts.filter((x) => x.x + x.w / 2 >= pageW * 0.5).map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim();
      if (l) left.push(l);
      if (rt) right.push(rt);
    });
    if (!left.length || !right.length) return null;
    const style = (t) => ({ b: !/^\(/.test(t) && !/^Thời gian/i.test(t) && ((/[A-ZÀ-Ỵ]/.test(t) && t === t.toUpperCase()) || /^(MÔN|NĂM HỌC)/i.test(t)), i: /^\(/.test(t) || /^Thời gian/i.test(t) });
    const para = (t, align, o) => ({ k: 'p', runs: [Object.assign({ t: 'text', s: t, b: false, i: false }, o || style(t))], align, sb: 0, sa: 0 });
    const idText = rowText(idRow);
    const mm = /M[ãa]\s*đề\s*[:：]?\s*(\d{2,4})/i.exec(idText);
    const W = 56.7;
    return [
      { k: 'table', border: 'none', cols: [4900 / W, 5588 / W], rows: [{ cells: [{ blocks: left.map((t) => para(t, 'center')) }, { blocks: right.map((t) => para(t, 'center')) }] }] },
      { k: 'table', border: 'none', cols: [5200 / W, 2788 / W, 2500 / W], rows: [{ cells: [
        { blocks: [para('Họ và tên: ........................................', 'left')] },
        { blocks: [para('Lớp: ..............', 'left')] },
        { blocks: [para(mm ? 'Mã đề ' + mm[1] : 'Mã đề', 'center', { b: true, i: false })] },
      ] }] },
    ];
  };

  /** Nối lại câu bị PDF ngắt dòng: dòng trên chạy sát lề phải (từ đầu dòng dưới không còn chỗ) và dòng dưới không mở đầu mục mới.
      lines: [{s, start, end, right}] */
  R.joinWrapped = function (lines) {
    const out = [];
    lines.forEach((ln) => {
      const prev = out[out.length - 1];
      const text = ln.s.trim();
      const word = (text.split(/\s/)[0] || '').length;
      const charW = (ln.end - ln.start) / Math.max(1, text.length);
      const noRoom = prev && prev.end + (word + 1) * charW >= prev.right - 2;
      const opens = /^(?:(?:Câu|Bài|PHẦN|Phần)\s*[\dIVXLC]+|Đáp án|ĐA\b|Đ\/A|[A-Fa-f]\s*[.)]|[-–—•*<]|\d+\s*[.)])/.test(text);
      const ended = prev && (/[?!:;]$/.test(prev.s.trim()) || (/\.$/.test(prev.s.trim()) && !/^\p{Ll}/u.test(text)));
      // dòng bảng viết thành chữ (các ô cách xa nhau): chữ thưa hơn hẳn dòng văn bản, không phải câu bị ngắt
      const spread = prev && !prev.joined && (prev.end - prev.start) / Math.max(1, prev.s.trim().length) > 1.5 * charW;
      if (noRoom && !opens && !ended && !spread && !/\t/.test(ln.s) && !/\t/.test(prev.s)) {
        prev.joined = true;
        prev.s = prev.s.trimEnd() + ' ' + text;
        prev.end = ln.end;
        prev.right = ln.right;
      } else out.push(Object.assign({}, ln));
    });
    return out.map((l) => l.s);
  };

  R.readPdf = async function (file, onProgress) {
    if (typeof pdfjsLib === 'undefined') throw new Error('Thư viện đọc PDF chưa tải được.');
    const buf = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const lines = [];
    let header = null;
    const sizes = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress && onProgress(`Đang đọc PDF: trang ${p}/${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter((it) => it.str !== undefined && it.transform);
      items.forEach((it) => sizes.push([Math.round(Math.abs(it.transform[3]) * 2) / 2, it.str.length]));
      items.sort((a, b) => (Math.abs(b.transform[5] - a.transform[5]) > 3 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]));
      let cur = null;
      const rows = [];
      items.forEach((it) => {
        const y = it.transform[5], x = it.transform[4];
        if (!cur || Math.abs(cur.y - y) > 3) { cur = { y, parts: [] }; rows.push(cur); }
        cur.parts.push({ x, w: it.width || 0, s: it.str });
      });
      rows.forEach((r) => r.parts.sort((a, b) => a.x - b.x));
      if (p === 1) header = R.pdfHeader(rows, page.view[2] - page.view[0]);
      const right = Math.max(...rows.map((r) => { const l = r.parts[r.parts.length - 1]; return l.x + l.w; }));
      rows.forEach((r) => {
        let s = '';
        let prevEnd = null;
        r.parts.forEach((pt) => {
          if (prevEnd != null) {
            const gap = pt.x - prevEnd;
            if (gap > 14) s += '\t';
            else if (gap > 1.2 && !/\s$/.test(s) && !/^\s/.test(pt.s)) s += ' ';
          }
          s += pt.s;
          prevEnd = pt.x + pt.w;
        });
        if (s.trim()) lines.push({ s: s.replace(/[  ]+$/g, ''), start: r.parts[0].x, end: prevEnd, right });
      });
    }
    const clean = R.joinWrapped(lines.filter((l) => !/^\s*(Mã đề\s*\d+\s*[-–—]?\s*)?(Trang|Page)\s*\d+\s*(\/\s*\d+)?\s*$/i.test(l.s)));
    const chars = clean.join('').replace(/\s/g, '').length;
    if (chars < 20 * pdf.numPages) {
      throw new Error('PDF này không có lớp văn bản (có thể là bản quét/ảnh chụp). Website chưa hỗ trợ nhận dạng chữ (OCR). Hãy dùng tệp Word (.docx) hoặc dán nội dung vào ô văn bản.');
    }
    const rawText = clean.join('\n');
    return {
      blocks: R.textToBlocks(rawText),
      rawText,
      header,
      fontSize: R.mainSize(sizes),
      warnings: ['Đọc từ PDF: hình ảnh, bảng biểu và công thức không được trích xuất. Nếu đề có hình/bảng, hãy dùng tệp Word (.docx).'],
    };
  };

  /* ---------------- Excel / CSV ---------------- */
  R.readSheets = async function (file) {
    const e = R.ext(file.name);
    let wb;
    if (e === 'csv') wb = XLSX.read(await file.text(), { type: 'string' });
    else wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map((n) => ({
      name: n,
      table: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false, blankrows: false }),
    }));
  };

  /* ---------------- Ma trận từ tệp ---------------- */
  R.readMatrix = async function (file, onProgress) {
    const e = R.ext(file.name);
    let best = { rows: [], warnings: [] };
    const consider = (res, label) => { if (res.rows.length > best.rows.length) best = Object.assign({ from: label }, res); else if (!best.rows.length && res.warnings.length) best = Object.assign({ from: label }, res); };
    if (e === 'xlsx' || e === 'xls' || e === 'csv') {
      onProgress && onProgress('Đang đọc bảng tính…');
      (await R.readSheets(file)).forEach((s) => consider(Matrix.fromTable(s.table), s.name));
    } else if (e === 'docx') {
      const { blocks } = await R.readDocx(file, onProgress);
      blocks.filter((b) => b.kind === 'table').forEach((b, i) => consider(Matrix.fromTable(b.rows), 'Bảng ' + (i + 1)));
      if (!best.rows.length) consider(Matrix.fromText(blocks.map((b) => b.text).join('\n')), 'văn bản');
    } else if (e === 'pdf') {
      const { rawText } = await R.readPdf(file, onProgress);
      consider(Matrix.fromText(rawText), 'PDF');
      best.warnings = (best.warnings || []).concat(['Ma trận đọc từ PDF có thể sai cột. Hãy đối chiếu từng dòng với tệp gốc.']);
    } else {
      consider(Matrix.fromText(await file.text()), 'văn bản');
    }
    return best;
  };

  /* ---------------- Đề / đáp án từ tệp ---------------- */
  R.readBlocks = async function (file, onProgress) {
    const e = R.ext(file.name);
    if (e === 'docx') return R.readDocx(file, onProgress);
    if (e === 'pdf') return R.readPdf(file, onProgress);
    onProgress && onProgress('Đang đọc văn bản…');
    const text = await file.text();
    return { blocks: R.textToBlocks(text), warnings: [] };
  };

  g.Readers = R;
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
