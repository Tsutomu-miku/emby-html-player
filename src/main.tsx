import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { useAuthStore } from './store/auth'
import { MpvOverlayPage } from './pages/MpvOverlayPage'

// 启动时把持久化的 Emby 身份同步给主进程，确保第一条 API/媒体请求也能被改写。
const initialAuth = useAuthStore.getState()
if (initialAuth.server) {
  window.ehp?.setEmbyAuth({
    server: initialAuth.server,
    accessToken: initialAuth.accessToken,
    deviceId: initialAuth.deviceId,
  })
}

const el = document.getElementById('app')
if (!el) throw new Error('root element not found')
const isMpvOverlay = new URLSearchParams(window.location.search).get('mpvOverlay') === '1'

createRoot(el).render(
  isMpvOverlay ? <MpvOverlayPage /> : <RouterProvider router={router} />,
)
