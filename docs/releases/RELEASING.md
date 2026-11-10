# Quy trình release KIRA

Chạy ở tree chính, trên `main` sạch, sau khi mọi nhánh của đợt release đã merge.

1. **Kiểm tĩnh**: `bun test apps/desktop/src/kira`, `cd apps/desktop && npx tsc -b`, `node scripts/graphify-lite.mjs --strict` (exit 0), `cd apps/desktop/src-tauri && cargo test && cargo clippy --no-deps` (0 warning).
2. **Nâng version**: `node scripts/bump-version.mjs <x.y.z> --dry-run`, đọc danh sách, rồi chạy lại không có `--dry-run`. Script dừng mà không ghi gì nếu một mẫu không khớp.
3. **Viết tay**: mục `## [x.y.z] - YYYY-MM-DD` và link cuối trong `CHANGELOG.md`; `docs/releases/x.y.z.md` theo khuôn bản trước. Copy hiển thị cho user không em dash.
4. **Build**: `cd apps/desktop && pnpm build:tauri` (frontend, extension, Safari appex), rồi `pnpm release:mac` (build release và ký ad-hoc), rồi `packaging/macos/package-release.sh` ra `release/KIRA-x.y.z-macos-arm64.zip` + `.sha256`.
5. **Smoke test bản release**: mở `KIRA.app` vừa build (không phải bản đã cài), mở project, chụp, lưu, mở lại; kiểm extension Chrome đẩy ảnh về được.
6. **Commit** `release: KIRA x.y.z`, push `main`.
7. **Phát hành (user quyết)**: `git tag vx.y.z && git push origin vx.y.z`, tạo GitHub Release, đính zip và `.sha256`, dán nội dung `docs/releases/x.y.z.md`.
