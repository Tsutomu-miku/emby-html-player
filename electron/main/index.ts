import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { installEmbyAuthIpc } from './authIpc'
import { installEmbeddedMpvIpc } from './embeddedMpv'
import { emptyEmbyAuth, type EmbyAuthState } from './embyIdentity'
import { createMainWindow } from './mainWindow'
import { installEmbyNetworkHandlers } from './networkIdentity'

const __dir = import.meta.dirname

const DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'] ?? ''
const REMOTE_DEBUGGING_PORT = process.env['EHP_REMOTE_DEBUGGING_PORT']
const isDev = DEV_SERVER_URL.length > 0

if (isDev && REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', REMOTE_DEBUGGING_PORT)
}

let mainWindow: BrowserWindow | null = null
let embyAuth: EmbyAuthState = emptyEmbyAuth()

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function getEmbyAuth(): EmbyAuthState {
  return embyAuth
}

function setEmbyAuth(next: EmbyAuthState): void {
  embyAuth = next
}

async function openMainWindow(): Promise<void> {
  mainWindow = await createMainWindow({
    preloadPath: path.join(__dir, '../preload/index.mjs'),
    devServerUrl: DEV_SERVER_URL,
    rendererIndexPath: path.join(__dir, '../renderer/index.html'),
    isDev,
  })
}

void app.whenReady().then(() => {
  installEmbyAuthIpc({
    getAuth: getEmbyAuth,
    setAuth: setEmbyAuth,
  })
  installEmbeddedMpvIpc(getMainWindow, getEmbyAuth)
  installEmbyNetworkHandlers({
    getAuth: getEmbyAuth,
    getWindow: getMainWindow,
  })
  void openMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
