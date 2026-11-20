# Tê Hoàng Cục v1.0

**Tĩnh tâm, sáng nước cờ.** Kỳ viện gia đình tại https://tehoangcuc.huongthiennature.com với cờ vây, cờ tướng, cờ vua, Học viện và Kỳ phổ.

## Chạy và triển khai

Dùng Node.js 22 trở lên, chạy `npm ci`, `npm test`, `npm run build`. Build tạo Worker ES module `dist/worker.mjs` tự chứa giao diện, tranh và engine offline. Tạo cơ sở dữ liệu Cloudflare D1 theo `schema.sql`, gắn binding `DB` và triển khai module dưới tên `te-hoang-cuc`. Tài khoản quản trị được cấp trong D1, ngoài mã nguồn. Bản tĩnh để xem giao diện nằm trong `dist/static`. Các API tài khoản cần Worker.

## Chơi và học

- Cờ vây 9, 13 và 19 đường. Tính diện tích với komi 6,5, chống lặp thế bàn, kết thúc sau hai lần bỏ lượt. Bắt hết quân chết trước khi bỏ lượt.
- Cờ tướng áp dụng cản chân mã, mắt tượng, cung, sông, ngòi pháo và chống lộ mặt tướng. Hòa sau ba lần lặp theo luật gia đình. Cờ vua dùng chess.js (BSD-2-Clause).
- Chơi với Bot, AI local, Sư phụ hoặc Song Hiệp. Hai người cùng máy có thể bật hai bàn đối diện. Chế độ 3D là phối cảnh bàn cờ. Giọng đọc tiếng Việt phụ thuộc giọng hệ thống.
- Học viện cờ vây gồm mười cấp. Mỗi kỳ thi cần hoàn thành bài học, chơi ba ván trong cấp, thắng hai đối thủ cùng cấp khác nhau, trả lời đúng câu hỏi và giải thế cờ. Thành tích lưu trên máy và đồng bộ khi đăng nhập.
- Khách có thể liên kết kỳ phổ sang tài khoản. Quản trị viên duyệt đến bốn thành viên ngoài admin. Đăng ký cung cấp mã khôi phục một lần. Admin có thể tạo mã từ hồ sơ sau khi đăng nhập.
- Bộ não local dùng luật, đánh giá chiến thuật và các bài giảng đi kèm. Hạn mức gợi ý local là 75 lượt/ngày trên mỗi thiết bị. Không cần khóa AI. PWA lưu giao diện và engine sau lần tải đầu tiên.

## Nhận diện

Xem [bộ nhận diện](brand.md). Tranh gốc và biểu trưng nằm trong [public/art](public/art/).

## Sư phụ trực tuyến tùy chọn

Bản production mặc định dùng engine và hướng dẫn tiếng Việt trên thiết bị. Adapter Gemini chỉ bật khi quản trị hạ tầng đã cấu hình secret `GEMINI_FREE_KEY`, model `GEMINI_FREE_MODEL` và xác nhận dự án Google không bật thanh toán bằng `MENTOR_FREE_ONLY=confirmed`. Server giới hạn 75 lượt giải thích mỗi ngày theo giờ Việt Nam cho toàn bộ thành viên, tối đa hai lượt đang chạy. Khi chưa cấu hình, mất kết nối hoặc hết lượt, gợi ý local vẫn hoạt động.
