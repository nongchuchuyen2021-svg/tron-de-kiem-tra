# TRỘN ĐỀ KIỂM TRA

Website dành cho giáo viên: nhập **ma trận**, **đề gốc**, **đáp án** → đối chiếu → tạo **2, 3 hoặc 4 mã đề** → xem trước → tải **Word, PDF, đáp án, hướng dẫn chấm, bảng đối chiếu, báo cáo kiểm tra ma trận** (từng tệp hoặc một gói ZIP).

> Website **chỉ trộn đề** (đảo thứ tự câu và phương án trong phạm vi cho phép), **không sáng tác hay thay câu hỏi**. Toàn bộ xử lý chạy ngay trong trình duyệt của giáo viên: không có máy chủ, không gửi nội dung đề lên mạng, không dùng AI bên ngoài.

---

## 1. Kiến trúc và luồng sử dụng (tóm tắt)

**Công nghệ:** website tĩnh (HTML + CSS + JavaScript thuần, không cần cài framework, không cần build). Lý do: giáo viên chỉ cần mở tệp hoặc tải thư mục lên hosting tĩnh; dữ liệu đề không rời khỏi máy; thuật toán trộn là mã xác định nên tái tạo được kết quả.

```
Tệp đầu vào ──► Đọc tệp ──► Chuẩn hóa ──► Giáo viên duyệt ──► Đối chiếu ma trận ──► Trộn ──► Kiểm tra lại ──► Xuất tệp
 (docx/xlsx/pdf/   readers.js  parse-exam.js   ui.js, ui-exam.js   check.js, matrix.js   shuffle.js   shuffle.verify   doc.js → export-*.js
  dán nội dung)                (câu/phương án/                                                         (tự động, 10+ mục)
                                đáp án/nhóm)
```

Luồng 5 bước trên giao diện:

| Bước | Việc làm | Điểm chặn an toàn |
|---|---|---|
| 1. Ma trận | Tải/dán/nhập bảng ma trận, sửa trực tiếp | Phải bấm "Xác nhận ma trận" |
| 2. Đề gốc & đáp án | Tách câu, phương án, ý đúng/sai, hình, bảng, câu chùm, đáp án; xem/sửa/khóa từng câu | Mọi câu mới nhận dạng ở trạng thái **Cần kiểm tra** |
| 3. Đối chiếu | Gán chủ đề, mức độ, điểm cho từng câu; so với ma trận; nêu rõ sai lệch | Còn sai lệch hoặc câu chưa xác nhận ⇒ **không** sang bước tạo mã đề |
| 4. Tạo mã đề | Chọn 2/3/4 mã, mã bắt đầu, tùy chọn trộn, khóa, seed | Báo lỗi nếu không đủ hoán vị khác nhau |
| 5. Xem trước & tải | Xem từng mã đề, báo cáo kiểm tra, sửa đầu đề, tải tệp | Đáp án chỉ xuất khi **đã xác nhận đủ đáp án** |

Dữ liệu được lưu tự động trong trình duyệt (IndexedDB) khi chuyển bước; có nút **Xóa dữ liệu phiên**, **Lưu dự án / Mở dự án** (.json, gồm cả seed và cấu hình để tạo lại đúng bộ mã đề).

## 2. Cấu trúc thư mục

```
index.html            Trang chính (mở là chạy)
Chay-web.bat          Chạy web bằng 1 cú nhấp đúp (Windows)
css/style.css         Giao diện
js/
  util.js             Tiện ích, bộ sinh số ngẫu nhiên có seed
  htmlkit.js          Xử lý HTML: tách khối, cắt tiền tố, HTML → mô hình tài liệu
  matrix.js           Đọc/chuẩn hóa/kiểm tra ma trận
  readers.js          Đọc tệp: Word (mammoth), Excel (SheetJS), PDF (pdf.js), văn bản
  parse-exam.js       Chuẩn hóa đề gốc + đọc đáp án
  check.js            Đối chiếu đề với ma trận, điều kiện sẵn sàng, gợi ý phân loại
  shuffle.js          LÕI TRỘN: nhóm câu, khóa, hoán vị, ánh xạ đáp án, kiểm tra lại
  doc.js              Dựng đề, đáp án, hướng dẫn chấm (mô hình tài liệu) + HTML xem trước
  export-docx.js      Xuất Word (thư viện docx)
  export-pdf.js       Xuất PDF (pdfmake + phông Tinos nhúng sẵn)
  export-files.js     Danh sách tệp, báo cáo Excel, gói ZIP
  store.js            Lưu phiên, xuất/nhập dự án
  ui.js, ui-exam.js   Giao diện 5 bước
  sample.js           Dữ liệu mẫu tích hợp (nút "Dùng dữ liệu mẫu")
vendor/               Thư viện bên thứ ba đã đóng gói sẵn (chạy offline)
mau/                  Tệp mẫu: ma trận (.docx/.xlsx/.txt), đề gốc (.docx/.txt), đáp án riêng
tests/                Kiểm thử tự động (Node + jsdom)
tools/make-samples.js Tạo lại các tệp trong mau/
package.json          Chỉ dùng cho kiểm thử/tạo tệp mẫu (website không cần)
```

Thư viện trong `vendor/` (đều mã nguồn mở): mammoth 1.8.0 (đọc .docx), pdf.js 3.11.174 (đọc PDF), SheetJS 0.18.5 (Excel), docx 8.5.0 (ghi Word), pdfmake 0.2.12 (ghi PDF), JSZip 3.10.1 (ZIP), phông Tinos (Apache 2.0, chữ Việt).

## 3. Cài đặt và chạy (không cần biết lập trình)

**Cách 1 – Nhấp đúp `Chay-web.bat`** (Windows, khuyến nghị). Trang sẽ tự mở tại `http://localhost:8080/index.html`. Cần máy có Python hoặc Node.js; nếu không có, dùng cách 2.

**Cách 2 – Mở trực tiếp `index.html`** bằng Chrome hoặc Edge (nhấp chuột phải → Open with). Hầu hết chức năng chạy bình thường. Nếu đọc PDF báo lỗi khi mở kiểu này, hãy dùng cách 1.

**Cách 3 – Dòng lệnh** (nếu đã có Python): mở thư mục dự án và chạy `python -m http.server 8080`, rồi vào `http://localhost:8080`.

### Đưa lên mạng để dùng chung (không bắt buộc)
Website chỉ gồm tệp tĩnh nên đưa lên bất kỳ dịch vụ lưu trữ tĩnh nào đều chạy được. Chỉ cần tải lên: `index.html`, `css/`, `js/`, `vendor/` (và `mau/` nếu muốn có tệp thử).
- **Netlify Drop:** vào app.netlify.com/drop, kéo thả thư mục. Nhận ngay một địa chỉ web.
- **GitHub Pages:** đẩy thư mục lên một kho (repository) rồi bật Settings → Pages → Deploy from branch.
- **Vercel / Cloudflare Pages:** tạo dự án mới, chọn thư mục này, để trống lệnh build, thư mục xuất bản là `.`.
- **Máy chủ của trường (IIS, Apache, Nginx):** chép thư mục vào thư mục web (ví dụ `wwwroot`). Nên bật HTTPS.
Không cần cấu hình biến môi trường hay cơ sở dữ liệu.

## 4. Hướng dẫn sử dụng nhanh

1. Bấm **Dùng dữ liệu mẫu** (góc trên) để thử ngay, hoặc dùng tệp trong `mau/`.
2. **Bước 1:** tải hoặc dán ma trận. Kiểm tra bảng, sửa nếu cần → **Xác nhận ma trận**.
3. **Bước 2:** tải/dán đề gốc (đáp án ở cuối đề sẽ tự được nhận dạng; hoặc tải tệp đáp án riêng). Mở từng câu bằng **Xem/Sửa**; sửa chỗ nhận dạng sai. Bấm **Xác nhận tất cả đáp án đang có** sau khi đã soát đáp án.
4. **Bước 3:** bấm **Gợi ý phân loại theo ma trận** (chỉ là gợi ý theo thứ tự/vị trí), chỉnh chủ đề–mức độ–điểm từng câu cho đúng, rồi **Xác nhận**. Hết sai lệch thì sang bước tiếp.
5. **Bước 4:** chọn **2 / 3 / 4 mã đề**, kiểm tra mã đề, các tùy chọn trộn và danh sách câu bị khóa → **Tạo mã đề**.
6. **Bước 5:** chuyển qua lại các mã đề, đọc báo cáo kiểm tra, sửa đầu đề (tên trường, môn, lớp, thời gian…) → **Tải Word / Tải PDF / Tải toàn bộ (ZIP)**.

### Định dạng đề gốc để nhận dạng tốt nhất
- Mỗi câu bắt đầu bằng `Câu 1.`, `Câu 2.`…; phương án `A.`, `B.`, `C.`, `D.` (có thể nằm cùng dòng); ý đúng/sai `a)`, `b)`, `c)`, `d)`.
- Tiêu đề phần: `PHẦN I. …`, `PHẦN II. …` (có thể ghi dạng câu: "nhiều lựa chọn", "đúng sai", "trả lời ngắn", "tự luận").
- Câu chùm: dòng dẫn nên ghi "…**trả lời câu 9 và câu 10**" hoặc "…**từ câu 9 đến câu 11**"; có thể gộp nhóm thủ công trong cửa sổ **Sửa**.
- Đáp án sau dòng `ĐÁP ÁN` (hoặc `HƯỚNG DẪN CHẤM`): `1.A 2.B …`, `Câu 3: C`, bảng "Câu/Đáp án", `Câu 13: a) Đúng b) Sai c) Đúng d) Sai` (hoặc `ĐSĐS`), `Câu 16: FTP`; tự luận ghi hướng dẫn chấm ngay dưới `Câu N:`.
- Ma trận: cần dòng tiêu đề có các cột như *Phần, Dạng câu hỏi, Chủ đề, Mức độ, Số câu, Điểm, Vị trí câu*; hoặc dạng "bảng rộng" có cột *Biết / Hiểu / Vận dụng* chứa số câu.

## 5. Quy tắc trộn (đã được lập trình và kiểm thử)

- Mỗi mã đề chứa đủ mọi câu của đề gốc, mỗi câu đúng một lần; số phần, dạng câu, tổng điểm, phân bố chủ đề–mức độ được giữ và **kiểm tra lại sau khi trộn**.
- Câu chỉ đổi chỗ **trong phần của nó**. Nếu ma trận quy định vị trí câu, câu chỉ được hoán đổi với câu **cùng dạng, chủ đề, mức độ, điểm**.
- Phương án và đáp án có **mã định danh ổn định**; đáp án đúng gắn với mã phương án rồi mới đổi thành nhãn A/B/C/D của từng mã đề.
- Phương án phụ thuộc nhãn/vị trí ("A và B đều đúng", "Tất cả các phương án trên"…) **tự động khóa đảo phương án** (giáo viên có thể đổi).
- Câu chùm, hình, bảng, dữ kiện dùng chung di chuyển thành một khối, giữ thứ tự bên trong. Câu tham chiếu số thứ tự câu khác ("ở câu 5…", "câu trước") **bị khóa** cùng câu được tham chiếu.
- Câu đúng/sai mặc định **giữ thứ tự ý a–d**; chỉ đảo khi giáo viên bật và xác nhận các ý độc lập; đáp án và hướng dẫn chấm của từng ý đi theo ý.
- Các mã đề phải khác nhau thật sự và khác đề gốc; nếu ràng buộc không đủ hoán vị, website **báo rõ nguyên nhân và đề xuất** thay vì xuất bản trùng.
- Cùng **seed + cấu hình + dữ liệu** ⇒ cùng kết quả (seed và cấu hình nằm trong tệp dự án và tệp `CauHinh_Seed.json`).

## 6. Kiểm thử và kết quả

Chạy kiểm thử tự động (cần Node.js):
```
npm install
npm test
```
Kết quả lần chạy cuối: **30/30 đạt**. Bao gồm: đọc ma trận/đề/đáp án mẫu; phát hiện sai lệch ma trận; tạo đúng 2, 3, 4 mã đề; không thiếu/lặp câu; tổng điểm và phân bố theo ma trận; đáp án đúng sau khi đảo câu và phương án; khóa vị trí/khóa phương án; câu chùm liền nhau; ánh xạ đúng/sai khi đảo ý; không đủ hoán vị ⇒ báo lỗi; ma trận có vị trí; đánh số theo từng phần; **200 seed ngẫu nhiên × 2/3/4 mã đều qua kiểm tra**; mức khác biệt giữa các mã đề.

Đã kiểm tra thêm trên trình duyệt (Chromium trong ứng dụng Claude): nạp ma trận từ `.xlsx/.docx/.txt`; đề `.docx` có hình, bảng, phương án cùng dòng, đáp án dạng bảng; đọc lại PDF do chính website tạo ra; xuất đủ 23 tệp (Word, PDF, Excel, JSON) và gói ZIP; Word mở lại bằng thư viện đọc `.docx` không lỗi; PDF hiển thị đúng tiếng Việt, hình ảnh và bảng (đã xem ảnh render); lưu/khôi phục phiên sau khi tải lại trang; các thông báo lỗi (đuôi tệp sai, `.doc`, tệp rỗng, PDF ảnh quét, đề không có câu hỏi, ma trận không có tiêu đề); hiển thị trên màn hình điện thoại 375 px.

## 7. Giới hạn còn tồn tại (nói rõ để không bị bất ngờ)

- **Chưa có OCR:** PDF dạng ảnh quét bị từ chối kèm hướng dẫn dùng `.docx` hoặc dán nội dung. PDF có lớp chữ chỉ lấy được văn bản (mất hình, bảng, công thức).
- **Công thức Word (Equation)** được đọc thành văn bản thuần (mất bố cục phân số, căn…) và có cảnh báo; hình EMF/WMF không hiển thị được. Hãy kiểm tra các câu có công thức trước khi xác nhận.
- Danh sách **đánh số tự động của Word** mất nhãn gốc; website suy đoán (đánh dấu "Cần kiểm tra"). Khung văn bản/hình vẽ trong Word không đọc được.
- **Chủ đề/mức độ** không có sẵn trong đề gốc: được gán qua Bước 3 (gợi ý theo vị trí/thứ tự ma trận rồi giáo viên xác nhận). Ma trận có tiêu đề nhiều tầng phức tạp có thể cần sửa tay trong bảng.
- Chưa hỗ trợ **đảo thứ tự các phần**; chưa tự cập nhật tham chiếu số câu trong nội dung (thay vào đó khóa các câu liên quan); chưa có chức năng thêm câu mới thủ công (chỉ sửa/xóa câu đã nhận dạng).
- Tệp Word được tạo bằng thư viện `docx` và đã kiểm tra bằng cách đọc lại; **chưa được mở thử trong Microsoft Word thật** trong môi trường phát triển — hãy mở thử một mã đề trước khi in hàng loạt. PDF được tạo từ cùng nội dung nên trình bày gần giống nhưng không giống từng điểm ảnh với Word.
- Dữ liệu phiên lưu trong trình duyệt của máy đang dùng; xóa dữ liệu trình duyệt sẽ mất (hãy dùng **Lưu dự án**).
- Nội dung câu hỏi trong dữ liệu mẫu do website tự soạn để thử nghiệm; cần soát lại nếu dùng thật.

## 8. Xử lý sự cố nhanh

| Hiện tượng | Cách xử lý |
|---|---|
| Không nhận dạng được câu hỏi | Kiểm tra mỗi câu bắt đầu bằng "Câu 1."; dùng `.docx` thay PDF; hoặc dán nội dung |
| Thiếu/ sai phương án | Mở **Sửa** ở câu đó để bổ sung; hoặc sửa trong Word rồi tải lại |
| "Chưa khớp ma trận" | Xem danh sách sai lệch ở Bước 3 (nêu rõ chủ đề, mức độ, số câu cần/có) |
| Không tạo đủ mã đề khác nhau | Mở bớt khóa, bật đảo phương án, tắt "chỉ đảo trong cùng mức độ" hoặc giảm số mã đề |
| Không tải được đáp án | Cần xác nhận đủ đáp án ở Bước 2 |
| PDF không đọc được khi mở trực tiếp `index.html` | Dùng `Chay-web.bat` |
