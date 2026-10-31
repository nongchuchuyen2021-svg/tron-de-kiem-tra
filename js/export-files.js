/* Lập danh sách tệp xuất ra (Word, PDF, báo cáo Excel, cấu hình tái tạo) và đóng gói ZIP. */
(function (g) {
  const F = {};

  const slug = (s) => U.fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const MIME = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    json: 'application/json',
  };

  F.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };

  function sheet(rows, widths) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
    return ws;
  }
  const xlsxBlob = (wb) => new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: MIME.xlsx });
  const T = Matrix.TYPES;

  F.mappingWorkbook = function (ctx) {
    const { exam, versions } = ctx;
    const map = Shuffle.mapping(exam, versions);
    const wb = XLSX.utils.book_new();
    const rows = [['Mã đề', 'Phần', 'Câu mới', 'Câu gốc', 'Dạng câu hỏi', 'Chủ đề', 'Mức độ', 'Điểm', 'Ánh xạ phương án/ý (vị trí mới ← vị trí gốc)', 'Đáp án gốc', 'Đáp án mã đề', 'Khóa vị trí', 'Khóa phương án']];
    const prep = Shuffle.prepare(exam, ctx.matrix, ctx.config);
    map.forEach((m) => {
      const q = exam.questions.find((x) => x.id === m.qid);
      const locked = prep.units.some((u) => u.locked && u.qids.includes(q.id));
      rows.push([m.code, m.part, m.num, m.origName, T[m.type], m.topic, m.level, m.points, m.map || (m.type === 'mcq' ? '(giữ nguyên)' : ''), m.origAnswer, m.newAnswer, locked ? 'Có' : '', q.type === 'mcq' && Shuffle.lockOptionsOf(q) ? 'Có' : '']);
    });
    XLSX.utils.book_append_sheet(wb, sheet(rows, [8, 10, 9, 22, 22, 36, 12, 7, 38, 11, 13, 11, 13]), 'Đối chiếu câu gốc - mã đề');
    return wb;
  };

  F.matrixReportWorkbook = function (ctx) {
    const { exam, matrix, versions, config } = ctx;
    const wb = XLSX.utils.book_new();
    // 1) thông tin
    const info = [
      ['BÁO CÁO KIỂM TRA MA TRẬN CÁC MÃ ĐỀ'],
      ['Ngày tạo', new Date(ctx.generatedAt || Date.now()).toLocaleString('vi-VN')],
      ['Số mã đề', versions.length], ['Các mã đề', versions.map((v) => v.code).join(', ')],
      ['Seed (giá trị khởi tạo ngẫu nhiên)', config.seed],
      ['Đảo thứ tự câu hỏi', config.shuffleQ !== false ? 'Có' : 'Không'], ['Đảo phương án trả lời', config.shuffleOpt !== false ? 'Có' : 'Không'],
      ['Đảo ý đúng/sai (chỉ câu giáo viên xác nhận độc lập)', config.tfShuffle ? 'Có' : 'Không'], ['Chỉ đảo trong cùng mức độ', config.withinLevel ? 'Có' : 'Không'],
      ['Cân đối vị trí đáp án', config.balanceAnswers !== false ? 'Có' : 'Không'],
      ['Tổng số câu', exam.questions.length], ['Tổng điểm', U.fmt(U.sum(exam.questions, (q) => +q.points || 0))],
    ];
    XLSX.utils.book_append_sheet(wb, sheet(info, [48, 40]), 'Thông tin');
    // 2) kiểm tra sau trộn
    const ver = ctx.verify || Shuffle.verify(exam, matrix, versions, config);
    const vr = [['Mã đề', 'Nội dung kiểm tra', 'Kết quả', 'Chi tiết']];
    ver.rows.forEach((r) => vr.push([r.code, r.check, r.ok ? 'Đạt' : 'KHÔNG ĐẠT', r.detail]));
    XLSX.utils.book_append_sheet(wb, sheet(vr, [10, 62, 12, 60]), 'Kiểm tra sau trộn');
    // 3) phân bố theo ma trận
    const qById = Object.fromEntries(exam.questions.map((q) => [q.id, q]));
    const dist = [['Mã đề', 'Dạng câu hỏi', 'Chủ đề', 'Mức độ', 'Ma trận: số câu', 'Mã đề: số câu', 'Ma trận: điểm', 'Mã đề: điểm', 'Kết quả']];
    versions.forEach((v) => {
      const res = Check.compare(matrix.rows, v.items.map((it) => ({ q: qById[it.qid], num: it.num, partId: qById[it.qid].part })), { numbering: exam.numbering });
      res.table.forEach((t) => dist.push([v.code, T[t.type], t.topic, t.level, t.need, t.have, t.needPts, t.havePts, t.ok ? 'Khớp' : 'LỆCH']));
    });
    XLSX.utils.book_append_sheet(wb, sheet(dist, [8, 24, 40, 12, 14, 14, 14, 14, 10]), 'Phân bố theo ma trận');
    // 4) ma trận gốc
    const mr = [['Phần', 'Dạng câu hỏi', 'Chủ đề', 'Mức độ', 'Số câu', 'Điểm', 'Vị trí câu']];
    matrix.rows.forEach((r) => mr.push([r.part, T[r.type], r.topic, r.level, r.count, r.points, r.positions]));
    XLSX.utils.book_append_sheet(wb, sheet(mr, [10, 26, 40, 12, 8, 8, 14]), 'Ma trận');
    return wb;
  };

  F.configJson = function (ctx) {
    return JSON.stringify({
      ghiChu: 'Tệp này cho phép tạo lại đúng bộ mã đề: mở website → Mở dự án → chọn tệp này → bấm "Tạo mã đề" (cùng seed, cùng cấu hình).',
      seed: ctx.config.seed, cauHinh: ctx.config, maDe: ctx.versions.map((v) => ({ ma: v.code, dauVan: v.sig })),
      ngayTao: new Date(ctx.generatedAt || Date.now()).toISOString(),
    }, null, 2);
  };

  /**
   * Danh sách tệp. ctx = {exam, matrix, config, meta, versions, verify, generatedAt, answersReady, answerBlockers}
   * Mỗi tệp: {id, folder, name, label, kind, disabledReason, make():Promise<Blob>}
   */
  F.plan = function (ctx) {
    const { exam, versions, meta } = ctx;
    const prefix = [slug(meta.subject), slug(meta.grade)].filter(Boolean).join('') || 'KiemTra';
    const files = [];
    const ansReason = ctx.answersReady ? '' : 'Chưa xác nhận đủ đáp án: ' + ctx.answerBlockers.join(' ');
    const both = (folder, base, label, model, footer, extra) => {
      ['docx', 'pdf'].forEach((ext) => files.push(Object.assign({
        id: `${folder}/${base}.${ext}`, folder, name: `${base}.${ext}`, label, kind: ext,
        make: () => (ext === 'docx' ? ExportDocx.toBlob(model(), footer) : ExportPdf.toBlob(model(), footer)),
      }, extra || {})));
    };
    versions.forEach((v) => both('De', `${prefix}_De_${v.code}`, `Đề – mã ${v.code}`, () => Doc.examModel(exam, v, meta), `Mã đề ${v.code}`, { code: v.code }));
    versions.forEach((v) => both('DapAn', `${prefix}_DapAn_${v.code}`, `Đáp án – mã ${v.code}`, () => Doc.answerModel(exam, v, meta), `Đáp án mã đề ${v.code}`, { code: v.code, disabledReason: ansReason }));
    both('DapAn', `${prefix}_DapAn_TongHop`, 'Đáp án tổng hợp các mã đề', () => Doc.combinedAnswerModel(exam, versions, meta), 'Đáp án tổng hợp', { disabledReason: ansReason });
    if (Doc.hasGuide(exam)) versions.forEach((v) => both('HuongDanCham', `${prefix}_HuongDanCham_${v.code}`, `Hướng dẫn chấm – mã ${v.code}`, () => Doc.guideModel(exam, v, meta), `Hướng dẫn chấm mã ${v.code}`, { code: v.code, disabledReason: ansReason }));
    files.push({ id: 'BaoCao/doichieu', folder: 'BaoCao', name: `${prefix}_DoiChieu_CauGoc_MaDe.xlsx`, label: 'Bảng đối chiếu câu gốc – mã đề', kind: 'xlsx', make: async () => xlsxBlob(F.mappingWorkbook(ctx)) });
    files.push({ id: 'BaoCao/matran', folder: 'BaoCao', name: `${prefix}_BaoCao_KiemTra_MaTran.xlsx`, label: 'Báo cáo kiểm tra ma trận', kind: 'xlsx', make: async () => xlsxBlob(F.matrixReportWorkbook(ctx)) });
    files.push({ id: 'BaoCao/cauhinh', folder: 'BaoCao', name: `${prefix}_CauHinh_Seed.json`, label: 'Cấu hình & seed để tạo lại', kind: 'json', make: async () => new Blob([F.configJson(ctx)], { type: MIME.json }) });
    return files;
  };

  F.zip = async function (files, onProgress) {
    const zip = new JSZip();
    let i = 0;
    for (const f of files) {
      if (f.disabledReason) continue;
      onProgress && onProgress(`Đang tạo ${f.name} (${++i}/${files.filter((x) => !x.disabledReason).length})…`);
      zip.folder(f.folder).file(f.name, await f.make());
      await new Promise((r) => setTimeout(r, 0));
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  };

  g.ExportFiles = F;
})(window);
