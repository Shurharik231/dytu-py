import React, { useState } from 'react';

export default function LeaveManager({ leaveRanges, onAdd, staffList }) {
  const [person, setPerson] = useState('');
  const [type, setType] = useState('Отпуск');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleAdd = () => {
    if (!person || !start || !end) return;

    const cleanName = person.replace(/\s*\(.+\)$/, '').trim();
    const newEntry = { name: cleanName, start, end, type };

    if (typeof onAdd === 'function') {
      onAdd([...leaveRanges, newEntry]);
    }

    setPerson('');
    setType('Отпуск');
    setStart('');
    setEnd('');
  };

  const handleRemove = (indexToRemove) => {
    const updated = leaveRanges.filter((_, idx) => idx !== indexToRemove);
    if (typeof onAdd === 'function') {
      onAdd(updated);
    }
  };

  return (
    <div style={{ margin: '20px 0', padding: 10, border: '1px solid #ccc' }}>
      <h4>Отпуска и больничные</h4>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={person} onChange={e => setPerson(e.target.value)}>
          <option value="">Сотрудник</option>
          {staffList.map((s, i) => {
            const display = `${s.rank} ${s.name} (${s.unit})`;
            return (
              <option key={`${s.unit}-${s.name}-${i}`} value={display}>
                {display}
              </option>
            );
          })}
        </select>

        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="Отпуск">Отпуск</option>
          <option value="Больничный">Больничный</option>
          <option value="B/O">B/O</option>
        </select>

        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} />

        <button onClick={handleAdd}>Добавить</button>
      </div>

      {leaveRanges.length > 0 && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: 4 }}>Сотрудник</th>
              <th style={{ border: '1px solid #ddd', padding: 4 }}>Тип</th>
              <th style={{ border: '1px solid #ddd', padding: 4 }}>С</th>
              <th style={{ border: '1px solid #ddd', padding: 4 }}>По</th>
              <th style={{ border: '1px solid #ddd', padding: 4 }}></th>
            </tr>
          </thead>
          <tbody>
            {leaveRanges.map((r, i) => (
              <tr key={`leave-${i}`}>
                <td style={{ border: '1px solid #ddd', padding: 4 }}>{r.name}</td>
                <td style={{ border: '1px solid #ddd', padding: 4 }}>{r.type}</td>
                <td style={{ border: '1px solid #ddd', padding: 4 }}>
                  {new Date(r.start).toLocaleDateString('ru-RU')}
                </td>
                <td style={{ border: '1px solid #ddd', padding: 4 }}>
                  {new Date(r.end).toLocaleDateString('ru-RU')}
                </td>
                <td style={{ border: '1px solid #ddd', padding: 4, textAlign: 'center' }}>
                  <button
                    onClick={() => handleRemove(i)}
                    style={{
                      color: 'red',
                      fontWeight: 'bold',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    title="Удалить"
                  >
                    ✖
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
