import React, { useState, useEffect } from 'react';
import { HotTable } from '@handsontable/react';

export default function DutyTypeManager({ types, onSave }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData([
      ...types.map(t => [t.name, t.hoursCounted, t.cycle.join(',')]),
      ['','','']
    ]);
  }, [types]);

  const handleSave = () => {
    const list = data
      .filter(r => (r[0] || '').trim() !== '')
      .map(r => ({
        name: r[0].trim(),
        hoursCounted: Number(r[1]) || 0,
        cycle: (r[2] || '').split(',').map(n => Number(n) || 0)
      }));
    onSave(list);
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Список видов дежурств</h3>
      <HotTable
        data={data}
        colHeaders={['Название', 'Часы', 'Цикл дней']}
        rowHeaders
        width="100%"
        height={300}
        stretchH="all"
        licenseKey="non-commercial-and-evaluation"
        minSpareRows={1}
        columns={[
          { data: 0, type: 'text' },
          { data: 1, type: 'numeric' },
          { data: 2, type: 'text' }
        ]}
        afterChange={(changes, source) => {
          if (!Array.isArray(changes)) return;
          setData(prev => {
            const updated = [...prev];
            changes.forEach(([r, c, oldV, newV]) => {
              if (updated[r]) updated[r][c] = newV;
            });
            return updated;
          });
        }}
      />
      <button onClick={handleSave} style={{ marginTop: 10 }}>Сохранить</button>
    </div>
  );
}
