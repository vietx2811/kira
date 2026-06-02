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
}
