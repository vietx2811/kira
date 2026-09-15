import { lazy, Suspense, useEffect, useState } from 'react'

// Lazy: người dùng bình thường (không mở ?uikit, không gọi
// window.__kiraDev.showUiKit()) không tải thêm một byte JS/CSS nào của
// Untitled UI React — giữ đúng yêu cầu "không xuất hiện với user" kể cả ở
// mức bundle, không chỉ ở mức UI.
const UiKitGallery = lazy(() => import('../uikit/UiKitGallery').then((m) => ({ default: m.UiKitGallery })))

declare global {
  interface Window {
    // Namespace RIÊNG, không phải window.__kiraDev: `__kiraDev` đã là API
    // QA/fixture hiện có của app (main.tsx, type `KiraDevApi` — loadFixture,
    // verifyLayout, v.v., gán tại main.tsx ~dòng 3327). Brief PHA 0 gốc xin
    // dùng `window.__kiraDev.showUiKit()`; đã đổi sang namespace riêng để
    // không đè type/API đó (tsc báo lỗi type ngay khi thử gộp chung — xem
    // report). Dùng `?uikit` (giữ nguyên như brief) hoặc namespace này.
    __kiraUiKit?: {
      showUiKit: () => void
      hideUiKit: () => void
    }
  }
}

/**
 * Router tối giản chỉ cho dev tooling, KHÔNG phải routing thật của app.
 * Mặc định luôn render `<App />` (hành vi hệt như trước khi có PHA 0 này) —
 * chỉ đổi sang gallery Untitled UI khi dev bật rõ ràng bằng query `?uikit`
 * hoặc gọi `window.__kiraUiKit.showUiKit()` từ console. User bình thường
 * không thấy khác biệt gì.
 */
export function DevRoot({ App }: { App: React.ComponentType }) {
  const [showUiKit, setShowUiKit] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has('uikit')
    } catch {
      return false
    }
  })

  useEffect(() => {
    window.__kiraUiKit = {
      showUiKit: () => setShowUiKit(true),
      hideUiKit: () => setShowUiKit(false),
    }
    return () => {
      delete window.__kiraUiKit
    }
  }, [])

  if (!showUiKit) return <App />

  return (
    <Suspense fallback={null}>
      <UiKitGallery />
    </Suspense>
  )
}
