import { useRef, type ReactNode } from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'

/**
 * Cầu nối portal cho Untitled UI React (React Aria Components) trong KIRA.
 *
 * React Aria portal Popover/Modal/Tooltip ra `document.body` theo mặc định
 * (props `UNSTABLE_portalContainer` per-component đã deprecated, kit tự
 * dùng mặc định này). `document.body` đứng NGOÀI `.app-shell`, nên không
 * thấy token màu inline theo project (CLAUDE.md: "phần tử portal ra
 * document.body cũng không thấy token theme") — Select/Dropdown/Tooltip/
 * Modal sẽ mất theme, mất dark/light, mất accent nếu không xử lý.
 *
 * `UNSAFE_PortalProvider` (react-aria) đặt container portal cho toàn bộ
 * children — bọc phần cây có dùng component Untitled UI bằng
 * `<UiKitPortalHost>`, container trả về nằm bên TRONG `.app-shell` nên kế
 * thừa đúng data-color-mode + accent runtime. "UNSAFE_" là tiền tố API của
 * chính React Aria (không ổn định giữa các bản), không phải cảnh báo của
 * KIRA — đây là API hiện hành, không phải API cũ (xem
 * node_modules/react-aria-components dist types: props portal cũ ghi rõ
 * "deprecated - Use a parent UNSAFE_PortalProvider instead").
 */
export function UiKitPortalHost({ className, children }: { className?: string; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className={className} style={{ isolation: 'isolate' }}>
      <UNSAFE_PortalProvider getContainer={() => containerRef.current}>{children}</UNSAFE_PortalProvider>
    </div>
  )
}
