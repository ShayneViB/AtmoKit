import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Calculator from './pages/Calculator';
import Evaluation from './pages/Evaluation';
import HourlyTracking from './pages/HourlyTracking';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Calculator />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="tracking" element={<HourlyTracking />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
