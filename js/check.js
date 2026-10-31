/* Đối chiếu đề (gốc hoặc đã trộn) với ma trận. Chỉ phát hiện và báo cáo sai lệch; không tự sửa dữ liệu. */
(function (g) {
  const C = {};

  /** Số thứ tự câu hiển thị trong đề gốc (theo cách đánh số của đề). */
  C.numberFor = (exam, q) => {
    if (exam.numbering !== 'perPart') return q.n;
    return exam.questions.filter((x) => x.part === q.part && x.n <= q.n).length;
  };
  C.partOf = (exam, q) => exam.parts.find((p) => p.id === q.part);
  C.nameOf = (exam, q) => {
    if (exam.numbering === 'perPart') return `${(C.partOf(exam, q) || {}).name || ''} · Câu ${C.numberFor(exam, q)}`;
    return `Câu ${q.n}`;
  };

  const TYPE = Matrix.TYPES;
  const keyQ = (q) => Matrix.key(q.type, q.topic, q.level);

  /**
   * So sánh danh sách câu hỏi (đã theo đúng thứ tự in) với ma trận.
   * ordered: [{q, num, partId}]  — num là số thứ tự theo cách đánh số hiện hành.
   */
  C.compare = function (rows, ordered, opts) {
    opts = opts || {};
    const issues = [];
    const bad = new Set();
    const err = (text, qid) => { issues.push({ level: 'error', text, qid }); if (qid) bad.add(qid); };
    const warn = (text) => issues.push({ level: 'warn', text });
    const groups = Matrix.groups(rows);
    const nameOf = opts.nameOf || ((o) => 'Câu ' + o.num);

    // 1) số phần
    const mParts = new Set(rows.map((r) => r.part)).size;
    const ePartIds = [...new Set(ordered.map((o) => o.partId))];
    if (mParts !== ePartIds.length) err(`Ma trận có ${mParts} phần nhưng đề có ${ePartIds.length} phần.`);

    // 2) dạng câu và số câu theo dạng
    const mt = Matrix.totals(rows);
    const types = new Set([...Object.keys(mt.byType), ...ordered.map((o) => o.q.type)]);
    types.forEach((t) => {
      const need = mt.byType[t] ? mt.byType[t].count : 0;
      const have = ordered.filter((o) => o.q.type === t).length;
      if (need !== have) {
        if (!need) err(`Đề có ${have} câu dạng "${TYPE[t]}" nhưng ma trận không có dạng này.`);
        else if (!have) err(`Ma trận có ${need} câu dạng "${TYPE[t]}" nhưng đề không có câu nào.`);
        else err(`Dạng "${TYPE[t]}": ma trận yêu cầu ${need} câu nhưng đề hiện có ${have} câu.`);
      }
    });

    // 3) chủ đề × mức độ × dạng
    ordered.forEach((o) => {
      if (!U.fold(o.q.topic) || !U.fold(o.q.level)) err(`${nameOf(o)} chưa được gán chủ đề hoặc mức độ nhận thức.`, o.q.id);
      else if (!(o.q.points >= 0) || o.q.points == null) err(`${nameOf(o)} chưa có điểm.`, o.q.id);
    });
    const have = new Map();
    ordered.forEach((o) => {
      if (!U.fold(o.q.topic) || !U.fold(o.q.level)) return;
      const k = keyQ(o.q);
      if (!have.has(k)) have.set(k, { count: 0, points: 0, qs: [] });
      const h = have.get(k);
      h.count++; h.points += +o.q.points || 0; h.qs.push(o);
    });
    const table = groups.map((gp) => {
      const h = have.get(gp.key) || { count: 0, points: 0, qs: [] };
      const okCount = h.count === gp.count;
      const okPts = U.same(h.points, gp.points);
      const label = `Chủ đề "${gp.topic}", mức độ ${gp.level} (${TYPE[gp.type]})`;
      if (!okCount) { err(`${label} cần ${gp.count} câu nhưng đề hiện có ${h.count} câu.`); h.qs.forEach((o) => bad.add(o.q.id)); }
      else if (!okPts) { err(`${label} cần ${U.fmt(gp.points)} điểm nhưng các câu hiện có tổng ${U.fmt(h.points)} điểm.`); h.qs.forEach((o) => bad.add(o.q.id)); }
      return { key: gp.key, type: gp.type, topic: gp.topic, level: gp.level, need: gp.count, have: h.count, needPts: gp.points, havePts: U.round2(h.points), ok: okCount && okPts };
    });
    have.forEach((h, k) => {
      if (!groups.some((gp) => gp.key === k)) {
        h.qs.forEach((o) => err(`${nameOf(o)} (${TYPE[o.q.type]}, chủ đề "${o.q.topic}", mức độ ${o.q.level}) không có trong ma trận.`, o.q.id));
      }
    });

    // 4) tổng điểm
    const eTotal = U.round2(U.sum(ordered, (o) => +o.q.points || 0));
    if (!U.same(eTotal, mt.points)) err(`Tổng điểm: ma trận ${U.fmt(mt.points)} điểm, đề hiện có ${U.fmt(eTotal)} điểm.`);
    Object.keys(mt.byType).forEach((t) => {
      const p = U.round2(U.sum(ordered.filter((o) => o.q.type === t), (o) => +o.q.points || 0));
      if (!U.same(p, mt.byType[t].points) && ordered.some((o) => o.q.type === t)) err(`Dạng "${TYPE[t]}": ma trận ${U.fmt(mt.byType[t].points)} điểm, đề hiện có ${U.fmt(p)} điểm.`);
    });

    // 5) vị trí câu (nếu ma trận có quy định)
    groups.forEach((gp) => {
      gp.positions.forEach((p) => {
        const cands = ordered.filter((o) => o.num === p && (opts.numbering !== 'perPart' || o.q.type === gp.type));
        const o = cands[0];
        if (!o) { err(`Ma trận quy định vị trí câu ${p} (${TYPE[gp.type]}, "${gp.topic}", ${gp.level}) nhưng đề không có câu ở vị trí này.`); return; }
        if (keyQ(o.q) !== gp.key) err(`Vị trí câu ${p} phải là ${TYPE[gp.type]}, chủ đề "${gp.topic}", mức độ ${gp.level}; hiện là chủ đề "${o.q.topic || '(chưa gán)'}", mức độ ${o.q.level || '(chưa gán)'}.`, o.q.id);
      });
    });

    return { issues, bad, table, errors: issues.filter((i) => i.level === 'error').length };
  };

  C.orderedOf = (exam) =>
    exam.questions.map((q) => ({ q, num: C.numberFor(exam, q), partId: q.part }));

  const DEFAULT_PTS = { mcq: 0.25, tf: 1, short: 0.5, essay: 1 };
  /** Chế độ không có tệp ma trận: ma trận được dựng lại từ chính đề, nên luôn khớp với đề. */
  C.refreshAuto = (matrix, exam) => {
    if (!matrix || !matrix.auto || !exam) return;
    exam.questions.forEach((q) => {
      if (!U.fold(q.topic)) q.topic = 'Toàn đề';
      if (!U.fold(q.level)) q.level = 'Chưa phân loại';
      if (q.points == null) { q.points = DEFAULT_PTS[q.type] || 0; q.pointsSource = 'auto'; }
    });
    matrix.rows = Matrix.fromExam(exam);
    matrix.confirmed = true;
    matrix.source = 'Tự dựng từ đề';
  };

  C.run = (matrix, exam) => {
    C.refreshAuto(matrix, exam);
    const ordered = C.orderedOf(exam);
    return C.compare(matrix.rows, ordered, { numbering: exam.numbering, nameOf: (o) => C.nameOf(exam, o.q) });
  };

  /** Trạng thái hiển thị của từng câu: ok | check | bad */
  C.qStatus = (q, res) => {
    if (res && res.bad.has(q.id)) return 'bad';
    if (!q.confirmed) return 'check';
    return 'ok';
  };
  C.STATUS_LABEL = { ok: 'Đã xác nhận', check: 'Cần kiểm tra', bad: 'Chưa khớp ma trận' };

  C.answerState = (q) => {
    if (q.type === 'essay') return 'na';
    let has;
    if (q.type === 'tf') has = q.statements.length > 0 && q.statements.every((s) => s.answer);
    else if (q.type === 'short') has = !!String(q.answer || '').trim();
    else has = !!q.answer;
    if (!has) return 'missing';
    return q.answerConfirmed ? 'ok' : 'unconfirmed';
  };

  /** Điều kiện để tạo mã đề / xuất đáp án. */
  C.readiness = (matrix, exam) => {
    const res = C.run(matrix, exam);
    const blockers = [];
    const mIssues = Matrix.validate(matrix.rows).filter((i) => i.level === 'error');
    mIssues.forEach((i) => blockers.push('Ma trận: ' + i.text));
    if (!matrix.confirmed) blockers.push('Ma trận chưa được xác nhận (Bước 1).');
    res.issues.filter((i) => i.level === 'error').forEach((i) => blockers.push(i.text));
    const unconfirmed = exam.questions.filter((q) => !q.confirmed).length;
    if (unconfirmed) blockers.push(`Còn ${unconfirmed} câu hỏi chưa được xác nhận (trạng thái "Cần kiểm tra").`);
    const ansBlock = [];
    const missing = exam.questions.filter((q) => C.answerState(q) === 'missing');
    const unconf = exam.questions.filter((q) => C.answerState(q) === 'unconfirmed');
    if (missing.length) ansBlock.push(`Còn ${missing.length} câu chưa có đáp án: ${missing.slice(0, 8).map((q) => C.nameOf(exam, q)).join(', ')}${missing.length > 8 ? '…' : ''}.`);
    if (unconf.length) ansBlock.push(`Còn ${unconf.length} câu có đáp án chưa được giáo viên xác nhận.`);
    return { res, blockers, canShuffle: blockers.length === 0, answersReady: ansBlock.length === 0, answerBlockers: ansBlock };
  };

  /**
   * GỢI Ý (không phải kết quả đã duyệt): gán chủ đề, mức độ, điểm cho các câu theo vị trí trong ma trận,
   * hoặc theo thứ tự các dòng ma trận cùng dạng. Giáo viên phải kiểm tra và xác nhận.
   */
  C.suggest = (matrix, exam) => {
    const groups = Matrix.groups(matrix.rows);
    let changed = 0;
    const locked = (q) => q.classSource === 'teacher';
    // 1) theo vị trí
    const done = new Set();
    groups.forEach((gp) => {
      gp.positions.forEach((p) => {
        const q = exam.questions.find((x) => C.numberFor(exam, x) === p && (exam.numbering !== 'perPart' || x.type === gp.type));
        if (q && !locked(q) && q.type === gp.type) {
          q.topic = gp.topic; q.level = gp.level; q.classSource = 'suggest';
          if (q.points == null || q.pointsSource === 'suggest') { q.points = U.round2(gp.points / gp.count); q.pointsSource = 'suggest'; }
          q.confirmed = false; done.add(q.id); changed++;
        }
      });
    });
    // 2) theo thứ tự các dòng cùng dạng
    Object.keys(Matrix.TYPES).forEach((t) => {
      const qs = exam.questions.filter((q) => q.type === t && !done.has(q.id) && !locked(q));
      const gs = groups.filter((gp) => gp.type === t).map((gp) => ({ gp, left: gp.count - gp.positions.filter((p) => exam.questions.some((x) => done.has(x.id) && x.type === t && C.numberFor(exam, x) === p)).length }));
      let gi = 0;
      qs.forEach((q) => {
        while (gi < gs.length && gs[gi].left <= 0) gi++;
        if (gi >= gs.length) return;
        const gp = gs[gi].gp;
        q.topic = gp.topic; q.level = gp.level; q.classSource = 'suggest';
        if (q.points == null || q.pointsSource === 'suggest') { q.points = U.round2(gp.points / gp.count); q.pointsSource = 'suggest'; }
        q.confirmed = false;
        gs[gi].left--; changed++;
      });
    });
    return changed;
  };

  g.Check = C;
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
