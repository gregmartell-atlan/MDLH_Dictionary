import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './services/queryClient'
import { ConnectionProvider } from './context/ConnectionContext'
import App from './App.jsx'
import './index.css'
import { initGlobalErrorLogging } from './utils/errorLogging'

// Initialize global error capture before rendering
initGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider>
        <App />
      </ConnectionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
