# Zoho Track

Extension Chrome hiển thị dữ liệu chấm công Zoho People trong một cái liếc: mấy giờ được về, còn bao nhiêu ngày thiếu giờ trong chu kỳ, và còn bao nhiêu phép. Xem được lịch cả chu kỳ, và tạo đơn chấm công hay đơn nghỉ phép ngay trong popup — không cần mở Zoho.

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

### Lịch chu kỳ

Bấm biểu tượng lịch trên đầu popup để mở lịch cả chu kỳ. Mỗi ô là một ngày, hiện số giờ đã làm.

| Hiển thị | Nghĩa |
|---|---|
| Số giờ **xanh** | Đủ 8 tiếng |
| Số giờ **cam** | 6–8 tiếng |
| Số giờ **đỏ** | Dưới 6 tiếng |
| **Vắng** đỏ | Không chấm công, chưa có đơn nào |
| **Leave** xanh | Nghỉ phép — thêm *Chờ duyệt* nếu đơn chưa được duyệt |
| **Chờ duyệt** cam | Đơn chấm công đang chờ duyệt |

Dùng `‹` `›` hai bên để xem chu kỳ trước hoặc sau — tiện khi cần kiểm tra đơn đã được duyệt chưa sau khi chu kỳ mới bắt đầu.

Bốn ô trên đầu lịch tóm tắt chu kỳ đang xem: số ngày đủ 8 tiếng, số ngày 6–8 tiếng, số ngày dưới 6 tiếng, và số ngày vắng chưa xử lý. **Ngày hôm nay không được tính vào các con số này** vì ca chưa kết thúc.

### Tạo đơn từ lịch

Bấm vào ô ngày để tạo đơn — không cần mở Zoho.

**Ngày thiếu giờ** (số giờ cam hoặc đỏ): bấm vào mở thẳng đơn chấm công. Giờ vào và giờ ra mặc định **09:00 – 18:30**, sửa được cả hai trước khi gửi.

**Ngày vắng**: bấm vào hiện menu hai lựa chọn.

- **Request Leave** — xin nghỉ phép. Chọn loại phép (kèm số ngày còn lại), thời lượng (cả ngày, nửa đầu, nửa cuối, hoặc một trong bốn phần tư ngày) và nhập lý do. Lý do bắt buộc.
- **Request Attendance** — đơn chấm công như trên.

Gửi xong ô đổi trạng thái ngay, không cần tải lại. Một thông báo nhỏ hiện lên dưới đáy popup xác nhận.

**Huỷ đơn**: ô đang *Chờ duyệt* bấm vào để huỷ. Đơn đã huỷ không tính vào hạn mức, và ngày đó tạo lại đơn mới được.

Ngày chưa qua thì chưa tạo được đơn — rê chuột vào ô sẽ thấy lý do.

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

**Đơn gửi từ extension vẫn cần được duyệt** như đơn tạo trên Zoho. Extension chỉ thay bạn điền form, không tự duyệt.

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
- Đơn nghỉ chỉ tạo được cho **một ngày mỗi lần** — nghỉ nhiều ngày liên tiếp thì tạo từng ngày, hoặc dùng Zoho
- Huỷ đơn chỉ áp dụng cho **đơn chấm công**; đơn nghỉ phải huỷ trên Zoho

---

☕ 💻 🔥 Work hard, OT harder · © Mạnh Vũ Duy (KO)
