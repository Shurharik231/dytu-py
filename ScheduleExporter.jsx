import React from 'react';
import { exportScheduleToExcel } from '../utils/excelUtils.js';

/**
 * Кнопка для экспорта итогового графика (AOA-матрицы fullSchedule) в Excel.
 */
export default function ScheduleExporter({ fullSchedule }) {
  return (
    <div>
      <h2>Экспорт итогового графика</h2>
      <button onClick={() => exportScheduleToExcel(fullSchedule)}>
        Экспортировать в Excel
      </button>
    </div>
  );
}
