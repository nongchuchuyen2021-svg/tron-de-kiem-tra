/* Xuất PDF bằng pdfmake với phông Tinos nhúng sẵn (chữ thật, hỗ trợ tiếng Việt, chọn/sao chép được). */
(function (g) {
  const X = {};
  const PT = 72 / 25.4; // pt trên mm
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ' };
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', i: 'ᵢ', j: 'ⱼ', n: 'ₙ' };
  const mapChars = (s, map) => [...s].map((c) => map[c] || c).join('');

  function textRun(r) {
    let s = r.s;
    if (r.sup) s = mapChars(s, SUP);
    else if (r.sub) s = mapChars(s, SUB);
    const o = { text: s };
    if (r.b) o.bold = true;
    if (r.i) o.italics = true;
    if (r.u) o.decoration = 'underline';
    if (r.size) o.fontSize = r.size;
    return o;
  }

  function para(b) {
    // pdfmake không chèn ảnh giữa dòng chữ: tách đoạn thành các phần chữ và ảnh liên tiếp
    const parts = [];
    let buf = [];
    const flush = () => {
      if (!buf.length) return;
      const node = { text: buf, alignment: b.align === 'justify' ? 'justify' : b.align || 'left', margin: [(b.ind && b.ind.left ? b.ind.left * PT : 0), (b.sb || 0), 0, (b.sa || 0) + 1.5] };
      parts.push(node);
      buf = [];
    };
    b.runs.forEach((r) => {
      if (r.t === 'img') {
        flush();
        const w = Math.min(r.w * 0.75, 450); // px -> pt
        parts.push({ image: r.src, width: w, height: (r.h * w) / r.w, margin: [b.ind && b.ind.left ? b.ind.left * PT : 0, 2, 0, 3] });
      } else if (r.t === 'br') buf.push({ text: '\n' });
      else if (r.t === 'tab') buf.push({ text: '    ' });
      else buf.push(textRun(Object.assign({}, r, b.bold ? { b: true } : {})));
    });
    flush();
    if (!parts.length) parts.push({ text: ' ', margin: [0, 0, 0, b.sa || 0] });
    if (b.keepNext && parts.length === 1) parts[0].keepWithNext = true;
    return parts.length === 1 ? parts[0] : { stack: parts, unbreakable: false };
  }

  function table(b) {
    const noBorder = b.border === 'none';
    const body = b.rows.map((r) => {
      const cells = [];
      r.cells.forEach((c) => {
        const stack = convert(c.blocks.length ? c.blocks : [{ k: 'p', runs: [] }]);
        const cell = { stack, margin: [1, 1, 1, 1] };
        if (c.shade) cell.fillColor = '#' + c.shade;
        if (c.border === 'box') cell.border = [true, true, true, true];
        if (c.align) cell.alignment = c.align;
        if (c.span > 1) { cell.colSpan = c.span; cells.push(cell); for (let i = 1; i < c.span; i++) cells.push({}); } else cells.push(cell);
      });
      while (cells.length < b.cols.length) cells.push({ text: '' });
      return cells;
    });
    const hasBox = b.rows.some((r) => r.cells.some((c) => c.border === 'box'));
    return {
      table: { widths: b.cols.map((w) => w * PT), body, dontBreakRows: true, keepWithHeaderRows: 0 },
      layout: noBorder
        ? { hLineWidth: (i, node) => (hasBox ? 0.7 : 0), vLineWidth: () => (hasBox ? 0.7 : 0), hLineColor: () => '#000', vLineColor: () => '#000', paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2 }
        : { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#000', vLineColor: () => '#000', paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2 },
      margin: [0, 0, 0, 4],
    };
  }

  function convert(list) {
    const out = [];
    list.forEach((b) => {
      if (b.k === 'p') out.push(para(b));
      else if (b.k === 'table') out.push(table(b));
      else if (b.k === 'keep') {
        const inner = convert(b.blocks);
        const long = b.blocks.length > 14;
        out.push(long ? { stack: inner, margin: [0, 0, 0, 3] } : { stack: inner, unbreakable: true, margin: [0, 0, 0, 3] });
      } else if (b.k === 'pagebreak') out.push({ text: '', pageBreak: 'after' });
    });
    return out;
  }

  X.toBlob = function (model, footerText) {
    return new Promise((resolve, reject) => {
      try {
        if (!window.pdfMake) throw new Error('Thư viện PDF chưa tải được.');
        pdfMake.vfs = window.TINOS_VFS;
        pdfMake.fonts = { Tinos: { normal: 'Tinos-Regular.ttf', bold: 'Tinos-Bold.ttf', italics: 'Tinos-Italic.ttf', bolditalics: 'Tinos-BoldItalic.ttf' } };
        const def = {
          pageSize: 'A4',
          pageMargins: [20 * PT, 15 * PT, 20 * PT, 17 * PT],
          defaultStyle: { font: 'Tinos', fontSize: 12, lineHeight: 1.12 },
          content: convert(model),
          footer: (cur, total) => ({ text: (footerText ? footerText + ' – ' : '') + `Trang ${cur} / ${total}`, alignment: 'center', fontSize: 10, margin: [0, 8, 0, 0] }),
          info: { title: footerText || 'Đề kiểm tra', creator: 'Trộn đề kiểm tra' },
        };
        pdfMake.createPdf(def).getBlob((blob) => resolve(blob));
      } catch (e) { reject(e); }
    });
  };

  g.ExportPdf = X;
})(window);
