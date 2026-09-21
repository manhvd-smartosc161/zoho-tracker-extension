# Zoho Track

Extension Chrome hiển thị dữ liệu chấm công Zoho People trong một cái liếc: mấy giờ được về, còn bao nhiêu ngày thiếu giờ trong chu kỳ, và còn bao nhiêu phép.

Không cần cài đặt gì thêm, không cần tài khoản, dữ liệu không rời khỏi trình duyệt. Extension đọc đúng những trang Zoho People mà bạn vốn đã có quyền xem.

---

## Cài đặt

Extension chưa lên Chrome Web Store, nên bạn cài từ thư mục trên máy.

### 1. Tải mã nguồn

Tải hoặc clone thư mục này về một chỗ cố định — ví dụ `~/Documents/zoho-track`.

**Đừng xoá hoặc di chuyển thư mục sau khi cài.** Chrome nạp extension từ đúng đường dẫn đó mỗi lần khởi động. Thư mục biến mất là extension hỏng.

### 2. Mở trang quản lý extension

Gõ vào thanh địa chỉ Chrome rồi Enter:

```
chrome://extensions
```

Hoặc: **menu ⋮ → Tiện ích mở rộng → Quản lý tiện ích mở rộng**.

### 3. Bật Developer mode

Tìm công tắc **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên bên phải và bật lên.

Ba nút mới hiện ra bên dưới tiêu đề trang: *Tải tiện ích đã giải nén*, *Đóng gói tiện ích*, *Cập nhật*.

### 4. Nạp extension

Bấm **Tải tiện ích đã giải nén** (Load unpacked), rồi chọn thư mục chứa `manifest.json` — chọn chính thư mục đó, không phải file bên trong.

"Zoho Track" giờ xuất hiện trong danh sách.

### 5. Ghim ra thanh công cụ

Mặc định Chrome giấu extension mới sau biểu tượng mảnh ghép.

1. Bấm **mảnh ghép** (🧩) ở cuối thanh địa chỉ
2. Tìm **Zoho Track** trong danh sách
3. Bấm biểu tượng **ghim** bên cạnh

Biểu tượng đồng hồ giờ nằm cố định trên thanh công cụ.

### 6. Đăng nhập Zoho một lần

Mở [people.zoho.com](https://people.zoho.com) và đăng nhập.

Bước này bắt buộc: extension đọc mã nhân viên từ chính trang Zoho. Chưa ghé trang lần nào thì nó không biết bạn là ai.

### 7. Mở extension

Bấm biểu tượng trên thanh công cụ. Dữ liệu tự tải.

---

## Đọc hiểu popup

### Hôm nay

| Trường | Ý nghĩa |
|---|---|
| **Giờ vào ca** | Giờ check-in đầu tiên hôm nay |
| **Đã làm** | Số giờ đã làm, đã trừ 1h15 nghỉ trưa |
| **Ra ca đủ 6 tiếng** | Về lúc này là đủ 6 tiếng |
| **Ra ca đủ 8 tiếng** | Về lúc này là đủ công |
| Thanh tiến độ | Hai đoạn: đoạn đầu chạy tới mốc 6 tiếng, đoạn sau tới 8 tiếng |

Badge góc trên bên phải hiện **Đang trong ca** khi đang làm, **Ngày nghỉ** vào cuối tuần, hoặc **Chưa check-in** nếu là ngày làm việc mà chưa chấm công.

### Chu kỳ chấm công

Chu kỳ tính từ **ngày 21 tháng này đến ngày 20 tháng sau** — không phải tháng dương lịch. Khoảng ngày cụ thể ghi ở đầu mục.

| Ô | Đếm cái gì |
|---|---|
| **Ngày làm 6–8 tiếng** | Số ngày chưa đủ 8 tiếng, trên hạn mức 5 ngày mỗi chu kỳ |
| **Request attendance** | Số đơn chấm công đã tạo, trên hạn mức 3 |
| **Ngày dưới 6 tiếng** | Ngày dưới 6 tiếng — không được tính đủ lương |
| **Vắng mặt chưa xử lý** | Ngày vắng mà chưa tạo đơn nghỉ hay đơn chấm công |
| **Ngày làm còn lại** | Số ngày làm việc còn lại trước khi hết chu kỳ |
| **Request leave** | Số đơn nghỉ phép đã tạo trong chu kỳ |

Ô nào có mũi tên `›` thì bấm được, xổ ra danh sách ngày và số giờ cụ thể.

### Quy ước màu

| Màu | Nghĩa |
|---|---|
| 🟢 Xanh lá | Ổn, còn trong hạn mức |
| 🫒 Ô-liu | Còn đúng một lần nữa là chạm hạn mức |
| 🟠 Cam | Đã chạm hạn mức — vẫn hợp lệ, nhưng hết dư địa |
| 🔴 Đỏ | Cần xử lý: ngày thiếu giờ không đủ lương, hoặc vắng mặt chưa tạo đơn |
| 🟣 Tím | Chỉ là thông tin, không đánh giá tốt xấu |

### Quỹ ngày phép

Mỗi loại phép một dòng, hiện số ngày đã dùng trên tổng. Thanh chia đoạn để đếm được số ngày còn lại bằng mắt.

---

## Dùng hằng ngày

**Mở popup là dữ liệu tự cập nhật.** Biểu tượng refresh trên đầu quay trong lúc tải. Bấm vào đó để tải lại bất cứ lúc nào.

**"Phiên đăng nhập đã hết hạn"** nghĩa là Zoho đã đăng xuất bạn. Bấm **Đăng nhập Zoho People**, đăng nhập xong quay lại bấm **Đã đăng nhập — thử lại**.

---

## Xử lý sự cố

**Popup trống, hoặc số liệu cũ**

Mở [people.zoho.com](https://people.zoho.com) trong một tab, kiểm tra đã đăng nhập chưa, rồi bấm biểu tượng refresh.

**"Chưa nhận diện được bạn"**

Extension chưa đọc được mã nhân viên. Mở people.zoho.com, đợi trang tải xong, rồi mở lại popup.

**Cập nhật bản mới rồi mà giao diện vẫn như cũ**

Chrome giữ lại bản cũ khá dai. Vào `chrome://extensions` bấm biểu tượng tải lại trên thẻ Zoho Track. Vẫn không được thì gỡ hẳn rồi nạp lại từ đầu.

**Extension biến mất sau khi khởi động lại Chrome**

Thư mục đã bị di chuyển hoặc xoá. Đặt lại chỗ cũ, hoặc nạp lại từ vị trí mới.

---

## Quyền riêng tư

Mọi thứ chạy cục bộ trong trình duyệt:

- Request chỉ gửi tới `people.zoho.com`, dùng chính phiên đăng nhập sẵn có của bạn
- Dữ liệu lưu trong bộ nhớ cục bộ của Chrome, trên máy bạn
- Không gửi đi đâu khác — không thống kê, không máy chủ bên ngoài
- Font nhúng sẵn trong extension nên chạy được cả khi mất mạng

## Giới hạn

- **Chưa trừ ngày lễ** khỏi "Ngày làm còn lại" — con số này coi mọi ngày trong tuần đều là ngày làm việc
- Số liệu cập nhật khi mở popup, không chạy liên tục
- Mốc chu kỳ (21–20) và các hạn mức (5 ngày dưới 8 tiếng, 3 đơn chấm công) đang cố định trong code

---

☕ 💻 🔥 Work hard, OT harder · © Mạnh Vũ Duy (KO)
