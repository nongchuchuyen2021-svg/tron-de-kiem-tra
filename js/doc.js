/* Dựng "mô hình tài liệu" cho đề, đáp án, hướng dẫn chấm và vẽ ra HTML để xem trước.
   Cùng một mô hình được dùng cho Word (export-docx.js) và PDF (export-pdf.js) để nội dung giống nhau. */
(function (g) {
  const D = {};
  const W = 170; // bề rộng nội dung (mm)
  D.W = W;

  const T = (s, o) => Object.assign({ t: 'text', s }, o);
  const P = (runs, o) => Object.assign({ k: 'p', runs }, o);
  const partTitle = (part, name) => {
    if (part.headText) return name ? part.headText.replace(/^(PHẦN|Phần)\s+[IVXLC\d]+/, (m) => m.replace(/[IVXLC\d]+$/, name.replace(/^Phần\s+/, ''))) : part.headText;
    return `PHẦN ${(name || part.name).replace(/^Phần\s+/, '')}. ${Matrix.TYPES[part.type].toUpperCase()}`;
  };

  const partShort = (part) => {
    const m = /^(PHẦN|Phần)s+[IVXLCd]+/.exec(part.headText || '');
    return (m ? m[0] : part.name).toUpperCase() + '. ' + Matrix.TYPES[part.type];
  };

  D.defaultMeta = () => ({
    school: '', dept: '', title: 'ĐỀ KIỂM TRA', subject: '', grade: '', year: '', time: '', studentLine: true, official: true,
  });

  /* ---- Tiêu đề đề thi ---- */
  function headerBlocks(meta, code) {
    const left = [];
    if (meta.dept) left.push(P([T(meta.dept.toUpperCase())], { align: 'center' }));
    if (meta.school) left.push(P([T(meta.school.toUpperCase(), { b: true })], { align: 'center' }));
    if (meta.official) left.push(P([T('ĐỀ CHÍNH THỨC', { b: true })], { align: 'center', sb: 4 }));
    if (!left.length) left.push(P([]));
    const right = [];
    if (meta.title) right.push(P([T(meta.title.toUpperCase(), { b: true })], { align: 'center' }));
    if (meta.year) right.push(P([T('NĂM HỌC ' + meta.year.replace(/^NĂM HỌC\s*/i, ''), { b: true })], { align: 'center' }));
    const sub = [meta.subject && 'Môn: ' + meta.subject, meta.grade && 'Lớp ' + meta.grade].filter(Boolean).join(' – ');
    if (sub) right.push(P([T(sub, { b: true })], { align: 'center' }));
    if (meta.time) right.push(P([T('Thời gian làm bài: ' + meta.time + ' (không kể thời gian phát đề)', { i: true })], { align: 'center' }));
    const out = [{ k: 'table', border: 'none', cols: [70, 100], rows: [{ cells: [{ blocks: left }, { blocks: right }] }] }];
    const dots = '…………………………………………';
    out.push({
      k: 'table', border: 'none', cols: [125, 45],
      rows: [{ cells: [
        { blocks: meta.studentLine ? [P([T('Họ và tên thí sinh: ' + dots)], { sb: 6 }), P([T('Lớp: ………………   Số báo danh: …………………')], { sb: 4 })] : [P([])] },
        { border: 'box', align: 'center', blocks: [P([T('Mã đề: ', { b: true, size: 14 }), T(String(code), { b: true, size: 18 })], { align: 'center', sb: 4, sa: 4 })] },
      ] }],
    });
    out.push(P([], { sa: 4 }));
    return out;
  }

  /* ---- Một câu hỏi ---- */
  function optionsBlocks(q, item, opts) {
    const list = item.optionOrder.map((oid, k) => {
      const o = q.options.find((x) => x.id === oid);
      return { label: U.letters[k] + '. ', blocks: H.toBlocks(o.html, 260) };
    });
    const simple = list.every((o) => o.blocks.length === 1 && o.blocks[0].k === 'p' && o.blocks[0].runs.every((r) => r.t === 'text'));
    const len = Math.max(...list.map((o) => (simple ? o.blocks[0].runs.reduce((s, r) => s + r.s.length, 0) : 999)));
    const mk = (o) => H.prefix(o.blocks, [T(o.label, { b: true })]);
    if (simple && len <= 16 && list.length === 4) {
      return [{ k: 'table', border: 'none', cols: [42.5, 42.5, 42.5, 42.5], rows: [{ cells: list.map((o) => ({ blocks: mk(o) })) }] }];
    }
    if (simple && len <= 42 && list.length % 2 === 0) {
      const rows = [];
      for (let i = 0; i < list.length; i += 2) rows.push({ cells: [{ blocks: mk(list[i]) }, { blocks: mk(list[i + 1]) }] });
      return [{ k: 'table', border: 'none', cols: [85, 85], rows }];
    }
    const out = [];
    list.forEach((o) => mk(o).forEach((b) => out.push(b.k === 'p' ? Object.assign({}, b, { ind: { left: 4 } }) : b)));
    return out;
  }

  function questionBlocks(exam, q, item, opts) {
    const label = [T(`Câu ${item.num}. `, { b: true })];
    if (opts.showPoints || q.type === 'essay') if (q.points != null) label.push(T(`(${U.fmt(q.points)} điểm) `, { i: true }));
    const out = H.prefix(H.toBlocks(q.stem), label);
    if (q.type === 'mcq') out.push(...optionsBlocks(q, item, opts));
    else if (q.type === 'tf') {
      item.stmtOrder.forEach((sid, k) => {
        const s = q.statements.find((x) => x.id === sid);
        H.prefix(H.toBlocks(s.html), [T('abcdef'[k] + ') ')]).forEach((b) => out.push(b.k === 'p' ? Object.assign({}, b, { ind: { left: 4 } }) : b));
      });
    }
    return out;
  }

  /** Xem một câu của đề gốc (thứ tự gốc, kèm đoạn dẫn của nhóm nếu có). */
  D.questionPreview = function (exam, q) {
    const item = { num: Check.numberFor(exam, q), optionOrder: q.options.map((o) => o.id), stmtOrder: q.statements.map((s) => s.id) };
    const out = [];
    if (q.group && exam.groups[q.group]) out.push(...H.toBlocks(exam.groups[q.group].html));
    out.push(...questionBlocks(exam, q, item, { showPoints: true }));
    return out;
  };

  /** Đề cho học sinh (không có đáp án). */
  D.examModel = function (exam, version, meta, opts) {
    opts = opts || {};
    const out = headerBlocks(meta, version.code);
    let lastPart = null, lastGroup = null;
    version.items.forEach((item, idx) => {
      const q = exam.questions.find((x) => x.id === item.qid);
      const part = exam.parts.find((p) => p.id === q.part);
      if (part.id !== lastPart) {
        out.push(P([T(partTitle(part), { b: true })], { sb: 8, sa: 2, keepNext: true }));
        part.intro.forEach((h) => H.toBlocks(h).forEach((b) => out.push(Object.assign({}, b, { keepNext: true, runs: b.runs.map((r) => (r.t === 'text' ? Object.assign({}, r, { i: true }) : r)) }))));
        lastPart = part.id; lastGroup = null;
      }
      const keep = [];
      if (q.group && q.group !== lastGroup && exam.groups[q.group]) {
        H.toBlocks(exam.groups[q.group].html).forEach((b) => keep.push(b));
      }
      lastGroup = q.group || null;
      keep.push(...questionBlocks(exam, q, item, opts));
      // nhóm câu chùm: giữ đoạn dẫn cùng câu đầu tiên; các câu khác giữ riêng
      out.push({ k: 'keep', blocks: keep });
      void idx;
    });
    out.push(P([T('— HẾT —', { i: true })], { align: 'center', sb: 10 }));
    return out;
  };

  /* ---- Bảng đáp án ---- */
  const cell = (s, o) => Object.assign({ blocks: [P([T(String(s), o && o.run)], { align: (o && o.align) || 'center' })] }, o && o.cell);
  const hcell = (s) => cell(s, { run: { b: true }, cell: { shade: 'EDEDED' } });

  function infoTitle(text, meta, code) {
    const lines = [P([T(text, { b: true, size: 14 })], { align: 'center', sa: 2 })];
    const sub = [meta.title, meta.subject && 'Môn ' + meta.subject, meta.grade && 'Lớp ' + meta.grade, meta.year].filter(Boolean).join(' – ');
    if (sub) lines.push(P([T(sub, { i: true })], { align: 'center', sa: 6 }));
    return lines;
  }

  D.answerModel = function (exam, version, meta) {
    const out = infoTitle(`ĐÁP ÁN – MÃ ĐỀ ${version.code}`, meta, version.code);
    exam.parts.forEach((part) => {
      const items = version.items.filter((it) => exam.questions.find((q) => q.id === it.qid).part === part.id);
      const qOf = (it) => exam.questions.find((q) => q.id === it.qid);
      out.push(P([T(partShort(part), { b: true })], { sb: 8, sa: 3, keepNext: true }));
      if (part.type === 'mcq') {
        for (let i = 0; i < items.length; i += 10) {
          const chunk = items.slice(i, i + 10);
          const pad = (arr) => arr.concat(Array(10 - arr.length).fill(cell('')));
          out.push({ k: 'table', border: 'grid', cols: [22].concat(Array(10).fill(14.8)), keep: true, rows: [
            { cells: [hcell('Câu')].concat(pad(chunk.map((it) => hcell(it.num)))) },
            { cells: [hcell('Đáp án')].concat(pad(chunk.map((it) => cell(Shuffle.answerText(qOf(it), it), { run: { b: true } })))) },
          ] });
          out.push(P([], { sa: 4 }));
        }
      } else if (part.type === 'tf') {
        const n = Math.max(...items.map((it) => it.stmtOrder.length));
        const w = (170 - 24) / n;
        out.push({ k: 'table', border: 'grid', cols: [24].concat(Array(n).fill(w)), rows: [{ cells: [hcell('Câu')].concat(Array.from({ length: n }, (_, k) => hcell('abcdef'[k]))) }].concat(items.map((it) => {
          const a = Shuffle.answerText(qOf(it), it);
          return { cells: [cell(it.num, { run: { b: true } })].concat(Array.from({ length: n }, (_, k) => cell(a[k] || ''))) };
        })) });
      } else if (part.type === 'short') {
        out.push({ k: 'table', border: 'grid', cols: [24, 146], rows: [{ cells: [hcell('Câu'), hcell('Đáp án')] }].concat(items.map((it) => ({ cells: [cell(it.num, { run: { b: true } }), cell(Shuffle.answerText(qOf(it), it))] }))) });
      } else {
        out.push({ k: 'table', border: 'grid', cols: [24, 30, 116], rows: [{ cells: [hcell('Câu'), hcell('Điểm'), hcell('Ghi chú')] }].concat(items.map((it) => ({ cells: [cell(it.num, { run: { b: true } }), cell(U.fmt(qOf(it).points)), cell('Chấm theo hướng dẫn chấm', { align: 'left' })] }))) });
      }
    });
    return out;
  };

  /** Bảng đáp án tổng hợp mọi mã đề. */
  D.combinedAnswerModel = function (exam, versions, meta) {
    const out = infoTitle('BẢNG ĐÁP ÁN TỔNG HỢP CÁC MÃ ĐỀ', meta);
    const nv = versions.length;
    exam.parts.forEach((part) => {
      const per = versions.map((v) => v.items.filter((it) => exam.questions.find((q) => q.id === it.qid).part === part.id));
      const count = per[0].length;
      out.push(P([T(partShort(part), { b: true })], { sb: 8, sa: 3, keepNext: true }));
      const w = (170 - 22) / nv;
      const rows = [{ cells: [hcell('Câu')].concat(versions.map((v) => hcell('Mã ' + v.code))) }];
      for (let j = 0; j < count; j++) {
        rows.push({ cells: [cell(per[0][j].num, { run: { b: true } })].concat(versions.map((v, k) => {
          const it = per[k][j];
          const q = exam.questions.find((x) => x.id === it.qid);
          return cell(q.type === 'essay' ? '—' : Shuffle.answerText(q, it), { run: { b: q.type === 'mcq' } });
        })) });
      }
      out.push({ k: 'table', border: 'grid', cols: [22].concat(Array(nv).fill(w)), rows });
    });
    return out;
  };

  /** Hướng dẫn chấm theo từng mã đề (chỉ tạo khi đề gốc có hướng dẫn). */
  D.hasGuide = (exam) => exam.questions.some((q) => (q.guide && !H.isEmpty(q.guide)) || q.statements.some((s) => s.guide && !H.isEmpty(s.guide)));
  D.guideModel = function (exam, version, meta) {
    const out = infoTitle(`HƯỚNG DẪN CHẤM – MÃ ĐỀ ${version.code}`, meta, version.code);
    let lastPart = null;
    version.items.forEach((item) => {
      const q = exam.questions.find((x) => x.id === item.qid);
      const part = exam.parts.find((p) => p.id === q.part);
      if (part.id !== lastPart) { out.push(P([T(partTitle(part), { b: true })], { sb: 8, sa: 2, keepNext: true })); lastPart = part.id; }
      const head = [T(`Câu ${item.num}`, { b: true })];
      if (q.points != null) head.push(T(` (${U.fmt(q.points)} điểm)`, { i: true }));
      const ans = Shuffle.answerText(q, item);
      if (ans) head.push(T(q.type === 'tf' ? ': ' + [...ans].map((c, k) => 'abcdef'[k] + '-' + c).join(', ') : ': ' + ans, { b: true }));
      const blocks = [P(head, { sb: 4, keepNext: true })];
      if (q.guide && !H.isEmpty(q.guide)) blocks.push(...H.toBlocks(q.guide));
      if (q.type === 'tf') item.stmtOrder.forEach((sid, k) => {
        const s = q.statements.find((x) => x.id === sid);
        if (s.guide && !H.isEmpty(s.guide)) H.prefix(H.toBlocks(s.guide), [T('abcdef'[k] + ') ', { b: true })]).forEach((b) => blocks.push(b));
      });
      out.push({ k: 'keep', blocks });
    });
    return out;
  };

  /* ---------------- Vẽ HTML xem trước ---------------- */
  const mm = (v) => (v == null ? '' : v + 'mm');
  function runHtml(r) {
    if (r.t === 'br') return '<br>';
    if (r.t === 'tab') return '<span class="m-tab"></span>';
    if (r.t === 'img') return `<img src="${r.src}" width="${r.w}" height="${r.h}" alt="">`;
    let s = U.esc(r.s).replace(/ {2}/g, '&nbsp; ');
    if (r.sub) s = '<sub>' + s + '</sub>';
    if (r.sup) s = '<sup>' + s + '</sup>';
    if (r.u) s = '<u>' + s + '</u>';
    if (r.i) s = '<em>' + s + '</em>';
    if (r.b) s = '<strong>' + s + '</strong>';
    if (r.size) s = `<span style="font-size:${r.size}pt">${s}</span>`;
    return s;
  }
  D.toHtml = function (blocks) {
    return blocks.map((b) => {
      if (b.k === 'p') {
        const st = [];
        if (b.align) st.push('text-align:' + (b.align === 'justify' ? 'justify' : b.align));
        if (b.ind && b.ind.left) st.push('margin-left:' + mm(b.ind.left));
        if (b.sb) st.push(`margin-top:${b.sb}pt`);
        if (b.sa) st.push(`margin-bottom:${b.sa}pt`);
        const inner = b.runs.map(runHtml).join('') || '&nbsp;';
        return `<p class="m-p" style="${st.join(';')}">${inner}</p>`;
      }
      if (b.k === 'table') {
        const cols = b.cols.map((w) => `<col style="width:${w}mm">`).join('');
        const rows = b.rows.map((r) => '<tr>' + r.cells.map((c) => {
          const cls = c.border === 'box' ? ' class="m-box"' : '';
          const st = [c.shade ? `background:#${c.shade}` : '', c.align ? `text-align:${c.align}` : ''].filter(Boolean).join(';');
          return `<td${cls}${c.span > 1 ? ` colspan="${c.span}"` : ''}${st ? ` style="${st}"` : ''}>${D.toHtml(c.blocks)}</td>`;
        }).join('') + '</tr>').join('');
        return `<table class="m-table m-${b.border || 'none'}" style="width:${b.cols.reduce((a, c) => a + c, 0)}mm"><colgroup>${cols}</colgroup>${rows}</table>`;
      }
      if (b.k === 'keep') return `<div class="m-keep">${D.toHtml(b.blocks)}</div>`;
      if (b.k === 'pagebreak') return '<div class="m-pb"></div>';
      return '';
    }).join('');
  };

  g.Doc = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
