import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SharedComponent from './Shared';
import PaymentSuccess from './PaymentSuccess';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router basename="/ai-life-coach">
      <Routes>
        <Route path="/shared/:ownerId/:conversationId" element={<SharedComponent />} />
        <Route path="/payment-success" element={<PaymentSuccess />}/>
        
        <Route path="/chat/:conversationId" element={<App />} />
        <Route path="/chat" element={<App />} />
        <Route path="/profile" element={<App />} />
        <Route path="/graph" element={<App />} />
        <Route path="/" element={<App />}/>
      </Routes>
    </Router>
  </React.StrictMode>
);