import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'

export function registerIpcHandlers(): void {
  ipcMain.handle('file:save-image', async (_event, dataUrl: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '이미지 저장',
      defaultPath: 'untitled.png',
      filters: [
        { name: 'PNG 이미지', extensions: ['png'] },
        { name: 'JPEG 이미지', extensions: ['jpg', 'jpeg'] }
      ]
    })

    if (canceled || !filePath) return { success: false }

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    await writeFile(filePath, buffer)
    return { success: true, filePath }
  })

  ipcMain.handle('file:open-image', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '이미지 열기',
      filters: [
        { name: '이미지 파일', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }
      ],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return { success: false }

    const data = await readFile(filePaths[0])
    const ext = filePaths[0].split('.').pop()?.toLowerCase() || 'png'
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    const dataUrl = `data:${mimeType};base64,${data.toString('base64')}`
    return { success: true, dataUrl, filePath: filePaths[0] }
  })

  ipcMain.handle('zoom:get', (event) => {
    return event.sender.getZoomFactor()
  })

  ipcMain.handle('zoom:set', (event, factor: number) => {
    event.sender.setZoomFactor(factor)
  })
}
