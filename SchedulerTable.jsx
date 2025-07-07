import React, { useEffect, useState } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';

export default function SchedulerTable({
  data = [],
  tableRef,
  byUnit = false,
  employeesMap = {},
  unitSchedule = [],
  allowedUnits = [],
  leaveRanges = [],
  holidayList = [],    // ['01.01', '08.03', '09.05', ...]
  highlightViolations = false,
  onDataChange         // ← ОБЯЗАТЕЛЬНО!
}) {
  const [cols, setCols] = useState([]);
  const [rows, setRows] = useState([]);
  const [highlightName, setHighlightName] = useState(null);

  // Сокращения дней недели
  const dowNames = ['вс','пн','вт','ср','чт','пт','сб'];

  // Синхронизируем локальные cols/rows с data из App.jsx
  useEffect(() => {
    if (!data.length) return;
    setCols(data[0]);
    setRows(data.slice(1));
  }, [data]);

  // Renderer для даты
  function dateRenderer(inst, td, row) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    const dateStr = inst.getDataAtRowProp(row, 0);
    const [d, m, y] = dateStr.split('.').map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    const key = `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}`;
    td.innerText = `${dateStr} ${dowNames[dow]}`;
    if (holidayList.includes(key)) td.style.background = '#FFE4B5';
    else if (dow === 0 || dow === 6) td.style.background = '#EEEFFF';
    if (dt.toDateString() === new Date().toDateString())
      td.style.outline = '2px solid #FFAA00';
  }
  Handsontable.renderers.registerRenderer('dateRenderer', dateRenderer);

  // Renderer для ячеек
  function cellRenderer(inst, td, row, col, prop, value) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (!byUnit && highlightViolations && col > 0 && value) {
      const prev = inst.getDataAtCell(row - 1, col);
      if (prev === value) td.style.background = '#FFCCCC';
    }
    if (highlightName && col > 0 && value === highlightName) {
      td.style.background = '#FFFF99';
    }
  }
  Handsontable.renderers.registerRenderer('cellRenderer', cellRenderer);

  // Убираем “(unit)” из значения
  const stripUnit = str => str.replace(/\s*\(.+\)$/, '').trim();

  // Настройка колонок
  const columns = cols.map((h, idx) => {
    if (idx === 0) {
      return { data: idx, type: 'text', renderer: 'dateRenderer' };
    }
    if (byUnit) {
      return {
        data: idx,
        type: 'dropdown',
        source: allowedUnits,
        strict: false,
        allowInvalid: false,
        renderer: 'cellRenderer'
      };
    }
    return {
      data: idx,
      type: 'dropdown',
      source(query, callback) {
        const r = this.row, c = this.col;
        const unit = (unitSchedule[r + 1] || [])[c] || '';
        const list = employeesMap[unit] || [];
        const display = list.map(n => `${n} (${unit})`);
        const filtered = display.filter(x =>
          x.toLowerCase().includes(query.toLowerCase())
        );
        callback(filtered);
      },
      strict: false,
      allowInvalid: false,
      renderer: 'cellRenderer'
    };
  });

  return (
    <HotTable
      ref={tableRef}
      data={rows}
      colHeaders={cols}
      columns={columns}
      width="100%"
      height={500}
      stretchH="all"
      rowHeaders
      licenseKey="non-commercial-and-evaluation"

      // Подсветка имени при клике
      afterOnCellMouseDown={(e, coords) => {
        if (coords.row >= 0 && coords.col > 0) {
          const v = tableRef.current.hotInstance.getDataAtCell(coords.row, coords.col);
          setHighlightName(v);
        }
      }}

      // Главное: после любого изменения ячеек
      afterChange={(changes, source) => {
        if (!changes) return;
        // 1) чистим текст, убираем “(unit)”
        changes.forEach(([r, prop, oldV, newV]) => {
          if (newV && newV.includes('(')) {
            tableRef.current.hotInstance.setDataAtRowProp(r, prop, stripUnit(newV));
          }
        });
        // 2) формируем новый массив: заголовок + текущие строки
        const updated = [
          cols,
          ...tableRef.current.hotInstance.getData()
        ];
        // 3) шлём его вверх в App.jsx
        if (typeof onDataChange === 'function') {
          onDataChange(updated);
        }
      }}
    />
  );
}
