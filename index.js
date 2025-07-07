import 'core-js/stable';
import 'regenerator-runtime/runtime';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Регистрируем все встроенные типы Handsontable (включая date, dropdown)
import { registerAllCellTypes } from 'handsontable/registry';
registerAllCellTypes();

const root = createRoot(document.getElementById('root'));
root.render(<App />);
