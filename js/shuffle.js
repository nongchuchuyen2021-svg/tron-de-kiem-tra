/* Lõi trộn đề — thuật toán xác định (cùng seed + cấu hình + dữ liệu => cùng kết quả).
   Không dùng AI. Đáp án luôn gắn với mã định danh phương án/ý, sau đó mới đổi thành nhãn A,B,C,D / a,b,c,d.

   Cấu trúc một mã đề (version):
     { code, index, items:[{qid, num, optionOrder:[optionId]|null, stmtOrder:[stmtId]|null}], sig }
   items đã theo đúng thứ tự in (các phần giữ nguyên thứ tự). */
(function (g) {
  const S = {};

  /* ---------------- Nhận diện câu phụ thuộc vị trí ---------------- */
  const DEP_RES = [
    /(cả|tất cả)\s+(các\s+)?(phương án|đáp án|ý|câu)?\s*(trên|đều)/i,
    /cả\s+(hai|ba|bốn)\b/i,
    /\b[A-D]\s*(?:,|và|&)\s*[A-D](?:\s*(?:,|và|&)\s*[A-D])*\s*(?:đều|cùng)?\s*(?:đúng|sai)/,
    /(?:phương án|đáp án|ý)\s+[A-D]\b/,
    /không\s+(?:có\s+)?(?:phương án|đáp án|ý)\s+nào/i,
    /(?:các|những)\s+(?:phương án|đáp án|ý)\s+(?:trên|còn lại)/i,
    /\b(?:A|B|C|D)\s*(?:,|và)\s*(?:A|B|C|D)\s*$/,
  ];
  S.optionDependent = (q) => q.type === 'mcq' && q.options.some((o) => { const t = H.textOf(o.html); return DEP_RES.some((re) => re.test(t)); });

  S.lockOptionsOf = (q) => (q.lockOptions != null ? !!q.lockOptions : S.optionDependent(q));

  const sigOf = (q) => [q.type, U.fold(q.topic), U.fold(q.level), q.points].join('~');

  /* ---------------- Chuẩn bị: nhóm (đơn vị di chuyển), khóa, lớp hoán đổi ---------------- */
  S.prepare = function (exam, matrix, config) {
    const qs = exam.questions;
    const reasons = {}; // qid -> [lý do khóa vị trí]
    const addR = (qid, r) => { (reasons[qid] = reasons[qid] || []); if (!reasons[qid].includes(r)) reasons[qid].push(r); };

    // tham chiếu số thứ tự câu khác -> khóa cả hai
    qs.forEach((q, i) => {
      const txt = H.textOf(q.stem + q.statements.map((s) => s.html).join('') + q.options.map((o) => o.html).join(''));
      const refs = [...txt.matchAll(/(?:^|[^\wÀ-ỹ])câu\s*(\d+)/gi)].map((m) => +m[1]);
      refs.forEach((num) => {
        if (q.label === num && refs.length === 1) return;
        const target = qs.find((x) => x.id !== q.id && x.label === num && (exam.numbering !== 'perPart' || x.part === q.part)) ||
          qs.find((x) => x.id !== q.id && C_num(exam, x) === num);
        if (target && !(q.group && q.group === target.group)) {
          addR(q.id, `Tham chiếu "câu ${num}" trong nội dung — chưa hỗ trợ tự cập nhật tham chiếu nên khóa vị trí`);
          addR(target.id, `Được câu khác tham chiếu số thứ tự (câu ${num}) nên khóa vị trí`);
        }
      });
      if (/(?:kết quả|đáp án|dữ liệu|số liệu)\s+(?:của\s+)?câu\s+(?:trước|trên)|ở\s+câu\s+(?:trước|trên)|câu\s+(?:trước|trên)\b/i.test(txt) && i > 0) {
        addR(q.id, 'Phụ thuộc vào câu liền trước — khóa vị trí');
        addR(qs[i - 1].id, 'Câu kế tiếp phụ thuộc vào câu này — khóa vị trí');
      }
    });

    const posBoundKeys = new Map(); // qid -> true nếu ma trận quy định vị trí
    Matrix.groups(matrix.rows).forEach((gp) => {
      gp.positions.forEach((p) => {
        const q = qs.find((x) => C_num(exam, x) === p && (exam.numbering !== 'perPart' || x.type === gp.type));
        if (q) posBoundKeys.set(q.id, true);
      });
    });

    // đơn vị = câu đơn hoặc nhóm câu chùm (di chuyển cùng nhau, giữ thứ tự trong nhóm)
    const units = [];
    const unitOfGroup = {};
    exam.parts.forEach((p) => {
      qs.filter((q) => q.part === p.id).forEach((q) => {
        if (q.group && unitOfGroup[p.id + '|' + q.group]) { unitOfGroup[p.id + '|' + q.group].qids.push(q.id); return; }
        const u = { id: 'U' + (units.length + 1), partId: p.id, qids: [q.id], group: q.group || null };
        if (q.group) unitOfGroup[p.id + '|' + q.group] = u;
        units.push(u);
      });
    });
    units.forEach((u) => {
      const members = u.qids.map((id) => qs.find((q) => q.id === id));
      u.reasons = [];
      members.forEach((q) => {
        if (q.lock) u.reasons.push('Giáo viên khóa vị trí');
        (reasons[q.id] || []).forEach((r) => u.reasons.push(r));
      });
      if (u.qids.length > 1) {
        const wholeGroup = members.some((q) => q.lock || (reasons[q.id] || []).length);
        if (wholeGroup) u.reasons.push('Câu thuộc nhóm — cả nhóm được giữ nguyên vị trí');
      }
      if (config.shuffleQ === false) u.reasons.push('Đã tắt đảo thứ tự câu hỏi');
      u.locked = u.reasons.length > 0;
      u.posBound = members.some((q) => posBoundKeys.get(q.id));
      u.sig = members.map(sigOf).join('/');
      u.levels = members.map((q) => U.fold(q.level)).join('/');
      u.key = [u.partId, u.qids.length, u.posBound ? u.sig : '*', config.withinLevel ? u.levels : ''].join('#');
    });

    // lớp hoán đổi: các đơn vị không khóa, cùng khóa lớp, được hoán đổi vị trí cho nhau
    const classes = {};
    units.forEach((u) => { if (!u.locked) (classes[u.key] = classes[u.key] || []).push(u); });

    const lockOpt = {};
    qs.forEach((q) => { lockOpt[q.id] = q.type === 'mcq' && S.lockOptionsOf(q); });
    let cap = 1;
    Object.values(classes).forEach((c) => { cap *= U.factorial(c.length); });
    qs.forEach((q) => {
      if (q.type === 'mcq' && config.shuffleOpt !== false && !lockOpt[q.id] && q.options.length >= 2) cap *= U.factorial(q.options.length);
      if (q.type === 'tf' && config.tfShuffle && q.tfIndependent && q.statements.length >= 2) cap *= U.factorial(q.statements.length);
    });
    return { units, classes, lockOpt, capacity: Math.min(cap, 1e18), qOf: Object.fromEntries(qs.map((q) => [q.id, q])) };
  };

  function C_num(exam, q) { return Check.numberFor(exam, q); }

  /** Danh sách câu bị khóa vị trí/phương án, kèm lý do (hiển thị cho giáo viên). */
  S.lockReport = function (exam, matrix, config) {
    const prep = S.prepare(exam, matrix, config);
    const out = [];
    prep.units.forEach((u) => {
      if (u.locked) u.qids.forEach((id) => out.push({ qid: id, kind: 'position', reasons: u.reasons.filter((v, i, a) => a.indexOf(v) === i) }));
    });
    exam.questions.forEach((q) => {
      if (q.type === 'mcq' && S.lockOptionsOf(q)) {
        const auto = q.lockOptions == null;
        out.push({ qid: q.id, kind: 'options', reasons: [auto ? 'Phương án phụ thuộc vị trí hoặc nhãn (ví dụ "A và B đều đúng", "Tất cả các phương án trên") — tự động khóa đảo phương án' : 'Giáo viên khóa đảo phương án'] });
      }
    });
    return out;
  };

  /* ---------------- Sinh một cách sắp xếp ---------------- */
  function candidate(exam, prep, config, rnd) {
    // thứ tự đơn vị trong từng phần
    const orderByPart = {};
    exam.parts.forEach((p) => { orderByPart[p.id] = prep.units.filter((u) => u.partId === p.id).slice(); });
    Object.values(prep.classes).forEach((cls) => {
      const part = cls[0].partId;
      const arr = orderByPart[part];
      const idxs = cls.map((u) => arr.indexOf(u));
      const perm = U.shuffle(cls, rnd);
      idxs.forEach((ix, k) => { arr[ix] = perm[k]; });
    });
    const items = [];
    const optOrder = {};
    const stmtOrder = {};
    exam.questions.forEach((q) => {
      if (q.type === 'mcq') {
        const ids = q.options.map((o) => o.id);
        optOrder[q.id] = config.shuffleOpt !== false && !prep.lockOpt[q.id] && ids.length >= 2 ? U.shuffle(ids, rnd) : ids;
      }
      if (q.type === 'tf') {
        const ids = q.statements.map((s) => s.id);
        stmtOrder[q.id] = config.tfShuffle && q.tfIndependent && ids.length >= 2 ? U.shuffle(ids, rnd) : ids;
      }
    });
    exam.parts.forEach((p) => {
      orderByPart[p.id].forEach((u) => u.qids.forEach((qid) => items.push({ qid, optionOrder: optOrder[qid] || null, stmtOrder: stmtOrder[qid] || null })));
    });
    numberItems(exam, items);
    return items;
  }

  function numberItems(exam, items) {
    const counters = {};
    let idx = 0;
    items.forEach((it) => {
      const q = exam.questions.find((x) => x.id === it.qid);
      idx++;
      counters[q.part] = (counters[q.part] || 0) + 1;
      it.num = exam.numbering === 'perPart' ? counters[q.part] : idx;
    });
  }

  const sigOfItems = (items) => items.map((i) => i.qid + ':' + (i.optionOrder || []).join(',') + ':' + (i.stmtOrder || []).join(',')).join('|');

  function originalItems(exam) {
    const items = [];
    exam.parts.forEach((p) => exam.questions.filter((q) => q.part === p.id).forEach((q) => items.push({
      qid: q.id,
      optionOrder: q.type === 'mcq' ? q.options.map((o) => o.id) : null,
      stmtOrder: q.type === 'tf' ? q.statements.map((s) => s.id) : null,
    })));
    numberItems(exam, items);
    return items;
  }
  S.originalItems = originalItems;

  function scoreOf(exam, items, refs, config) {
    let s = 0;
    refs.forEach((r) => {
      items.forEach((it, i) => {
        if (r[i] && r[i].qid === it.qid) s += 1;
        if (r[i] && r[i].qid === it.qid && it.optionOrder && it.optionOrder.length > 1 && it.optionOrder.join() === r[i].optionOrder.join()) s += 0.5;
      });
    });
    if (config.balanceAnswers !== false) {
      const cnt = [0, 0, 0, 0, 0, 0];
      let tot = 0;
      const seq = [];
      items.forEach((it) => {
        if (!it.optionOrder) return;
        const q = exam.questions.find((x) => x.id === it.qid);
        const k = it.optionOrder.indexOf(q.answer);
        if (k >= 0) { cnt[k]++; tot++; seq.push(k); }
      });
      const avg = tot / 4;
      for (let k = 0; k < 4; k++) s += 1.2 * Math.pow(cnt[k] - avg, 2);
      // tránh 3 câu liên tiếp cùng một đáp án
      for (let i = 2; i < seq.length; i++) if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) s += 1.5;
    }
    return s;
  }

  /**
   * Tạo các mã đề. Trả {ok, versions, errors, warnings, capacity}.
   * config: {count, codes[], seed, shuffleQ, shuffleOpt, tfShuffle, withinLevel, balanceAnswers}
   */
  S.generate = function (exam, matrix, config) {
    const errors = [], warnings = [];
    const count = config.count;
    const prep = S.prepare(exam, matrix, config);
    const orig = originalItems(exam);
    const origSig = sigOfItems(orig);
    const need = count; // số mã đề khác nhau và khác đề gốc
    if (prep.capacity - 1 < need) {
      const movable = Object.values(prep.classes).map((c) => c.length);
      errors.push(
        `Với các khóa và ràng buộc hiện tại, chỉ có tối đa ${Math.max(0, Math.floor(prep.capacity) - 1)} cách sắp xếp khác đề gốc nhưng cần ${need} mã đề khác nhau.`
      );
      errors.push(`Nguyên nhân: số câu/nhóm được phép đảo quá ít (${movable.length ? movable.join(', ') + ' đơn vị trong mỗi lớp hoán đổi' : 'không có câu nào được đảo vị trí'}) và/hoặc nhiều câu bị khóa phương án.`);
      errors.push('Đề xuất: mở khóa vị trí/phương án ở những câu không bắt buộc, bật "Đảo thứ tự phương án trả lời", tắt "Chỉ đảo trong cùng mức độ", hoặc giảm số mã đề.');
      return { ok: false, errors, warnings, capacity: prep.capacity };
    }

    const versions = [];
    const refs = [orig];
    const seen = new Set([origSig]);
    for (let k = 0; k < count; k++) {
      const rnd = U.rng(U.hash(config.seed, 'v', k));
      let best = null, bestScore = Infinity, valid = 0;
      for (let tries = 0; tries < 400 && valid < 40; tries++) {
        const items = candidate(exam, prep, config, rnd);
        const sg = sigOfItems(items);
        if (seen.has(sg)) continue;
        valid++;
        const sc = scoreOf(exam, items, refs, config);
        if (sc < bestScore) { bestScore = sc; best = items; }
      }
      if (!best) {
        errors.push(`Không tạo được mã đề thứ ${k + 1} khác với các mã đã có sau nhiều lần thử. Hãy mở bớt khóa hoặc giảm số mã đề.`);
        return { ok: false, errors, warnings, capacity: prep.capacity };
      }
      seen.add(sigOfItems(best));
      refs.push(best);
      versions.push({ code: config.codes[k], index: k, items: best, sig: U.hash(sigOfItems(best)).toString(16) });
    }

    // cảnh báo chất lượng khác biệt
    const movableN = Object.values(prep.classes).reduce((s, c) => s + c.length, 0);
    versions.forEach((v) => {
      const moved = v.items.filter((it, i) => orig[i].qid !== it.qid).length;
      if (movableN >= 4 && moved / v.items.length < 0.3) warnings.push(`Mã đề ${v.code}: chỉ ${moved}/${v.items.length} câu đổi vị trí so với đề gốc (do nhiều câu bị khóa).`);
    });
    return { ok: true, versions, errors, warnings, capacity: prep.capacity };
  };

  /* ---------------- Đáp án theo từng mã đề ---------------- */
  S.letterOf = (item, optionId) => {
    const k = item.optionOrder ? item.optionOrder.indexOf(optionId) : -1;
    return k >= 0 ? U.letters[k] : '';
  };
  /** Trả về chuỗi hiển thị đáp án của một câu trong một mã đề (hoặc '' nếu chưa có). */
  S.answerText = (q, item) => {
    if (q.type === 'mcq') return q.answer ? S.letterOf(item, q.answer) : '';
    if (q.type === 'tf') {
      return item.stmtOrder.map((sid) => { const s = q.statements.find((x) => x.id === sid); return s && s.answer ? (s.answer === 'D' ? 'Đ' : 'S') : '?'; }).join('');
    }
    if (q.type === 'short') return String(q.answer || '');
    return '';
  };

  /* ---------------- Kiểm tra lại sau khi trộn ---------------- */
  S.verify = function (exam, matrix, versions, config) {
    const rows = [];
    const add = (code, check, ok, detail) => rows.push({ code, check, ok, detail: detail || '' });
    const prep = S.prepare(exam, matrix, config);
    const orig = originalItems(exam);
    const qById = Object.fromEntries(exam.questions.map((q) => [q.id, q]));
    const sigs = new Set();
    versions.forEach((v) => {
      const code = v.code;
      const ids = v.items.map((i) => i.qid);
      const uniq = new Set(ids);
      add(code, 'Mỗi câu xuất hiện đúng một lần', ids.length === exam.questions.length && uniq.size === exam.questions.length && exam.questions.every((q) => uniq.has(q.id)), `${ids.length}/${exam.questions.length} câu`);

      const pts = U.round2(U.sum(v.items, (i) => +qById[i.qid].points || 0));
      const pts0 = U.round2(U.sum(exam.questions, (q) => +q.points || 0));
      add(code, 'Tổng điểm không đổi', U.same(pts, pts0), `${U.fmt(pts)} / ${U.fmt(pts0)} điểm`);

      const partsOk = v.items.every((it, i) => qById[it.qid].part === qById[orig[i].qid].part);
      add(code, 'Số phần, dạng câu, số câu mỗi phần giữ nguyên', partsOk);

      // nhóm câu chùm liền nhau và đúng thứ tự
      let groupOk = true;
      const gpos = {};
      v.items.forEach((it, i) => { const gq = qById[it.qid].group; if (gq) (gpos[gq] = gpos[gq] || []).push([i, it.qid]); });
      Object.keys(gpos).forEach((gid) => {
        const arr = gpos[gid];
        for (let i = 1; i < arr.length; i++) if (arr[i][0] !== arr[i - 1][0] + 1) groupOk = false;
        const origOrder = exam.questions.filter((q) => q.group === gid).map((q) => q.id);
        if (arr.map((a) => a[1]).join() !== origOrder.join()) groupOk = false;
      });
      add(code, 'Câu chùm / dữ kiện dùng chung đi liền nhau, đúng thứ tự', groupOk);

      // khóa vị trí
      let lockOk = true;
      prep.units.filter((u) => u.locked).forEach((u) => u.qids.forEach((id) => {
        const oi = orig.findIndex((x) => x.qid === id);
        if (v.items[oi].qid !== id) lockOk = false;
      }));
      add(code, 'Câu bị khóa vị trí giữ đúng vị trí', lockOk);

      // phương án
      let optOk = true, ansOk = true, lockOptOk = true, tfOk = true, detail = '';
      v.items.forEach((it) => {
        const q = qById[it.qid];
        if (q.type === 'mcq') {
          const a = it.optionOrder.slice().sort().join(), b = q.options.map((o) => o.id).sort().join();
          if (a !== b) optOk = false;
          if (prep.lockOpt[q.id] && it.optionOrder.join() !== q.options.map((o) => o.id).join()) lockOptOk = false;
          if (q.answer) {
            const letter = S.letterOf(it, q.answer);
            const shown = it.optionOrder[U.letters.indexOf(letter)];
            const sameText = H.textOf(q.options.find((o) => o.id === shown).html) === H.textOf(q.options.find((o) => o.id === q.answer).html);
            if (!letter || shown !== q.answer || !sameText) { ansOk = false; detail = 'Câu ' + q.n; }
          }
        }
        if (q.type === 'tf') {
          const a = it.stmtOrder.slice().sort().join(), b = q.statements.map((s) => s.id).sort().join();
          if (a !== b) tfOk = false;
          if (!(config.tfShuffle && q.tfIndependent) && it.stmtOrder.join() !== q.statements.map((s) => s.id).join()) tfOk = false;
        }
      });
      add(code, 'Phương án chỉ đổi chỗ, không mất/lặp phương án', optOk);
      add(code, 'Đáp án đúng khớp đúng phương án sau khi đảo', ansOk, detail);
      add(code, 'Câu khóa phương án giữ nguyên thứ tự phương án', lockOptOk);
      add(code, 'Ý đúng/sai giữ đúng ánh xạ (mặc định giữ nguyên thứ tự ý)', tfOk);

      // đối chiếu lại ma trận trên thứ tự mới
      const ordered = v.items.map((it) => ({ q: qById[it.qid], num: it.num, partId: qById[it.qid].part }));
      const cmp = Check.compare(matrix.rows, ordered, { numbering: exam.numbering, nameOf: (o) => 'Câu ' + o.num });
      const errs = cmp.issues.filter((i) => i.level === 'error');
      add(code, 'Phân bố chủ đề, mức độ, điểm và vị trí theo ma trận', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '));

      // số thứ tự câu hợp lệ
      const numOk = v.items.every((it, i) => it.num === (exam.numbering === 'perPart' ? v.items.slice(0, i + 1).filter((x) => qById[x.qid].part === qById[it.qid].part).length : i + 1));
      add(code, 'Đánh số lại câu hợp lệ', numOk);
      sigs.add(v.sig);
    });
    add('Tất cả', 'Các mã đề khác nhau thực sự (thứ tự câu hoặc phương án)', sigs.size === versions.length && versions.every((v) => v.items.map((x) => x.qid + x.optionOrder + x.stmtOrder).join() !== orig.map((x) => x.qid + x.optionOrder + x.stmtOrder).join()), `${sigs.size}/${versions.length} bản khác nhau, đều khác đề gốc`);
    const codes = versions.map((v) => v.code);
    add('Tất cả', 'Mã đề không trùng nhau', new Set(codes).size === codes.length, codes.join(', '));
    return { rows, ok: rows.every((r) => r.ok) };
  };

  /** Bảng đối chiếu: với mỗi mã đề, câu mới <- câu gốc và ánh xạ phương án. */
  S.mapping = function (exam, versions) {
    const out = [];
    versions.forEach((v) => {
      v.items.forEach((it) => {
        const q = exam.questions.find((x) => x.id === it.qid);
        const part = exam.parts.find((p) => p.id === q.part);
        let map = '';
        if (it.optionOrder) map = it.optionOrder.map((oid, k) => `${U.letters[k]}←${U.letters[q.options.findIndex((o) => o.id === oid)]}`).join('; ');
        if (q.type === 'tf' && it.stmtOrder.join() !== q.statements.map((s) => s.id).join()) {
          map = it.stmtOrder.map((sid, k) => `${'abcdef'[k]}←${'abcdef'[q.statements.findIndex((s) => s.id === sid)]}`).join('; ');
        }
        out.push({
          code: v.code, qid: q.id, part: part.name, num: it.num, origNum: Check.numberFor(exam, q), origName: Check.nameOf(exam, q),
          type: q.type, topic: q.topic, level: q.level, points: q.points, map,
          origAnswer: q.type === 'mcq' ? (q.answer ? U.letters[q.options.findIndex((o) => o.id === q.answer)] : '') : q.type === 'tf' ? q.statements.map((s) => (s.answer ? (s.answer === 'D' ? 'Đ' : 'S') : '?')).join('') : q.type === 'short' ? String(q.answer || '') : '',
          newAnswer: S.answerText(q, it),
        });
      });
    });
    return out;
  };

  g.Shuffle = S;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
