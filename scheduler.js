import * as XLSX from 'xlsx';

const OFFICER_RANKS = [
  "Мл. лейтенант",
  "Лейтенант",
  "Старший лейтенант",
  "Капитан",
  "Майор",
  "Подполковник",
  "Полковник"
];

function parseDMY(str) {
  const [d, m, y] = str.split('.').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(d1, d2) {
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function findReplacement(
  shift,
  hoursCount,
  lastShifts,
  staffList,
  leaveRanges,
  holidayList,
  dutyTypes,
  assignedToday = new Set(),
  holidayAssignments = {}
) {
  const { date, name: origName, role } = shift;
  const [dStr, mStr] = date.split('.');
  const isHoliday = holidayList.includes(`${mStr}.${dStr}`);
  const dt = dutyTypes.find(dt => dt.name === role);
  const isChiefRole = role === 'Дежурный';

  const candidates = staffList
    .map(s => s.name)
    .filter(name => {
      if (name === origName) return false;
      if (assignedToday.has(name)) return false;
      if (isHoliday && holidayAssignments[`${mStr}.${dStr}`]?.has(name)) return false;
      if (leaveRanges.some(r =>
        r.name === name &&
        r.start <= date.split('.').reverse().join('-') &&
        date.split('.').reverse().join('-') <= r.end
      )) return false;
      if (isChiefRole) {
        const rank = staffList.find(s => s.name === name)?.rank;
        if (!OFFICER_RANKS.includes(rank)) return false;
      }
      const last = lastShifts[name];
      if (last) {
        const days = diffDays(parseDMY(last.date), parseDMY(date));
        const rank = staffList.find(s => s.name === name)?.rank;
        const minInterval = OFFICER_RANKS.includes(rank) ? 1 : (dt?.cycle?.[0] || 1);
        if (days < minInterval) return false;
      }
      return true;
    });

  candidates.sort((a, b) => (hoursCount[a] || 0) - (hoursCount[b] || 0));
  return candidates[0] || staffList.find(s => s.name !== origName)?.name || staffList[0].name;
}

export function autoFillSchedule(
  rawTable,
  staffList,
  dutyTypes,
  leaveRanges,
  holidayList
) {
  const data = rawTable.map(r => [...r]);
  const shifts = [];
  const assignedByDate = {};
  const holidayAssignments = {};

  for (let i = 1; i < data.length; i++) {
    const date = data[i][0];
    for (let c = 1; c < data[i].length; c++) {
      shifts.push({
        row: i, col: c, date,
        name: data[i][c] || null,
        role: data[0][c]
      });
    }
  }

  shifts.sort((a, b) => parseDMY(a.date) - parseDMY(b.date));

  const lastShifts = {};
  const hoursCount = {};

  shifts.forEach(shift => {
    const { row, col, date, role } = shift;
    let name = data[row][col];
    const [dStr, mStr] = date.split('.');
    const key = `${mStr}.${dStr}`;
    const isHoliday = holidayList.includes(key);
    const dt = dutyTypes.find(dt => dt.name === role);
    const addHours = dt?.hoursCounted || 12;

    assignedByDate[date] ||= new Set();
    if (isHoliday) holidayAssignments[key] ||= new Set();

    if (
      !name ||
      name === 'Б' ||
      name === 'О' ||
      isHoliday ||
      leaveRanges.some(r =>
        r.name === name &&
        r.start <= date.split('.').reverse().join('-') &&
        date.split('.').reverse().join('-') <= r.end
      )
    ) {
      name = findReplacement(
        shift,
        hoursCount,
        lastShifts,
        staffList,
        leaveRanges,
        holidayList,
        dutyTypes,
        assignedByDate[date],
        holidayAssignments
      );
      data[row][col] = name;
    }

    assignedByDate[date].add(name);
    if (isHoliday) holidayAssignments[key].add(name);

    hoursCount[name] = (hoursCount[name] || 0) + addHours;
    lastShifts[name] = { date };
  });

  return data;
}

export function calculateDuty(
  rawTable,
  leaveRanges,
  staffList,
  dutyTypes,
  holidayList,
  opts = {}
) {
  const table = rawTable.map(r => [...r]);
  const summaryMap = {};
  const history = [];
  const lastShifts = {};

  const shifts = [];
  for (let i = 1; i < table.length; i++) {
    const date = table[i][0];
    for (let c = 1; c < table[i].length; c++) {
      shifts.push({ row: i, col: c, date, name: table[i][c], role: table[0][c] });
    }
  }

  shifts.sort((a, b) => parseDMY(a.date) - parseDMY(b.date));

  shifts.forEach(shift => {
    const { row, col, date, role } = shift;
    let name = table[row][col];
    const [dStr, mStr] = date.split('.');
    const key = `${mStr}.${dStr}`;
    const isHoliday = holidayList.includes(key);
    const dt = dutyTypes.find(dt => dt.name === role);
    const addHours = dt?.hoursCounted || 12;

    let replace = false;
    let reason = '';

    if (
      name === 'Б' ||
      name === 'О' ||
      isHoliday ||
      leaveRanges.some(r =>
        r.name === name &&
        r.start <= date.split('.').reverse().join('-') &&
        date.split('.').reverse().join('-') <= r.end
      )
    ) {
      replace = true;
      reason = name === 'Б' ? 'Болен' : name === 'О' ? 'Отпуск' : 'Праздник';
    } else {
      const rank = staffList.find(s => s.name === name)?.rank;
      const last = lastShifts[name];
      if (last) {
        const days = diffDays(parseDMY(last.date), parseDMY(date));
        const minInterval = OFFICER_RANKS.includes(rank) ? 1 : (dt?.cycle?.[0] || 1);
        if (days < minInterval) {
          replace = true;
          reason = `Интервал < ${minInterval}`;
        }
      }
    }

    if (replace) {
      const rep = findReplacement(
        shift,
        { ...summaryMap },
        lastShifts,
        staffList,
        leaveRanges,
        holidayList,
        dutyTypes
      );
      history.push({ date, missing: table[row][col], replacement: rep, role, reason });
      name = rep;
      table[row][col] = name;
    }

    summaryMap[name] = (summaryMap[name] || 0) + addHours;
    lastShifts[name] = { date };
  });

  const summary = Object.entries(summaryMap).map(([name, hours]) => ({
    name,
    rank: staffList.find(s => s.name === name)?.rank,
    hours
  }));

  const result = { summary, history, updatedTable: table };
  if (opts.returnInternals) {
    result.hoursCount = summaryMap;
    result.lastShifts = lastShifts;
  }
  return result;
}

export function generateEmptySchedule(start, end, dutyTypes) {
  const headers = ['Дата', ...dutyTypes.map(dt => dt.name)];
  const table = [headers];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    table.push([d.toLocaleDateString('ru-RU'), ...dutyTypes.map(() => '')]);
  }
  return table;
}

export function generateFutureSchedule(
  historyTable,
  leaveRanges,
  staffList,
  dutyTypes,
  holidayList,
  hoursCount,
  lastShifts,
  monthsAhead
) {
  let start;
  if (historyTable.length > 1) {
    const [d, m, y] = historyTable[historyTable.length - 1][0].split('.').map(Number);
    start = new Date(y, m - 1, d + 1);
  } else {
    start = new Date();
  }
  const end = new Date(start.getFullYear(), start.getMonth() + monthsAhead, start.getDate());

  const headers = ['Дата', ...dutyTypes.map(dt => dt.name)];
  const full = [headers];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    full.push([d.toLocaleDateString('ru-RU'), ...dutyTypes.map(() => '')]);
  }

  return autoFillSchedule(full, staffList, dutyTypes, leaveRanges, holidayList);
}

export function generateMonthlyWorkbooks(rawTable) {
  const list = [];
  const headers = rawTable[0];
  let currKey = '';
  let rows = [];

  for (let i = 1; i < rawTable.length; i++) {
    const [date] = rawTable[i];
    const [, m, y] = date.split('.');
    const key = `${m}.${y}`;

    if (key !== currKey) {
      if (rows.length) {
        const sheetData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!rows'] = new Array(sheetData.length).fill({ hpt: 25 });

        Object.keys(ws).forEach(k => {
          if (!k.startsWith('!')) {
            ws[k].s = {
              alignment: {
                vertical: 'center',
                horizontal: 'center',
                wrapText: true
              }
            };
          }
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, currKey);
        list.push({ wb, filename: `График_${currKey}.xlsx` });
      }

      currKey = key;
      rows = [];
    }

    rows.push(rawTable[i]);
  }

  if (rows.length) {
    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!rows'] = new Array(sheetData.length).fill({ hpt: 25 });

    Object.keys(ws).forEach(k => {
      if (!k.startsWith('!')) {
        ws[k].s = {
          alignment: {
            vertical: 'center',
            horizontal: 'center',
            wrapText: true
          }
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currKey);
    list.push({ wb, filename: `График_${currKey}.xlsx` });
  }

  return list;
}

export function generateOutputWorkbook(rawTable, summary, history) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rawTable), 'График');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      summary.map(r => ({
        'ФИО': r.name,
        'Звание': r.rank,
        'Часы дежурств': r.hours
      }))
    ),
    'Итоги'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(history), 'История');
  return wb;
}

export function generateDepartmentSchedule(
  historyTable,
  allowedUnits,
  holidayList,
  monthsAhead
) {
  const dutyTypes = allowedUnits.map(name => ({ name, hoursCounted: 0, cycle: [1] }));
  const staffList = allowedUnits.map(name => ({ name, rank: '' }));
  return generateFutureSchedule(
    historyTable,
    [], [], dutyTypes,
    holidayList,
    {}, {}, monthsAhead
  );
}

export function generateDepartmentWorkbook(rawTable) {
  return generateMonthlyWorkbooks(rawTable);
}
