import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './services/queryClient'
import { ConnectionProvider } from './context/ConnectionContext'
import { DynamicSchemaProvider } from './context/DynamicSchemaContext'
import { MdlhProvider } from './context/MdlhContext'
import App from './App.jsx'
import './index.css'
import { initGlobalErrorLogging } from './utils/errorLogging'

// Initialize global error capture before rendering
initGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider>
        <DynamicSchemaProvider>
          <MdlhProvider>
            <App />
          </MdlhProvider>
        </DynamicSchemaProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
