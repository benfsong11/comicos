import { Menu, BrowserWindow } from 'electron'

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow()
  win?.webContents.send(channel, ...args)
}

export function createMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Comicos',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: '파일',
      submenu: [
        {
          label: '새 캔버스',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu:action', 'new')
        },
        { type: 'separator' },
        {
          label: '이미지 열기',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu:action', 'open')
        },
        { type: 'separator' },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu:action', 'save')
        },
        {
          label: '다른 이름으로 저장',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu:action', 'save-as')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: '편집',
      submenu: [
        {
          label: '실행 취소',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('menu:action', 'undo')
        },
        {
          label: '다시 실행',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendToRenderer('menu:action', 'redo')
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '확대',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendToRenderer('menu:action', 'zoom-in')
        },
        {
          label: '축소',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendToRenderer('menu:action', 'zoom-out')
        },
        {
          label: '원래 크기',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendToRenderer('menu:action', 'zoom-reset')
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '개발자 도구' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
