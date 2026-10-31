/* Tạo các tệp mẫu (.docx/.xlsx/.txt) trong thư mục mau/ để dùng thử chức năng tải tệp. Chạy: node _tools/make-samples.js */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const d = require('docx');
const XLSX = require('xlsx');
require('../js/sample.js');
const OUT = path.join(__dirname, '..', 'mau');
fs.mkdirSync(OUT, { recursive: true });

/* ---- PNG đơn giản (sơ đồ mạng minh hoạ) ---- */
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, draw) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = draw(x, y); const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const img = png(260, 110, (x, y) => {
  const box = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (box(105, 40, 155, 70)) return [29, 78, 216];           // switch
  if (box(10, 8, 50, 30) || box(10, 80, 50, 102) || box(210, 8, 250, 30) || box(210, 80, 250, 102)) return [15, 122, 61]; // máy tính
  const line = (x0, y0, x1, y1) => { const t = (x - x0) / (x1 - x0); return Math.abs(y - (y0 + t * (y1 - y0))) < 1.5 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1); };
  if (line(50, 20, 105, 50) || line(50, 92, 105, 62) || line(155, 50, 210, 20) || line(155, 62, 210, 92)) return [90, 100, 120];
  return [255, 255, 255];
});
fs.writeFileSync(path.join(OUT, 'so-do-mang.png'), img);

const P = (text, o) => new d.Paragraph(Object.assign({ children: Array.isArray(text) ? text : [new d.TextRun(text)] }, o));
const B = (t) => new d.TextRun({ text: t, bold: true });

/* ---- Ma trận .docx / .xlsx / .txt ---- */
const rows = SAMPLE.matrixText.split('\n').map((l) => l.split('\t'));
const mk = (r, head) => new d.TableRow({ children: r.map((c) => new d.TableCell({ children: [P([new d.TextRun({ text: String(c), bold: head })])] })) });
const mdoc = new d.Document({ sections: [{ children: [P([B('MA TRẬN ĐỀ KIỂM TRA GIỮA KÌ I – TIN HỌC 12')]), new d.Table({ rows: rows.map((r, i) => mk(r, i === 0)) })] }] });
d.Packer.toBuffer(mdoc).then((b) => fs.writeFileSync(path.join(OUT, 'ma-tran-mau.docx'), b));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.map((r, i) => (i ? r.map((c, j) => (j === 4 ? +c : c)) : r))), 'Ma trận');
XLSX.writeFile(wb, path.join(OUT, 'ma-tran-mau.xlsx'));
fs.writeFileSync(path.join(OUT, 'ma-tran-mau.txt'), SAMPLE.matrixText);
fs.writeFileSync(path.join(OUT, 'de-goc-mau.txt'), SAMPLE.examText);

/* ---- Đề gốc .docx (có hình, bảng, phương án cùng dòng, đáp án dạng bảng) ---- */
const lines = SAMPLE.examText.split('\n').filter((l) => l.trim());
const idxAns = lines.findIndex((l) => /^ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM/.test(l));
const body = lines.slice(0, idxAns).filter((l) => !/^---/.test(l));
const ansLines = lines.slice(idxAns);
const kids = [];
const para = (l) => {
  if (/^(Câu \d+\.)/.test(l)) { const m = /^(Câu \d+\.)(.*)$/.exec(l); return P([B(m[1]), new d.TextRun(m[2])]); }
  if (/^PHẦN/.test(l)) return P([B(l)]);
  return P(l);
};
for (let i = 0; i < body.length; i++) {
  const l = body[i];
  if (/^A\. 16$/.test(l)) { // Câu 2: các phương án nằm trên cùng một dòng
    kids.push(P('A. 16\tB. 32\tC. 64\tD. 128')); i += 3; continue;
  }
  kids.push(para(l));
  if (/^Câu 3\./.test(l)) kids.push(P([new d.ImageRun({ data: img, transformation: { width: 260, height: 110 }, type: 'png' })]));
  if (/^Bảng HOCSINH\(MaHS/.test(l)) {
    kids.push(new d.Table({ rows: [['MaHS', 'HoTen', 'Lop', 'Diem'], ['HS001', 'Lê Văn An', '12A1', '8.5'], ['HS002', 'Trần Thị Bình', '12A2', '9.0']].map((r, k) => mk(r, k === 0)) }));
    kids.push(P(''));
  }
}
kids.push(P([new d.TextRun({ text: '--- HẾT ---', italics: true })], { alignment: d.AlignmentType.CENTER }));
kids.push(P([B('ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM')]));
kids.push(P([B('PHẦN I')]));
const key = 'C B D A C D B A C B C A'.split(' ');
kids.push(new d.Table({ rows: [mk(['Câu', ...key.map((_, i) => String(i + 1))], true), mk(['Đáp án', ...key], false)] }));
ansLines.slice(ansLines.findIndex((l) => l === 'PHẦN II')).forEach((l) => kids.push(para(l)));
const edoc = new d.Document({ sections: [{ children: kids }] });
d.Packer.toBuffer(edoc).then((b) => fs.writeFileSync(path.join(OUT, 'de-goc-mau.docx'), b));

fs.writeFileSync(path.join(OUT, 'dap-an-rieng-mau.txt'), `ĐÁP ÁN\nPHẦN I\n1.C 2.B 3.D 4.A 5.C 6.D 7.B 8.A 9.C 10.B 11.C 12.A\nPHẦN II\nCâu 13: ĐSĐS\nCâu 14: a-Đ, b-Đ, c-S, d-S\nCâu 15: a) Đúng b) Đúng c) Sai d) Đúng\nPHẦN III\nCâu 16: FTP\nCâu 17: 15\nCâu 18: SELECT\nCâu 19: 30\n`);
console.log('Đã tạo các tệp mẫu trong', OUT);
