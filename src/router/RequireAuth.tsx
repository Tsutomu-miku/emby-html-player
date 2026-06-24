import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/auth'

interface Props {
  children: ReactNode
}

/**
 * 路由守卫：未登录跳 /login，登录后允许访问。
 */
export function RequireAuth({ children }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const server = useAuthStore((s) => s.server)
  const location = useLocation()

  if (!accessToken || !server) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}
