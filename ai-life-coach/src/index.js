import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SharedComponent from './Shared';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/shared/:ownerId/:conversationId" element={<SharedComponent />} />
        <Route path="/" element={<App />}/>
      </Routes>
    </Router>
  </React.StrictMode>
);