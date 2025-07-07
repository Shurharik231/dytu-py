// components/MonthNormModal.jsx
import React, { useState, useEffect } from 'react';

export default function MonthNormModal({
  open,
  months = [],
  normByMonth = {},
  onSave,
  onClose,
}) {
  const [localNorms, setLocalNorms] = useState({});
  const [monthList, setMonthList] = useState(months); // ["01.MM.YYYY", ...]
  const [newMonth, setNewMonth] = useState(''); // "YYYY-MM-DD"
  const [newNorm, setNewNorm] = useState(160);

  useEffect(() => {
    setMonthList(months);
    setLocalNorms(
      months.reduce(
        (acc, m) => ({ ...acc, [m]: normByMonth[m] ?? 160 }),
        {}
      )
    );
  }, [months, normByMonth, open]);

  const handleAddMonth = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newMonth)) {
      alert('Выберите дату в формате ГГГГ-MM-DD');
      return;
    }
    const [yyyy, mm, dd] = newMonth.split('-');
    const monthKey = `01.${mm}.${yyyy}`; // "01.MM.YYYY"
    if (monthList.includes(monthKey)) {
      alert('Такой месяц уже есть');
      return;
    }
    setMonthList(list => [...list, monthKey]);
    setLocalNorms(norms => ({ ...norms, [monthKey]: +newNorm || 160 }));
    setNewMonth('');
    setNewNorm(160);
  };

  const handleRemove = m => {
    setMonthList(list => list.filter(mm => mm !== m));
    setLocalNorms(norms => {
      const copy = { ...norms };
      delete copy[m];
      return copy;
    });
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          minWidth: 340,
          boxShadow: '0 2px 8px #0003',
        }}
      >
        <h3>Нормы часов по месяцам</h3>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <input
            type="date"
            value={newMonth}
            onChange={e => setNewMonth(e.target.value)}
            style={{ width: 130 }}
            title="Выберите любой день нужного месяца; будет браться 1-е число"
          />
          <input
            type="number"
            value={newNorm}
            min={0}
            onChange={e => setNewNorm(e.target.value)}
            style={{ width: 80 }}
            placeholder="Норма"
            title="Введите норму в часах"
          />
          <button onClick={handleAddMonth}>Добавить месяц</button>
        </div>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Норма, ч</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {monthList.map(m => (
              <tr key={m}>
                <td>{m}</td>
                <td>
                  <input
                    type="number"
                    style={{ width: 80 }}
                    value={localNorms[m]}
                    min={0}
                    onChange={e =>
                      setLocalNorms(l => ({
                        ...l,
                        [m]: +e.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <button onClick={() => handleRemove(m)} title="Удалить месяц">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              onSave(localNorms);
              localStorage.setItem('monthlyNorms', JSON.stringify(localNorms));
            }}
          >
            Сохранить
          </button>
          <button onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
