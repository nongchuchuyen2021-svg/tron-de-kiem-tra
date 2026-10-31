/* Xuất Word (.docx) từ mô hình tài liệu, dùng thư viện docx (bản UMD, chạy trong trình duyệt). */
(function (g) {
  const X = {};
  const TW_MM = 56.7; // twip trên mm

  function run(r, base) {
    const d = window.docx;
    if (r.t === 'br') return new d.TextRun({ break: 1 });
    if (r.t === 'tab') return new d.TextRun({ children: [new d.Tab()] });
    if (r.t === 'img') {
      const info = U.dataUriInfo(r.src);
      const type = /png/.test(info.type) ? 'png' : /gif/.test(info.type) ? 'gif' : 'jpg';
      return new d.ImageRun({ data: U.b64ToBytes(info.b64), transformation: { width: r.w, height: r.h }, type });
    }
    return new d.TextRun({
      text: r.s,
      bold: !!(r.b || (base && base.b)),
      italics: !!r.i,
      underline: r.u ? {} : undefined,
      superScript: !!r.sup,
      subScript: !!r.sub,
      size: r.size ? r.size * 2 : undefined,
    });
  }

  function para(b) {
    const d = window.docx;
    const al = { center: d.AlignmentType.CENTER, right: d.AlignmentType.RIGHT, justify: d.AlignmentType.JUSTIFIED, left: d.AlignmentType.LEFT }[b.align || 'left'];
    return new d.Paragraph({
      alignment: al,
      keepNext: !!b.keepNext,
      keepLines: true,
      spacing: { before: Math.round((b.sb || 0) * 20), after: Math.round((b.sa || 0) * 20), line: 240 },
      indent: b.ind && b.ind.left ? { left: Math.round(b.ind.left * TW_MM) } : undefined,
      children: b.runs.map((r) => run(r, b)),
    });
  }

  function table(b, keepNext) {
    const d = window.docx;
    const none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const line = { style: d.BorderStyle.SINGLE, size: 4, color: '000000' };
    const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    const grid = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line };
    const widths = b.cols.map((w) => Math.round(w * TW_MM));
    const rows = b.rows.map((r) => {
      let ci = 0;
      return new d.TableRow({
        cantSplit: true,
        children: r.cells.map((c) => {
          const span = c.span || 1;
          const w = widths.slice(ci, ci + span).reduce((a, x) => a + x, 0);
          ci += span;
          const bd = c.border === 'box' ? { top: line, bottom: line, left: line, right: line } : undefined;
          return new d.TableCell({
            width: { size: w, type: d.WidthType.DXA },
            columnSpan: span > 1 ? span : undefined,
            shading: c.shade ? { type: d.ShadingType.CLEAR, color: 'auto', fill: c.shade } : undefined,
            borders: bd,
            margins: { top: 0, bottom: 0, left: 60, right: 60 },
            verticalAlign: d.VerticalAlign.CENTER,
            children: blocks(c.blocks.length ? c.blocks : [{ k: 'p', runs: [] }], keepNext),
          });
        }),
      });
    });
    return new d.Table({
      width: { size: widths.reduce((a, x) => a + x, 0), type: d.WidthType.DXA },
      columnWidths: widths,
      borders: b.border === 'grid' ? grid : noBorders,
      rows,
    });
  }

  function blocks(list, keepAll) {
    const out = [];
    list.forEach((b) => {
      if (b.k === 'p') out.push(para(keepAll ? Object.assign({}, b, { keepNext: true }) : b));
      else if (b.k === 'table') { out.push(table(b, keepAll)); out.push(new window.docx.Paragraph({ spacing: { after: 0, line: 40 }, children: [] })); }
      else if (b.k === 'keep') {
        const items = b.blocks;
        items.forEach((x, i) => {
          const last = i === items.length - 1;
          if (x.k === 'p') out.push(para(last ? x : Object.assign({}, x, { keepNext: true })));
          else if (x.k === 'table') { out.push(table(x, !last)); out.push(new window.docx.Paragraph({ spacing: { after: 0, line: 40 }, keepNext: !last, children: [] })); }
        });
      } else if (b.k === 'pagebreak') out.push(new window.docx.Paragraph({ children: [new window.docx.PageBreak()] }));
    });
    return out;
  }

  /** model: mảng khối; footerText: chuỗi hiển thị ở chân trang. Trả về Blob. */
  X.toBlob = async function (model, footerText) {
    const d = window.docx;
    const doc = new d.Document({
      creator: 'Trộn đề kiểm tra',
      styles: { default: { document: { run: { font: 'Times New Roman', size: Math.round((model.fontSize || 11) * 2) } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 851, right: 567, footer: 284 } } },
        footers: {
          default: new d.Footer({
            children: [new d.Paragraph({
              alignment: d.AlignmentType.CENTER,
              children: [
                new d.TextRun({ text: (footerText ? footerText + ' – ' : '') + 'Trang ', size: 22 }),
                new d.TextRun({ children: [d.PageNumber.CURRENT], size: 22 }),
                new d.TextRun({ text: ' / ', size: 22 }),
                new d.TextRun({ children: [d.PageNumber.TOTAL_PAGES], size: 22 }),
              ],
            })],
          }),
        },
        children: blocks(model, false),
      }],
    });
    return d.Packer.toBlob(doc);
  };

  g.ExportDocx = X;
})(window);
