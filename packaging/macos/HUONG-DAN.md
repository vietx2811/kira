# KIRA 1.0.1 cho macOS

Nhà phát triển: **VX Studio**

Bundle identifier: `vxstudio.kira`

## Cài đặt và tự ký

1. Giải nén bộ phát hành.
2. Mở Terminal tại thư mục vừa giải nén.
3. Chạy:

   ```bash
   chmod +x sign-kira.sh
   ./sign-kira.sh
   ```

4. Kéo `KIRA.app` vào thư mục `/Applications`.
5. Mở KIRA một lần. Nếu dùng Safari, vào **Safari → Settings → Extensions** và bật **KIRA**.

Script mặc định tạo chữ ký ad-hoc miễn phí, phù hợp để chạy ứng dụng trên chính máy đã ký.

## Ký bằng Developer ID

Nếu máy có certificate Apple Developer ID Application:

```bash
security find-identity -v -p codesigning
KIRA_SIGN_IDENTITY="Developer ID Application: Tên của bạn (TEAMID)" ./sign-kira.sh
```

Developer ID signing không tự động notarize ứng dụng. Khi phân phối công khai, vẫn cần gửi ứng dụng tới dịch vụ notarization của Apple.

## Tuỳ chọn

Giữ nguyên quarantine attribute thay vì để script xoá nó:

```bash
KIRA_KEEP_QUARANTINE=1 ./sign-kira.sh
```

Bạn cũng có thể truyền đường dẫn ứng dụng:

```bash
./sign-kira.sh "/đường/dẫn/khác/KIRA.app"
```
