/* Giao diện Bước 2: nhập đề gốc + đáp án, danh sách câu hỏi (xem, sửa, khóa), cửa sổ chỉnh sửa câu hỏi. */
(function (g) {
  const UI = g.UI;
  const { $, $$ } = UI;
  const esc = U.esc;
  const st = () => UI.st();
  const chip = UI.chip;

  /* ------------------------------------------------------------ dựng dữ liệu từ kết quả phân tích */
  function applyExam(blocks, source, preWarnings, header) {
    const s = st();
    const parsed = ExamParser.parse(blocks);
    if (!parsed.questions.length) {
      return UI.setMsgs('exam', [{ level: 'error', text: parsed.warnings[0] }, { level: 'warn', text: 'Mẹo: mỗi câu phải bắt đầu bằng "Câu 1.", "Câu 2."…; phương án bắt đầu bằng "A.", "B.", "C.", "D."; ý đúng/sai bắt đầu bằng "a)", "b)"…' }]);
    }
    if (s.exam && !confirm('Thay thế đề gốc hiện tại bằng đề vừa đọc? Các chỉnh sửa và mã đề đã tạo sẽ bị xóa.')) return;
    s.exam = { parts: parsed.parts, questions: parsed.questions, groups: parsed.groups, numbering: parsed.numbering, source, importedAt: Date.now(), header: header || null, footerNotes: parsed.footerNotes || [], labelSep: parsed.labelSep || '.', code: parsed.code || '' };
    s.result = null;
    let ans = null;
    if (parsed.answerBlocks.length) ans = ExamParser.applyAnswers(parsed.answerBlocks, s.exam);
    Object.keys(parsed.meta).forEach((k) => { if (!s.meta[k]) s.meta[k] = parsed.meta[k]; });
    const list = [{ level: 'ok', text: `Đã nhận dạng ${parsed.questions.length} câu hỏi trong ${parsed.parts.length} phần từ ${source}. Mọi câu đang ở trạng thái "Cần kiểm tra" — hãy xem lại rồi xác nhận.` }];
    if (header) list.push({ level: 'ok', text: 'Đã lấy mẫu tiêu đề của đề gốc: các mã đề sẽ dùng đúng tiêu đề này (chỉ thay số mã đề).' });
    (preWarnings || []).forEach((w) => list.push({ level: 'warn', text: w }));
    if (ans) {
      list.push({ level: ans.matched ? 'ok' : 'warn', text: ans.matched ? `Nhận dạng đáp án/hướng dẫn chấm cuối đề cho ${ans.matched}/${parsed.questions.length} câu (cần giáo viên xác nhận).` : 'Có phần đáp án cuối đề nhưng chưa khớp được câu nào.' });
      ans.warnings.slice(0, 8).forEach((w) => list.push({ level: 'warn', text: w }));
    } else list.push({ level: 'warn', text: 'Không tìm thấy phần đáp án cuối đề. Hãy tải tệp đáp án riêng hoặc nhập đáp án trực tiếp bằng nút "Sửa".' });
    parsed.warnings.slice(0, 12).forEach((w) => list.push({ level: 'warn', text: w }));
    if (parsed.warnings.length > 12) list.push({ level: 'warn', text: `… và ${parsed.warnings.length - 12} cảnh báo khác.` });
    UI.ui.msgs.exam = list;
    UI.ui.msgs.answer = [];
    UI.commit();
    UI.render(false);
  }

  UI.importExam = async function (file) {
    const err = Readers.check(file, ['docx', 'pdf', 'txt', 'md']);
    if (err) return UI.setMsgs('exam', [{ level: 'error', text: err }]);
    try {
      UI.busy('Đang đọc đề từ "' + file.name + '"…');
      const res = await Readers.readBlocks(file, (m) => UI.busy(m));
      UI.busy('Đang nhận dạng câu hỏi…');
      await new Promise((r) => setTimeout(r, 20));
      applyExam(res.blocks, file.name, res.warnings, res.header);
    } catch (e) {
      UI.setMsgs('exam', [{ level: 'error', text: 'Không đọc được tệp: ' + e.message }, { level: 'warn', text: 'Cách xử lý: dùng tệp Word (.docx) hoặc dán trực tiếp nội dung đề vào ô bên cạnh.' }]);
    } finally { UI.busy(); }
  };

  async function applyAnswerBlocks(blocks, source, warnings) {
    const s = st();
    if (!s.exam) return UI.setMsgs('answer', [{ level: 'error', text: 'Hãy nhập đề gốc trước, sau đó mới nạp đáp án.' }]);
    const r = ExamParser.applyAnswers(blocks, s.exam);
    const list = [];
    if (!r.matched) list.push({ level: 'error', text: 'Không nhận dạng được đáp án nào. Mỗi đáp án cần ghi theo mẫu "Câu 1: A", "1.A 2.B 3.C", hoặc bảng Câu/Đáp án; câu đúng/sai: "Câu 13: a) Đúng b) Sai…".' });
    else list.push({ level: 'ok', text: `Đã nhận dạng đáp án/hướng dẫn chấm cho ${r.matched} câu từ ${source}. Đáp án ở trạng thái "chưa xác nhận" cho tới khi bạn xác nhận.` });
    (warnings || []).forEach((w) => list.push({ level: 'warn', text: w }));
    r.warnings.slice(0, 10).forEach((w) => list.push({ level: 'warn', text: w }));
    UI.ui.msgs.answer = list;
    UI.commit();
    UI.render(true);
  }
  UI.importAnswer = async function (file) {
    const err = Readers.check(file, ['docx', 'pdf', 'txt', 'md']);
    if (err) return UI.setMsgs('answer', [{ level: 'error', text: err }]);
    try {
      UI.busy('Đang đọc đáp án…');
      const res = await Readers.readBlocks(file, (m) => UI.busy(m));
      await applyAnswerBlocks(res.blocks, file.name, res.warnings);
    } catch (e) { UI.setMsgs('answer', [{ level: 'error', text: 'Không đọc được tệp đáp án: ' + e.message }]); } finally { UI.busy(); }
  };

  UI.loadSample = function () {
    const s = st();
    if ((s.exam || s.matrix.rows.length) && !confirm('Nạp dữ liệu mẫu sẽ thay thế ma trận và đề hiện tại. Tiếp tục?')) return;
    s.matrix = { rows: Matrix.fromText(SAMPLE.matrixText).rows, confirmed: false, source: 'Dữ liệu mẫu', auto: false };
    const parsed = ExamParser.parse(Readers.textToBlocks(SAMPLE.examText));
    s.exam = { parts: parsed.parts, questions: parsed.questions, groups: parsed.groups, numbering: parsed.numbering, source: 'Dữ liệu mẫu', importedAt: Date.now() };
    ExamParser.applyAnswers(parsed.answerBlocks, s.exam);
    Object.assign(s.meta, parsed.meta, { dept: 'SỞ GD&ĐT …', school: 'TRƯỜNG THPT ABC', title: 'Kiểm tra giữa kì I', year: '2025-2026' });
    s.result = null;
    s.step = 1;
    UI.ui.msgs = { matrix: [{ level: 'ok', text: 'Đã nạp ma trận mẫu (Tin học 12, 21 câu, 10 điểm). Hãy xem lại bảng, rồi bấm "Xác nhận ma trận".' }], exam: [], answer: [] };
    UI.commit();
    UI.render(false);
    UI.toast('Đã nạp dữ liệu mẫu. Làm theo 5 bước: xác nhận ma trận → xem đề (Bước 2) → Gợi ý & xác nhận (Bước 3) → Tạo mã đề.', 'info', 10000);
  };

  /* ------------------------------------------------------------ BƯỚC 2 */
  const snippet = (q) => H.textOf(q.stem).replace(/\s+/g, ' ').trim().slice(0, 120);
  function ansText(q) {
    if (q.type === 'mcq') return q.answer ? U.letters[q.options.findIndex((o) => o.id === q.answer)] : '';
    if (q.type === 'tf') return q.statements.map((x) => (x.answer ? (x.answer === 'D' ? 'Đ' : 'S') : '?')).join('');
    if (q.type === 'short') return q.answer || '';
    return '';
  }

  UI.viewExam = function () {
    const s = st(), exam = s.exam, ui = UI.ui;
    const res = exam && (s.matrix.auto || s.matrix.rows.length) ? Check.run(s.matrix, exam) : null;
    let list = '';
    if (exam) {
      const nAns = exam.questions.filter((q) => ['ok', 'unconfirmed'].includes(Check.answerState(q))).length;
      const nAnsOk = exam.questions.filter((q) => Check.answerState(q) === 'ok').length;
      const needAns = exam.questions.filter((q) => q.type !== 'essay').length;
      const nConf = exam.questions.filter((q) => q.confirmed).length;
      const gIssues = Object.values(exam.groups).filter((gp) => { const qs = exam.questions.filter((q) => q.group === gp.id); return qs.length > 1 && (qs[qs.length - 1].n - qs[0].n !== qs.length - 1 || new Set(qs.map((q) => q.part)).size > 1); }).map((gp) => `Nhóm ${gp.id} gồm các câu không liền nhau — hãy kiểm tra.`);
      list = `
      <section class="card">
        <div class="card-head"><h3>Danh sách câu hỏi đã nhận dạng</h3>
          <div class="row-actions"><button class="btn sm" data-act="confirm-all-q">Xác nhận tất cả câu hỏi</button><button class="btn sm" data-act="confirm-all-ans">Xác nhận tất cả đáp án đang có</button></div></div>
        <div class="stat-row">
          ${chip('', exam.questions.length + ' câu · ' + exam.parts.length + ' phần')}
          ${chip(nConf === exam.questions.length ? 'st-ok' : 'st-check', nConf + '/' + exam.questions.length + ' câu đã xác nhận')}
          ${chip(nAnsOk === needAns ? 'st-ok' : nAns === needAns ? 'st-check' : 'st-bad', 'Đáp án: ' + nAns + '/' + needAns + ' có · ' + nAnsOk + ' đã xác nhận')}
          ${chip('', 'Đánh số: ' + (exam.numbering === 'perPart' ? 'lại từ 1 ở mỗi phần' : 'liên tục toàn đề'))}
          <button class="btn sm ghost" data-act="toggle-numbering">Đổi cách đánh số</button>
        </div>
        ${UI.msgs(gIssues.map((t) => ({ level: 'warn', text: t })))}
        <div class="table-wrap"><table class="grid qlist"><thead><tr><th>Câu</th><th>Dạng</th><th>Nội dung</th><th>Đáp án</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        ${exam.parts.map((p) => `<tr class="part-row"><td colspan="6"><b>${esc(p.headText || p.name)}</b></td></tr>` + exam.questions.filter((q) => q.part === p.id).map((q) => {
          const stt = Check.qStatus(q, res);
          const as = Check.answerState(q);
          const posL = exam.questions.indexOf(q);
          const optLocked = q.type === 'mcq' && Shuffle.lockOptionsOf(q);
          return `<tr>
            <td class="nw"><b>${esc(Check.nameOf(exam, q))}</b>${q.group ? '<br>' + chip('grp', 'Nhóm ' + q.group) : ''}</td>
            <td>${Matrix.TYPE_SHORT[q.type]}</td>
            <td class="stem">${esc(snippet(q)) || '<i>(trống)</i>'}${H.hasImg(q.stem) ? ' <span title="Có hình ảnh">🖼</span>' : ''}${/<table/i.test(q.stem) ? ' <span title="Có bảng">▦</span>' : ''}
              ${!q.confirmed && q.flags.length ? `<div class="flags">⚠ ${esc(q.flags.join(' '))}</div>` : ''}</td>
            <td class="nw">${as === 'na' ? '<span class="muted">—</span>' : as === 'missing' ? chip('st-bad', 'Chưa có') : `<b>${esc(ansText(q))}</b> ` + (as === 'ok' ? '<span class="ok-mark" title="Đã xác nhận">✓</span>' : chip('st-check', 'chưa xác nhận', q.answerNote))}</td>
            <td>${UI.statusChip(stt)}</td>
            <td class="nw acts">
              <button class="btn sm ghost" data-act="view-q" data-q="${q.id}">Xem</button>
              <button class="btn sm" data-act="edit-q" data-q="${q.id}">Sửa</button>
              <button class="btn sm ghost ${q.lock ? 'on' : ''}" data-act="lock-pos" data-q="${q.id}" title="Khóa vị trí: câu giữ nguyên số thứ tự khi trộn" aria-pressed="${!!q.lock}">${q.lock ? '🔒' : '🔓'} Vị trí</button>
              ${q.type === 'mcq' ? `<button class="btn sm ghost ${optLocked ? 'on' : ''}" data-act="lock-opt" data-q="${q.id}" title="${q.lockOptions == null && optLocked ? 'Tự động khóa: phương án phụ thuộc nhãn/vị trí' : 'Khóa thứ tự phương án'}" aria-pressed="${optLocked}">${optLocked ? '🔒' : '🔓'} Phương án${q.lockOptions == null && optLocked ? ' (tự động)' : ''}</button>` : ''}
              <button class="icon-btn" data-act="del-q" data-q="${q.id}" title="Xóa câu này khỏi đề" aria-label="Xóa câu ${q.n}">✕</button>
            </td></tr>`;
        }).join('')).join('')}
        </tbody></table></div>
        <div class="row-actions end"><button class="btn ghost" data-act="goto" data-step="1">Ma trận (không bắt buộc)</button><button class="btn primary" data-act="goto" data-step="3">${s.matrix.auto ? 'Sang Bước 3: xác nhận câu hỏi →' : 'Sang Bước 3: đối chiếu →'}</button></div>
      </section>`;
    }
    return `
    <section class="card">
      <h2>Bước 2. Nhập đề gốc và đáp án</h2>
      <p class="hint">Hỗ trợ Word (.docx), PDF có lớp văn bản hoặc dán nội dung. Hệ thống tách thành các khối <b>câu hỏi – phương án – ý đúng/sai – hình ảnh – đáp án</b> để bạn kiểm tra. PDF dạng ảnh quét <b>chưa nhận dạng được chữ (không có OCR)</b>.</p>
      <div class="grid2">
        <div><h3>Đề kiểm tra gốc</h3>${UI.dropzone('exam', '.docx,.pdf,.txt', 'Tệp đề gốc')}
          <label class="lbl" for="exam-paste">Hoặc dán nội dung đề</label><textarea id="exam-paste" rows="5" placeholder="Câu 1. …&#10;A. …&#10;B. …"></textarea>
          <div class="row-actions"><button class="btn" data-act="exam-parse">Phân tích nội dung đã dán</button></div></div>
        <div><h3>Đáp án &amp; hướng dẫn chấm <small>(không bắt buộc)</small></h3>
          <p class="hint">Nếu đáp án nằm cuối tệp đề (sau dòng "ĐÁP ÁN"), hệ thống tự nhận dạng. Nếu có tệp riêng, tải ở đây. Bạn cũng có thể nhập/sửa đáp án trực tiếp bằng nút "Sửa".</p>
          ${UI.dropzone('answer', '.docx,.pdf,.txt', 'Tệp đáp án')}
          <label class="lbl" for="ans-paste">Hoặc dán đáp án</label><textarea id="ans-paste" rows="3" placeholder="1.A 2.C 3.B …&#10;Câu 13: a) Đúng b) Sai c) Đúng d) Sai"></textarea>
          <div class="row-actions"><button class="btn" data-act="ans-parse" ${exam ? '' : 'disabled'}>Đọc đáp án đã dán</button></div></div>
      </div>
      ${UI.msgs(ui.msgs.exam)}${UI.msgs(ui.msgs.answer)}
    </section>${list}`;
  };

  /* ------------------------------------------------------------ cửa sổ */
  let modal = null;
  function openModal(html, cls) {
    UI.closeModal();
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    modal = root.firstChild;
    document.body.classList.add('noscroll');
    return modal;
  }
  UI.closeModal = function () {
    const root = $('#modal-root');
    if (root) root.innerHTML = '';
    modal = null;
    document.body.classList.remove('noscroll');
  };

  function viewQuestion(q) {
    const s = st();
    const m = openModal(`<div class="modal-head"><h3>${esc(Check.nameOf(s.exam, q))} — xem trước</h3><button class="icon-btn" data-act="close-modal" aria-label="Đóng">✕</button></div>
      <div class="modal-body"><div class="paper small">${Doc.toHtml(Doc.questionPreview(s.exam, q))}</div>
      <p class="muted">Đáp án: <b>${esc(ansText(q)) || '(chưa có)'}</b> · Điểm: <b>${q.points == null ? '(chưa có)' : U.fmt(q.points)}</b> · Chủ đề: ${esc(q.topic) || '(chưa gán)'} · Mức độ: ${esc(q.level) || '(chưa gán)'}</p>
      ${q.guide && !H.isEmpty(q.guide) ? `<h4>Hướng dẫn chấm / lời giải</h4><div class="paper small">${Doc.toHtml(H.toBlocks(q.guide))}</div>` : ''}</div>
      <div class="modal-foot"><button class="btn" data-act="close-modal">Đóng</button><button class="btn primary" data-act="edit-q" data-q="${q.id}">Sửa câu này</button></div>`, 'wide');
    void m;
  }

  /* ------------------------------------------------------------ soạn thảo câu hỏi */
  let draft = null, draftId = null, lastEditor = null;
  const RICH_BTNS = [['bold', '<b>B</b>', 'Đậm'], ['italic', '<i>I</i>', 'Nghiêng'], ['underline', '<u>U</u>', 'Gạch chân'], ['superscript', 'x²', 'Chỉ số trên'], ['subscript', 'x₂', 'Chỉ số dưới'], ['img', '🖼', 'Chèn ảnh']];
  const rich = (key, html, cls) => `<div class="rich ${cls || ''}"><div class="rtool">${RICH_BTNS.map((b) => `<button type="button" tabindex="-1" data-cmd="${b[0]}" title="${b[2]}">${b[1]}</button>`).join('')}</div><div class="redit" contenteditable="true" spellcheck="false" data-rich="${key}">${html || ''}</div></div>`;
  const opt = (list, val, ph) => `<option value="">${ph}</option>` + list.concat(val && !list.includes(val) ? [val] : []).map((x) => `<option value="${esc(x)}" ${x === val ? 'selected' : ''}>${esc(x)}</option>`).join('');

  function nextId(prefix, arr) {
    const nums = arr.map((x) => +(x.id.match(/(\d+)$/) || [0, 0])[1]);
    return prefix + (Math.max(0, ...nums) + 1);
  }

  function syncDraft() {
    if (!draft || !modal) return;
    const d = draft;
    const val = (k) => { const e = modal.querySelector(`[data-d="${k}"]`); return e ? (e.type === 'checkbox' ? e.checked : e.value) : undefined; };
    const rv = (k) => { const e = modal.querySelector(`[data-rich="${k}"]`); return e ? e.innerHTML : undefined; };
    d.type = val('type') || d.type;
    d.part = val('part') || d.part;
    const p = U.num(val('points'));
    d.points = isNaN(p) ? null : p;
    d.topic = val('topic') != null ? val('topic') : d.topic;
    d.level = val('level') != null ? val('level') : d.level;
    d.stem = rv('stem') != null ? rv('stem') : d.stem;
    d.guide = rv('guide') != null ? rv('guide') : d.guide;
    d.options.forEach((o, i) => { const h = rv('opt' + i); if (h != null) o.html = h; });
    d.statements.forEach((x, i) => { const h = rv('stm' + i); if (h != null) x.html = h; const gh = rv('sg' + i); if (gh != null) x.guide = gh; const a = val('sa' + i); if (a != null) x.answer = a || null; });
    const ra = modal.querySelector('input[name="ans"]:checked');
    if (d.type === 'mcq') d.answer = ra ? ra.value : (d.options.some((o) => o.id === d.answer) ? d.answer : null);
    if (d.type === 'short') d.answer = val('shortans') != null ? val('shortans') : d.answer;
    d.groupId = val('group') != null ? val('group') : d.groupId;
    d.passage = rv('passage') != null ? rv('passage') : d.passage;
    d.lock = !!val('lock');
    const lo = val('lockopt');
    d.lockOptions = lo === 'auto' ? undefined : lo === '1';
    d.tfIndependent = !!val('tfind');
    d.confirmed = !!val('confirmed');
    d.answerConfirmed = !!val('ansconf');
  }

  function renderEdit() {
    const s = st(), exam = s.exam, d = draft;
    const tops = UI.topicsOf(), lvls = UI.levelsOf();
    const groups = Object.values(exam.groups);
    const optsHtml = d.type === 'mcq' ? `<h4>Phương án <small>(chọn nút tròn ở phương án đúng)</small></h4>${d.options.map((o, i) => `<div class="opt-row"><label class="radio"><input type="radio" name="ans" value="${o.id}" ${d.answer === o.id ? 'checked' : ''}><b>${U.letters[i]}</b></label>${rich('opt' + i, o.html, 'sm')}<button class="icon-btn" data-act="opt-del" data-i="${i}" title="Xóa phương án" ${d.options.length <= 2 ? 'disabled' : ''}>✕</button></div>`).join('')}<button class="btn sm" data-act="opt-add" ${d.options.length >= 6 ? 'disabled' : ''}>+ Thêm phương án</button>` : '';
    const stmHtml = d.type === 'tf' ? `<h4>Các ý đúng/sai</h4>${d.statements.map((x, i) => `<div class="opt-row"><b class="lb">${'abcdef'[i]})</b>${rich('stm' + i, x.html, 'sm')}<select data-d="sa${i}" aria-label="Đáp án ý ${'abcdef'[i]}"><option value="">Đáp án?</option><option value="D" ${x.answer === 'D' ? 'selected' : ''}>Đúng</option><option value="S" ${x.answer === 'S' ? 'selected' : ''}>Sai</option></select><button class="icon-btn" data-act="stm-del" data-i="${i}" title="Xóa ý" ${d.statements.length <= 2 ? 'disabled' : ''}>✕</button></div>
      <details class="mini"><summary>Hướng dẫn chấm cho ý ${'abcdef'[i]})</summary>${rich('sg' + i, x.guide, 'sm')}</details>`).join('')}<button class="btn sm" data-act="stm-add" ${d.statements.length >= 6 ? 'disabled' : ''}>+ Thêm ý</button>` : '';
    const shortHtml = d.type === 'short' ? `<h4>Đáp án trả lời ngắn</h4><input data-d="shortans" value="${esc(d.answer || '')}" placeholder="Ví dụ: 12,5">` : '';
    const html = `<div class="modal-head"><h3>Sửa ${esc(Check.nameOf(exam, exam.questions.find((x) => x.id === draftId)))}</h3><button class="icon-btn" data-act="close-modal" aria-label="Đóng">✕</button></div>
    <div class="modal-body">
      <div class="grid4">
        <div><label class="lbl">Dạng câu hỏi</label><select data-d="type" data-rerender="1">${Object.keys(Matrix.TYPES).map((t) => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${Matrix.TYPES[t]}</option>`).join('')}</select></div>
        <div><label class="lbl">Thuộc phần</label><select data-d="part">${exam.parts.map((p) => `<option value="${p.id}" ${d.part === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div><label class="lbl">Điểm</label><input data-d="points" inputmode="decimal" value="${d.points == null ? '' : U.fmt(d.points)}"></div>
        <div></div>
        <div class="span2"><label class="lbl">Chủ đề</label><select data-d="topic">${opt(tops, d.topic, '— chưa gán —')}</select></div>
        <div><label class="lbl">Mức độ</label><select data-d="level">${opt(lvls, d.level, '— chưa gán —')}</select></div>
      </div>
      <h4>Nội dung câu hỏi (phần dẫn)</h4>${rich('stem', d.stem)}
      ${optsHtml}${stmHtml}${shortHtml}
      <h4>Hướng dẫn chấm / lời giải <small>(không bắt buộc)</small></h4>${rich('guide', d.guide, 'sm')}
      <h4>Câu chùm / dữ kiện dùng chung</h4>
      <div class="grid2"><div><select data-d="group" data-rerender="1"><option value="">Không thuộc nhóm</option>${groups.map((gp) => `<option value="${gp.id}" ${d.groupId === gp.id ? 'selected' : ''}>Nhóm ${gp.id} — ${esc(H.textOf(gp.html).slice(0, 50))}</option>`).join('')}<option value="new" ${d.groupId === 'new' ? 'selected' : ''}>+ Tạo nhóm mới với đoạn dẫn…</option></select><small class="muted">Các câu cùng nhóm phải liền nhau và sẽ luôn di chuyển cùng nhau, giữ thứ tự.</small></div></div>
      ${d.groupId ? `<label class="lbl">Đoạn dẫn / hình / bảng dùng chung</label>${rich('passage', d.passage, 'sm')}` : ''}
      <h4>Khóa &amp; xác nhận</h4>
      <div class="opts">
        <label class="check"><input type="checkbox" data-d="lock" ${d.lock ? 'checked' : ''}><span><b>Khóa vị trí</b><small>Câu giữ nguyên số thứ tự ở mọi mã đề.</small></span></label>
        ${d.type === 'mcq' ? `<div class="check"><span><b>Đảo phương án</b><small>Mặc định tự khóa nếu phương án có dạng "A và B đều đúng", "Tất cả các phương án trên"…</small></span><select data-d="lockopt"><option value="auto" ${d.lockOptions == null ? 'selected' : ''}>Tự động${Shuffle.optionDependent({ type: 'mcq', options: d.options }) ? ' (đang khóa)' : ' (đang đảo)'}</option><option value="1" ${d.lockOptions === true ? 'selected' : ''}>Luôn khóa (không đảo)</option><option value="0" ${d.lockOptions === false ? 'selected' : ''}>Luôn đảo</option></select></div>` : ''}
        ${d.type === 'tf' ? `<label class="check"><input type="checkbox" data-d="tfind" ${d.tfIndependent ? 'checked' : ''}><span><b>Các ý a, b, c, d độc lập với nhau</b><small>Cần bật mới được đảo thứ tự ý (khi bật tùy chọn ở Bước 4).</small></span></label>` : ''}
        <label class="check"><input type="checkbox" data-d="confirmed" ${d.confirmed ? 'checked' : ''}><span><b>Tôi đã kiểm tra nội dung &amp; phân loại câu này</b></span></label>
        ${d.type !== 'essay' ? `<label class="check"><input type="checkbox" data-d="ansconf" ${d.answerConfirmed ? 'checked' : ''}><span><b>Tôi xác nhận đáp án của câu này</b>${d.answerNote ? `<small>${esc(d.answerNote)}</small>` : ''}</span></label>` : ''}
      </div>
      <div id="edit-err"></div>
    </div>
    <div class="modal-foot"><button class="btn" data-act="close-modal">Hủy</button><button class="btn primary" data-act="save-q">Lưu thay đổi</button></div>`;
    openModal(html, 'wide');
  }

  function openEdit(qid) {
    const s = st();
    const q = s.exam.questions.find((x) => x.id === qid);
    draftId = qid;
    draft = U.clone(q);
    draft.groupId = q.group || '';
    draft.passage = q.group && s.exam.groups[q.group] ? s.exam.groups[q.group].html : '';
    if (draft.type === 'mcq' && !draft.options.length) draft.options = [1, 2, 3, 4].map((i) => ({ id: q.id + 'o' + i, html: '' }));
    if (draft.type === 'tf' && !draft.statements.length) draft.statements = [1, 2, 3, 4].map((i) => ({ id: q.id + 's' + i, html: '', answer: null, guide: '' }));
    renderEdit();
  }

  function saveEdit() {
    syncDraft();
    const s = st(), exam = s.exam, d = draft;
    const q = exam.questions.find((x) => x.id === draftId);
    const err = (t) => { $('#edit-err').innerHTML = `<p class="notice err">${esc(t)}</p>`; };
    if (H.isEmpty(d.stem)) return err('Phần dẫn của câu hỏi đang trống.');
    if (d.type === 'mcq') {
      if (d.options.length < 2 || d.options.some((o) => H.isEmpty(o.html))) return err('Mỗi phương án phải có nội dung (tối thiểu 2 phương án).');
    }
    if (d.type === 'tf' && (d.statements.length < 2 || d.statements.some((x) => H.isEmpty(x.html)))) return err('Mỗi ý đúng/sai phải có nội dung (tối thiểu 2 ý).');
    const ptsChanged = d.points !== q.points;
    const clsChanged = d.topic !== q.topic || d.level !== q.level;
    q.type = d.type; q.part = d.part; q.points = d.points; q.topic = d.topic; q.level = d.level;
    if (ptsChanged) q.pointsSource = 'teacher';
    if (clsChanged) q.classSource = 'teacher';
    q.stem = d.stem; q.guide = d.guide;
    q.options = d.type === 'mcq' ? d.options : [];
    q.statements = d.type === 'tf' ? d.statements : [];
    q.answer = d.type === 'mcq' ? (d.options.some((o) => o.id === d.answer) ? d.answer : null) : d.type === 'short' ? String(d.answer || '').trim() || null : null;
    q.lock = d.lock; q.lockOptions = d.lockOptions; q.tfIndependent = d.tfIndependent;
    q.confirmed = d.confirmed; q.answerConfirmed = d.answerConfirmed && Check.answerState(Object.assign({}, q, { answerConfirmed: true })) !== 'missing';
    if (q.type !== 'mcq' && q.type !== 'tf') q.flags = q.flags.filter((f) => !/phương án|ý a/.test(f));
    // nhóm câu chùm
    let gid = d.groupId;
    if (gid === 'new') {
      let n = 1; while (exam.groups['G' + n]) n++;
      gid = 'G' + n; exam.groups[gid] = { id: gid, html: d.passage || '', qids: [] };
    } else if (gid && exam.groups[gid]) exam.groups[gid].html = d.passage;
    q.group = gid || null;
    // sắp xếp lại theo phần, đánh số lại
    const order = exam.parts.map((p) => p.id);
    exam.questions.sort((a, b) => order.indexOf(a.part) - order.indexOf(b.part) || a.n - b.n);
    UI_renumber(exam);
    UI.closeModal();
    UI.commit();
    UI.render(true);
    UI.toast('Đã lưu câu hỏi.', 'ok', 2500);
  }

  function UI_renumber(exam) {
    exam.questions.forEach((q, i) => { q.n = i + 1; });
    Object.values(exam.groups).forEach((gp) => { gp.qids = exam.questions.filter((q) => q.group === gp.id).map((q) => q.id); });
    Object.keys(exam.groups).forEach((k) => { if (!exam.groups[k].qids.length) delete exam.groups[k]; });
  }

  /* ------------------------------------------------------------ hành động */
  Object.assign(UI.actions, {
    'exam-parse': () => {
      const t = $('#exam-paste').value;
      if (!t.trim()) return UI.setMsgs('exam', [{ level: 'error', text: 'Ô dán đang trống. Hãy dán nội dung đề (mỗi câu bắt đầu bằng "Câu 1.") rồi bấm lại.' }]);
      applyExam(Readers.textToBlocks(t), 'nội dung đã dán', []);
    },
    'ans-parse': () => {
      const t = $('#ans-paste').value;
      if (!t.trim()) return UI.setMsgs('answer', [{ level: 'error', text: 'Ô dán đáp án đang trống.' }]);
      applyAnswerBlocks(Readers.textToBlocks(t), 'nội dung đã dán', []);
    },
    'confirm-all-ans': () => {
      const s = st();
      let n = 0;
      s.exam.questions.forEach((q) => { if (Check.answerState(q) === 'unconfirmed') { q.answerConfirmed = true; n++; } });
      UI.commit(); UI.render(true);
      UI.toast(n ? `Đã xác nhận ${n} đáp án đang có. Các câu chưa có đáp án vẫn cần được bổ sung.` : 'Không có đáp án nào chờ xác nhận.', n ? 'ok' : 'warn');
    },
    'toggle-numbering': () => { const e = st().exam; e.numbering = e.numbering === 'perPart' ? 'continuous' : 'perPart'; UI.commit(); UI.render(true); },
    'view-q': (el) => viewQuestion(st().exam.questions.find((x) => x.id === el.dataset.q)),
    'edit-q': (el) => openEdit(el.dataset.q),
    'close-modal': () => UI.closeModal(),
    'save-q': saveEdit,
    'lock-pos': (el) => { const q = st().exam.questions.find((x) => x.id === el.dataset.q); q.lock = !q.lock; UI.commit(); UI.render(true); },
    'lock-opt': (el) => { const q = st().exam.questions.find((x) => x.id === el.dataset.q); q.lockOptions = !Shuffle.lockOptionsOf(q); UI.commit(); UI.render(true); },
    'del-q': (el) => {
      const s = st();
      const q = s.exam.questions.find((x) => x.id === el.dataset.q);
      if (!confirm(`Xóa ${Check.nameOf(s.exam, q)} khỏi đề gốc? (Thao tác này làm thay đổi số câu; ma trận sẽ báo lệch nếu cần.)`)) return;
      s.exam.questions = s.exam.questions.filter((x) => x.id !== q.id);
      UI_renumber(s.exam);
      UI.commit(); UI.render(true);
    },
    'opt-add': () => { syncDraft(); draft.options.push({ id: nextId(draftId + 'o', draft.options), html: '' }); renderEdit(); },
    'opt-del': (el) => { syncDraft(); const i = +el.dataset.i; if (draft.answer === draft.options[i].id) draft.answer = null; draft.options.splice(i, 1); renderEdit(); },
    'stm-add': () => { syncDraft(); draft.statements.push({ id: nextId(draftId + 's', draft.statements), html: '', answer: null, guide: '' }); renderEdit(); },
    'stm-del': (el) => { syncDraft(); draft.statements.splice(+el.dataset.i, 1); renderEdit(); },
  });

  /* thanh công cụ soạn thảo + sự kiện trong cửa sổ */
  document.addEventListener('mousedown', (e) => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });
  document.addEventListener('focusin', (e) => { const r = e.target.closest && e.target.closest('.redit'); if (r) lastEditor = r; });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b || !lastEditor) return;
    if (b.dataset.cmd === 'img') { $('#rich-img').click(); return; }
    lastEditor.focus();
    document.execCommand(b.dataset.cmd, false, null);
  });
  document.addEventListener('paste', (e) => {
    const r = e.target.closest && e.target.closest('.redit');
    if (!r) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'rich-img') {
      const f = t.files[0]; t.value = '';
      if (!f || !lastEditor) return;
      if (!/^image\/(png|jpe?g|gif)$/.test(f.type)) return UI.toast('Chỉ chèn được ảnh PNG, JPG hoặc GIF.', 'err');
      if (f.size > 3 * 1048576) return UI.toast('Ảnh quá lớn (tối đa 3 MB).', 'err');
      const rd = new FileReader();
      rd.onload = () => { lastEditor.focus(); document.execCommand('insertImage', false, rd.result); };
      rd.readAsDataURL(f);
      return;
    }
    if (t.dataset && t.dataset.d && t.dataset.rerender && modal) {
      syncDraft();
      if (t.dataset.d === 'type') {
        const d = draft;
        if (d.type === 'mcq' && !d.options.length) d.options = [1, 2, 3, 4].map((i) => ({ id: draftId + 'o' + i, html: '' }));
        if (d.type === 'tf' && !d.statements.length) d.statements = [1, 2, 3, 4].map((i) => ({ id: draftId + 's' + i, html: '', answer: null, guide: '' }));
        if (d.type !== 'mcq') d.answer = d.type === 'short' ? '' : null;
      }
      if (t.dataset.d === 'group' && draft.groupId && draft.groupId !== 'new') draft.passage = st().exam.groups[draft.groupId].html;
      if (t.dataset.d === 'group' && draft.groupId === 'new') draft.passage = '';
      renderEdit();
    }
  });
})(window);
