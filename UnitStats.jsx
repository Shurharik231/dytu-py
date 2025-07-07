import React, { useMemo } from 'react';

export default function UnitStats({ staffMap, unitSchedule }) {
  const stats = useMemo(() => {
    if (!unitSchedule || unitSchedule.length < 2) return [];

    const header = unitSchedule[0];
    const rows = unitSchedule.slice(1);

    const peopleCounts = {};
    Object.entries(staffMap).forEach(([unit, list]) => {
      peopleCounts[unit] = list.length;
    });

    const totalPeople = Object.values(peopleCounts).reduce((a, b) => a + b, 0);
    const totalDuties = rows.length * (header.length - 1);

    const calculated = {};
    Object.entries(peopleCounts).forEach(([unit, count]) => {
      calculated[unit] = {
        unit,
        people: count,
        percent: totalPeople ? (count / totalPeople) * 100 : 0,
        expected: totalPeople ? Math.round((count / totalPeople) * totalDuties) : 0,
        actual: 0,
      };
    });

    // Подсчёт фактических дежурств
    rows.forEach(row => {
      row.slice(1).forEach(unit => {
        if (calculated[unit]) {
          calculated[unit].actual += 1;
        }
      });
    });

    return Object.values(calculated);
  }, [staffMap, unitSchedule]);

  if (!stats.length) return null;

  return (
    <div>
      <h4>Статистика подразделений</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Подразделение</th>
            <th style={cellStyle}>Личный состав / %</th>
            <th style={cellStyle}>Расчет. кол. деж / Факт. кол. деж</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.unit}>
              <td style={cellStyle}>{s.unit}</td>
              <td style={cellStyle}>{s.people} / {s.percent.toFixed(1)}%</td>
              <td style={cellStyle}>{s.expected} / {s.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '8px',
  textAlign: 'center',
};
