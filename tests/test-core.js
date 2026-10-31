/* Kiểm thử lõi: chạy bằng  node tests/test-core.js  (cần jsdom — xem README, mục "Chạy kiểm thử"). */
require('./setup');
const assert = require('assert');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); } };

function loadSample() {
  const m = Matrix.fromText(SAMPLE.matrixText);
  const matrix = { rows: m.rows, confirmed: true };
  const ex = ExamParser.parse(Readers.textToBlocks(SAMPLE.examText));
  ExamParser.applyAnswers(ex.answerBlocks, ex);
  const exam = { parts: ex.parts, questions: ex.questions, groups: ex.groups, numbering: ex.numbering };
  Check.suggest(matrix, exam);
  exam.questions.forEach((q) => { q.confirmed = true; q.answerConfirmed = true; });
  return { matrix, exam };
}
const cfg = (n, o) => Object.assign({ count: n, codes: ['101', '102', '103', '104'].slice(0, n), seed: 12345, shuffleQ: true, shuffleOpt: true, tfShuffle: false, balanceAnswers: true, withinLevel: false }, o || {});

console.log('\n1. Đọc ma trận và đề mẫu');
t('Ma trận mẫu: 16 dòng, 21 câu, 10 điểm', () => {
  const { matrix } = loadSample();
  const tot = Matrix.totals(matrix.rows);
  assert.strictEqual(matrix.rows.length, 16); assert.strictEqual(tot.count, 21); assert.strictEqual(tot.points, 10);
});
t('Đề mẫu: 21 câu, 4 phần, 1 nhóm câu chùm (câu 9-10)', () => {
  const { exam } = loadSample();
  assert.strictEqual(exam.questions.length, 21); assert.strictEqual(exam.parts.length, 4);
  assert.deepStrictEqual(exam.groups.G1.qids, ['Q9', 'Q10']);
});
t('Đáp án nhận dạng đủ (mcq/tf/short)', () => {
  const { exam } = loadSample();
  assert.strictEqual(exam.questions.filter((q) => Check.answerState(q) === 'missing').length, 0);
  assert.strictEqual(exam.questions[0].options.findIndex((o) => o.id === exam.questions[0].answer), 2); // câu 1 = C
  assert.strictEqual(exam.questions[12].statements.map((s) => s.answer).join(''), 'DSDS');
});
t('Đáp án chưa xác nhận khi vừa nhận dạng', () => {
  const ex = ExamParser.parse(Readers.textToBlocks(SAMPLE.examText));
  ExamParser.applyAnswers(ex.answerBlocks, ex);
  assert.ok(ex.questions.every((q) => !q.answerConfirmed && !q.confirmed));
});
t('Đối chiếu ma trận khớp sau khi gán gợi ý', () => {
  const { matrix, exam } = loadSample();
  const r = Check.run(matrix, exam);
  assert.strictEqual(r.errors, 0, JSON.stringify(r.issues.slice(0, 3)));
  assert.ok(Check.readiness(matrix, exam).canShuffle);
});
t('Phát hiện sai lệch: thiếu 1 câu Hiểu của chủ đề', () => {
  const { matrix, exam } = loadSample();
  const q = exam.questions.find((x) => x.level === 'Hiểu' && x.type === 'mcq');
  q.level = 'Biết';
  const r = Check.run(matrix, exam);
  assert.ok(r.errors > 0);
  assert.ok(r.issues.some((i) => /cần \d+ câu nhưng đề hiện có \d+ câu/.test(i.text)), r.issues.map((i) => i.text).join('\n'));
  assert.ok(!Check.readiness(matrix, exam).canShuffle);
});

t('Phương án 2 cột (A,B / C,D) trên cùng dòng được tách đủ 4 phương án', () => {
  const txt = 'PHẦN I. Trắc nghiệm nhiều lựa chọn\nCâu 1. Chọn đúng?\nA. Cấu trúc lặp for  B. Cấu trúc tuần tự\nC. Cấu trúc rẽ nhánh  D. Câu lệnh gán\nCâu 2. Tiếp?\nA. 1  B. 2  C. 3  D. 4';
  const ex = ExamParser.parse(Readers.textToBlocks(txt));
  assert.strictEqual(ex.questions.length, 2);
  assert.strictEqual(ex.questions[0].options.length, 4);
  assert.strictEqual(ex.questions[1].options.length, 4);
});

console.log('\n2. Trộn đề 2/3/4 mã');
[2, 3, 4].forEach((n) => {
  t(`Tạo đúng ${n} mã đề, đủ câu, khác nhau, qua kiểm tra`, () => {
    const { matrix, exam } = loadSample();
    const config = cfg(n);
    const r = Shuffle.generate(exam, matrix, config);
    assert.ok(r.ok, r.errors.join(' | '));
    assert.strictEqual(r.versions.length, n);
    r.versions.forEach((v) => {
      assert.strictEqual(v.items.length, 21);
      assert.strictEqual(new Set(v.items.map((i) => i.qid)).size, 21);
    });
    assert.strictEqual(new Set(r.versions.map((v) => v.sig)).size, n);
    const ver = Shuffle.verify(exam, matrix, r.versions, config);
    assert.ok(ver.ok, ver.rows.filter((x) => !x.ok).map((x) => x.code + ': ' + x.check + ' ' + x.detail).join('\n'));
  });
});
t('Đáp án đúng sau khi đảo (so với nội dung phương án đúng gốc)', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => v.items.forEach((it) => {
    const q = exam.questions.find((x) => x.id === it.qid);
    if (q.type !== 'mcq') return;
    const letter = Shuffle.answerText(q, it);
    const shownId = it.optionOrder[U.letters.indexOf(letter)];
    assert.strictEqual(H.textOf(q.options.find((o) => o.id === shownId).html), H.textOf(q.options.find((o) => o.id === q.answer).html));
  }));
});
t('Câu 12 ("A và B đều đúng") tự khóa phương án, thứ tự phương án giữ nguyên', () => {
  const { matrix, exam } = loadSample();
  assert.ok(Shuffle.optionDependent(exam.questions[11]));
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => {
    const it = v.items.find((i) => i.qid === 'Q12');
    assert.strictEqual(it.optionOrder.join(), exam.questions[11].options.map((o) => o.id).join());
  });
});
t('Câu chùm 9-10 luôn liền nhau và đúng thứ tự', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => {
    const i = v.items.findIndex((x) => x.qid === 'Q9');
    assert.strictEqual(v.items[i + 1].qid, 'Q10');
  });
});
t('Giữ nguyên các phần; câu chỉ đổi chỗ trong phần của nó', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(3));
  r.versions.forEach((v) => v.items.forEach((it, i) => {
    assert.strictEqual(exam.questions.find((q) => q.id === it.qid).part, exam.questions[i].part);
  }));
});
t('Khóa vị trí một câu được giữ', () => {
  const { matrix, exam } = loadSample();
  exam.questions[2].lock = true; exam.questions[15].lock = true;
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => { assert.strictEqual(v.items[2].qid, 'Q3'); assert.strictEqual(v.items[15].qid, 'Q16'); });
});
t('Khóa phương án một câu được giữ', () => {
  const { matrix, exam } = loadSample();
  exam.questions[0].lockOptions = true;
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => assert.strictEqual(v.items.find((i) => i.qid === 'Q1').optionOrder.join(), exam.questions[0].options.map((o) => o.id).join()));
});
t('Câu đúng/sai mặc định giữ thứ tự ý; bật đảo thì ánh xạ đáp án đúng', () => {
  const { matrix, exam } = loadSample();
  let r = Shuffle.generate(exam, matrix, cfg(3));
  r.versions.forEach((v) => assert.strictEqual(v.items.find((i) => i.qid === 'Q13').stmtOrder.join(), 'Q13s1,Q13s2,Q13s3,Q13s4'));
  exam.questions.filter((q) => q.type === 'tf').forEach((q) => (q.tfIndependent = true));
  const config = cfg(4, { tfShuffle: true });
  r = Shuffle.generate(exam, matrix, config);
  assert.ok(r.ok);
  const some = r.versions.some((v) => v.items.some((i) => i.stmtOrder && i.stmtOrder.join() !== exam.questions.find((q) => q.id === i.qid).statements.map((s) => s.id).join()));
  assert.ok(some, 'nên có ít nhất một câu đảo ý');
  r.versions.forEach((v) => v.items.forEach((it) => {
    const q = exam.questions.find((x) => x.id === it.qid);
    if (q.type !== 'tf') return;
    const a = Shuffle.answerText(q, it);
    it.stmtOrder.forEach((sid, k) => assert.strictEqual(a[k], q.statements.find((s) => s.id === sid).answer === 'D' ? 'Đ' : 'S'));
  }));
  assert.ok(Shuffle.verify(exam, matrix, r.versions, config).ok);
});
t('Cùng seed + cấu hình => cùng kết quả; khác seed => khác', () => {
  const { matrix, exam } = loadSample();
  const a = Shuffle.generate(exam, matrix, cfg(4)), b = Shuffle.generate(exam, matrix, cfg(4)), c = Shuffle.generate(exam, matrix, cfg(4, { seed: 999 }));
  assert.deepStrictEqual(a.versions.map((v) => v.sig), b.versions.map((v) => v.sig));
  assert.notDeepStrictEqual(a.versions.map((v) => v.sig), c.versions.map((v) => v.sig));
});
t('Câu tham chiếu số thứ tự câu khác bị khóa', () => {
  const { matrix, exam } = loadSample();
  exam.questions[6].stem += '<p>Dựa vào kết quả ở câu 5, hãy chọn đáp án.</p>';
  const rep = Shuffle.lockReport(exam, matrix, cfg(3));
  assert.ok(rep.some((x) => x.qid === 'Q7' && x.kind === 'position'));
  assert.ok(rep.some((x) => x.qid === 'Q5' && x.kind === 'position'));
});

t('200 seed ngẫu nhiên × 2/3/4 mã: luôn qua kiểm tra, mã đề khác nhau', () => {
  const { matrix, exam } = loadSample();
  for (let s = 1; s <= 200; s++) {
    const n = 2 + (s % 3);
    const config = cfg(n, { seed: s * 7919 });
    const r = Shuffle.generate(exam, matrix, config);
    assert.ok(r.ok, 'seed ' + s);
    const ver = Shuffle.verify(exam, matrix, r.versions, config);
    assert.ok(ver.ok, 'seed ' + s + ': ' + ver.rows.filter((x) => !x.ok).map((x) => x.check).join(';'));
  }
});
t('Các mã đề khác nhau rõ rệt (>= 60% câu đổi vị trí so với đề gốc)', () => {
  const { matrix, exam } = loadSample();
  const orig = Shuffle.originalItems(exam);
  const r = Shuffle.generate(exam, matrix, cfg(4));
  r.versions.forEach((v) => {
    const moved = v.items.filter((it, i) => it.qid !== orig[i].qid).length;
    assert.ok(moved / v.items.length >= 0.6, `mã ${v.code}: ${moved}/21`);
  });
});

console.log('\n3. Không đủ hoán vị hợp lệ');
t('Khóa hết + tắt đảo phương án => báo lỗi rõ ràng, không xuất bản trùng', () => {
  const { matrix, exam } = loadSample();
  exam.questions.forEach((q) => { q.lock = true; });
  const r = Shuffle.generate(exam, matrix, cfg(2, { shuffleOpt: false }));
  assert.ok(!r.ok); assert.ok(r.errors.join(' ').includes('chỉ có tối đa'));
});
t('Chỉ còn ít hoán vị so với số mã cần => báo lỗi', () => {
  const { matrix, exam } = loadSample();
  exam.questions.forEach((q, i) => { q.lock = i >= 2; });
  const r = Shuffle.generate(exam, matrix, cfg(4, { shuffleOpt: false }));
  assert.ok(!r.ok, 'phải báo không đủ');
});

console.log('\n4. Ma trận có quy định vị trí (chỉ hoán đổi giữa vị trí tương đương)');
t('Hoán đổi chỉ trong cùng chủ đề/mức độ/điểm', () => {
  const { exam } = loadSample();
  const rows = [];
  const keyPos = {};
  exam.questions.filter((q) => q.type === 'mcq').forEach((q) => { const k = [q.topic, q.level].join('|'); (keyPos[k] = keyPos[k] || { q, pos: [] }).pos.push(q.n); });
  Object.values(keyPos).forEach((o) => rows.push(Matrix.newRow({ part: 'Phần I', type: 'mcq', topic: o.q.topic, level: o.q.level, count: o.pos.length, points: o.pos.length * 0.25, positions: o.pos.join(',') })));
  Matrix.fromText(SAMPLE.matrixText).rows.filter((r) => r.type !== 'mcq').forEach((r) => rows.push(r));
  const matrix = { rows, confirmed: true };
  const res = Check.run(matrix, exam);
  assert.strictEqual(res.errors, 0, res.issues.map((i) => i.text).join('\n'));
  const config = cfg(4);
  const g = Shuffle.generate(exam, matrix, config);
  assert.ok(g.ok, (g.errors || []).join('|'));
  const ver = Shuffle.verify(exam, matrix, g.versions, config);
  assert.ok(ver.ok, ver.rows.filter((x) => !x.ok).map((x) => x.check + x.detail).join('\n'));
  g.versions.forEach((v) => v.items.slice(0, 12).forEach((it, i) => {
    const a = exam.questions.find((q) => q.id === it.qid), b = exam.questions[i];
    assert.strictEqual([a.topic, a.level].join('|'), [b.topic, b.level].join('|'));
  }));
});
t('Vị trí sai bị phát hiện', () => {
  const { exam } = loadSample();
  const rows = [Matrix.newRow({ part: 'Phần I', type: 'mcq', topic: exam.questions[0].topic, level: 'Vận dụng', count: 1, points: 0.25, positions: '1' })];
  const res = Check.compare(rows, Check.orderedOf(exam), { numbering: exam.numbering });
  assert.ok(res.issues.some((i) => /Vị trí câu 1/.test(i.text)));
});

console.log('\n5. Đánh số theo từng phần');
t('Đề đánh số lại từng phần: nhận dạng perPart và trộn đúng', () => {
  const map = { 13: 1, 14: 2, 15: 3, 16: 1, 17: 2, 18: 3, 19: 4, 20: 1, 21: 2 };
  const txt = SAMPLE.examText
    .replace(/^Câu (1[3-9]|2[01])([.:])/gm, (m, n, sep) => 'Câu ' + map[n] + sep);
  const ex = ExamParser.parse(Readers.textToBlocks(txt));
  ExamParser.applyAnswers(ex.answerBlocks, ex);
  assert.strictEqual(ex.numbering, 'perPart');
  const matrix = { rows: Matrix.fromText(SAMPLE.matrixText).rows, confirmed: true };
  const exam = { parts: ex.parts, questions: ex.questions, groups: ex.groups, numbering: ex.numbering };
  Check.suggest(matrix, exam);
  exam.questions.forEach((q) => { q.confirmed = true; q.answerConfirmed = true; });
  assert.strictEqual(Check.run(matrix, exam).errors, 0);
  assert.strictEqual(Check.answerState(exam.questions[12]), 'ok', 'đáp án phần II phải khớp theo thứ tự dù số câu đánh lại');
  const config = cfg(3);
  const g = Shuffle.generate(exam, matrix, config);
  assert.ok(g.ok);
  assert.strictEqual(g.versions[0].items[12].num, 1);
  assert.ok(Shuffle.verify(exam, matrix, g.versions, config).ok);
});

console.log('\n6. Ma trận dạng bảng rộng (cột Biết/Hiểu/Vận dụng)');
t('Nhận dạng cột mức độ', () => {
  const table = [
    ['Chủ đề', 'Dạng câu hỏi', 'Biết', 'Hiểu', 'Vận dụng', 'Điểm'],
    ['CĐ1', 'Trắc nghiệm nhiều lựa chọn', '3', '2', '', '1,25'],
    ['CĐ2', 'Trắc nghiệm nhiều lựa chọn', '2', '', '1', '0,75'],
    ['Tổng', '', '5', '2', '1', '2'],
  ];
  const r = Matrix.fromTable(table);
  assert.strictEqual(r.rows.length, 4, JSON.stringify(r.rows.map((x) => [x.topic, x.level, x.count, x.points])));
  assert.strictEqual(Matrix.totals(r.rows).count, 8);
  assert.ok(Math.abs(Matrix.totals(r.rows).points - 2) < 0.01);
});
t('Vị trí "1-4, 7"', () => assert.deepStrictEqual(Matrix.parsePositions('1-4, 7'), [1, 2, 3, 4, 7]));

console.log('\n7. Mô hình tài liệu / bảng đáp án');
t('Dựng đề, đáp án, tổng hợp, hướng dẫn chấm', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(3));
  const meta = Doc.defaultMeta(); meta.school = 'Trường ABC'; meta.subject = 'Tin học'; meta.grade = '12';
  const m1 = Doc.examModel(exam, r.versions[0], meta);
  const html = Doc.toHtml(m1);
  assert.ok(html.includes('Mã đề') && html.includes('Câu 21.'));
  assert.ok(!/Đáp án/.test(html), 'đề học sinh không chứa đáp án');
  assert.ok(Doc.toHtml(Doc.answerModel(exam, r.versions[0], meta)).includes('Đáp án'));
  assert.ok(Doc.toHtml(Doc.combinedAnswerModel(exam, r.versions, meta)).includes('Mã 103'));
  assert.ok(Doc.hasGuide(exam));
  assert.ok(Doc.toHtml(Doc.guideModel(exam, r.versions[0], meta)).includes('Nhập n'));
});
t('Bảng đối chiếu có ánh xạ phương án', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(2));
  const map = Shuffle.mapping(exam, r.versions);
  assert.strictEqual(map.length, 42);
  assert.ok(map.find((x) => x.origNum === 1).map.includes('←'));
});

console.log('\n8. Chế độ không cần ma trận (chỉ có đề)');
t('Trộn được khi chỉ có đề, không có ma trận', () => {
  const ex = ExamParser.parse(Readers.textToBlocks(SAMPLE.examText));
  ExamParser.applyAnswers(ex.answerBlocks, ex);
  const exam = { parts: ex.parts, questions: ex.questions, groups: ex.groups, numbering: ex.numbering };
  exam.questions.forEach((q) => { q.confirmed = true; q.answerConfirmed = true; });
  const matrix = { rows: [], confirmed: false, auto: true };
  const rd = Check.readiness(matrix, exam);
  assert.ok(rd.canShuffle, rd.blockers.join('; '));
  assert.strictEqual(Matrix.totals(matrix.rows).count, 21);
  const c = cfg(3);
  const g = Shuffle.generate(exam, matrix, c);
  assert.ok(g.ok, JSON.stringify(g.errors));
  assert.ok(Shuffle.verify(exam, matrix, g.versions, c).ok);
});

console.log('\n9. Lời dẫn phần, điểm trong câu, dòng bị PDF ngắt');
const essayExam = (intro) => ExamParser.parse(Readers.textToBlocks(`PHẦN III. Tự luận (3,0 điểm)
${intro}
Câu 1 (1,5 điểm). Nêu khái niệm AI.
Câu 2 (1,5 điểm). Viết tệp HTML.`));
t('"Mỗi câu 1,5 điểm" là lời dẫn phần, không phải câu chùm', () => {
  const r = essayExam('Trả lời hai câu sau trên giấy làm bài. Mỗi câu 1,5 điểm.');
  assert.strictEqual(Object.keys(r.groups).length, 0);
  assert.strictEqual(r.parts[0].intro.length, 1);
});
t('"Thí sinh trả lời từ câu 1 đến câu 2" là lời dẫn phần', () => {
  const r = essayExam('Thí sinh trả lời từ câu 1 đến câu 2.');
  assert.strictEqual(Object.keys(r.groups).length, 0);
});
t('Đoạn dẫn "trả lời câu 1 và 2" vẫn là câu chùm', () => {
  const r = essayExam('Đọc đoạn văn sau và trả lời câu 1 và 2: Máy tính ra đời từ lâu.');
  assert.ok(r.questions[0].group);
  assert.strictEqual(r.questions[0].group, r.questions[1].group);
});
t('Tách điểm không để lại dấu chấm thừa', () => {
  const q = essayExam('Làm bài trên giấy.').questions[0];
  assert.strictEqual(q.points, 1.5);
  assert.strictEqual(H.textOf(q.stem).trim(), 'Nêu khái niệm AI.');
});
t('Nối dòng bị ngắt, giữ nguyên dòng mới và dòng mã', () => {
  const L = (s, end) => ({ s, start: 40, end, right: 560 });
  assert.deepStrictEqual(Readers.joinWrapped([
    L('Câu 1. Viết tệp HTML có tiêu đề chính “Lớp em” và', 555), L('một đoạn dùng phông Tahoma.', 330),
    L('Câu 2. Đoạn mã sau hiển thị gì ở trình duyệt web của máy tính:', 555), L('<h2>Rau cải</h2>', 120),
    L('A. Phương án thứ nhất rất dài chạy sát tới lề phải của trang', 555), L('B. Phương án thứ hai', 150),
  ]), ['Câu 1. Viết tệp HTML có tiêu đề chính “Lớp em” và một đoạn dùng phông Tahoma.', 'Câu 2. Đoạn mã sau hiển thị gì ở trình duyệt web của máy tính:', '<h2>Rau cải</h2>', 'A. Phương án thứ nhất rất dài chạy sát tới lề phải của trang', 'B. Phương án thứ hai']);
});

t('Không nối dòng bảng đáp án viết thành chữ', () => {
  const rows = [{ s: 'Câu 1 2 3 4', start: 40, end: 555, right: 560 }, { s: 'Đáp án B A A C', start: 40, end: 555, right: 560 }];
  assert.deepStrictEqual(Readers.joinWrapped(rows), ['Câu 1 2 3 4', 'Đáp án B A A C']);
  const spreadRows = [{ s: '1 2 3 4 5', start: 40, end: 555, right: 560 }, { s: 'b c d e g', start: 40, end: 80, right: 560 }];
  assert.strictEqual(Readers.joinWrapped(spreadRows).length, 2);
});

console.log('\n10. Mẫu tiêu đề chuẩn cho mọi đề');
const headText = (m) => JSON.stringify(m.slice(0, 2));
t('Đọc thông tin từ tiêu đề kiểu khác', () => {
  const m = ExamParser.extractMeta(['SỞ GD&ĐT THÁI NGUYÊN', 'TRƯỜNG THPT NA RÌ', 'TỔ XÃ HỘI', '(Đề thi có 03 trang)', 'ĐỀ KIỂM TRA CUỐI KÌ I - MÔN: NGỮ VĂN 11', 'Năm học 2026 – 2027', 'Thời gian: 90 phút (không kể thời gian phát đề)']);
  assert.strictEqual(m.dept, 'SỞ GD&ĐT THÁI NGUYÊN');
  assert.strictEqual(m.school, 'TRƯỜNG THPT NA RÌ');
  assert.strictEqual(m.group, 'TỔ XÃ HỘI');
  assert.strictEqual(m.pages, '3');
  assert.strictEqual(m.title, 'ĐỀ KIỂM TRA CUỐI KÌ I');
  assert.strictEqual(m.subject, 'NGỮ VĂN 11');
  assert.strictEqual(m.year, '2026-2027');
  assert.strictEqual(m.time, '90 phút');
});
t('Dòng "Môn: Toán - Lớp 10" tách đúng môn và lớp', () => {
  const m = ExamParser.extractMeta(['Môn: Toán – Lớp 10   Thời gian làm bài: 60 phút']);
  assert.strictEqual(m.subject, 'Toán');
  assert.strictEqual(m.grade, '10');
  assert.strictEqual(m.time, '60 phút');
});
t('Chữ "môn" trong câu văn không bị hiểu là tên môn', () => {
  const m = ExamParser.extractMeta(['Với các môn không sử dụng Trả lời ngắn có thể chuyển điểm sang dạng Đúng – Sai.', 'MÔN: TOÁN - LỚP 12', 'NĂM HỌC: 2026 - 2027', 'THỜI GIAN LÀM BÀI: 90 PHÚT']);
  assert.strictEqual(m.subject, 'TOÁN');
  assert.strictEqual(m.grade, '12');
  assert.strictEqual(m.year, '2026-2027');
  assert.strictEqual(m.time, '90 phút');
});
t('Bảng tiêu đề nhiều dòng trong một ô không bị dính chữ', () => {
  const blocks = H.parseBlocks('<table><tr><td><p>TRƯỜNG THPT ABC</p><p>TỔ TOÁN</p></td><td><p>MÔN: TOÁN</p><p>Thời gian làm bài: 60 phút</p></td></tr></table><p>Câu 1. Hai cộng hai bằng mấy?</p><p>A. 1</p><p>B. 2</p><p>C. 3</p><p>D. 4</p>');
  const m = ExamParser.parse(blocks).meta;
  assert.strictEqual(m.school, 'TRƯỜNG THPT ABC');
  assert.strictEqual(m.group, 'TỔ TOÁN');
  assert.strictEqual(m.subject, 'TOÁN');
  assert.strictEqual(m.time, '60 phút');
});
t('Mọi đề đều ra đúng mẫu, số trang theo thực tế', () => {
  const { matrix, exam } = loadSample();
  const r = Shuffle.generate(exam, matrix, cfg(2));
  const meta = Object.assign(Doc.defaultMeta(), { group: 'Tổ Tự nhiên 1', title: 'Đề kiểm tra giữa học kì 1', subject: 'Toán', grade: '10', year: '2026-2027', time: '60 phút' });
  exam.pageCount = 3;
  const h = headText(Doc.examModel(exam, r.versions[1], meta));
  ['TRƯỜNG THPT NA RÌ', 'TỔ TỰ NHIÊN 1', '(Đề gồm có 03 trang)', 'ĐỀ KIỂM TRA GIỮA HỌC KÌ 1', 'NĂM HỌC 2026 - 2027', 'MÔN: Toán 10', 'Thời gian làm bài: 60 phút', 'Họ và tên:', 'Lớp:', 'Mã đề ' + r.versions[1].code].forEach((x) => assert.ok(h.includes(x), x));
});

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
