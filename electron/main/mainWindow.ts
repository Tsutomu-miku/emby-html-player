import { BrowserWindow, shell } from 'electron'
import path from 'node:path'

export interface MainWindowOptions {
  preloadPath: string
  devServerUrl: string
  rendererIndexPath: string
  isDev: boolean
}

export async function createMainWindow(options: MainWindowOptions): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Emby Desktop Player',
    backgroundColor: '#101114',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  if (options.isDev) {
    await window.loadURL(options.devServerUrl)
    window.webContents.openDevTools({ mode: 'detach' })
    return window
  }

  await window.loadFile(path.normalize(options.rendererIndexPath))
  return window
}
