import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { initAppZoom } from './utils/appZoom.js'

const rootElement = document.getElementById('root')
// 1920 기준 디자인을 좁은 PC 화면에 같은 비율로 축소 (첫 화면이 그려지기 전에 적용)
initAppZoom(rootElement)

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
