import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/lora/500.css'
import './index.css'
import './styles/showcase.css'
import { AuthProvider } from './lib/auth'
import App from './App'
import { DiscoveryProvider } from './lib/discovery.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <DiscoveryProvider>
            <App />
          </DiscoveryProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
