declare const chrome: {
  action?: {
    openPopup?: () => Promise<void>
  }
  contextMenus: {
    create: (properties: {
      id: string
      title: string
      contexts: Array<'image' | 'page'>
    }) => void
    onClicked: {
      addListener: (
        callback: (
          info: { menuItemId: string | number; srcUrl?: string; pageUrl?: string },
          tab?: { title?: string; url?: string },
        ) => void,
      ) => void
    }
  }
  runtime: {
    getURL: (path: string) => string
    sendMessage: (message: unknown) => Promise<unknown>
    onMessage: {
      addListener: (
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ) => void
    }
    onInstalled: {
      addListener: (callback: () => void) => void
    }
  }
  scripting: {
    executeScript: <T>(details: {
      target: { tabId: number }
      func: () => T
    }) => Promise<Array<{ result?: T }>>
  }
  storage: {
    local: {
      get: <T>(keys: string[]) => Promise<T>
      set: (items: Record<string, unknown>) => Promise<void>
      remove: (keys: string[]) => Promise<void>
    }
  }
  tabs: {
    query: (queryInfo: { active: boolean; currentWindow: boolean }) => Promise<Array<{ id?: number; title?: string; url?: string }>>
  }
  windows: {
    create: (createData: {
      url: string
      type?: 'popup'
      width?: number
      height?: number
      left?: number
      top?: number
      focused?: boolean
    }) => Promise<{ id?: number }>
    update: (windowId: number, updateInfo: {
      focused?: boolean
      width?: number
      height?: number
      left?: number
      top?: number
    }) => Promise<unknown>
    onRemoved: {
      addListener: (callback: (windowId: number) => void) => void
    }
  }
}
