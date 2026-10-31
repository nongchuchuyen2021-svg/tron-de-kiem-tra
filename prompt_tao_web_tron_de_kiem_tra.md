# Prompt tạo website trộn đề kiểm tra

Hãy đóng vai chuyên gia phát triển website và chuyên gia xây dựng công cụ kiểm tra, đánh giá trong giáo dục phổ thông.

Hãy xây dựng cho tôi một website có tên “TRỘN ĐỀ KIỂM TRA”, giao diện hoàn toàn bằng tiếng Việt, dành cho giáo viên. Website phải hoạt động thực tế từ khâu nhập dữ liệu đến xuất đề kiểm tra và đáp án.

## 1. Mục tiêu chính

Giáo viên đưa vào:

- Ma trận đề kiểm tra.
- Một đề kiểm tra gốc.
- Đáp án và hướng dẫn chấm của đề gốc, nếu có trong cùng tệp hoặc tệp riêng.

Website cho phép lựa chọn tạo **2 đề, 3 đề hoặc 4 đề**, tương ứng với 2, 3 hoặc 4 mã đề.

Các mã đề được tạo từ cùng tập câu hỏi của đề gốc bằng cách đảo thứ tự câu hỏi và đảo phương án trong phạm vi cho phép. Giữ nguyên nội dung, số liệu, hình ảnh, số câu, điểm số và mức độ của câu hỏi.

Phân biệt rõ “trộn thành các mã đề” với “sáng tác đề mới”. Chức năng chính của website là trộn đề; không tự tạo thêm hoặc thay thế câu hỏi.

## 2. Dữ liệu đầu vào

### A. Ma trận đề kiểm tra

Hỗ trợ:

- Tải lên tệp Word (.docx), Excel (.xlsx) hoặc PDF có lớp văn bản.
- Dán trực tiếp nội dung ma trận.
- Nhập hoặc chỉnh sửa ma trận bằng bảng trên website.

Nhận diện và hiển thị các thông tin có trong ma trận:

- Phần thi và dạng câu hỏi.
- Chủ đề, bài học hoặc đơn vị kiến thức.
- Mức độ nhận thức, giữ nguyên tên mức độ trong ma trận.
- Số câu, số ý và điểm số.
- Vị trí hoặc số thứ tự câu, nếu ma trận quy định cụ thể.
- Tổng số câu và tổng điểm.

### B. Đề kiểm tra gốc

Hỗ trợ tải tệp Word (.docx), PDF có lớp văn bản hoặc dán nội dung.

Nhận diện được các dạng:

- Trắc nghiệm nhiều lựa chọn.
- Trắc nghiệm đúng/sai, có các ý a, b, c, d.
- Trả lời ngắn.
- Tự luận.

Giữ đầy đủ phần dẫn, phương án trả lời, công thức, hình ảnh, bảng biểu, đơn vị và ký hiệu.

Với PDF quét hoặc nội dung cần OCR, phải có bước nhận dạng và duyệt lại. Nếu môi trường triển khai chưa hỗ trợ OCR, thông báo rõ và hướng dẫn giáo viên dùng DOCX hoặc dán nội dung; không hiển thị trạng thái nhập thành công khi chưa đọc được dữ liệu.

### C. Đáp án và hướng dẫn chấm

Cho phép:

- Nhận diện đáp án nằm cuối đề gốc.
- Tải đáp án bằng tệp riêng.
- Nhập hoặc sửa đáp án trực tiếp trên website.

Đáp án chưa có hoặc chưa chắc chắn phải được đánh dấu để giáo viên bổ sung, xác nhận. Chỉ xuất bảng đáp án chính thức khi các đáp án cần thiết đã được xác nhận.

## 3. Quy trình sử dụng

Thiết kế quy trình gồm 5 bước:

**Bước 1: Nhập ma trận.**

Hiển thị ma trận dưới dạng bảng có thể chỉnh sửa.

**Bước 2: Nhập đề gốc và đáp án.**

Tách câu hỏi, phương án, hình ảnh và đáp án thành các khối để giáo viên kiểm tra.

**Bước 3: Đối chiếu đề gốc với ma trận.**

Hiển thị bảng gồm:

- Số câu gốc.
- Dạng câu hỏi.
- Chủ đề.
- Mức độ nhận thức.
- Điểm số.
- Đáp án.
- Trạng thái khớp hoặc chưa khớp ma trận.

Nếu dùng AI để gợi ý phân loại câu hỏi, đánh dấu rõ đó là gợi ý và cho giáo viên xác nhận. Không coi việc tự suy đoán chủ đề, mức độ là kết quả đã được duyệt.

**Bước 4: Chọn cấu hình và tạo mã đề.**

Cho phép chọn rõ một trong ba lựa chọn: **2 mã đề / 3 mã đề / 4 mã đề**.

**Bước 5: Xem trước và tải xuống.**

Cho phép chuyển qua lại giữa các mã đề, kiểm tra đáp án và xuất tệp.

Lưu dữ liệu đã nhập trong quá trình chuyển bước để giáo viên không phải nhập lại.

## 4. Kiểm tra sự phù hợp với ma trận

Đối chiếu đề gốc với ma trận theo các tiêu chí:

- Số phần.
- Dạng câu hỏi.
- Số câu hoặc số ý.
- Chủ đề và mức độ nhận thức.
- Điểm từng phần và tổng điểm.
- Vị trí câu, nếu ma trận có quy định.

Nếu phát hiện sai lệch, chỉ rõ vị trí và nội dung cần sửa, ví dụ:

“Chủ đề A, mức độ Hiểu cần 3 câu nhưng đề gốc hiện có 2 câu.”

Giáo viên có thể sửa dữ liệu đã nhận dạng hoặc bổ sung nội dung phù hợp. Hệ thống không tự bỏ câu, thêm câu hay đổi mức độ để làm cho đề có vẻ khớp ma trận.

Chỉ xác nhận bộ đề hoàn tất khi các sai lệch bắt buộc đã được xử lý.

## 5. Cấu hình trộn đề

Cung cấp các tùy chọn:

- Số lượng mã đề: 2, 3 hoặc 4.
- Mã đề bắt đầu; mặc định 101.
- Cho phép sửa mã đề, đồng thời kiểm tra không trùng mã.
- Đảo thứ tự câu hỏi.
- Đảo thứ tự phương án trả lời.
- Khóa vị trí một câu hoặc một nhóm câu.
- Khóa đảo phương án của từng câu.
- Giữ nguyên thứ tự các phần.
- Lưu cấu hình để tạo lại cùng kết quả.

Ví dụ:

- Chọn 2 mã đề → 101, 102.
- Chọn 3 mã đề → 101, 102, 103.
- Chọn 4 mã đề → 101, 102, 103, 104.

Số lượng đã chọn là tổng số đề cần xuất. Đề gốc được giữ làm nguồn dữ liệu.

## 6. Quy tắc trộn bắt buộc

### A. Bám sát cấu trúc và ma trận

Mỗi mã đề phải chứa đầy đủ tập câu hỏi của đề gốc, mỗi câu xuất hiện đúng một lần.

Giữ nguyên số phần, dạng câu, tổng điểm và phân bố kiến thức, mức độ.

Nếu ma trận quy định vị trí câu cụ thể, chỉ hoán đổi giữa các vị trí có yêu cầu tương đương về phần thi, dạng câu, chủ đề, mức độ và điểm.

Nếu ma trận chỉ quy định phân bố, cho phép đảo câu trong phạm vi phù hợp nhưng phải kiểm tra lại toàn bộ chỉ tiêu sau khi trộn.

### B. Trắc nghiệm nhiều lựa chọn

Khi đảo phương án, hệ thống phải tự cập nhật đáp án theo vị trí mới.

Mỗi câu hỏi và mỗi phương án phải có mã định danh ổn định. Đáp án đúng được gắn với mã phương án, sau đó mới chuyển thành nhãn A, B, C, D của từng mã đề.

Ví dụ: phương án đúng ở đề gốc là B, khi chuyển sang vị trí D thì đáp án của mã đề mới phải là D.

Nhận diện và cảnh báo những phương án phụ thuộc vào vị trí hoặc nhãn, như:

- “A và B đều đúng”.
- “Tất cả các phương án trên”.
- Các phương án cần giữ trình tự cố định.

Mặc định khóa đảo phương án của những câu này để bảo toàn ý nghĩa.

Có thể bổ sung tùy chọn phân bố vị trí đáp án A, B, C, D tương đối cân đối nếu khả thi; việc cân đối không được làm thay đổi nội dung hoặc vi phạm các khóa đã đặt.

### C. Câu đúng/sai

Giữ phần dẫn đi cùng các ý a, b, c, d.

Mặc định giữ nguyên thứ tự các ý. Chỉ cho phép đảo khi giáo viên bật tùy chọn và xác nhận các ý độc lập.

Nếu đảo ý, phải chuyển đồng thời nội dung, đáp án đúng/sai và hướng dẫn chấm tương ứng.

### D. Trả lời ngắn và tự luận

Giữ nguyên nội dung, đơn vị, đáp án, lời giải, biểu điểm và quy tắc chấm của từng câu.

Chỉ đảo câu khi phù hợp với ma trận và không làm ảnh hưởng đến mối liên hệ giữa các câu.

### E. Câu chùm, hình ảnh và dữ kiện dùng chung

Phần dẫn, đoạn văn, hình vẽ, bảng số liệu và các câu phụ thuộc phải di chuyển thành một nhóm thống nhất.

Giữ thứ tự câu có quan hệ suy luận hoặc phụ thuộc vào kết quả câu trước.

Với câu tham chiếu trực tiếp số thứ tự câu khác, chỉ cho đảo nếu hệ thống cập nhật được tham chiếu an toàn; nếu chưa hỗ trợ thì khóa nhóm đó và thông báo.

### F. Khác biệt giữa các mã đề

Các mã đề phải khác nhau thực sự về thứ tự câu hoặc thứ tự phương án được phép, không chỉ khác tên mã đề.

Nếu các ràng buộc khiến không thể tạo đủ số mã đề khác nhau đã chọn, thông báo rõ nguyên nhân và đề xuất điều chỉnh phù hợp. Không xuất các bản trùng nhau rồi coi là các đề khác nhau.

## 7. Kết quả xuất ra

Cho phép tải từng tệp hoặc tải toàn bộ trong một tệp ZIP.

Bộ kết quả gồm:

1. Các đề kiểm tra theo từng mã đề, ở định dạng Word (.docx) và PDF.
2. Bảng đáp án riêng cho từng mã đề.
3. Bảng đáp án tổng hợp tất cả mã đề.
4. Hướng dẫn chấm tương ứng, nếu đề gốc có cung cấp.
5. Bảng đối chiếu câu gốc với câu ở mỗi mã đề.
6. Báo cáo kiểm tra ma trận của các mã đề.

Bảng đối chiếu cần thể hiện được: câu gốc, số câu mới, mã đề và ánh xạ phương án khi có đảo.

Tệp đề dành cho học sinh phải tách riêng khỏi đáp án và hướng dẫn chấm.

Cho phép chỉnh sửa thông tin đầu đề:

- Tên trường.
- Tên bài kiểm tra.
- Môn học, lớp, năm học.
- Thời gian làm bài.
- Mã đề.
- Dòng họ tên và lớp của học sinh.

Định dạng mặc định: khổ A4, chữ tiếng Việt rõ ràng, bố cục thuận tiện để in, có đánh số trang. Hạn chế tách phần dẫn và phương án của cùng một câu sang hai trang nếu chúng có thể nằm cùng trang.

## 8. Giao diện

Thiết kế giao diện tiếng Việt hiện đại, dễ sử dụng với giáo viên, ưu tiên thao tác trên máy tính và vẫn hiển thị tốt trên điện thoại.

Cần có:

- Khu vực kéo thả tệp.
- Thanh hiển thị 5 bước thực hiện.
- Bảng chỉnh sửa ma trận.
- Danh sách câu hỏi có nút xem, sửa và khóa.
- Nhãn trạng thái: “Đã xác nhận”, “Cần kiểm tra”, “Chưa khớp ma trận”.
- Bộ chọn 2, 3 hoặc 4 mã đề nổi bật.
- Nút “Tạo mã đề”.
- Khu vực xem trước từng mã đề.
- Nút “Tải Word”, “Tải PDF”, “Tải toàn bộ”.

Khi xử lý tệp, hiển thị tiến trình và lỗi cụ thể bằng tiếng Việt. Thông báo phải hướng dẫn giáo viên cách xử lý.

## 9. Yêu cầu kỹ thuật và bảo vệ dữ liệu

Chủ động lựa chọn công nghệ phù hợp với môi trường triển khai và giải thích ngắn gọn lựa chọn.

Tách rõ các chức năng: đọc tệp, chuẩn hóa câu hỏi, đối chiếu ma trận, trộn đề, ánh xạ đáp án và xuất tệp.

Thuật toán trộn, đánh số câu và cập nhật đáp án phải được xử lý bằng mã lập trình xác định. Nếu có AI, chỉ dùng để hỗ trợ đọc hoặc gợi ý phân loại; các nội dung chưa chắc chắn cần được giáo viên duyệt.

Lưu giá trị khởi tạo ngẫu nhiên (seed), cấu hình và dữ liệu đã xác nhận để có thể tái tạo chính xác bộ mã đề.

Kiểm tra định dạng, kích thước tệp đầu vào. Cung cấp chức năng xóa dữ liệu phiên làm việc. Nếu cần gửi nội dung đề tới dịch vụ AI bên ngoài, thông báo rõ và yêu cầu giáo viên chủ động bật tính năng đó.

Các nút và chức năng phải được kết nối với xử lý thực tế. Nếu môi trường chưa hỗ trợ một chức năng, thể hiện rõ giới hạn và phương án hoàn thiện.

## 10. Kiểm thử và bàn giao

Tạo một bộ dữ liệu mẫu gồm ma trận, đề gốc và đáp án để kiểm tra.

Kiểm thử tối thiểu:

- Tạo đúng số lượng 2, 3 và 4 mã đề.
- Không thiếu hoặc lặp câu trong từng mã đề.
- Không sai tổng điểm hoặc phân bố theo ma trận.
- Đáp án vẫn đúng sau khi đảo câu và phương án.
- Câu bị khóa giữ đúng quy tắc.
- Câu chùm, hình ảnh và bảng dữ liệu không bị tách sai.
- Câu đúng/sai giữ đúng ánh xạ giữa từng ý và đáp án.
- Phát hiện trường hợp không đủ hoán vị hợp lệ.
- Tệp Word và PDF mở được, không mất nội dung và hiển thị đúng tiếng Việt.

Hãy bàn giao:

1. Mã nguồn hoàn chỉnh, có cấu trúc thư mục rõ ràng.
2. Các tệp cấu hình và danh sách thư viện cần cài.
3. Hướng dẫn cài đặt, chạy và triển khai từng bước, phù hợp với giáo viên chưa có nhiều kinh nghiệm lập trình.
4. Bộ dữ liệu mẫu để dùng thử.
5. Kết quả kiểm thử và các giới hạn còn tồn tại.

Bắt đầu bằng việc tóm tắt kiến trúc và luồng sử dụng, sau đó triển khai sản phẩm. Ưu tiên hoàn thiện xuyên suốt quy trình: nhập ma trận và đề gốc → duyệt dữ liệu → chọn 2/3/4 mã đề → trộn đúng → xem trước → xuất đề và đáp án.
