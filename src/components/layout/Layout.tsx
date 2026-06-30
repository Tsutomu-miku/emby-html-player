import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import './Layout.scss'

/**
 * 应用壳：Sidebar（移动端横排 / 桌面端竖排）+ 右侧 TopBar + Outlet。
 */
export function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__content">
        <TopBar />
        <main className="app-shell__main">
          <div className="app-shell__container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
