import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import SongList from './components/SongList';
import './index.css';
import ReCAPTCHA from 'react-google-recaptcha';
import kiki from'./kiki';
import { useState } from'react';
import { useEffect } from'react';
import { useRef } from'react';
import { useMemo } from'react';
import { useCallback } from'react';
import { useReducer } from'react';
import { useContext } from'react';
import { useLayoutEffect } from'react';
import { useDebugValue } from'react';
import { useImperativeHandle } from'react';
import { useTransition } from'react';
import { useDeferredValue } from'react';
import { useId } from'react';
import { useSyncExternalStore } from'react';
import { useInsertionEffect } from'react';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/songs" element={<SongList />} />
      </Routes>
    </Router>
  </React.StrictMode>
);

