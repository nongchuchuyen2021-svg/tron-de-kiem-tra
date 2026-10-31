/* Chuẩn hóa đề gốc: từ các khối (đoạn văn/bảng) -> phần, câu hỏi, phương án, ý đúng/sai, nhóm câu chùm;
   và đọc đáp án (cuối đề hoặc tệp riêng).
   Mọi nhận dạng ở đây chỉ là đề xuất: câu hỏi mới nhận dạng luôn ở trạng thái "Cần kiểm tra" cho tới khi giáo viên xác nhận. */
(function (g) {
  const P = {};

  const RE_PART = /^(?:PHẦN|Phần)\s+([IVXLC]+|\d+)\b\s*[.:)\-–—]?\s*/;
  const RE_ROMAN = /^([IVX]{1,4})\s*[.)]\s+(.+)$/;
  const RE_Q = /^\s*(?:Câu|Bài|Question)\s*(\d+)\s*[.:)\-–—]?\s*/i;
  const RE_Q_RANGE = /^\s*(?:Câu|Bài)\s*\d+\s*(?:[-–—,]|đến|tới|và)\s*(?:câu\s*)?\d+/i;
  const RE_OPT = /^\s*([A-F])\s*[.)]\s*/;
  const RE_STM = /^\s*([a-f])\s*[.)]\s*/;
  const RE_INLINE_ANS = /^\s*(?:Đáp án|ĐA|Chọn)\s*[:：.]?\s*([A-F])\s*[.)]?\s*$/i;
  const RE_POINTS = /\(\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)\s*\)/i;

  const lead = (t) => t.match(/^\s*/)[0].length;

  function isAnswerHeading(text) {
    const t = text.trim();
    if (t.length > 110) return false;
    const m = /^(?:BẢNG\s+)?(ĐÁP ÁN|HƯỚNG DẪN CHẤM|HƯỚNG DẪN)\b(.*)$/i.exec(t);
    if (!m) return false;
    return !/[:：]\s*\S/.test(m[2]);
  }

  function rangeNums(text) {
    if (text.length < 12) return null;
    const refers = /(trả lời|dựa vào|sử dụng|đọc|cho .* sau|thông tin|đoạn|bảng|hình)/i.test(text) || RE_Q_RANGE.test(text);
    if (!refers) return null;
    let m = /(?:từ\s+)?(?:các\s+)?câu(?:\s+hỏi)?\s*(?:số\s*)?(\d+)\s*(?:đến|tới|[-–—])\s*(?:câu\s*)?(\d+)/i.exec(text);
    if (m) {
      const a = +m[1], b = +m[2];
      const s = new Set();
      for (let i = Math.min(a, b); i <= Math.max(a, b) && i < 500; i++) s.add(i);
      return s;
    }
    m = /câu\s*(\d+)((?:\s*(?:,|và)\s*(?:câu\s*)?\d+)+)/i.exec(text);
    if (m) {
      const s = new Set([+m[1]]);
      (m[2].match(/\d+/g) || []).forEach((x) => s.add(+x));
      return s;
    }
    return null;
  }

  /* Tách dòng "A. ... B. ... C. ... D. ..." thành từng phương án (giữ nguyên định dạng, ảnh). */
  function splitInlineOptions(b) {
    const t = b.text;
    const first = /^\s*([A-F])\s*[.)]/.exec(t);
    if (!first) return [b];
    const startIdx = 'ABCDEF'.indexOf(first[1]);
    if (startIdx >= 5 || !new RegExp('\\s' + 'ABCDEF'[startIdx + 1] + '\\s*[.)]').test(t)) return [b];
    const offs = [lead(t)];
    let from = offs[0] + 1;
    for (const L of 'ABCDEF'.slice(startIdx + 1)) {
      const m = new RegExp('\\s(' + L + ')\\s*[.)]').exec(t.slice(from));
      if (!m) break;
      offs.push(from + m.index + 1);
      from = offs[offs.length - 1] + 1;
    }
    if (offs.length < 2) return [b];
    return offs.map((o, i) => {
      const html = H.trimHtml(H.slice(b.html, o, offs[i + 1]));
      return { kind: 'li-split', html, text: H.textOf(html) };
    });
  }

  function preprocess(blocks, notes) {
    const out = [];
    let ended = false;
    blocks.forEach((b) => {
      if (b.kind === 'table') { out.push(b); return; }
      const nb = Object.assign({}, b);
      nb.html = H.trimHtml(nb.html || '');
      nb.text = H.textOf(nb.html);
      if (/^[\s\-–—_*.]*HẾT[\s\-–—_*.]*$/i.test(nb.text)) { ended = true; return; }
      // dòng ghi chú cuối đề (sau "HẾT"): không thuộc câu hỏi nào, giữ riêng để in lại cuối đề
      if (ended && notes) {
        if (/^\s*[-–—•*]\s*\S/.test(nb.text)) { notes.push(nb.text.replace(/^\s*[-–—•*]\s*/, '').trim()); return; }
        if (nb.text.trim()) ended = false; // gặp nội dung khác (vd. tiêu đề đáp án): hết phần ghi chú
      }
      if (!nb.text.trim() && !H.hasImg(nb.html)) return;
      splitInlineOptions(nb).forEach((x) => out.push(x));
    });
    return out;
  }

  const wrap = (b) => (b.kind === 'table' ? b.html : '<p>' + b.html + '</p>');

  /** Phương án nào được đánh dấu bằng chữ đậm/gạch chân (đúng một phương án)? Trả chỉ số hoặc -1. */
  function markedOption(options) {
    const marked = options.map((o) => {
      const doc = new DOMParser().parseFromString('<body>' + o.html + '</body>', 'text/html');
      const total = doc.body.textContent.replace(/\s/g, '').length;
      if (!total) return false;
      let inner = 0;
      doc.body.querySelectorAll('u,strong,b').forEach((e) => { if (!e.parentElement.closest('u,strong,b')) inner += e.textContent.replace(/\s/g, '').length; });
      return inner / total >= 0.9;
    });
    const n = marked.filter(Boolean).length;
    return n === 1 && options.length >= 3 ? marked.indexOf(true) : -1;
  }

  function extractMeta(lines0) {
    const lines = lines0.flatMap((l) => l.split(/\s{2,}/));
    const meta = {};
    const joined = lines.join('\n');
    let m;
    if ((m = /Thời gian(?: làm bài)?\s*[:\-]?\s*(\d+)\s*phút/i.exec(joined))) meta.time = m[1] + ' phút';
    if ((m = /Môn\s*[:\-]?\s*([^\n,;–—(]+?)(?:\s*[-–—,]\s*Lớp|\s*Lớp|\s*Thời gian|\s*Họ và tên|\n|$)/i.exec(joined))) meta.subject = m[1].trim();
    if ((m = /Lớp\s*[:\-]?\s*(\d{1,2})/i.exec(joined))) meta.grade = m[1];
    if ((m = /Năm học\s*[:\-]?\s*(\d{4}\s*[-–—]\s*\d{4})/i.exec(joined))) meta.year = m[1].replace(/\s/g, '');
    const school = lines.find((l) => /^(TRƯỜNG|SỞ|THPT|TRUNG TÂM)\b/i.test(l.trim()) && l.length < 80);
    if (school) meta.school = school.trim();
    const title = lines.find((l) => /(KIỂM TRA|ĐỀ THI|ĐỀ ÔN|ĐỀ KIỂM TRA)/i.test(l) && l.length < 120);
    if (title) meta.title = title.trim();
    return meta;
  }

  /**
   * Phân tích đề.  blocks: [{kind:'p'|'li'|'table', html, text, rows?}]
   * Trả về {parts, questions, groups, answerBlocks, warnings, meta, numbering}
   */
  P.parse = function (blocksIn) {
    const warnings = [];
    const footerNotes = [];
    const blocks = preprocess(blocksIn, footerNotes);

    // tách phần đáp án ở cuối đề (nếu có)
    let ansIdx = -1, qSeen = 0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].kind !== 'table' && RE_Q.test(blocks[i].text)) qSeen++;
      if (qSeen > 0 && blocks[i].kind !== 'table' && isAnswerHeading(blocks[i].text)) { ansIdx = i; break; }
    }
    const body = ansIdx < 0 ? blocks : blocks.slice(0, ansIdx);
    const answerBlocks = ansIdx < 0 ? [] : blocks.slice(ansIdx + 1);

    const parts = [];
    const questions = [];
    const groups = {};
    const preamble = [];
    let curPart = null;
    let cur = null;
    let pending = null; // đoạn dẫn chờ gắn vào câu tiếp theo
    let auto = 0;

    const openPart = (name, headText, type) => {
      curPart = { id: 'P' + (parts.length + 1), name, headText: headText || '', intro: [], type: type || null, explicit: !!headText };
      parts.push(curPart);
      return curPart;
    };

    const finalize = () => {
      if (!cur) return;
      const c = cur;
      cur = null;
      const part = parts.find((p) => p.id === c.part);
      let stem = c.stem.join('');
      let pointsHint = null;
      const pm = RE_POINTS.exec(H.textOf(stem));
      if (pm) { pointsHint = U.num(pm[1]); stem = H.removeText(stem, new RegExp(RE_POINTS.source, 'i')).replace(/<p>s+/g, '<p>'); }
      const flags = c.flags.slice();
      let type = part.type;
      const nOpt = c.options.length, nSt = c.statements.length;
      if (!type) type = nOpt >= 2 ? 'mcq' : nSt >= 2 ? 'tf' : 'essay';
      if (type === 'mcq' && nOpt < 2) flags.push('Chưa nhận dạng được các phương án A, B, C, D.');
      if (type === 'mcq' && nOpt >= 2 && nOpt !== 4) flags.push(`Có ${nOpt} phương án (thường là 4).`);
      if (type === 'tf' && nSt < 2) flags.push('Chưa nhận dạng được các ý a), b), c), d).');
      if (type === 'tf' && nSt >= 2 && nSt !== 4) flags.push(`Có ${nSt} ý (thường là 4).`);
      if ((type === 'short' || type === 'essay') && (nOpt || nSt)) flags.push('Câu có phương án/ý nhưng nằm trong phần ' + (type === 'short' ? 'trả lời ngắn' : 'tự luận') + '. Kiểm tra lại dạng câu.');
      if (!H.textOf(stem).trim() && !H.hasImg(stem)) flags.push('Phần dẫn của câu hỏi đang trống.');
      const n = questions.length + 1;
      const id = 'Q' + n;
      const q = {
        id, n, label: c.label, part: c.part, type,
        stem,
        options: type === 'mcq' ? c.options.map((o, i) => ({ id: id + 'o' + (i + 1), html: o.html })) : [],
        statements: type === 'tf' ? c.statements.map((s, i) => ({ id: id + 's' + (i + 1), html: s.html, answer: null, guide: '' })) : [],
        answer: null, answerNote: '', guide: '',
        points: pointsHint != null ? pointsHint : null,
        topic: '', level: '', classSource: '',
        group: c.group || null,
        lock: false, lockOptions: undefined, tfIndependent: false,
        confirmed: false, answerConfirmed: false,
        flags,
      };
      if (type === 'mcq' && c.inlineAnswer) {
        const k = U.letters.indexOf(c.inlineAnswer.toUpperCase());
        if (q.options[k]) { q.answer = q.options[k].id; q.answerNote = 'Đáp án ghi ngay sau câu hỏi.'; }
      }
      if (type === 'mcq' && !q.answer) {
        const k = markedOption(q.options);
        if (k >= 0) { q.answer = q.options[k].id; q.answerNote = 'Nhận dạng từ phương án in đậm/gạch chân — cần xác nhận.'; }
      }
      questions.push(q);
      if (q.group && groups[q.group]) groups[q.group].qids.push(id);
    };

    const startQuestion = (label, firstHtml, fromList) => {
      finalize();
      if (!curPart) {
        openPart('Phần ' + U.roman(parts.length + 1), '', null);
        curPart.auto = true;
      }
      cur = { label, part: curPart.id, stem: [], options: [], statements: [], flags: [], zone: 'stem', group: null };
      if (fromList) cur.flags.push('Số câu lấy từ danh sách tự đánh số của Word.');
      if (firstHtml && !H.isEmpty(firstHtml)) cur.stem.push('<p>' + firstHtml + '</p>');
      // gắn đoạn dẫn (câu chùm)
      if (pending) {
        if (pending.nums) {
          if (pending.nums.has(label)) {
            if (!pending.gid) {
              pending.gid = 'G' + (Object.keys(groups).length + 1);
              groups[pending.gid] = { id: pending.gid, html: pending.html.join(''), qids: [] };
            }
            cur.group = pending.gid;
          }
          if (label >= pending.max) pending = null;
        } else {
          const gid = 'G' + (Object.keys(groups).length + 1);
          groups[gid] = { id: gid, html: pending.html.join(''), qids: [] };
          cur.group = gid;
          cur.flags.push('Đoạn dẫn trước câu này được gắn riêng cho câu này; nếu dùng chung cho nhiều câu, hãy gộp nhóm.');
          pending = null;
        }
      }
    };

    for (let bi = 0; bi < body.length; bi++) {
      const b = body[bi];
      const text = b.text || '';
      const t = text.trim();

      if (b.kind !== 'table') {
        // --- tiêu đề phần ---
        let pm = RE_PART.exec(t);
        let isHead = !!pm;
        let pType = null;
        if (!pm) {
          const rm = RE_ROMAN.exec(t);
          if (rm && (Matrix.detectType(rm[2]) || (rm[2] === rm[2].toUpperCase() && /[A-ZÀ-Ỹ]/.test(rm[2]) && rm[2].length < 90))) isHead = true;
        }
        if (isHead && t.length < 260 && !(cur && !cur.options.length && !RE_Q.test(t) && /^[IVX]+\.\s/.test(t) && !Matrix.detectType(t))) {
          finalize();
          pending = pending && !pending.nums ? null : pending;
          pType = Matrix.detectType(t);
          const nm = pm ? 'Phần ' + (/^\d+$/.test(pm[1]) ? U.roman(+pm[1]) : pm[1].toUpperCase()) : 'Phần ' + RE_ROMAN.exec(t)[1];
          openPart(nm, t, pType);
          continue;
        }

        // --- đáp án ngay sau câu ---
        if (cur && RE_INLINE_ANS.test(t)) { cur.inlineAnswer = RE_INLINE_ANS.exec(t)[1]; continue; }

        // --- đoạn dẫn có "trả lời câu a đến b" ---
        const nums = (!cur || cur.options.length >= 2 || cur.statements.length >= 2 || RE_Q_RANGE.test(t)) ? rangeNums(t) : null;
        if (nums && (RE_Q_RANGE.test(t) || !RE_Q.test(t))) {
          finalize();
          pending = pending && pending.nums ? pending : { nums, max: Math.max(...nums), html: [], gid: null };
          if (pending.nums !== nums) { nums.forEach((x) => pending.nums.add(x)); pending.max = Math.max(pending.max, ...nums); }
          pending.html.push(wrap(b));
          continue;
        }

        // --- câu hỏi mới ---
        const qm = RE_Q.exec(t);
        if (qm && !RE_Q_RANGE.test(t)) {
          const label = +qm[1];
          const html = H.stripPrefix(b.html, RE_Q);
          startQuestion(label, html, false);
          continue;
        }
        if (b.kind === 'li' && curPart && curPart.type && !/^(PHẦN)/i.test(t) && (!cur || (cur.options.length >= 4 && curPart.type === 'mcq') || (cur.statements.length >= 4 && curPart.type === 'tf') || (['short', 'essay'].includes(curPart.type)))) {
          const label = (questions.length ? questions[questions.length - 1].label : 0) + 1;
          startQuestion(cur ? cur.label + 1 : label, b.html, true);
          continue;
        }
      }

      // --- không có câu hỏi đang mở: lời dẫn / mô tả phần / đoạn dẫn ---
      if (!cur) {
        if (!curPart) { preamble.push(b); continue; }
        const hasQ = questions.some((q) => q.part === curPart.id);
        if (!hasQ && b.kind !== 'table' && !H.hasImg(b.html) && !pending) {
          curPart.intro.push(b.html);
          if (!curPart.type) curPart.type = Matrix.detectType(b.text);
        } else {
          pending = pending || { nums: null, max: 0, html: [], gid: null };
          pending.html.push(wrap(b));
        }
        continue;
      }

      // --- bên trong một câu hỏi ---
      const t0 = b.kind === 'table' ? '' : b.text;
      const om = b.kind === 'table' ? null : RE_OPT.exec(t0);
      const sm = b.kind === 'table' ? null : RE_STM.exec(t0);
      const partType = (parts.find((p) => p.id === cur.part) || {}).type;
      if (om && partType !== 'essay' && partType !== 'short') {
        const expect = U.letters[cur.options.length];
        if (om[1] === expect && !cur.statements.length) {
          cur.options.push({ html: '<p>' + H.stripPrefix(b.html, RE_OPT) + '</p>' });
          cur.zone = 'opt';
          continue;
        }
      }
      if (sm && partType !== 'essay' && partType !== 'short') {
        const expect = 'abcdef'[cur.statements.length];
        if (sm[1] === expect && !cur.options.length) {
          cur.statements.push({ html: '<p>' + H.stripPrefix(b.html, RE_STM) + '</p>' });
          cur.zone = 'stm';
          continue;
        }
      }
      if (b.kind === 'li' && !om && !sm && partType !== 'essay' && partType !== 'short' && (cur.zone === 'opt' || cur.zone === 'stem') && (partType === 'mcq' || cur.options.length) && cur.options.length < 6) {
        cur.options.push({ html: '<p>' + b.html + '</p>' });
        cur.zone = 'opt';
        if (!cur.flags.some((f) => /tự đánh số/.test(f))) cur.flags.push('Nhãn phương án lấy từ danh sách tự đánh số của Word.');
        continue;
      }
      // nội dung không có nhãn
      const full = (cur.zone === 'opt' && cur.options.length >= 4) || (cur.zone === 'stm' && cur.statements.length >= 4);
      if (full && (b.kind === 'table' || H.hasImg(b.html) || t0.length > 0)) {
        // sau khi đủ phương án: coi là đoạn dẫn của câu kế tiếp
        const open = cur;
        finalize();
        pending = pending || { nums: null, max: 0, html: [], gid: null };
        pending.html.push(wrap(b));
        void open;
        continue;
      }
      if (cur.zone === 'opt' && cur.options.length) cur.options[cur.options.length - 1].html += wrap(b);
      else if (cur.zone === 'stm' && cur.statements.length) cur.statements[cur.statements.length - 1].html += wrap(b);
      else cur.stem.push(wrap(b));
    }
    finalize();

    if (!questions.length) {
      return { parts, questions, groups, answerBlocks, warnings: ['Không nhận dạng được câu hỏi nào. Mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2."... Hãy kiểm tra tệp hoặc dán lại nội dung.'], meta: {}, numbering: 'continuous' };
    }

    // phần chưa rõ dạng: suy ra từ các câu bên trong
    parts.forEach((p) => {
      const qs = questions.filter((q) => q.part === p.id);
      if (!p.type && qs.length) {
        const counts = {};
        qs.forEach((q) => (counts[q.type] = (counts[q.type] || 0) + 1));
        p.type = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      }
    });
    // bỏ các phần rỗng
    for (let i = parts.length - 1; i >= 0; i--) if (!questions.some((q) => q.part === parts[i].id)) parts.splice(i, 1);

    // nếu đề không có tiêu đề phần, tách phần theo dạng câu liên tiếp
    if (parts.length === 1 && parts[0].auto) {
      const base = parts[0];
      parts.length = 0;
      let last = null;
      questions.forEach((q) => {
        if (!last || last.type !== q.type) {
          last = { id: 'P' + (parts.length + 1), name: 'Phần ' + U.roman(parts.length + 1), headText: '', intro: [], type: q.type, explicit: false };
          parts.push(last);
        }
        q.part = last.id;
      });
      void base;
    }

    questions.forEach((q) => {
      if (q.group && groups[q.group]) q.group = q.group; // giữ
    });
    // nhóm có 1 câu giữ nguyên (đoạn dẫn riêng)
    Object.keys(groups).forEach((gid) => { if (!groups[gid].qids.length) delete groups[gid]; });

    // đánh số liên tục hay theo từng phần?
    let numbering = 'continuous';
    if (parts.length > 1) {
      const firsts = parts.slice(1).map((p) => questions.find((q) => q.part === p.id));
      if (firsts.every((q) => q && q.label === 1)) numbering = 'perPart';
    }

    // cảnh báo thứ tự số câu
    parts.forEach((p) => {
      const qs = questions.filter((q) => q.part === p.id);
      qs.forEach((q, i) => {
        if (i > 0 && q.label !== qs[i - 1].label + 1) warnings.push(`${p.name}: số câu nhảy từ ${qs[i - 1].label} sang ${q.label}. Có thể thiếu hoặc thừa câu — hãy kiểm tra.`);
      });
    });
    questions.forEach((q) => q.flags.forEach((f) => warnings.push(`Câu ${q.n}: ${f}`)));

    const meta = extractMeta(preamble.map((b) => b.text || ''));
    const sepM = blocks.map((b) => (b.kind !== 'table' && RE_Q.exec(b.text)) || null).find(Boolean);
    const labelSep = sepM && /^\s*Câu\s*\d+\s*:/i.test(sepM[0]) ? ':' : '.';
    return { parts, questions, groups, answerBlocks, warnings, meta, numbering, footerNotes, labelSep };
  };

  /* ---------------------------------------------------------------------------------
     Đọc đáp án
  --------------------------------------------------------------------------------- */
  function answerLines(blocks) {
    const lines = [];
    blocks.forEach((b) => {
      if (b.kind === 'table') {
        const rows = (b.rows || []).filter((r) => r.some(Boolean));
        let i = 0;
        while (i < rows.length) {
          const r = rows[i];
          const f0 = U.fold(r[0] || '');
          const f1 = rows[i + 1] ? U.fold(rows[i + 1][0] || '') : '';
          if (/^(cau|cau hoi|stt|so cau)$/.test(f0) && /^(dap an|da|ket qua|kq)/.test(f1)) {
            for (let c = 1; c < r.length; c++) if (r[c] && rows[i + 1][c] != null) lines.push({ text: `${r[c]}-${rows[i + 1][c]}`, tbl: true, html: '' });
            i += 2;
            continue;
          }
          if (/^(cau|stt|so cau|cau hoi)$/.test(f0) && !(rows[i + 1] && /^(dap an|da)/.test(f1))) { i++; continue; }
          lines.push({ text: r.filter((x) => x !== '').join(' '), tbl: true, html: '' });
          i++;
        }
      } else {
        lines.push({ text: (b.text || '').trim(), html: b.html, tbl: false });
      }
    });
    return lines.filter((l) => l.text);
  }

  function parseTF(text, n) {
    const out = [];
    const re = /(?:^|[\s,;(])([a-f])\s*[).\-–:]?\s*(Đúng|Sai|Đ|S|True|False)(?![a-zà-ỹ])/gi;
    let m;
    while ((m = re.exec(text))) {
      const idx = 'abcdef'.indexOf(m[1].toLowerCase());
      out[idx] = /^(đ|d|t)/i.test(m[2]) ? 'D' : 'S';
    }
    if (out.filter(Boolean).length >= 1) return out;
    const seq = [...text.matchAll(/(?:^|[\s,;|])([ĐS])\s*\((?:Đúng|Sai)\)/g)].map((x) => (x[1] === 'Đ' ? 'D' : 'S'));
    if (seq.length >= 2) return seq.slice(0, n || seq.length);
    const compact = text.replace(/[^ĐSđsDd]/g, '');
    const only = text.replace(/[\s,;\-–.:]/g, '');
    if (/^[ĐSđsDd]+$/.test(only) && only.length === n) return [...only].map((c) => (/[ĐĐđdD]/.test(c) ? 'D' : 'S'));
    void compact;
    return out;
  }

  /**
   * Gắn đáp án/hướng dẫn chấm vào các câu. Trả {matched, warnings}.
   * Mọi đáp án nhận dạng được đều ở trạng thái chưa xác nhận.
   */
  P.applyAnswers = function (blocksIn, exam) {
    const warnings = [];
    const blocks = preprocess(blocksIn.filter((b) => b.kind === 'table' || b.text || b.html));
    const lines = answerLines(blocks);
    const entries = [];
    const subs = [];
    let partHint = -1;
    let curE = null;
    const newEntry = (label, head, line) => {
      curE = { label, head: head || '', lines: [], partHint };
      entries.push(curE);
      void line;
    };
    for (const ln of lines) {
      const t = ln.text;
      // tiêu đề phần trong phần đáp án
      if (!ln.tbl && (RE_PART.test(t) || (RE_ROMAN.test(t) && Matrix.detectType(t))) && t.length < 200) { partHint++; curE = null; continue; }
      // dạng gọn: "1.A 2.B 3.C" / "1-A, 2-B"
      const compact = [...t.matchAll(/(?:^|[\s,;|])(?:Câu\s*)?(\d+)\s*[.\-:)–]?\s*([A-F])(?![A-Za-zÀ-ỹ])/g)];
      const stripped = t.replace(/(?:Câu\s*)?\d+\s*[.\-:)–]?\s*[A-F](?![A-Za-zÀ-ỹ])/g, '').replace(/[\s,;|.\-–:]/g, '');
      if (compact.length >= 2 && stripped.length <= 2) {
        compact.forEach((m) => { curE = null; newEntry(+m[1], m[2]); });
        curE = null;
        continue;
      }
      let m = /^Câu\s*(\d+)\s*[-–—]\s*([a-f])\s*[:.)]?\s*(Đúng|Sai)?\s*(.*)$/is.exec(t);
      if (m && m[3]) { subs.push({ label: +m[1], idx: 'abcdef'.indexOf(m[2].toLowerCase()), ans: m[3] === 'Đúng' ? 'D' : 'S', note: m[4].replace(/^(Nhận biết|Thông hiểu|Vận dụng cao|Vận dụng)\s*/i, '').trim(), partHint }); curE = null; continue; }
      m = /^(?:Câu|Bài)\s*(\d+)\s*[.:)\-–—]?\s*(.*)$/is.exec(t);
      if (m) { newEntry(+m[1], m[2], ln); curE.lines.push(ln); curE.firstLine = ln; continue; }
      const essayPart = partHint >= 0 && exam.parts[partHint] && exam.parts[partHint].type === 'essay';
      m = /^(\d+)\s*[.:)\-–]\s*(.+)$/s.exec(t);
      if (m && !essayPart && (/^([A-F]\b|[a-f]\s*[-.)]|[ĐS]\b|Đúng|Sai)/.test(m[2]) || ln.tbl)) { newEntry(+m[1], m[2], ln); curE.lines.push(ln); curE.firstLine = ln; continue; }
      m = /^(\d+)\s+(\S.*)$/s.exec(t);
      if (m && ln.tbl && !essayPart) { newEntry(+m[1], m[2], ln); curE.lines.push(ln); curE.firstLine = ln; continue; }
      if (curE) curE.lines.push(ln);
    }

    let ptr = 0, matched = 0;
    const qs = exam.questions;
    entries.forEach((e) => {
      let idx = -1;
      let start = ptr;
      if (e.partHint >= 0 && exam.parts[e.partHint]) {
        const first = qs.findIndex((q) => q.part === exam.parts[e.partHint].id);
        if (first >= 0 && (start < first || qs[start] && qs[start].part !== exam.parts[e.partHint].id)) start = first;
      }
      for (let i = start; i < qs.length; i++) if (qs[i].label === e.label) { idx = i; break; }
      if (idx < 0) for (let i = 0; i < qs.length; i++) if (qs[i].label === e.label) { idx = i; break; }
      if (idx < 0) { warnings.push(`Đáp án cho "Câu ${e.label}" không khớp câu nào của đề gốc.`); return; }
      ptr = idx + 1;
      const q = qs[idx];
      const head = e.head.replace(/^(Đáp án|ĐA|Kết quả|KQ)\s*[:：]?\s*/i, '').trim();
      const restLines = e.lines.filter((l) => l !== e.firstLine);
      const restText = restLines.map((l) => l.text).join(' ');
      const restHtml = restLines.map((l) => (l.html ? '<p>' + l.html + '</p>' : '<p>' + U.esc(l.text) + '</p>')).join('');
      if (q.type === 'mcq') {
        const lm = /^[\s:.\-]*(?:Chọn\s*)?([A-F])(?![A-Za-zÀ-ỹ])/.exec(head) || /^[\s:.\-]*(?:Chọn\s*)?([A-F])(?![A-Za-zÀ-ỹ])/.exec(restText);
        const k = lm ? U.letters.indexOf(lm[1]) : -1;
        if (k >= 0 && q.options[k]) {
          q.answer = q.options[k].id; q.answerNote = 'Nhận dạng từ phần đáp án — cần xác nhận.'; q.answerConfirmed = false; matched++;
          const extra = head.replace(/^[\s:.\-]*(?:Chọn\s*)?[A-F][.)]?\s*/, '').trim();
          if (extra || restHtml) q.guide = (extra ? '<p>' + U.esc(extra) + '</p>' : '') + restHtml;
        } else warnings.push(`Câu ${q.n}: đáp án "${head.slice(0, 20)}" không phải A–D hoặc vượt số phương án.`);
      } else if (q.type === 'tf') {
        const marks = parseTF(head + ' ' + (e.lines.length > 1 ? restText : ''), q.statements.length);
        if (marks.filter(Boolean).length) {
          q.statements.forEach((s, i) => { if (marks[i]) s.answer = marks[i]; });
          q.answerNote = 'Nhận dạng từ phần đáp án — cần xác nhận.'; q.answerConfirmed = false; matched++;
          if (marks.filter(Boolean).length < q.statements.length) warnings.push(`Câu ${q.n}: chỉ đọc được ${marks.filter(Boolean).length}/${q.statements.length} đáp án đúng/sai.`);
          if (restHtml) q.guide = restHtml;
        } else warnings.push(`Câu ${q.n}: không đọc được đáp án đúng/sai từ "${head.slice(0, 30)}".`);
      } else if (q.type === 'short') {
        const ans = head || (restLines[0] ? restLines[0].text : '');
        if (ans) { q.answer = ans.trim(); q.answerNote = 'Nhận dạng từ phần đáp án — cần xác nhận.'; q.answerConfirmed = false; matched++; if (head && restHtml) q.guide = restHtml; }
        else warnings.push(`Câu ${q.n}: chưa đọc được đáp án trả lời ngắn.`);
      } else {
        const g1 = (head ? '<p>' + (e.firstLine && e.firstLine.html ? H.stripPrefix(e.firstLine.html, /^\s*(?:Câu|Bài)\s*\d+\s*[.:)\-–—]?\s*/i) : U.esc(head)) + '</p>' : '') + restHtml;
        if (g1) { q.guide = g1; matched++; }
      }
    });
    // đáp án/giải thích theo từng ý đúng-sai ("Câu 1 - a: Đúng ...") — ưu tiên hơn dòng tóm tắt
    subs.forEach((sb) => {
      const part = sb.partHint >= 0 ? exam.parts[sb.partHint] : null;
      const q = qs.find((x) => x.type === 'tf' && x.label === sb.label && (!part || x.part === part.id));
      const st = q && q.statements[sb.idx];
      if (!st) return;
      if (!st.answer) { st.answer = sb.ans; matched++; }
      q.answerNote = 'Nhận dạng từ phần đáp án — cần xác nhận.'; q.answerConfirmed = false;
      if (sb.note) st.guide = '<p>' + U.esc(sb.note) + '</p>';
    });
    return { matched, entries: entries.length, warnings: warnings.filter((w) => !/chỉ đọc được \d+\/\d+ đáp án đúng\/sai/.test(w) || !subs.length) };
  };

  g.ExamParser = P;
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
