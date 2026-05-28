import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { testConnection } from './lib/firebase';
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Fix for iframe environments (like AI Studio preview) where modals might be blocked
if (window.self !== window.top) {
  window.confirm = (message?: string) => {
    console.log(`[Confirm bypassed in iframe]: ${message}`);
    return true; 
  };
  window.alert = (message?: any) => {
    console.log(`[Alert bypassed in iframe]: ${message}`);
  };
}

// Safely catch Safari/Chrome quota exceeded errors globally to prevent application crashes
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key: string, value: string) {
  try {
    originalSetItem.call(this, key, value);
  } catch (e: any) {
    console.warn(`[Storage] Failed to set ${key}: ${e.message}`);
    // If it's a quota issue, we could clear old caches, but at least we don't crash now.
  }
};

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);
