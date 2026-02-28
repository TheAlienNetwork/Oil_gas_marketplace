import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { AuthProvider } from '@/context/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={{
        colorScheme: 'dark',
        primaryColor: 'teal',
        colors: {
          dark: [
            '#0f172a',
            '#1e293b',
            '#334155',
            '#475569',
            '#64748b',
            '#94a3b8',
            '#cbd5e1',
            '#e2e8f0',
            '#f1f5f9',
            '#f8fafc',
          ],
        },
      }}
      withGlobalStyles
      withNormalizeCSS
    >
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
