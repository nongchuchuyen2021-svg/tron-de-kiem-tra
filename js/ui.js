/* Giao diện: khung chung, thanh 5 bước, nhập tệp, Bước 1 (ma trận), Bước 3 (đối chiếu), Bước 4 (cấu hình), Bước 5 (xem trước & tải). */
(function (g) {
  const UI = {};
  g.UI = UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = U.esc;
  UI.$ = $; UI.$$ = $$;

  const ui = (UI.ui = { tab: 0, showAnswers: false, msgs: { matrix: [], exam: [], answer: [] }, genError: null, headerOpen: false, checksOpen: false });
  let st = null;
  UI.st = () => st;

  const STEPS = [
    ['Ma trận (tùy chọn)', 'Nhập ma trận đề (không bắt buộc)'],
    ['Đề gốc & đáp án', 'Nhập đề và đáp án'],
    ['Xác nhận câu hỏi', 'Xác nhận câu hỏi / đối chiếu ma trận'],
    ['Tạo mã đề', 'Cấu hình & tạo mã đề'],
    ['Xem trước & tải', 'Xem trước, tải xuống'],
  ];

  /* ------------------------------------------------------------ tiện ích giao diện */
  UI.toast = (msg, kind, ms) => {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = msg;
    el.title = 'Bấm để đóng';
    el.addEventListener('click', () => el.remove());
    const box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), ms || 6000);
  };
  UI.busy = (msg) => {
    const b = $('#busy');
    if (msg) { b.hidden = false; $('#busy-msg').textContent = msg; } else b.hidden = true;
  };
  const chip = (cls, text, title) => `<span class="chip ${cls}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
  UI.chip = chip;
  const statusChip = (s) => chip('st-' + s, Check.STATUS_LABEL[s]);
  UI.statusChip = statusChip;

  UI.commit = () => {
    Store.save();
    renderStepper();
  };

  function msgs(list) {
    if (!list || !list.length) return '';
    return `<ul class="msgs">${list.map((m) => `<li class="${m.level}">${esc(m.text)}</li>`).join('')}</ul>`;
  }
  UI.msgs = msgs;

  function dropzone(id, accept, label) {
    return `<div class="drop" data-drop="${id}" tabindex="0" role="button" aria-label="${esc(label)}">
      <input type="file" hidden data-file="${id}" accept="${accept}">
      <div class="drop-ico">⬆</div>
      <strong>${esc(label)}</strong>
      <span>Kéo thả tệp vào đây hoặc <u>bấm để chọn tệp</u></span>
      <small>${accept.split(',').join(' ')} · tối đa 25 MB</small>
    </div>`;
  }
  UI.dropzone = dropzone;

  const dataSig = () => U.hash(JSON.stringify([st.exam && st.exam.questions, st.exam && st.exam.groups, st.matrix.rows, st.config]));
  UI.dataSig = dataSig;
  const cfgForShuffle = () => Object.assign({}, st.config, { codes: st.config.codes.slice(0, st.config.count), count: st.config.count });
  UI.cfg = cfgForShuffle;

  /* ------------------------------------------------------------ thanh bước */
  function stepDone(i) {
    if (i === 1) return !st.matrix.auto && st.matrix.rows.length > 0 && st.matrix.confirmed;
    if (i === 2) return !!st.exam;
    if (i === 3) return !!st.exam && (st.matrix.auto || st.matrix.rows.length > 0) && Check.readiness(st.matrix, st.exam).canShuffle;
    if (i === 4) return !!st.result && st.result.dataSig === dataSig();
    return !!st.result && st.result.dataSig === dataSig() && st.result.verify.ok;
  }
  function renderStepper() {
    $('#stepper').innerHTML = STEPS.map((s, k) => {
      const i = k + 1;
      const cls = (i === st.step ? 'active ' : '') + (stepDone(i) ? 'done' : '');
      return `<button class="step ${cls}" data-act="goto" data-step="${i}" ${i === st.step ? 'aria-current="step"' : ''}>
        <span class="num">${stepDone(i) && i !== st.step ? '✓' : i}</span><span class="lbl">${s[0]}</span></button>`;
    }).join('<span class="sep"></span>');
  }

  /* ------------------------------------------------------------ vẽ lại */
  UI.render = function (keepScroll) {
    const y = window.scrollY;
    renderStepper();
    const views = [null, viewMatrix, UI.viewExam, viewCompare, viewConfig, viewResult];
    $('#main').innerHTML = views[st.step]();
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    if (st.step === 5) fitPaper();
    const sb = $('#save-state');
    if (sb) sb.textContent = Store.saveError ? 'Không lưu được phiên trong trình duyệt này (vẫn dùng bình thường)' : 'Tự động lưu trong trình duyệt';
  };
  const goto = (n) => { st.step = n; Store.save(); UI.render(false); };
  UI.goto = goto;

  function fitPaper() {
    const wrap = $('.paper-wrap');
    const paper = $('.paper');
    if (!wrap || !paper) return;
    const avail = wrap.clientWidth - 8;
    const need = 794;
    paper.style.zoom = avail < need ? (avail / need).toFixed(3) : '1';
  }
  window.addEventListener('resize', () => st && st.step === 5 && fitPaper());

  /* ------------------------------------------------------------ BƯỚC 1: MA TRẬN */
  function topicsOf() { return [...new Set(st.matrix.rows.map((r) => r.topic).filter(Boolean))]; }
  function levelsOf() { return [...new Set(st.matrix.rows.map((r) => r.level).filter(Boolean))]; }
  UI.topicsOf = topicsOf; UI.levelsOf = levelsOf;

  function matrixSummary() {
    const rows = st.matrix.rows;
    const tot = Matrix.totals(rows);
    const issues = Matrix.validate(rows);
    const bytype = Object.keys(tot.byType).map((t) => `${Matrix.TYPE_SHORT[t]}: <b>${tot.byType[t].count}</b> câu / <b>${U.fmt(tot.byType[t].points)}</b> đ`).join(' · ');
    return `<div class="totals"><span>Tổng số câu: <b>${tot.count}</b></span><span>Tổng điểm: <b>${U.fmt(tot.points)}</b></span><span>Số phần: <b>${tot.parts.length}</b></span></div>
      <div class="muted">${bytype}</div>${msgs(issues)}`;
  }

  function viewMatrix() {
    const rows = st.matrix.rows;
    const types = Object.keys(Matrix.TYPES);
    if (st.matrix.auto) {
      return `
    <section class="card">
      <h2>Bước 1. Ma trận đề (không bắt buộc)</h2>
      <p class="hint">Bạn <b>không cần ma trận</b> để trộn đề: chỉ cần tải đề (và đáp án) ở Bước 2. Web sẽ tự thống kê cấu trúc từ chính đề gốc và bảo đảm mọi mã đề giữ đúng số câu, số điểm, phần và dạng câu của đề gốc.</p>
      <div class="row-actions">
        <button class="btn primary" data-act="goto" data-step="2">Bỏ qua, nhập đề gốc →</button>
        <button class="btn" data-act="matrix-use">Tôi muốn đối chiếu đề với ma trận</button>
      </div>
    </section>`;
    }
    return `
    <section class="card">
      <h2>Bước 1. Nhập ma trận đề kiểm tra</h2>
      <div class="row-actions"><button class="btn sm" data-act="matrix-auto">← Không dùng ma trận, chỉ trộn đề</button></div>
      <p class="hint">Tải tệp ma trận (Word, Excel, PDF có lớp văn bản) hoặc dán nội dung từ Word/Excel. Sau đó kiểm tra và chỉnh sửa trong bảng bên dưới. Nếu bảng nhận dạng sai, bạn có thể sửa trực tiếp hoặc nhập tay từng dòng.</p>
      <div class="grid2">
        <div>${dropzone('matrix', '.docx,.xlsx,.xls,.csv,.pdf,.txt', 'Tệp ma trận')}</div>
        <div>
          <label class="lbl" for="matrix-paste">Hoặc dán nội dung ma trận</label>
          <textarea id="matrix-paste" rows="6" placeholder="Dán bảng ma trận (từ Excel/Word) vào đây. Cần có dòng tiêu đề, ví dụ:&#10;Phần | Dạng câu hỏi | Chủ đề | Mức độ | Số câu | Điểm | Vị trí câu"></textarea>
          <div class="row-actions"><button class="btn" data-act="matrix-parse">Phân tích nội dung đã dán</button></div>
        </div>
      </div>
      <div id="matrix-msgs">${msgs(ui.msgs.matrix)}</div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Ma trận (có thể chỉnh sửa)</h3>
        <div class="row-actions"><button class="btn sm" data-act="mrow-add">+ Thêm dòng</button><button class="btn sm ghost" data-act="matrix-clear" ${rows.length ? '' : 'disabled'}>Xóa toàn bộ</button></div></div>
      <div class="table-wrap"><table class="grid editable" id="matrix-table">
        <thead><tr><th>#</th><th>Phần</th><th>Dạng câu hỏi</th><th>Chủ đề / đơn vị kiến thức</th><th>Mức độ nhận thức</th><th>Số câu</th><th>Điểm</th><th title="Không bắt buộc. Ví dụ: 1-4, 7">Vị trí câu</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-row="${r.id}">
          <td class="c">${i + 1}</td>
          <td><input data-f="part" value="${esc(r.part)}" size="9"></td>
          <td><select data-f="type">${types.map((t) => `<option value="${t}" ${t === r.type ? 'selected' : ''}>${Matrix.TYPE_SHORT[t]}</option>`).join('')}</select></td>
          <td><input data-f="topic" list="dl-topics" value="${esc(r.topic)}"></td>
          <td><input data-f="level" list="dl-levels" value="${esc(r.level)}" size="10"></td>
          <td><input data-f="count" type="number" min="0" step="1" value="${r.count}" class="num"></td>
          <td><input data-f="points" inputmode="decimal" value="${U.fmt(r.points)}" class="num"></td>
          <td><input data-f="positions" value="${esc(r.positions)}" size="9" placeholder="tùy chọn"></td>
          <td class="c"><button class="icon-btn" data-act="mrow-del" title="Xóa dòng" aria-label="Xóa dòng ${i + 1}">✕</button></td></tr>`).join('') || `<tr><td colspan="9" class="empty">Chưa có dòng nào. Hãy tải tệp, dán nội dung hoặc bấm "+ Thêm dòng".</td></tr>`}</tbody></table></div>
      <datalist id="dl-topics">${topicsOf().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <datalist id="dl-levels">${levelsOf().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <div id="matrix-summary">${matrixSummary()}</div>
      <div class="row-actions end">
        ${st.matrix.confirmed ? chip('st-ok', 'Ma trận đã được xác nhận') : ''}
        <button class="btn primary" data-act="matrix-confirm" ${rows.length ? '' : 'disabled'}>Xác nhận ma trận &amp; sang Bước 2 →</button>
      </div>
    </section>`;
  }

  function matrixChanged() {
    st.matrix.confirmed = false;
    UI.commit();
    const sum = $('#matrix-summary');
    if (sum) sum.innerHTML = matrixSummary();
    const bar = $('#stepper');
    if (bar) renderStepper();
  }

  async function importMatrix(file) {
    const err = Readers.check(file, ['docx', 'xlsx', 'xls', 'csv', 'pdf', 'txt', 'md']);
    if (err) return setMsgs('matrix', [{ level: 'error', text: err }]);
    try {
      UI.busy('Đang đọc ma trận từ "' + file.name + '"…');
      const res = await Readers.readMatrix(file, (m) => UI.busy(m));
      applyMatrixResult(res, file.name);
    } catch (e) {
      setMsgs('matrix', [{ level: 'error', text: 'Không đọc được tệp: ' + e.message + ' Hãy thử dán nội dung ma trận vào ô bên cạnh hoặc nhập trực tiếp vào bảng.' }]);
    } finally { UI.busy(); }
  }
  function applyMatrixResult(res, source) {
    if (!res.rows || !res.rows.length) {
      return setMsgs('matrix', [{ level: 'error', text: 'Chưa nhận dạng được dòng ma trận nào.' }].concat((res.warnings || []).map((w) => ({ level: 'warn', text: w })), [{ level: 'warn', text: 'Gợi ý: bảng cần có dòng tiêu đề (Chủ đề, Mức độ, Số câu, Điểm…). Bạn cũng có thể nhập trực tiếp vào bảng bên dưới.' }]));
    }
    if (st.matrix.rows.length && !confirm('Thay thế ma trận hiện tại bằng ma trận vừa đọc?')) return;
    st.matrix.auto = false;
    st.matrix.rows = res.rows;
    st.matrix.source = source;
    st.matrix.confirmed = false;
    UI.commit();
    setMsgs('matrix', [{ level: 'ok', text: `Đã nhận dạng ${res.rows.length} dòng ma trận từ ${source}${res.from ? ' (' + res.from + ')' : ''}. Hãy kiểm tra từng dòng trong bảng rồi bấm "Xác nhận ma trận".` }].concat((res.warnings || []).map((w) => ({ level: 'warn', text: w }))));
  }
  function setMsgs(key, list) { ui.msgs[key] = list; UI.render(true); }
  UI.setMsgs = setMsgs;

  /* ------------------------------------------------------------ BƯỚC 3: ĐỐI CHIẾU */
  function viewCompare() {
    if (!st.exam || !(st.matrix.auto || st.matrix.rows.length)) {
      return `<section class="card"><h2>Bước 3. Đối chiếu đề gốc với ma trận</h2><p class="notice warn">Cần hoàn thành Bước 1 (ma trận) và Bước 2 (đề gốc) trước.</p>
      <div class="row-actions"><button class="btn" data-act="goto" data-step="${st.matrix.rows.length ? 2 : 1}">Quay lại bước còn thiếu</button></div></section>`;
    }
    const exam = st.exam;
    const rd = Check.readiness(st.matrix, exam);
    const res = rd.res;
    const topics = topicsOf(), levels = levelsOf();
    const nConf = exam.questions.filter((q) => q.confirmed).length;
    const sel = (list, val, f, qid) => `<select data-qf="${f}" data-q="${qid}"><option value="">— chưa gán —</option>${list.concat(val && !list.includes(val) ? [val] : []).map((x) => `<option ${x === val ? 'selected' : ''} value="${esc(x)}">${esc(x)}</option>`).join('')}</select>`;
    const ansCell = (q) => {
      const s = Check.answerState(q);
      let txt = '';
      if (q.type === 'mcq') txt = q.answer ? U.letters[q.options.findIndex((o) => o.id === q.answer)] : '';
      else if (q.type === 'tf') txt = q.statements.map((x) => (x.answer ? (x.answer === 'D' ? 'Đ' : 'S') : '?')).join('');
      else if (q.type === 'short') txt = q.answer || '';
      if (s === 'na') return '<span class="muted">—</span>';
      if (s === 'missing') return chip('st-bad', 'Chưa có', 'Bổ sung đáp án trong Bước 2');
      return `<b>${esc(txt)}</b> ` + (s === 'ok' ? '<span class="ok-mark" title="Đã xác nhận">✓</span>' : chip('st-check', 'chưa xác nhận'));
    };
    return `
    <section class="card">
      <h2>${st.matrix.auto ? 'Bước 3. Xác nhận câu hỏi' : 'Bước 3. Đối chiếu đề gốc với ma trận'}</h2>
      ${st.matrix.auto
        ? '<p class="hint">Kiểm tra lại các câu đã nhận dạng rồi bấm "Xác nhận tất cả câu hỏi". Chủ đề, mức độ và điểm là <b>không bắt buộc</b>: câu chưa gán sẽ được xếp vào "Toàn đề / Chưa phân loại". Nếu muốn chỉ trộn các câu cùng mức độ, hãy gán mức độ cho từng câu ở bảng dưới.</p>'
        : '<p class="hint">Mỗi câu của đề gốc cần được gán <b>chủ đề</b> và <b>mức độ</b> đúng như ma trận. Nút "Gợi ý" chỉ là <b>đề xuất theo thứ tự/vị trí trong ma trận</b>, không phải kết quả đã duyệt — bạn cần kiểm tra và xác nhận từng câu.</p>'}
      <div class="row-actions">
        ${st.matrix.auto ? '' : '<button class="btn" data-act="suggest">Gợi ý phân loại theo ma trận</button>'}
        <button class="btn" data-act="confirm-all-q">Xác nhận tất cả câu hỏi</button>
        <span class="muted">${nConf}/${exam.questions.length} câu đã xác nhận</span>
      </div>
      ${res.errors === 0 ? `<p class="notice ok">Đề gốc khớp ma trận về số phần, dạng câu, số câu, chủ đề, mức độ, điểm${st.matrix.rows.some((r) => r.positions) ? ' và vị trí câu' : ''}.</p>` : `<p class="notice err">Có <b>${res.errors}</b> sai lệch cần xử lý. Hệ thống không tự bỏ câu, thêm câu hay đổi mức độ — hãy sửa dữ liệu ở bảng dưới hoặc ở Bước 2.</p>`}
      ${res.issues.length ? `<ul class="msgs">${res.issues.map((i) => `<li class="${i.level === 'error' ? 'error' : 'warn'}">${esc(i.text)}</li>`).join('')}</ul>` : ''}
    </section>
    <section class="card">
      <h3>Đối chiếu theo từng dòng ma trận</h3>
      <div class="table-wrap"><table class="grid"><thead><tr><th>Dạng câu hỏi</th><th>Chủ đề</th><th>Mức độ</th><th>Ma trận (câu)</th><th>Đề gốc (câu)</th><th>Ma trận (điểm)</th><th>Đề gốc (điểm)</th><th>Kết quả</th></tr></thead>
      <tbody>${res.table.map((t) => `<tr class="${t.ok ? '' : 'row-bad'}"><td>${Matrix.TYPE_SHORT[t.type]}</td><td>${esc(t.topic)}</td><td>${esc(t.level)}</td><td class="c">${t.need}</td><td class="c">${t.have}</td><td class="c">${U.fmt(t.needPts)}</td><td class="c">${U.fmt(t.havePts)}</td><td>${t.ok ? chip('st-ok', 'Khớp') : chip('st-bad', 'Chưa khớp')}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="card">
      <h3>Danh sách câu hỏi của đề gốc</h3>
      <div class="table-wrap"><table class="grid" id="cmp-table"><thead><tr><th>Câu gốc</th><th>Dạng câu</th><th>Chủ đề</th><th>Mức độ</th><th>Điểm</th><th>Đáp án</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${exam.questions.map((q) => {
        const s = Check.qStatus(q, res);
        const sug = q.classSource === 'suggest' && !q.confirmed;
        return `<tr class="${s === 'bad' ? 'row-bad' : ''}"><td class="nw"><b>${esc(Check.nameOf(exam, q))}</b>${q.group ? ' ' + chip('grp', 'Nhóm ' + q.group) : ''}</td>
          <td>${Matrix.TYPE_SHORT[q.type]}</td>
          <td>${sel(topics, q.topic, 'topic', q.id)}${sug ? '<div class="sug">gợi ý</div>' : ''}</td>
          <td>${sel(levels, q.level, 'level', q.id)}</td>
          <td><input class="num" data-qf="points" data-q="${q.id}" inputmode="decimal" value="${q.points == null ? '' : U.fmt(q.points)}"></td>
          <td class="nw">${ansCell(q)}</td>
          <td>${statusChip(s)}</td>
          <td class="nw"><button class="btn sm ${q.confirmed ? 'ghost' : ''}" data-act="toggle-confirm" data-q="${q.id}">${q.confirmed ? 'Bỏ xác nhận' : 'Xác nhận'}</button> <button class="btn sm ghost" data-act="edit-q" data-q="${q.id}">Sửa</button></td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="row-actions end">
        <button class="btn" data-act="goto" data-step="2">← Quay lại Bước 2</button>
        <button class="btn primary" data-act="goto" data-step="4" ${rd.canShuffle ? '' : 'disabled'}>Sang Bước 4: chọn số mã đề →</button>
      </div>
      ${rd.canShuffle ? '' : `<p class="notice warn">Chưa thể sang bước tạo mã đề vì: <ul>${rd.blockers.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join('')}${rd.blockers.length > 6 ? `<li>… và ${rd.blockers.length - 6} vấn đề khác</li>` : ''}</ul></p>`}
    </section>`;
  }

  /* ------------------------------------------------------------ BƯỚC 4: CẤU HÌNH */
  function defaultCodes() {
    const c = st.config;
    return Array.from({ length: c.count }, (_, i) => String(+c.startCode + i));
  }
  function codeIssues() {
    const codes = st.config.codes.slice(0, st.config.count).map((x) => String(x).trim());
    const out = [];
    if (codes.some((c) => !c)) out.push('Có mã đề để trống.');
    if (new Set(codes).size !== codes.length) out.push('Có mã đề bị trùng nhau.');
    if (codes.some((c) => /[\\/:*?"<>|]/.test(c))) out.push('Mã đề không được chứa ký tự đặc biệt \\ / : * ? " < > |.');
    return out;
  }

  function viewConfig() {
    if (!st.exam) return `<section class="card"><h2>Bước 4. Tạo mã đề</h2><p class="notice warn">Cần nhập đề gốc trước (Bước 2).</p><div class="row-actions"><button class="btn" data-act="goto" data-step="1">Về Bước 1</button></div></section>`;
    const c = st.config;
    const rd = Check.readiness(st.matrix, st.exam);
    const locks = Shuffle.lockReport(st.exam, st.matrix, UI.cfg());
    const prep = Shuffle.prepare(st.exam, st.matrix, UI.cfg());
    const ci = codeIssues();
    const tfs = st.exam.questions.filter((q) => q.type === 'tf');
    const tfOk = tfs.length && tfs.every((q) => q.tfIndependent);
    const chk = (k, label, extra, disabled) => `<label class="check"><input type="checkbox" data-cfg="${k}" ${c[k] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span><b>${label}</b>${extra ? `<small>${extra}</small>` : ''}</span></label>`;
    return `
    <section class="card">
      <h2>Bước 4. Chọn số mã đề &amp; tạo mã đề</h2>
      <p class="hint">Mã đề được tạo bằng cách <b>đảo thứ tự câu và phương án</b> của đề gốc theo quy tắc xác định (không dùng AI, không sáng tác câu mới). Nội dung, số liệu, hình ảnh, điểm và mức độ của từng câu được giữ nguyên.</p>
      ${rd.answersReady ? '' : `<div class="notice warn"><b>Đề chưa có đủ đáp án đã xác nhận.</b> Vẫn tạo được mã đề, nhưng web <b>không thể cân đối vị trí đáp án A/B/C/D</b> (đáp án có thể dồn vào một vài chữ cái) và <b>chưa xuất bảng đáp án, hướng dẫn chấm</b>. Hãy nạp đáp án ở Bước 2 và xác nhận trước khi tạo.<br><button class="btn sm" data-act="goto" data-step="2">Về Bước 2 để nạp đáp án</button></div>`}
      ${rd.canShuffle ? '' : `<div class="notice warn"><b>Chưa thể tạo mã đề.</b> Cần xử lý trước:<ul>${rd.blockers.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join('')}${rd.blockers.length > 6 ? `<li>… và ${rd.blockers.length - 6} vấn đề khác</li>` : ''}</ul><button class="btn sm" data-act="goto" data-step="3">Đến Bước 3</button></div>`}
      <h3>Số lượng mã đề</h3>
      <div class="count-picker" role="radiogroup" aria-label="Số lượng mã đề">
        ${[2, 3, 4].map((n) => `<button class="count-card ${c.count === n ? 'on' : ''}" role="radio" aria-checked="${c.count === n}" data-act="set-count" data-n="${n}"><span class="big">${n}</span><span>mã đề</span><small>${Array.from({ length: n }, (_, i) => +c.startCode + i).join(', ')}</small></button>`).join('')}
      </div>
      <div class="grid3">
        <div><label class="lbl" for="start-code">Mã đề bắt đầu</label><input id="start-code" type="number" min="1" value="${esc(c.startCode)}" data-act-change="start-code"></div>
        <div class="span2"><label class="lbl">Mã đề (có thể sửa)</label><div class="codes">${c.codes.slice(0, c.count).map((x, i) => `<input data-code="${i}" value="${esc(x)}" aria-label="Mã đề ${i + 1}">`).join('')}</div>${ci.length ? `<div class="notice err">${ci.map(esc).join(' ')}</div>` : ''}</div>
      </div>
      <h3>Tùy chọn trộn</h3>
      <div class="opts">
        ${chk('shuffleQ', 'Đảo thứ tự câu hỏi', 'Chỉ đảo trong phạm vi từng phần; câu chùm di chuyển cùng nhau.')}
        ${chk('shuffleOpt', 'Đảo thứ tự phương án trả lời', 'Đáp án tự động cập nhật theo vị trí mới. Phương án kiểu "A và B đều đúng" tự động khóa.')}
        ${chk('keepParts', 'Giữ nguyên thứ tự các phần', 'Hiện luôn giữ nguyên thứ tự các phần (chưa hỗ trợ đảo phần).', true)}
        ${chk('withinLevel', 'Chỉ đảo câu trong cùng mức độ nhận thức', 'Câu mức Biết chỉ đổi chỗ với câu mức Biết… (ít khác biệt hơn).')}
        ${chk('balanceAnswers', 'Cân đối vị trí đáp án A, B, C, D', 'Chọn phương án sắp xếp sao cho đáp án đúng phân bố tương đối đều; không phá vỡ các khóa.')}
        <label class="check"><input type="checkbox" data-cfg="tfShuffle" ${c.tfShuffle ? 'checked' : ''}><span><b>Đảo thứ tự các ý a, b, c, d của câu đúng/sai</b><small>Mặc định tắt. Chỉ áp dụng cho câu bạn xác nhận các ý độc lập với nhau.</small></span></label>
        ${c.tfShuffle ? `<div class="sub-opt">${tfs.length ? `<button class="btn sm" data-act="tf-independent" data-v="${tfOk ? 0 : 1}">${tfOk ? 'Bỏ xác nhận' : 'Tôi xác nhận các ý của TẤT CẢ câu đúng/sai là độc lập'}</button> <span class="muted">${tfs.filter((q) => q.tfIndependent).length}/${tfs.length} câu đã xác nhận (có thể xác nhận riêng từng câu ở Bước 2)</span>` : '<span class="muted">Đề không có câu đúng/sai.</span>'}</div>` : ''}
      </div>
      <div class="grid3">
        <div><label class="lbl" for="seed">Seed (giá trị khởi tạo ngẫu nhiên)</label><div class="inline"><input id="seed" type="number" value="${c.seed}" data-act-change="seed"><button class="btn sm" data-act="new-seed">Đổi seed</button></div><small class="muted">Cùng seed + cùng cấu hình + cùng dữ liệu ⇒ tạo lại đúng bộ mã đề.</small></div>
        <div class="span2"><div class="stat-line">Số cách sắp xếp khả dĩ với các khóa hiện tại: <b>${prep.capacity >= 1e18 ? 'rất lớn' : Math.floor(prep.capacity).toLocaleString('vi-VN')}</b></div></div>
      </div>
    </section>
    <section class="card">
      <h3>Câu bị khóa (giữ nguyên vị trí/phương án)</h3>
      ${locks.length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>Câu</th><th>Loại khóa</th><th>Lý do</th><th></th></tr></thead><tbody>${locks.map((l) => {
        const q = st.exam.questions.find((x) => x.id === l.qid);
        return `<tr><td class="nw"><b>${esc(Check.nameOf(st.exam, q))}</b></td><td>${l.kind === 'position' ? 'Khóa vị trí' : 'Khóa phương án'}</td><td>${esc(l.reasons.join('; '))}</td><td><button class="btn sm ghost" data-act="edit-q" data-q="${q.id}">Sửa khóa</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted">Không có câu nào bị khóa.</p>'}
    </section>
    ${ui.genError ? `<section class="card"><div class="notice err"><b>Không tạo được đủ mã đề khác nhau.</b><ul>${ui.genError.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div></section>` : ''}
    <div class="sticky-bar"><button class="btn" data-act="goto" data-step="3">← Bước 3</button>
      <button class="btn primary lg" data-act="generate" ${rd.canShuffle && !ci.length ? '' : 'disabled'}>Tạo mã đề</button></div>`;
  }

  function doGenerate() {
    const rd = Check.readiness(st.matrix, st.exam);
    if (!rd.canShuffle) return UI.toast('Còn sai lệch bắt buộc chưa xử lý (xem Bước 3).', 'err');
    if (codeIssues().length) return UI.toast(codeIssues().join(' '), 'err');
    const config = UI.cfg();
    ui.genError = null;
    const r = Shuffle.generate(st.exam, st.matrix, config);
    if (!r.ok) { ui.genError = r.errors; UI.render(true); window.scrollTo(0, document.body.scrollHeight); return; }
    const verify = Shuffle.verify(st.exam, st.matrix, r.versions, config);
    const rdNow = Check.readiness(st.matrix, st.exam);
    if (!rdNow.answersReady) r.warnings = (r.warnings || []).concat(['Đề chưa có đủ đáp án đã xác nhận: vị trí đáp án A/B/C/D chưa được cân đối và chưa có bảng đáp án. Nạp đáp án rồi tạo lại.']);
    st.result = { versions: r.versions, verify, warnings: r.warnings, generatedAt: Date.now(), dataSig: dataSig(), config: U.clone(config) };
    ui.tab = 0;
    st.step = 5;
    Store.save();
    UI.render(false);
    UI.toast(verify.ok ? `Đã tạo ${r.versions.length} mã đề và kiểm tra đạt.` : 'Đã tạo mã đề nhưng có mục kiểm tra KHÔNG ĐẠT — xem báo cáo.', verify.ok ? 'ok' : 'err');
  }

  /* ------------------------------------------------------------ BƯỚC 5: XEM TRƯỚC & TẢI */
  function ctxForExport() {
    const rd = Check.readiness(st.matrix, st.exam);
    return { exam: st.exam, matrix: st.matrix, config: st.result.config, meta: st.meta, versions: st.result.versions, verify: st.result.verify, generatedAt: st.result.generatedAt, answersReady: rd.answersReady, answerBlockers: rd.answerBlockers };
  }

  function viewResult() {
    const r = st.result;
    if (!r) return `<section class="card"><h2>Bước 5. Xem trước &amp; tải xuống</h2><p class="notice warn">Chưa có mã đề nào. Hãy hoàn thành Bước 4 và bấm "Tạo mã đề".</p><div class="row-actions"><button class="btn" data-act="goto" data-step="4">Về Bước 4</button></div></section>`;
    const stale = r.dataSig !== dataSig();
    const ctx = ctxForExport();
    const files = ExportFiles.plan(ctx);
    ui.files = files;
    const v = r.versions[Math.min(ui.tab, r.versions.length - 1)];
    const meta = st.meta;
    const fld = (k, label, ph) => `<div><label class="lbl">${label}</label><input data-meta="${k}" value="${esc(meta[k])}" placeholder="${esc(ph || '')}"></div>`;
    const passAll = r.verify.ok;
    const cur = files.filter((f) => f.code === v.code);
    const failed = r.verify.rows.filter((x) => !x.ok);
    return `
    <section class="card">
      <h2>Bước 5. Xem trước &amp; tải xuống</h2>
      ${stale ? `<div class="notice err"><b>Dữ liệu đã thay đổi sau lần tạo mã đề.</b> Các mã đề dưới đây có thể không còn khớp. Hãy quay lại Bước 4 và tạo lại trước khi tải xuống.<div class="row-actions"><button class="btn" data-act="goto" data-step="4">Về Bước 4</button></div></div>` : ''}
      <div class="notice ${passAll ? 'ok' : 'err'}">${passAll ? `Đã tạo <b>${r.versions.length}</b> mã đề (${r.versions.map((x) => x.code).join(', ')}) — mọi mục kiểm tra tự động đều ĐẠT.` : `<b>${failed.length}</b> mục kiểm tra KHÔNG ĐẠT. Không nên dùng bộ đề này cho tới khi xử lý.`} <button class="btn sm ghost" data-act="toggle-checks">${ui.checksOpen ? 'Ẩn' : 'Xem'} báo cáo kiểm tra</button></div>
      ${r.warnings && r.warnings.length ? `<ul class="msgs">${r.warnings.map((w) => `<li class="warn">${esc(w)}</li>`).join('')}</ul>` : ''}
      ${ui.checksOpen ? `<div class="table-wrap"><table class="grid"><thead><tr><th>Mã đề</th><th>Nội dung kiểm tra</th><th>Kết quả</th><th>Chi tiết</th></tr></thead><tbody>${r.verify.rows.map((x) => `<tr class="${x.ok ? '' : 'row-bad'}"><td class="c">${esc(x.code)}</td><td>${esc(x.check)}</td><td>${x.ok ? chip('st-ok', 'Đạt') : chip('st-bad', 'Không đạt')}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h3>Thông tin đầu đề</h3><button class="btn sm ghost" data-act="toggle-header">${ui.headerOpen ? 'Thu gọn' : 'Chỉnh sửa'}</button></div>
      ${ui.headerOpen ? `<div class="grid4">
        ${fld('dept', 'Sở / Phòng GD&ĐT', 'SỞ GD&ĐT …')}${fld('school', 'Tên trường', 'TRƯỜNG THPT …')}${fld('title', 'Tên bài kiểm tra', 'KIỂM TRA GIỮA KÌ I')}${fld('subject', 'Môn học', 'Tin học')}
        ${fld('grade', 'Lớp', '12')}${fld('year', 'Năm học', '2025-2026')}${fld('time', 'Thời gian làm bài', '45 phút')}
        <div class="checks"><label class="check"><input type="checkbox" data-meta-bool="studentLine" ${meta.studentLine ? 'checked' : ''}><span>In dòng họ tên, lớp, SBD của học sinh</span></label><label class="check"><input type="checkbox" data-meta-bool="official" ${meta.official ? 'checked' : ''}><span>In dòng "ĐỀ CHÍNH THỨC"</span></label></div>
      </div>` : `<p class="muted">${esc([meta.dept, meta.school, meta.title, meta.subject && 'Môn ' + meta.subject, meta.grade && 'Lớp ' + meta.grade, meta.year, meta.time].filter(Boolean).join(' · ') || 'Chưa nhập thông tin đầu đề. Bấm "Chỉnh sửa" để nhập tên trường, môn, lớp, thời gian…')}</p>`}
    </section>
    <section class="card">
      <div class="tabs" role="tablist">${r.versions.map((x, i) => `<button role="tab" class="tab ${i === ui.tab ? 'on' : ''}" aria-selected="${i === ui.tab}" data-act="tab" data-i="${i}">Mã đề ${esc(x.code)}</button>`).join('')}</div>
      <div class="dl-bar">
        <button class="btn primary" data-act="dl" data-id="${esc(cur.find((f) => f.kind === 'docx' && f.folder === 'De').id)}" ${stale ? 'disabled' : ''}>Tải Word</button>
        <button class="btn primary" data-act="dl" data-id="${esc(cur.find((f) => f.kind === 'pdf' && f.folder === 'De').id)}" ${stale ? 'disabled' : ''}>Tải PDF</button>
        <button class="btn" data-act="dl-all" ${stale ? 'disabled' : ''}>Tải toàn bộ (ZIP)</button>
        <label class="check inline"><input type="checkbox" data-act-change="show-ans" ${ui.showAnswers ? 'checked' : ''}><span>Hiện đáp án bên dưới</span></label>
      </div>
      <div class="paper-wrap"><div class="paper">${Doc.toHtml(Doc.examModel(st.exam, v, meta))}</div></div>
      ${ui.showAnswers ? (ctx.answersReady ? `<h3>Đáp án mã đề ${esc(v.code)}</h3><div class="paper-wrap"><div class="paper small">${Doc.toHtml(Doc.answerModel(st.exam, v, meta))}</div></div>` : `<p class="notice warn">Chưa hiển thị bảng đáp án chính thức vì chưa xác nhận đủ đáp án. ${esc(ctx.answerBlockers.join(' '))} <button class="btn sm" data-act="goto" data-step="2">Đến Bước 2</button></p>`) : ''}
    </section>
    <section class="card">
      <h3>Danh sách tệp xuất ra</h3>
      <p class="hint">Đề dành cho học sinh được tách riêng khỏi đáp án và hướng dẫn chấm.</p>
      <div class="table-wrap"><table class="grid"><thead><tr><th>Nhóm</th><th>Tệp</th><th>Nội dung</th><th></th></tr></thead><tbody>
      ${files.map((f) => `<tr><td>${{ De: 'Đề học sinh', DapAn: 'Đáp án', HuongDanCham: 'Hướng dẫn chấm', BaoCao: 'Báo cáo' }[f.folder]}</td><td class="nw">${esc(f.name)}</td><td>${esc(f.label)}</td><td class="nw">${f.disabledReason ? `<span class="muted" title="${esc(f.disabledReason)}">Chưa thể xuất</span>` : `<button class="btn sm" data-act="dl" data-id="${esc(f.id)}" ${stale ? 'disabled' : ''}>Tải</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      ${ctx.answersReady ? '' : `<p class="notice warn">Bảng đáp án và hướng dẫn chấm chỉ xuất khi đã xác nhận đủ đáp án. ${esc(ctx.answerBlockers.join(' '))}</p>`}
      ${Doc.hasGuide(st.exam) ? '' : '<p class="muted">Đề gốc không có hướng dẫn chấm nên không tạo tệp hướng dẫn chấm.</p>'}
      <div class="row-actions end"><button class="btn" data-act="goto" data-step="4">← Chỉnh cấu hình / tạo lại</button><button class="btn" data-act="save-project">Lưu dự án (.json)</button></div>
    </section>`;
  }

  async function download(id) {
    const f = (ui.files || []).find((x) => x.id === id);
    if (!f) return;
    try {
      UI.busy('Đang tạo ' + f.name + '…');
      await new Promise((r) => setTimeout(r, 30));
      ExportFiles.download(await f.make(), f.name);
    } catch (e) { UI.toast('Không tạo được tệp ' + f.name + ': ' + e.message, 'err', 9000); console.error(e); }
    finally { UI.busy(); }
  }
  async function downloadAll() {
    try {
      UI.busy('Đang đóng gói…');
      await new Promise((r) => setTimeout(r, 30));
      const blob = await ExportFiles.zip(ui.files, (m) => UI.busy(m));
      ExportFiles.download(blob, `TronDe_${[U.fold(st.meta.subject), U.fold(st.meta.grade)].filter(Boolean).join('').replace(/[^a-z0-9]/g, '') || 'KiemTra'}_${st.result.versions.length}MaDe.zip`);
      UI.toast('Đã tải gói ZIP gồm đề, đáp án và báo cáo.', 'ok');
    } catch (e) { UI.toast('Không tạo được gói ZIP: ' + e.message, 'err', 9000); console.error(e); }
    finally { UI.busy(); }
  }

  /* ------------------------------------------------------------ sự kiện chung */
  const actions = {
    goto: (el) => goto(+el.dataset.step),
    'matrix-parse': () => {
      const text = $('#matrix-paste').value;
      if (!text.trim()) return setMsgs('matrix', [{ level: 'error', text: 'Ô dán đang trống. Hãy dán nội dung ma trận (có dòng tiêu đề) rồi bấm lại.' }]);
      applyMatrixResult(Matrix.fromText(text), 'nội dung đã dán');
    },
    'matrix-use': () => { st.matrix = { rows: [], confirmed: false, source: '', auto: false }; UI.commit(); UI.render(false); },
    'matrix-auto': () => {
      if (st.matrix.rows.length && !confirm('Bỏ ma trận đã nhập và chỉ trộn theo đề gốc?')) return;
      st.matrix = { rows: [], confirmed: false, source: '', auto: true }; UI.commit(); UI.render(false);
    },
    'mrow-add': () => { st.matrix.rows.push(Matrix.newRow({ part: st.matrix.rows.length ? st.matrix.rows[st.matrix.rows.length - 1].part : 'Phần I', type: st.matrix.rows.length ? st.matrix.rows[st.matrix.rows.length - 1].type : 'mcq' })); matrixChanged(); UI.render(true); },
    'mrow-del': (el) => { const id = el.closest('tr').dataset.row; st.matrix.rows = st.matrix.rows.filter((r) => r.id !== id); matrixChanged(); UI.render(true); },
    'matrix-clear': () => { if (confirm('Xóa toàn bộ các dòng của ma trận?')) { st.matrix.rows = []; matrixChanged(); UI.render(true); } },
    'matrix-confirm': () => {
      const errs = Matrix.validate(st.matrix.rows).filter((i) => i.level === 'error');
      if (errs.length) return UI.toast('Ma trận còn lỗi: ' + errs[0].text, 'err');
      st.matrix.confirmed = true; UI.commit();
      goto(2);
      UI.toast('Đã xác nhận ma trận.', 'ok');
    },
    suggest: () => {
      const n = Check.suggest(st.matrix, st.exam);
      UI.commit();
      UI.render(true);
      UI.toast(n ? `Đã gợi ý phân loại cho ${n} câu theo ma trận. Đây chỉ là gợi ý — hãy kiểm tra rồi xác nhận.` : 'Không có câu nào cần gợi ý thêm.', n ? 'info' : 'warn');
    },
    'confirm-all-q': () => { st.exam.questions.forEach((q) => (q.confirmed = true)); UI.commit(); UI.render(true); },
    'toggle-confirm': (el) => { const q = st.exam.questions.find((x) => x.id === el.dataset.q); q.confirmed = !q.confirmed; UI.commit(); UI.render(true); },
    'set-count': (el) => { st.config.count = +el.dataset.n; st.config.codes = defaultCodes(); UI.commit(); UI.render(true); },
    'new-seed': () => { st.config.seed = Math.floor(Math.random() * 2147483646) + 1; UI.commit(); UI.render(true); },
    'tf-independent': (el) => { st.exam.questions.filter((q) => q.type === 'tf').forEach((q) => (q.tfIndependent = el.dataset.v === '1')); UI.commit(); UI.render(true); },
    generate: doGenerate,
    tab: (el) => { ui.tab = +el.dataset.i; UI.render(true); },
    'toggle-header': () => { ui.headerOpen = !ui.headerOpen; UI.render(true); },
    'toggle-checks': () => { ui.checksOpen = !ui.checksOpen; UI.render(true); },
    dl: (el) => download(el.dataset.id),
    'dl-all': downloadAll,
    'save-project': () => ExportFiles.download(new Blob([Store.exportProject()], { type: 'application/json' }), 'DuAn_TronDe.json'),
  };
  UI.actions = actions;

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (el && actions[el.dataset.act] && el.tagName !== 'INPUT') {
      if (el.disabled) return;
      actions[el.dataset.act](el, e);
      return;
    }
    const drop = e.target.closest('.drop');
    if (drop) $('input[type=file]', drop).click();
  }

  function onChange(e) {
    const t = e.target;
    // bảng ma trận
    const tr = t.closest('#matrix-table tr[data-row]');
    if (tr && t.dataset.f) {
      const row = st.matrix.rows.find((r) => r.id === tr.dataset.row);
      const f = t.dataset.f;
      if (f === 'count') row.count = Math.max(0, parseInt(t.value, 10) || 0);
      else if (f === 'points') { const n = U.num(t.value); row.points = isNaN(n) ? 0 : n; t.value = U.fmt(row.points); }
      else row[f] = t.value.trim();
      if (f === 'topic' || f === 'level') { $('#dl-topics').innerHTML = topicsOf().map((x) => `<option value="${esc(x)}">`).join(''); $('#dl-levels').innerHTML = levelsOf().map((x) => `<option value="${esc(x)}">`).join(''); }
      return matrixChanged();
    }
    // bảng đối chiếu
    if (t.dataset.qf) {
      const q = st.exam.questions.find((x) => x.id === t.dataset.q);
      if (t.dataset.qf === 'points') { const n = U.num(t.value); q.points = isNaN(n) ? null : n; q.pointsSource = 'teacher'; }
      else { q[t.dataset.qf] = t.value; q.classSource = 'teacher'; }
      q.confirmed = false;
      UI.commit();
      return UI.render(true);
    }
    if (t.dataset.cfg) { st.config[t.dataset.cfg] = t.checked; UI.commit(); return UI.render(true); }
    if (t.dataset.code != null) { st.config.codes[+t.dataset.code] = t.value.trim(); UI.commit(); return UI.render(true); }
    if (t.dataset.actChange === 'start-code') { st.config.startCode = Math.max(1, parseInt(t.value, 10) || 101); st.config.codes = defaultCodes(); UI.commit(); return UI.render(true); }
    if (t.dataset.actChange === 'seed') { st.config.seed = Math.max(1, parseInt(t.value, 10) || 1); UI.commit(); return UI.render(true); }
    if (t.dataset.actChange === 'show-ans') { ui.showAnswers = t.checked; return UI.render(true); }
    if (t.dataset.meta) { st.meta[t.dataset.meta] = t.value; Store.save(); const p = $('.paper'); if (p && st.result) p.innerHTML = Doc.toHtml(Doc.examModel(st.exam, st.result.versions[ui.tab], st.meta)); return; }
    if (t.dataset.metaBool) { st.meta[t.dataset.metaBool] = t.checked; Store.save(); const p = $('.paper'); if (p && st.result) p.innerHTML = Doc.toHtml(Doc.examModel(st.exam, st.result.versions[ui.tab], st.meta)); return; }
    if (t.dataset.file) {
      const file = t.files[0];
      t.value = '';
      if (file) UI.handleFile(t.dataset.file, file);
    }
  }
  UI.handleFile = (kind, file) => {
    if (kind === 'matrix') importMatrix(file);
    else if (kind === 'exam') UI.importExam(file);
    else if (kind === 'answer') UI.importAnswer(file);
    else if (kind === 'project') openProject(file);
  };

  async function openProject(file) {
    try {
      Store.importProject(await file.text());
      st = Store.state;
      UI.st = () => st;
      Store.save();
      UI.render(false);
      UI.toast('Đã mở dự án. Bạn có thể bấm "Tạo mã đề" ở Bước 4 để tạo lại đúng bộ mã đề (cùng seed).', 'ok', 9000);
    } catch (e) { UI.toast('Không mở được dự án: ' + e.message, 'err'); }
  }

  function bindGlobal() {
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('drop')) { e.preventDefault(); $('input[type=file]', e.target).click(); }
      if (e.key === 'Escape' && UI.closeModal) UI.closeModal();
    });
    ['dragover', 'dragenter'].forEach((ev) => document.addEventListener(ev, (e) => { const d = e.target.closest && e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { const d = e.target.closest && e.target.closest('.drop'); if (d) d.classList.remove('over'); }));
    document.addEventListener('drop', (e) => {
      const d = e.target.closest && e.target.closest('.drop');
      if (!d) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) UI.handleFile(d.dataset.drop, f);
    });
    // chặn trình duyệt mở tệp khi thả sai chỗ
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  /* ------------------------------------------------------------ khởi động */
  UI.init = async function () {
    await Store.load();
    st = Store.state;
    UI.st = () => st;
    bindGlobal();
    $('#btn-sample').addEventListener('click', UI.loadSample);
    $('#btn-clear').addEventListener('click', async () => {
      if (!confirm('Xóa toàn bộ dữ liệu phiên làm việc (ma trận, đề gốc, đáp án, mã đề đã tạo) khỏi trình duyệt này?')) return;
      await Store.clear(); st = Store.state; UI.st = () => st; ui.msgs = { matrix: [], exam: [], answer: [] }; ui.genError = null;
      UI.render(false); UI.toast('Đã xóa dữ liệu phiên làm việc.', 'ok');
    });
    $('#btn-save').addEventListener('click', actions['save-project']);
    $('#btn-open').addEventListener('click', () => $('#file-project').click());
    $('#file-project').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openProject(f); });
    UI.render(false);
  };
})(window);
