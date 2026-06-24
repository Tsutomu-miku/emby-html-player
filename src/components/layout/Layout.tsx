import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * 应用壳：Sidebar（移动端横排 / 桌面端竖排）+ 右侧 TopBar + Outlet。
 */
export function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-jelly-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1">
          <div className="px-4 md:px-8 py-5 md:py-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
