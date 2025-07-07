// App.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

import SchedulerTable from './components/SchedulerTable.jsx';
import LeaveManager from './components/LeaveManager.jsx';
import DutyTypeManager from './components/DutyTypeManager.jsx';
import PostManager from './components/PostManager.jsx';
import ScheduleExporter from './components/ScheduleExporter.jsx';
import UnitStats from './components/UnitStats.jsx';
import MonthlyStatsTable from './components/MonthlyStatsTable.jsx';
import MonthNormModal from './components/MonthNormModal.jsx';
import holidayListDefault from './data/holidays.json';

// Импортируем утилиты для экспорта Excel
import {
  exportStaffWithHours,
  exportScheduleToExcel,
  exportStaffTemplate
} from './utils/excelUtils.js';


// Утилита для надёжного разбора строки "DD.MM.YYYY" в Date
function parseDDMMYYYY(str) {
  const [dd, mm, yyyy] = str.split('.');
  return new Date(`${yyyy}-${mm}-${dd}`);
}

// Формат даты «DD.MM.YYYY»
function formatDateRU(d) {
  d = d instanceof Date ? d : new Date(d);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// Проверяет, активен ли сотрудник на дату
function isActiveOnDate(s, dutyDate) {
  const parse = d =>
    d && d.includes('.')
      ? parseDDMMYYYY(d)
      : d
      ? new Date(d)
      : null;
  const hired = s.hiredDate ? parse(s.hiredDate) : null;
  const fired = s.firedDate ? parse(s.firedDate) : null;
  if (hired && dutyDate < hired) return false;
  if (fired && dutyDate >= fired) return false; // день увольнения не считается рабочим
  return true;
}

// Сброс prevHours при новой сессии
if (!sessionStorage.getItem('sessionStarted')) {
  localStorage.removeItem('prevHours');
  sessionStorage.setItem('sessionStarted', '1');
}

export default function App() {
  const [tab, setTab] = useState('units');

  // 1. Сотрудники
  const [staffList, setStaffList] = useState(
    JSON.parse(localStorage.getItem('staffList') || '[]')
  );
  const prevHoursRaw = localStorage.getItem('prevHours');
  const prevHours = prevHoursRaw ? JSON.parse(prevHoursRaw) : {};

  useEffect(() => {
    try {
      localStorage.setItem('staffList', JSON.stringify(staffList));
    } catch (e) {
      console.warn('Не удалось записать staffList', e);
    }
  }, [staffList]);

  // 2. Виды дежурств
  const [dutyTypes, setDutyTypes] = useState(
    JSON.parse(localStorage.getItem('dutyTypes') || '[]')
  );
  useEffect(() => {
    try {
      localStorage.setItem('dutyTypes', JSON.stringify(dutyTypes));
    } catch (e) {
      console.warn('Не удалось записать dutyTypes', e);
    }
  }, [dutyTypes]);

  // 3. Праздники
  const [holidayList, setHolidayList] = useState(
    JSON.parse(localStorage.getItem('holidayList')) || holidayListDefault
  );
  const [showHolidaysEditor, setShowHolidaysEditor] = useState(false);
  const [editedHolidays, setEditedHolidays] = useState(holidayList.join('\n'));
  useEffect(() => {
    try {
      localStorage.setItem('holidayList', JSON.stringify(holidayList));
    } catch (e) {
      console.warn('Не удалось записать holidayList', e);
    }
    setEditedHolidays(holidayList.join('\n'));
  }, [holidayList]);

  // 4. Посты
  const [posts, setPosts] = useState(dutyTypes.map(d => d.name));
  useEffect(() => {
    setPosts(dutyTypes.map(d => d.name));
  }, [dutyTypes]);

  // 5. Карта подразделение → [ "rank name", ... ]
  const staffMap = useRef({});
  useEffect(() => {
    const map = {};
    staffList.forEach(s => {
      if (!map[s.unit]) map[s.unit] = [];
      map[s.unit].push(s.full);
    });
    staffMap.current = map;
  }, [staffList]);

  // 6. Разрешённые подразделения на пост
  const [allowedPerPost, setAllowedPerPost] = useState({});

  // 7. Диапазон дат (в формате YYYY-MM-DD для <input type="date">)
  const today = new Date();
  const defaultStart = formatDateRU(today).split('.').reverse().join('-'); // "YYYY-MM-DD"
  const defaultEnd = formatDateRU(new Date(today.getTime() + 29 * 86400000))
    .split('.')
    .reverse()
    .join('-');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // 8. График подразделений и статистика
  const [unitSchedule, setUnitSchedule] = useState([]);
  const [unitStats, setUnitStats] = useState([]);

  // Нормы по месяцам (ключи: "01.MM.YYYY")
  const savedNormsRaw = localStorage.getItem('monthlyNorms') || '{}';
  const [monthNorms, setMonthNorms] = useState(JSON.parse(savedNormsRaw));
  const [showMonthNorm, setShowMonthNorm] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('monthlyNorms', JSON.stringify(monthNorms));
    } catch (e) {
      console.warn('Не удалось записать monthlyNorms', e);
    }
  }, [monthNorms]);

  // Восстановление данных из sessionStorage
  const [rawData, setRawData] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  useEffect(() => {
    const raw = sessionStorage.getItem('rawData');
    const stats = sessionStorage.getItem('monthlyStats');
    const sched = sessionStorage.getItem('unitSchedule');
    const prev = sessionStorage.getItem('prevHours');

    if (raw) setRawData(JSON.parse(raw));
    if (stats) setMonthlyStats(JSON.parse(stats));
    if (sched) setUnitSchedule(JSON.parse(sched));
    if (prev) localStorage.setItem('prevHours', prev);
  }, []);

  // Список месяцев из monthlyStats (ключи "01.MM.YYYY")
  const rawMonths = useMemo(() => {
    if (!monthlyStats.length) return [];
    return Array.from(
      new Set(monthlyStats.flatMap(s => Object.keys(s.monthly)))
    ).sort((a, b) => {
      const [da, ma, ya] = a.split('.');
      const [db, mb, yb] = b.split('.');
      return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
    });
  }, [monthlyStats]);

  // Сохраняем unitSchedule в sessionStorage
  useEffect(() => {
    if (unitSchedule.length > 0) {
      sessionStorage.setItem('unitSchedule', JSON.stringify(unitSchedule));
    } else {
      sessionStorage.removeItem('unitSchedule');
    }
  }, [unitSchedule]);

  // useEffect — рассчитываем статистику подразделений
  useEffect(() => {
    if (!unitSchedule || unitSchedule.length < 2) return;

    const units = Object.keys(staffMap.current);
    const days = unitSchedule.length - 1;
    const totalDuties = days * posts.length;

    const peopleCounts = {};
    units.forEach(u => {
      peopleCounts[u] = staffList.filter(
        s => s.unit === u && isActiveOnDate(s, new Date(startDate))
      ).length;
    });

    setUnitStats(calculateUnitDutyAllocation(peopleCounts, totalDuties));
  }, [unitSchedule, posts, staffList, startDate]);

  const unitHotRef = useRef(null);

  // 9. Итоговый график и учёт отпусков/больничных
  const [leaveRanges, setLeaveRanges] = useState(
    JSON.parse(localStorage.getItem('leaveRanges') || '[]')
  );
  const [firstCalc, setFirstCalc] = useState(false);
  const scheduleHotRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('leaveRanges', JSON.stringify(leaveRanges));
    } catch (e) {
      console.warn('Не удалось записать leaveRanges', e);
    }
  }, [leaveRanges]);

  // Панель для увольнения сотрудника с даты
  const [removePerson, setRemovePerson] = useState('');
  const [removeDate, setRemoveDate] = useState(
    formatDateRU(new Date()).split('.').reverse().join('-')
  );

  // Панель для добавления нового сотрудника с датой
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({
    rank: '',
    name: '',
    unit: '',
    baseHours: 160,
    hiredDate: formatDateRU(new Date()).split('.').reverse().join('-'),
  });

  const handleAddNewPerson = () => {
    if (!newPerson.rank || !newPerson.name || !newPerson.unit)
      return alert('Заполните все поля!');
    setStaffList(prev => [
      ...prev,
      {
        ...newPerson,
        full: `${newPerson.rank} ${newPerson.name}`.trim(),
        fired: false,
        firedDate: null,
      },
    ]);
    setNewPerson({
      rank: '',
      name: '',
      unit: '',
      baseHours: 160,
      hiredDate: formatDateRU(new Date()).split('.').reverse().join('-'),
    });
    setShowAddPerson(false);
  };

  const handleStaffChange = ({ leavingFullName = null, changeDate = null }) => {
    if (leavingFullName && changeDate) {
      setStaffList(curr =>
        curr.map(s =>
          s.full === leavingFullName
            ? { ...s, fired: true, firedDate: changeDate }
            : s
        )
      );
    }
  };

  // Загрузка сотрудников из XLSX
  const onStaffLoad = e => {
    const f = e.target.files[0];
    if (!f) return;

    const r = new FileReader();
    r.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const all = [];
      wb.SheetNames.forEach(sheet => {
        const arr = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
          header: 1,
          blankrows: false,
        });
        if (!arr.length) return;

        const [headerRow, ...dataRows] = arr;
        const colIndex = {
          rank: headerRow.findIndex(h =>
            String(h).toLowerCase().includes('зван')
          ),
          name: headerRow.findIndex(h =>
            String(h).toLowerCase().includes('фио')
          ),
          base: headerRow.findIndex(h =>
            String(h).toLowerCase().includes('баз')
          ),
          current: headerRow.findIndex(h =>
            String(h).toLowerCase().includes('текущ')
          ),
        };

        dataRows.forEach(row => {
          const rank = row[colIndex.rank];
          const name = row[colIndex.name];
          const base = row[colIndex.base];
          const current = row[colIndex.current];
          if (!rank || !name) return;

          const full = `${rank} ${name}`.trim();
          const baseHours = !isNaN(+current)
            ? +current
            : !isNaN(+base)
            ? +base
            : 0;
          all.push({
            unit: sheet,
            rank,
            name,
            full,
            baseHours,
            fired: false,
            firedDate: null,
            hiredDate: null,
          });
        });
      });

      setStaffList(all);
      resetUnits();
    };
    r.readAsBinaryString(f);
  };

  // Загрузка существующего графика подразделений из XLSX
  const onLoadUnitSchedule = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
      });
      setUnitSchedule(arr);

      const days = arr.length - 1;
      const peopleCounts = {};
      Object.keys(staffMap.current).forEach(u => {
        peopleCounts[u] = staffList.filter(
          s => s.unit === u && isActiveOnDate(s, new Date(startDate))
        ).length;
      });
      const totalDuties = days * posts.length;
      setUnitStats(calculateUnitDutyAllocation(peopleCounts, totalDuties));
    };
    r.readAsBinaryString(f);
  };

  function calculateUnitDutyAllocation(peopleCounts, totalDuties) {
    const totalPeople = Object.values(peopleCounts).reduce((a, b) => a + b, 0);
    return Object.entries(peopleCounts).map(([unit, count]) => {
      const percent = totalPeople ? (count / totalPeople) * 100 : 0;
      const duties = totalPeople ? (count / totalPeople) * totalDuties : 0;
      return { unit, percent, duties };
    });
  }

  const onGenerateUnits = () => {
    const units = Object.keys(staffMap.current);
    if (!units.length) {
      return alert('Сначала загрузите сотрудников');
    }

    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) {
      return alert('Дата окончания раньше начала');
    }

    const days = Math.round((e - s) / 86400000) + 1;
    const header = ['Дата', ...posts];
    const sched = [header];

    const peopleCounts = {};
    units.forEach(u => {
      peopleCounts[u] = staffList.filter(
        s => s.unit === u && isActiveOnDate(s, new Date(startDate))
      ).length;
    });

    const totalDuties = days * posts.length;
    const stat = calculateUnitDutyAllocation(peopleCounts, totalDuties);

    const unitLimits = {};
    stat.forEach(s => {
      unitLimits[s.unit] = Math.round(s.duties);
    });

    const unitUsed = {};
    units.forEach(u => {
      unitUsed[u] = 0;
    });

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const d = new Date(s.getTime() + dayIndex * 86400000);
      const ds = formatDateRU(d); // "DD.MM.YYYY"
      const row = [ds];

      posts.forEach((post, postIndex) => {
        const candidates = (allowedPerPost[post] || []).filter(
          u =>
            staffMap.current[u]?.length &&
            staffMap.current[u].some(name => {
              const staff = staffList.find(st => st.full === name);
              return staff && isActiveOnDate(staff, d);
            })
        );
        const totalAssigned =
          Object.values(unitUsed).reduce((a, b) => a + b, 0) || 1;

        const scored = candidates.map(u => {
          const targetShare = (unitLimits[u] || 0) / totalDuties;
          const actualShare = (unitUsed[u] || 0) / totalAssigned;
          return { unit: u, diff: targetShare - actualShare };
        });

        scored.sort((a, b) => b.diff - a.diff);

        const pick = scored[0]?.unit || '—';
        if (pick !== '—') {
          unitUsed[pick] = (unitUsed[pick] || 0) + 1;
        }
        row.push(pick);
      });

      sched.push(row);
    }
    setUnitSchedule(sched);
    setUnitStats(stat);
  };

  const resetUnits = () => {
    setUnitSchedule([]);
    setUnitStats([]);
    setRawData([]);
    setFirstCalc(false);
  };

  const onSaveUnits = () => exportScheduleToExcel(unitSchedule);

  // Итоговый график и учёт отпусков/больничных
  const onGenerateSchedule = () => {
    if (!unitSchedule || unitSchedule.length < 2) {
      return alert('Сначала создайте подразделения');
    }

    const prevHours = JSON.parse(localStorage.getItem('prevHours') || '{}');
    if (!sessionStorage.getItem('originalPrevHours')) {
      sessionStorage.setItem('originalPrevHours', JSON.stringify(prevHours));
    }
    const originalPrevHours = JSON.parse(
      sessionStorage.getItem('originalPrevHours') || '{}'
    );

    const hoursCount = {};
    staffList.forEach(s => {
      const carry = originalPrevHours[s.full] ?? 0;
      const base = s.baseHours ?? 160;
      hoursCount[s.full] = carry - base;
    });

    const bannedDatesByPerson = {};
    leaveRanges.forEach(r => {
      const name = r.name;
      const start = new Date(r.start);
      const end = new Date(r.end);
      const bufferEnd = new Date(end);
      bufferEnd.setDate(bufferEnd.getDate() + 1);

      let d = new Date(start);
      while (d <= bufferEnd) {
        const key = formatDateRU(d);
        if (!bannedDatesByPerson[name]) bannedDatesByPerson[name] = new Set();
        bannedDatesByPerson[name].add(key);
        d.setDate(d.getDate() + 1);
      }
    });

    const header = ['Дата', ...posts];
    const result = [];
    const personDutyHistory = {};

    const canServeToday = (s, currentDateISO, dutyName, hours) => {
      if (!s) return false;
      if (!isActiveOnDate(s, new Date(currentDateISO))) return false;
      const history = personDutyHistory[s.full] || [];

      for (let i = 1; i <= 2; i++) {
        const prevDate = new Date(currentDateISO.split('.').reverse().join('-'));
        prevDate.setDate(prevDate.getDate() - i);
        const prevISO = formatDateRU(prevDate);
        if (bannedDatesByPerson[s.full]?.has(prevISO)) {
          return false;
        }
      }

      if (history.length > 0) {
        const last = history[history.length - 1];
        const diff =
          (new Date(currentDateISO.split('.').reverse().join('-')) -
            new Date(last.date.split('.').reverse().join('-'))) /
          (1000 * 60 * 60 * 24);

        if (last.hours >= 24 && diff < 4) return false;

        if (history.length >= 2) {
          const last2 = history[history.length - 2];
          const diff2 =
            (new Date(currentDateISO.split('.').reverse().join('-')) -
              new Date(last2.date.split('.').reverse().join('-'))) /
            (1000 * 60 * 60 * 24);

          if (last.hours === 12 && last2.hours === 12 && diff2 < 2) {
            const between =
              (new Date(last.date.split('.').reverse().join('-')) -
                new Date(last2.date.split('.').reverse().join('-'))) /
              (1000 * 60 * 60 * 24);
            if (between === 1 && diff < 2) return false;
          }
        }
      }

      return true;
    };

    unitSchedule.slice(1).forEach(row => {
      const date = row[0]; // "DD.MM.YYYY"
      const [dd, mm, yy] = date.split('.');
      const dutyDate = new Date(`${yy}-${mm}-${dd}`);
      const dutyKey = formatDateRU(dutyDate);

      const out = [date];
      row.slice(1).forEach((unit, idx) => {
        const post = posts[idx];
        const dt = dutyTypes.find(d => d.name === post);
        const addH = dt?.hoursCounted || 0;

        let list = staffMap.current[unit]
          ?.map(name => staffList.find(s => s.full === name))
          .filter(s => {
            if (!isActiveOnDate(s, new Date(dutyKey.split('.').reverse().join('-')))) return false;
            if (bannedDatesByPerson[s.full]?.has(dutyKey)) return false;
            if (!canServeToday(s, dutyKey, post, addH)) return false;
            return true;
          }) || [];

        if (list.length === 0) {
          list = staffMap.current[unit]
            ?.map(name => staffList.find(s => s.full === name))
            .filter(s => {
              if (!isActiveOnDate(s, dutyDate)) return false;
              if (bannedDatesByPerson[s.full]?.has(dutyKey)) return false;
              return true;
            }) || [];
        }

        let pick = '—',
          minH = Infinity;
        list.forEach(s => {
          if (hoursCount[s.full] < minH) {
            minH = hoursCount[s.full];
            pick = s.full;
          }
        });

        if (pick !== '—') {
          hoursCount[pick] += addH;
          if (!personDutyHistory[pick]) personDutyHistory[pick] = [];
          personDutyHistory[pick].push({ date: dutyKey, hours: addH });

          const s = staffList.find(st => st.full === pick);
          const display = s ? `${s.rank} ${s.name} (${s.unit})` : pick;
          out.push(display);
        } else {
          out.push('—');
        }
      });

      result.push(out);
    });

    const newRaw = [header, ...result];
    setRawData(newRaw);

    // Месяцы в формате "01.MM.YYYY"
    const monthsArray = Array.from(
      new Set(
        newRaw.slice(1).map(row => {
          const [d, m, y] = row[0].split('.');
          return `01.${m.padStart(2, '0')}.${y}`;
        })
      )
    ).sort((a, b) => {
      const [da, ma, ya] = a.split('.');
      const [db, mb, yb] = b.split('.');
      return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
    });

    // Подготовка monthMap (ключ "01.MM.YYYY" → часы)
    const monthMap = {};
    staffList.forEach(s => {
      monthMap[s.full] = {};
      monthsArray.forEach(m => {
        monthMap[s.full][m] = 0;
      });
    });

    newRaw.slice(1).forEach(row => {
      const [date, ...cells] = row;
      const [d, m, y] = date.split('.');
      const key = `01.${m.padStart(2, '0')}.${y}`;
      const dutyDate = new Date(`${y}-${m}-${d}`);

      cells.forEach((displayName, idx) => {
        if (!displayName || displayName === '—') return;
        const s = staffList.find(
          st => `${st.rank} ${st.name} (${st.unit})` === displayName
        );
        if (!s) return;
        if (!isActiveOnDate(s, dutyDate)) return;
        const post = newRaw[0][idx + 1];
        const dt = dutyTypes.find(d => d.name === post);
        const h = dt?.hoursCounted || 0;
        monthMap[s.full][key] += h;
      });
    });

    const monthSummary = staffList.map(s => {
      const monthly = {};
      let total = 0;

      monthsArray.forEach(monthKey => {
        // monthKey = "01.MM.YYYY"
        const [ddm, mm, yy] = monthKey.split('.');
        const year = +yy,
          month = +mm;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        let hiredDate = null;
        if (s.hiredDate) {
          hiredDate = s.hiredDate.includes('.')
            ? parseDDMMYYYY(s.hiredDate)
            : new Date(s.hiredDate);
        }
        let firedDate = null;
        if (s.firedDate) {
          firedDate = s.firedDate.includes('.')
            ? parseDDMMYYYY(s.firedDate)
            : new Date(s.firedDate);
        }

        if (hiredDate && monthEnd < hiredDate) {
          monthly[monthKey] = '-';
          return;
        }
        if (firedDate && monthStart > firedDate) {
          monthly[monthKey] = '-';
          return;
        }

        let effectiveStart = monthStart;
        let effectiveEnd = monthEnd;
        if (hiredDate && hiredDate > monthStart && hiredDate <= monthEnd) {
          effectiveStart = hiredDate;
        }
        if (firedDate && firedDate >= monthStart && firedDate <= monthEnd) {
          const lastWork = new Date(firedDate);
          lastWork.setDate(lastWork.getDate() - 1);
          effectiveEnd = lastWork;
        }
        if (effectiveEnd < effectiveStart) {
          monthly[monthKey] = '-';
          return;
        }

        const actualDays =
          Math.round((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

        let leaveDays = 0;
        leaveRanges.forEach(r => {
          if (r.name !== s.full) return;
          const leaveStart = new Date(r.start);
          const leaveEnd = new Date(r.end);
          const overlapStart =
            leaveStart > effectiveStart ? leaveStart : effectiveStart;
          const overlapEnd = leaveEnd < effectiveEnd ? leaveEnd : effectiveEnd;
          if (overlapStart <= overlapEnd) {
            const diff =
              Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) +
              1;
            leaveDays += diff;
          }
        });

        const normForMonth =
          monthNorms && typeof monthNorms[monthKey] === 'number'
            ? monthNorms[monthKey]
            : 160;
        const expected =
          actualDays > 0
            ? Math.round((normForMonth * (actualDays - leaveDays)) / daysInMonth)
            : 0;

        const worked = monthMap[s.full]?.[monthKey] ?? 0;
        const delta = Math.round(worked - expected);
        monthly[monthKey] = delta;
        total += delta;
      });

      return {
        name: s.full,
        department: s.unit,
        monthly,
        total,
      };
    });

    setMonthlyStats(monthSummary);
    sessionStorage.setItem('rawData', JSON.stringify(newRaw));
    sessionStorage.setItem('monthlyStats', JSON.stringify(monthSummary));
    sessionStorage.setItem(
      'prevHours',
      JSON.stringify(
        Object.fromEntries(monthSummary.map(s => [s.name, s.total]))
      )
    );
    localStorage.setItem(
      'prevHours',
      JSON.stringify(
        Object.fromEntries(monthSummary.map(s => [s.name, s.total]))
      )
    );
  };

  const handleExportWithHours = () => {
    if (!staffList.length || !rawData.length || !dutyTypes.length) {
      alert('Не хватает данных для экспорта');
      return;
    }
    exportStaffWithHours(staffList, rawData, dutyTypes);
  };

  const onCalculateSchedule = () => {
    if (!scheduleHotRef.current) return;
    const tbl = [rawData[0], ...scheduleHotRef.current.hotInstance.getData()];
    if (!firstCalc) {
      setFirstCalc(true);
      scheduleHotRef.current.hotInstance.render();
      return;
    }
    setRawData(tbl);
    setFirstCalc(false);
  };

  const saveHolidays = () => {
    const arr = editedHolidays
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\d{1,2}\.\d{1,2}$/.test(l));
    setHolidayList(arr);
    setShowHolidaysEditor(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          background: '#2a2a2a',
          color: '#fff',
          padding: 16,
          fontSize: 24,
          fontWeight: 'bold',
        }}
      >
        ДежурПро
      </header>

      <nav style={{ display: 'flex', gap: 8, background: '#333', padding: 8 }}>
        {['units', 'schedule', 'duties', 'statistics', 'export'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: 8,
              border: 'none',
              cursor: 'pointer',
              background: tab === t ? '#555' : '#444',
              color: '#fff',
            }}
          >
            {t === 'units'
              ? 'Подразделения'
              : t === 'schedule'
              ? 'График'
              : t === 'duties'
              ? 'Дежурства'
              : t === 'statistics'
              ? 'Статистика'
              : 'Экспорт'}
          </button>
        ))}
      </nav>

      <main
        style={{
          flex: 1,
          padding: 16,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {tab === 'units' && (
          <>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <select
                value={removePerson}
                onChange={e => setRemovePerson(e.target.value)}
                style={{ minWidth: 200 }}
              >
                <option value="">Выберите сотрудника для удаления</option>
                {staffList.map(s => (
                  <option key={s.full} value={s.full}>
                    {s.rank} {s.name} ({s.unit})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={removeDate}
                onChange={e => setRemoveDate(e.target.value)}
              />
              <button
                onClick={() => {
                  if (!removePerson || !removeDate)
                    return alert('Выберите сотрудника и дату!');
                  const [y, m, d] = removeDate.split('-');
                  const changeDate = `${d}.${m}.${y}`;
                  handleStaffChange({
                    leavingFullName: removePerson,
                    changeDate,
                  });
                }}
              >
                Уволить сотрудника с даты
              </button>
              <button onClick={() => setShowAddPerson(p => !p)}>
                Новый сотрудник
              </button>
            </div>

            {showAddPerson && (
              <div
                style={{
                  margin: '8px 0',
                  padding: 8,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                }}
              >
                <h4>Добавить нового сотрудника</h4>
                <input
                  placeholder="Звание"
                  value={newPerson.rank}
                  onChange={e =>
                    setNewPerson(p => ({ ...p, rank: e.target.value }))
                  }
                />
                <input
                  placeholder="Имя"
                  value={newPerson.name}
                  onChange={e =>
                    setNewPerson(p => ({ ...p, name: e.target.value }))
                  }
                />
                <input
                  placeholder="Подразделение"
                  value={newPerson.unit}
                  onChange={e =>
                    setNewPerson(p => ({ ...p, unit: e.target.value }))
                  }
                />
                <input
                  type="number"
                  placeholder="Базовые часы"
                  value={newPerson.baseHours}
                  onChange={e =>
                    setNewPerson(p => ({ ...p, baseHours: +e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={newPerson.hiredDate}
                  onChange={e =>
                    setNewPerson(p => ({ ...p, hiredDate: e.target.value }))
                  }
                />
                <button onClick={handleAddNewPerson}>Добавить</button>
                <button onClick={() => setShowAddPerson(false)}>Отмена</button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <style>
                {`
                  .button {
                    padding: 6px 12px;
                    background: #444;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                  }

                  .file-input-label {
                    padding: 6px 12px;
                    background: #444;
                    color: #fff;
                    border-radius: 4px;
                    cursor: pointer;
                  }

                  .file-input {
                    display: none;
                  }
                `}
              </style>

              <label className="file-input-label">
                Загрузить сотрудников
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={onStaffLoad}
                  className="file-input"
                />
              </label>

              <label className="file-input-label">
                Загрузить график
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={onLoadUnitSchedule}
                  className="file-input"
                />
              </label>

              <button
                className="button"
                onClick={() => exportStaffTemplate(Object.keys(staffMap.current))}
              >
                Шаблон сотрудников
              </button>

              <button className="button" onClick={onGenerateUnits}>
                Сформировать график подразделений
              </button>

              <button className="button" onClick={onSaveUnits}>
                Сохранить XLSX
              </button>

              <button
                className="button"
                onClick={() => setShowHolidaysEditor(!showHolidaysEditor)}
              >
                Праздники
              </button>

              <label style={{ color: '#fff' }}>
                С:
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ marginLeft: 4 }}
                />
              </label>

              <label style={{ color: '#fff' }}>
                По:
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ marginLeft: 4 }}
                />
              </label>
            </div>

            {showHolidaysEditor && (
              <div
                style={{
                  border: '1px solid #888',
                  padding: 8,
                  marginBottom: 16,
                }}
              >
                <h4>Редактирование праздников</h4>
                <textarea
                  rows={5}
                  style={{ width: '100%', fontFamily: 'monospace' }}
                  value={editedHolidays}
                  onChange={e => setEditedHolidays(e.target.value)}
                />
                <div style={{ marginTop: 8 }}>
                  <button onClick={saveHolidays}>Сохранить</button>{' '}
                  <button onClick={() => setShowHolidaysEditor(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 16,
                flex: 1,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  flex: 1,
                  border: '1px solid #ccc',
                  overflow: 'auto',
                }}
              >
                <SchedulerTable
                  byUnit
                  data={unitSchedule}
                  tableRef={unitHotRef}
                  employeesMap={staffMap.current}
                  allowedUnits={Object.keys(staffMap.current)}
                  holidayList={holidayList}
                  onDataChange={setUnitSchedule}
                />
              </div>
              <PostManager
                posts={posts}
                units={Object.keys(staffMap.current)}
                allowedPerPost={allowedPerPost}
                onAllowedChange={setAllowedPerPost}
                onPostsChange={setPosts}
              />
            </div>

            <UnitStats
              staffMap={staffMap.current}
              unitSchedule={unitSchedule}
            />
          </>
        )}

        {tab === 'schedule' && (
          <>
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  color: '#fff',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={onCalculateSchedule}
              >
                Рассчитать
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  color: '#fff',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={onGenerateSchedule}
              >
                Распределить людей
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  color: '#fff',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={onSaveUnits}
              >
                Сохранить XLSX
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  color: '#fff',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={handleExportWithHours}
              >
                Экспорт сотрудников с часами
              </button>
            </div>

            <LeaveManager
              leaveRanges={leaveRanges}
              staffList={staffList}
              onAdd={entryOrArray => {
                if (Array.isArray(entryOrArray)) {
                  setLeaveRanges(entryOrArray);
                } else {
                  setLeaveRanges(prev => [...prev, entryOrArray]);
                }
              }}
            />

            <div style={{ display: 'flex', gap: 16, height: 600 }}>
              <div
                style={{
                  flex: 4,
                  border: '1px solid #ccc',
                  overflow: 'auto',
                }}
              >
                <SchedulerTable
                  data={rawData}
                  tableRef={scheduleHotRef}
                  employeesMap={staffMap.current}
                  unitSchedule={unitSchedule}
                  leaveRanges={leaveRanges}
                  holidayList={holidayList}
                  highlightViolations={firstCalc}
                />
              </div>
              <div
                style={{
                  flex: 2,
                  border: '1px solid #ccc',
                  overflow: 'auto',
                  width: 150,
                }}
              >
                <h4>Наработка</h4>
                <table>
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th>Часы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s, i) => {
                      const ms = monthlyStats.find(st => st.name === s.full);
                      const fired = s.fired;
                      const firedDate = s.firedDate;
                      return (
                        <tr
                          key={i}
                          style={
                            fired
                              ? { color: '#888', fontStyle: 'italic' }
                              : {}
                          }
                        >
                          <td>
                            {s.full}
                            {fired && firedDate
                              ? ` (уволен с ${firedDate})`
                              : ''}
                          </td>
                          <td>
                            {ms ? (ms.total >= 0 ? '+' : '') + ms.total : '+0'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'duties' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              type="file"
              accept=".xlsx"
              onChange={e => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = ev => {
                  const wb = XLSX.read(ev.target.result, {
                    type: 'binary',
                  });
                  const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
                    header: 1,
                    blankrows: false,
                  });
                  const list = arr.slice(1).map(([name, hours, cycle]) => ({
                    name,
                    hoursCounted: +hours || 0,
                    cycle: String(cycle || '').split(',').map(n => +n || 0),
                  }));
                  setDutyTypes(list);
                };
                r.readAsBinaryString(f);
              }}
            />
            <DutyTypeManager types={dutyTypes} onSave={setDutyTypes} />
          </div>
        )}

        {tab === 'export' && (
          <ScheduleExporter fullSchedule={rawData} />
        )}

        {tab === 'statistics' && (
          <div>
            <button
              style={{
                padding: '6px 12px',
                background: '#444',
                color: '#fff',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 12,
              }}
              onClick={() => setShowMonthNorm(true)}
            >
              Нормы по месяцам
            </button>

            <MonthlyStatsTable
              stats={monthlyStats}
              staffList={staffList}
              monthlyNorms={monthNorms}
            />
          </div>
        )}
      </main>

      <MonthNormModal
        open={showMonthNorm}
        months={rawMonths}
        normByMonth={monthNorms}
        onSave={updatedNorms => {
          setMonthNorms(updatedNorms);
          setShowMonthNorm(false);
          onGenerateSchedule();
        }}
        onClose={() => setShowMonthNorm(false)}
      />
    </div>
  );
}
