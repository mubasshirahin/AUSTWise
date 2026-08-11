import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes/industrial.css'
import './themes/minimalist-dark.css'
import './themes/bitcoindefi.css'
import './themes/terminal.css'
import './themes/artdeco.css'
import './themes/swiss.css'
import './themes/poster.css'
import './themes/dark-enhanced.css'
import './themes/nexus.css'
import './themes/meshtopo.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
