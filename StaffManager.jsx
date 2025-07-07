import React, { useState, useEffect } from 'react';
import { HotTable } from '@handsontable/react';

export default function StaffManager({ staffList, onSave }) {
  const RANKS = [
    "Рядовой","Ефрейтор","Младший сержант","Сержант","Старший сержант",
    "Старшина","Прапорщик","Старший прапорщик","Младший лейтенант",
    "Лейтенант","Старший лейтенант","Капитан","Майор","Подполковник","Полковник"
  ];
  const [data, setData] = useState([]);

  useEffect(() => {
    setData([...staffList.map(s => [s.name, s.rank]), ['','']]);
  }, [staffList]);

  const handleSave = () => {
    const list = data
      .filter(r => (r[0] || '').trim() !== '')
      .map(r => ({ name: r[0].trim(), rank: r[1].trim() }));
    onSave(list);
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Список сотрудников</h3>
      <HotTable
        data={data}
        colHeaders={['ФИО сотрудника', 'Звание']}
        rowHeaders
        width="100%"
        height={400}
        stretchH="all"
        licenseKey="non-commercial-and-evaluation"
        minSpareRows={1}
        columns={[
          { data: 0, type: 'text' },
          { data: 1, type: 'dropdown', source: RANKS, strict: true }
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
