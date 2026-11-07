import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { boot } from './lib/store';

boot();
createRoot(document.getElementById('root')!).render(<App />);
