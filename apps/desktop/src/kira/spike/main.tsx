// SPIKE entry point — mounted only by spike-chat.html, never imported by main.tsx.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChatSpike from './ChatSpike'
import './chatSpike.css'

const container = document.getElementById('root')
if (!container) throw new Error('missing #root')

createRoot(container).render(
  <StrictMode>
    <ChatSpike />
  </StrictMode>,
)
