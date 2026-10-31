/* Công cụ xử lý HTML: tách khối khi đọc tệp, cắt/bỏ tiền tố, và chuyển HTML sang "mô hình tài liệu"
   dùng chung cho xem trước, Word và PDF.

   Mô hình tài liệu (model) là mảng khối:
     {k:'p', runs:[run], align, ind:{left,hanging}, sb, sa, keepNext, size, bold}
     {k:'table', cols:[mm], rows:[{cells:[{blocks, span, border, align, shade}]}], border:'none'|'grid'}
     {k:'keep', blocks:[...]}    – giữ các khối trên cùng một trang nếu có thể
     {k:'pagebreak'}
   run: {t:'text', s, b, i, u, sup, sub} | {t:'img', src, w, h} | {t:'br'} | {t:'tab'}
*/
(function (g) {
  const H = {};
  const parse = (html) => new DOMParser().parseFromString('<!doctype html><body>' + (html || '') + '</body>', 'text/html');

  H.textOf = (html) => (html ? parse(html).body.textContent : '');
  H.hasImg = (html) => /<img\b/i.test(html || '');
  H.isEmpty = (html) => !H.textOf(html).trim() && !/<(img|table)\b/i.test(html || '');

  /** Cắt phần HTML theo vị trí ký tự của văn bản [start, end). Giữ nguyên định dạng. */
  H.slice = (html, start, end) => {
    const doc = parse(html);
    const root = doc.body;
    const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    let pos = 0, sN = null, sO = 0, eN = null, eO = 0, last = null;
    const total = root.textContent.length;
    if (end == null || end > total) end = total;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.nodeValue.length;
      last = n;
      if (!sN && start >= pos && start <= pos + len && (start < pos + len || pos + len === total)) { sN = n; sO = start - pos; }
      if (!eN && end >= pos && end <= pos + len) { eN = n; eO = end - pos; }
      pos += len;
    }
    if (!last) return '';
    if (!sN) { sN = last; sO = last.nodeValue.length; }
    if (!eN) { eN = last; eO = last.nodeValue.length; }
    const r = doc.createRange();
    r.setStart(sN, sO);
    r.setEnd(eN, eO);
    const holder = doc.createElement('div');
    holder.appendChild(r.cloneContents());
    return holder.innerHTML;
  };

  /** Bỏ phần đầu văn bản khớp biểu thức chính quy (đã neo ^). */
  H.stripPrefix = (html, re) => {
    const t = H.textOf(html);
    const m = t.match(re);
    if (!m) return html;
    return H.slice(html, m[0].length);
  };

  /** Xóa mọi đoạn văn bản khớp biểu thức trong HTML (mỗi đoạn nằm gọn trong một nút văn bản). */
  H.removeText = (html, re) => {
    const doc = parse(html);
    const walker = doc.createTreeWalker(doc.body, 4);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(re, ''); });
    return doc.body.innerHTML;
  };

  H.trimHtml = (html) => {
    const t = H.textOf(html);
    const lead = t.match(/^\s*/)[0].length;
    const trail = t.match(/\s*$/)[0].length;
    if (!lead && !trail) return html;
    if (lead + trail >= t.length) return html;
    return H.slice(html, lead, t.length - trail);
  };

  /* ---------------- Tách HTML (từ mammoth) thành các khối cho bộ phân tích ---------------- */
  H.parseBlocks = (html) => {
    const doc = parse(html);
    const out = [];
    const push = (kind, inner, extra) => {
      const text = (() => { const d = parse(inner); return d.body.textContent; })();
      if (!text.trim() && !/<img\b/i.test(inner) && kind !== 'table') return;
      out.push(Object.assign({ kind, html: inner, text }, extra || {}));
    };
    const splitBr = (el) => {
      const parts = [[]];
      el.childNodes.forEach((c) => {
        if (c.nodeName === 'BR') parts.push([]);
        else parts[parts.length - 1].push(c);
      });
      return parts.map((nodes) => {
        const d = doc.createElement('div');
        nodes.forEach((n) => d.appendChild(n.cloneNode(true)));
        return d.innerHTML;
      });
    };
    const walk = (parent) => {
      parent.childNodes.forEach((el) => {
        if (el.nodeType !== 1) {
          if (el.nodeType === 3 && el.nodeValue.trim()) push('p', U.esc(el.nodeValue));
          return;
        }
        const tag = el.nodeName;
        if (tag === 'TABLE') {
          // bung ô gộp (colspan/rowspan) để mỗi cột luôn thẳng hàng
          const rows = [];
          [...el.querySelectorAll('tr')].forEach((tr, ri) => {
            rows[ri] = rows[ri] || [];
            let ci = 0;
            [...tr.children].filter((c) => /^(TD|TH)$/.test(c.nodeName)).forEach((c) => {
              while (rows[ri][ci] !== undefined) ci++;
              const txt = c.textContent.replace(/\s+/g, ' ').trim();
              const cs = Math.min(40, parseInt(c.getAttribute('colspan') || '1', 10) || 1);
              const rs = Math.min(40, parseInt(c.getAttribute('rowspan') || '1', 10) || 1);
              for (let dr = 0; dr < rs; dr++) {
                rows[ri + dr] = rows[ri + dr] || [];
                for (let dc = 0; dc < cs; dc++) rows[ri + dr][ci + dc] = txt;
              }
              ci += cs;
            });
          });
          rows.forEach((r, i) => { for (let k = 0; k < r.length; k++) if (r[k] === undefined) r[k] = ''; rows[i] = r; });
          // từng dòng trong ô (mỗi đoạn một dòng), dùng để đọc thông tin tiêu đề mà không bị dính chữ
          const lines = [...el.querySelectorAll('td,th')].flatMap((c) => { const ps = [...c.querySelectorAll('p')]; return (ps.length ? ps : [c]).map((x) => x.textContent.replace(/\s+/g, ' ').trim()); }).filter(Boolean);
          push('table', el.outerHTML, { rows, lines });
        } else if (tag === 'UL' || tag === 'OL') {
          el.querySelectorAll(':scope > li').forEach((li) => splitBr(li).forEach((h) => push('li', h)));
        } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'BODY') {
          walk(el);
        } else {
          splitBr(el).forEach((h) => push('p', h));
        }
      });
    };
    walk(doc.body);
    return out;
  };

  /* ---------------- HTML -> mô hình tài liệu ---------------- */
  const MAXW = 560; // px

  function imgRun(el, maxW) {
    const src = el.getAttribute('src') || '';
    const info = U.dataUriInfo(src);
    if (!info || !/^image\/(png|jpe?g|gif)$/.test(info.type)) {
      return { t: 'text', s: '[hình ảnh định dạng chưa hỗ trợ]', i: true };
    }
    const sz = U.imageSize(src) || { w: 300, h: 200 };
    let w = sz.w || 300, h = sz.h || 200;
    const lim = maxW || MAXW;
    if (w > lim) { h = Math.round((h * lim) / w); w = lim; }
    return { t: 'img', src, w, h };
  }

  function inlineRuns(node, style, maxW, runs) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        const s = c.nodeValue.replace(/[ \t\r\n\f]+/g, ' ');
        if (s) runs.push(Object.assign({ t: 'text', s }, style));
      } else if (c.nodeType === 1) {
        const tag = c.nodeName;
        if (tag === 'BR') runs.push({ t: 'br' });
        else if (tag === 'IMG') runs.push(imgRun(c, maxW));
        else {
          const st = Object.assign({}, style);
          if (tag === 'STRONG' || tag === 'B') st.b = true;
          if (tag === 'EM' || tag === 'I') st.i = true;
          if (tag === 'U') st.u = true;
          if (tag === 'SUP') st.sup = true;
          if (tag === 'SUB') st.sub = true;
          inlineRuns(c, st, maxW, runs);
        }
      }
    });
    return runs;
  }

  function trimRuns(runs) {
    while (runs.length && runs[0].t === 'text') { runs[0].s = runs[0].s.replace(/^\s+/, ''); if (runs[0].s) break; runs.shift(); }
    while (runs.length && runs[runs.length - 1].t === 'text') {
      const r = runs[runs.length - 1];
      r.s = r.s.replace(/\s+$/, '');
      if (r.s) break;
      runs.pop();
    }
    return runs;
  }

  function cellBlocks(el, maxW) {
    const sub = blocksFromNode(el, maxW);
    return sub.length ? sub : [{ k: 'p', runs: [] }];
  }

  function blocksFromNode(parent, maxW) {
    const out = [];
    let inline = [];
    const flush = () => {
      if (inline.some((n) => n.nodeType === 3 ? n.nodeValue.trim() : true)) {
        const holder = parent.ownerDocument.createElement('div');
        inline.forEach((n) => holder.appendChild(n.cloneNode(true)));
        const runs = trimRuns(inlineRuns(holder, {}, maxW, []));
        if (runs.length) out.push({ k: 'p', runs });
      }
      inline = [];
    };
    parent.childNodes.forEach((c) => {
      const tag = c.nodeName;
      if (c.nodeType === 1 && /^(P|H[1-6]|LI)$/.test(tag)) {
        flush();
        const runs = trimRuns(inlineRuns(c, tag.startsWith('H') ? { b: true } : {}, maxW, []));
        out.push({ k: 'p', runs });
      } else if (c.nodeType === 1 && (tag === 'UL' || tag === 'OL')) {
        flush();
        c.querySelectorAll(':scope > li').forEach((li) => out.push({ k: 'p', runs: trimRuns(inlineRuns(li, {}, maxW, [])) }));
      } else if (c.nodeType === 1 && tag === 'TABLE') {
        flush();
        out.push(tableBlock(c, maxW));
      } else if (c.nodeType === 1 && tag === 'DIV') {
        flush();
        out.push(...blocksFromNode(c, maxW));
      } else {
        inline.push(c);
      }
    });
    flush();
    return out;
  }

  function tableBlock(tbl, maxW) {
    const trs = [...tbl.querySelectorAll('tr')];
    const rows = trs.map((tr) => ({
      cells: [...tr.children].filter((c) => /^(TD|TH)$/.test(c.nodeName)).map((c) => ({
        blocks: cellBlocks(c, Math.max(120, Math.round((maxW || MAXW) / Math.max(1, tr.children.length)))),
        span: parseInt(c.getAttribute('colspan') || '1', 10) || 1,
        b: c.nodeName === 'TH',
      })),
    }));
    const ncols = Math.max(1, ...rows.map((r) => U.sum(r.cells, (c) => c.span)));
    const W = 170;
    return { k: 'table', border: 'grid', cols: Array(ncols).fill(W / ncols), rows };
  }

  /** HTML -> mảng khối. maxW: chiều rộng ảnh tối đa (px). */
  H.toBlocks = (html, maxW) => {
    if (!html) return [];
    const doc = parse(html);
    return blocksFromNode(doc.body, maxW);
  };

  /** Gắn tiền tố (ví dụ "Câu 3. ") vào đoạn văn đầu tiên của dãy khối. */
  H.prefix = (blocks, runs) => {
    const out = blocks.slice();
    if (out.length && out[0].k === 'p') {
      out[0] = Object.assign({}, out[0], { runs: runs.concat(out[0].runs) });
    } else {
      out.unshift({ k: 'p', runs: runs.slice() });
    }
    return out;
  };

  g.H = H;
  if (typeof module !== 'undefined') module.exports = H;
})(typeof window !== 'undefined' ? window : globalThis);
