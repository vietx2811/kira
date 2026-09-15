import { useState } from 'react'
import { DialogTrigger as AriaDialogTrigger } from 'react-aria-components'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import { Input } from '@/components/base/input/input'
import { Select } from '@/components/base/select/select'
import { Toggle } from '@/components/base/toggle/toggle'
import { Slider } from '@/components/base/slider/slider'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { Tooltip } from '@/components/base/tooltip/tooltip'
import { Tabs, TabList, Tab, TabPanel } from '@/components/application/tabs/tabs'
import { Dropdown } from '@/components/base/dropdown/dropdown'
import { Modal, ModalOverlay, Dialog } from '@/components/application/modals/modal'
import { UiKitPortalHost } from './PortalHost'
import '../../styles/uikit/globals.css'

// Hai preset accent để kiểm cầu nối brand-* đổi theo project thật sự đổi
// (không phải hard-code) — trùng cơ chế buildProjectAppearanceStyle() dùng
// cho --accent-cyan/--accent-strong, KHÔNG phải bản sao logic: chỉ 2 cặp
// giá trị demo, không tính lại toàn bộ token .app-shell (ngoài phạm vi PHA
// 0 — gallery chỉ cần đúng phần brand-*, bg/text/border/fg không phụ thuộc
// accent nên không cần demo ở đây).
const ACCENT_PRESETS = {
  teal: { '--accent-cyan': '#84cdbc', '--accent-strong': '#3f8f79' },
  rose: { '--accent-cyan': '#e2a0a0', '--accent-strong': '#b5504f' },
} as const

const SELECT_ITEMS = [
  { id: 'hanoi', label: 'Hà Nội' },
  { id: 'hcmc', label: 'TP. Hồ Chí Minh' },
  { id: 'overseas', label: 'Việt kiều' },
]

function GallerySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-secondary pb-8">
      <h2 className="text-md font-semibold text-primary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

function GalleryBody() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="flex flex-col gap-8 p-8">
      <GallerySection title="Button">
        <Button color="primary" size="md">
          Primary
        </Button>
        <Button color="secondary" size="md">
          Secondary
        </Button>
        <Button color="tertiary" size="md">
          Tertiary
        </Button>
        <Button color="primary-destructive" size="md">
          Destructive
        </Button>
        <Button color="primary" size="md" isDisabled>
          Disabled
        </Button>
      </GallerySection>

      <GallerySection title="Badge">
        <Badge color="brand">Brand</Badge>
        <Badge color="gray">Gray</Badge>
        <Badge color="success">Success</Badge>
        <Badge color="error">Error</Badge>
        <Badge type="modern" color="gray">
          Modern
        </Badge>
      </GallerySection>

      <GallerySection title="Input">
        <Input placeholder="Tên brand" className="w-64" />
        <Input placeholder="Vô hiệu hoá" className="w-64" isDisabled />
      </GallerySection>

      <GallerySection title="Select (mở thật để kiểm portal + theme)">
        <Select
          aria-label="Thị trường"
          items={SELECT_ITEMS}
          placeholder="Chọn thị trường"
          className="w-64"
          defaultSelectedKey="hanoi"
        >
          {(item) => (
            <Select.Item key={item.id} id={item.id}>
              {item.label}
            </Select.Item>
          )}
        </Select>
      </GallerySection>

      <GallerySection title="Dropdown (mở thật)">
        <Dropdown.Root>
          <Button color="secondary" size="md">
            Mở menu
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Hành động">
              <Dropdown.Item id="rename">Đổi tên</Dropdown.Item>
              <Dropdown.Item id="duplicate">Nhân bản</Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item id="delete">Xoá</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </GallerySection>

      <GallerySection title="Tooltip (mở thật)">
        <Tooltip title="Đây là tooltip Untitled UI" delay={0}>
          <Button color="secondary" size="md">
            Di chuột vào đây
          </Button>
        </Tooltip>
      </GallerySection>

      <GallerySection title="Toggle / Checkbox / Slider">
        <Toggle label="Bật gợi ý" defaultSelected />
        <Checkbox label="Đồng ý" defaultSelected />
        <div className="w-64">
          <Slider defaultValue={[40]} aria-label="Độ mờ" />
        </div>
      </GallerySection>

      <GallerySection title="Tabs">
        <Tabs className="w-full max-w-md">
          <TabList type="button-brand">
            <Tab id="chat" label="Chat" />
            <Tab id="needs" label="Cần bạn" badge="2" />
          </TabList>
          <TabPanel id="chat" className="pt-3 text-sm text-tertiary">
            Nội dung tab Chat.
          </TabPanel>
          <TabPanel id="needs" className="pt-3 text-sm text-tertiary">
            Nội dung tab Cần bạn.
          </TabPanel>
        </Tabs>
      </GallerySection>

      <GallerySection title="Modal (mở thật)">
        <AriaDialogTrigger isOpen={modalOpen} onOpenChange={setModalOpen}>
          <Button color="secondary" size="md" onPress={() => setModalOpen(true)}>
            Mở modal
          </Button>
          <ModalOverlay isOpen={modalOpen} onOpenChange={setModalOpen}>
            <Modal>
              <Dialog>
                <div className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold text-primary">Xác nhận</h3>
                  <p className="text-sm text-tertiary">
                    Modal này portal vào trong .app-shell (UiKitPortalHost) nên vẫn thấy đúng token theme và
                    data-color-mode hiện tại.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button color="secondary" size="sm" onPress={() => setModalOpen(false)}>
                      Huỷ
                    </Button>
                    <Button color="primary" size="sm" onPress={() => setModalOpen(false)}>
                      Đồng ý
                    </Button>
                  </div>
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </AriaDialogTrigger>
      </GallerySection>
    </div>
  )
}

/**
 * Trang gallery chỉ cho dev — PHA 0. Bật qua `window.__kiraDev.showUiKit()`
 * hoặc query `?uikit` (xem src/kira/dev/DevRoot.tsx), không xuất hiện với
 * user thường. Render bên trong `.app-shell` thật (không phải shell giả
 * lập riêng) để kiểm token theme + portal trong đúng điều kiện app thật sẽ
 * gặp khi migrate các màn thật.
 */
export function UiKitGallery() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [accentKey, setAccentKey] = useState<keyof typeof ACCENT_PRESETS>('teal')

  const accentVars = ACCENT_PRESETS[accentKey] as Record<string, string>

  return (
    <main
      className="app-shell kira-uikit"
      data-color-mode={mode}
      style={{
        ...accentVars,
        minHeight: '100vh',
        background: mode === 'dark' ? '#0d0e0d' : '#f7f5f1',
        color: mode === 'dark' ? '#e9e6df' : '#23211d',
      }}
    >
      <UiKitPortalHost>
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-secondary bg-primary/95 p-4 backdrop-blur-sm">
          <h1 className="text-lg font-semibold text-primary">KIRA — Untitled UI gallery (dev only)</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" color={mode === 'dark' ? 'primary' : 'secondary'} onPress={() => setMode('dark')}>
              Dark
            </Button>
            <Button size="sm" color={mode === 'light' ? 'primary' : 'secondary'} onPress={() => setMode('light')}>
              Light
            </Button>
            <span className="mx-1 h-4 w-px bg-border-secondary" />
            {(Object.keys(ACCENT_PRESETS) as Array<keyof typeof ACCENT_PRESETS>).map((key) => (
              <Button
                key={key}
                size="sm"
                color={accentKey === key ? 'primary' : 'secondary'}
                onPress={() => setAccentKey(key)}
              >
                Accent {key}
              </Button>
            ))}
          </div>
        </div>
        <GalleryBody />
      </UiKitPortalHost>
    </main>
  )
}
