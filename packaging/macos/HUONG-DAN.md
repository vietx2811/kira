# KIRA 1.1.0 cho macOS

Nhà phát triển: **VX Studio**

Bundle identifier: `vxstudio.kira`

## Cài đặt (bấm đúp)

1. Giải nén bộ phát hành.
2. Bấm đúp **`Install KIRA.command`**.

File này mở Terminal và tự làm hết:

- đóng KIRA nếu đang chạy, chuyển bản cũ trong `/Applications` vào Thùng rác;
- chép `KIRA.app` vào `/Applications`;
- gỡ cờ quarantine và tự ký lại app cùng mọi thành phần bên trong: 4 helper native (OCR, Natural Language, Foundation Models, Codex) và Safari Extension;
- xác minh chữ ký, đăng ký Safari Extension với hệ thống, rồi mở KIRA.

Nếu `/Applications` cần quyền quản trị, Terminal sẽ hỏi mật khẩu máy Mac một lần.

Sau khi cài: vào **Safari → Cài đặt → Tiện ích mở rộng** và bật **KIRA**. Với Chrome, mở KIRA → **Cài đặt**, vào tab cài extension Chrome và làm theo hướng dẫn.

### Nếu macOS chặn file cài đặt

Bộ cài không được Apple notarize, nên lần đầu bấm đúp macOS có thể báo không xác minh được nhà phát triển. Khi đó chọn một trong hai cách:

- Vào **Cài đặt hệ thống → Quyền riêng tư & Bảo mật**, kéo xuống, bấm **Vẫn mở** cạnh dòng nhắc tới `Install KIRA.command`, rồi bấm đúp lại.
- Hoặc mở Terminal, gõ `bash ` (có dấu cách), kéo file `Install KIRA.command` vào cửa sổ Terminal, rồi nhấn Return.

## Ký thủ công

Chỉ ký mà không cài (ví dụ app nằm ở chỗ khác):

```bash
./sign-kira.sh "/đường/dẫn/KIRA.app"
```

Chữ ký mặc định là ad-hoc, miễn phí, chỉ có giá trị trên chính máy đã ký.

## Ký bằng Developer ID

Nếu máy có certificate Apple Developer ID Application:

```bash
security find-identity -v -p codesigning
KIRA_SIGN_IDENTITY="Developer ID Application: Tên của bạn (TEAMID)" bash "Install KIRA.command"
```

Developer ID signing không tự động notarize ứng dụng. Khi phân phối công khai, vẫn cần gửi ứng dụng tới dịch vụ notarization của Apple.

## Tuỳ chọn

- `KIRA_INSTALL_DIR=<thư mục>`: cài vào chỗ khác thay vì `/Applications`.
- `KIRA_NO_OPEN=1`: không tự mở KIRA sau khi cài.
- `KIRA_KEEP_QUARANTINE=1`: giữ nguyên cờ quarantine thay vì để script gỡ.
