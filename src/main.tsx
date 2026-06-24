import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'

const el = document.getElementById('app')!
createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
