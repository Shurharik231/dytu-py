// components/MonthlyStatsTable.jsx
import React, { useState, useMemo } from 'react';

const monthNames = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export default function MonthlyStatsTable({ stats, staffList, monthlyNorms }) {
  const [filter, setFilter] = useState('');

  if (!stats || !stats.length) {
    return <p>Нет данных для отображения.</p>;
  }

  // rawMonths — ключи «01.MM.YYYY»
  const rawMonths = useMemo(() => {
    return Object.keys(stats[0].monthly).sort((a, b) => {
      const [da, ma, ya] = a.split('.');
      const [db, mb, yb] = b.split('.');
      return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
    });
  }, [stats]);

  // Для заголовков: «01.MM.YYYY» → «Месяц Год»
  const displayMonths = useMemo(() => {
    return rawMonths.map(m => {
      const [dd, mm, yyyy] = m.split('.');
      return `${monthNames[+mm - 1]} ${yyyy}`;
    });
  }, [rawMonths]);

  // Фильтрация по ФИО
  const filteredStats = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return stats;
    return stats.filter(({ name }) => name.toLowerCase().includes(term));
  }, [filter, stats]);

  const th = {
    border: '1px solid #ccc',
    padding: '8px',
    background: '#f0f0f0',
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };
  const td = {
    border: '1px solid #ccc',
    padding: '8px',
    textAlign: 'center',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <h4>Наработка по месяцам</h4>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '6px 12px',
            width: '100%',
            maxWidth: 300,
            marginBottom: 8,
            borderRadius: 4,
            border: '1px solid #ccc',
          }}
        />
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>ФИО</th>
            <th style={th}>Отдел</th>
            {displayMonths.map((label, idx) => (
              <th key={rawMonths[idx]} style={th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredStats.map(({ name, department, monthly }, i) => (
            <tr key={i}>
              <td style={td} title={name}>
                {name}
              </td>
              <td style={td}>{department}</td>
              {rawMonths.map(monthKey => {
                const delta = monthly[monthKey] ?? 0;
                const sign = delta >= 0 ? '+' : '';

                const normValue =
                  monthlyNorms && typeof monthlyNorms[monthKey] === 'number'
                    ? monthlyNorms[monthKey]
                    : 160;

                const worked = normValue + delta;
                const displayText = `${worked}/${normValue} (${sign}${delta})`;

                return (
                  <td key={monthKey} style={td}>
                    {displayText}
                  </td>
                );
              })}
            </tr>
          ))}
          {filteredStats.length === 0 && (
            <tr>
              <td colSpan={2 + displayMonths.length} style={td}>
                По запросу "{filter}" ничего не найдено.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
