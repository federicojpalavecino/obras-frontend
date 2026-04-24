import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Menu from './pages/Menu';
import Presupuesto from './pages/Presupuesto';
import Certificado from './pages/Certificado';
import Materiales from './pages/Materiales';
import ManoObra from './pages/ManoObra';
import AnalisisCostos from './pages/AnalisisCostos';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/presupuesto/:id" element={<Presupuesto />} />
        <Route path="/presupuesto/:id/certificado" element={<Certificado />} />
        <Route path="/materiales" element={<Materiales />} />
        <Route path="/mano-obra" element={<ManoObra />} />
        <Route path="/analisis" element={<AnalisisCostos />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
