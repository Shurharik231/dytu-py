import * as XLSX from 'xlsx';

/**
 * Экспорт AOA-матрицы расписания в файл .xlsx
 * @param {Array<Array<any>>} schedule — AOA-матрица с данными расписания
 */
export function exportScheduleToExcel(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(schedule);
  XLSX.utils.book_append_sheet(wb, ws, 'График');
  XLSX.writeFile(wb, 'график_дежурств.xlsx');
}

/**
 * Экспорт шаблона сотрудников с начальными и текущими часами
 * по одному листу на подразделение
 * @param {string[]} units — список подразделений
 */
export function exportStaffTemplate(units = []) {
  const wb = XLSX.utils.book_new();

  // Если подразделения не переданы — создать 5 отделов по умолчанию
  if (!units.length) {
    units = Array.from({ length: 5 }, (_, i) => `${i + 1} - отдел`);
  }

  // Заголовок таблицы
  const header = [['звание', 'ФИО', 'Начальные часы', 'Текущие часы']];

  // Для каждого подразделения создаём свой лист
  units.forEach(unit => {
    // Создаём лист с одним заголовком
    const ws = XLSX.utils.aoa_to_sheet(header);
    // Добавляем лист под именем подразделения (максимум 31 символ)
    XLSX.utils.book_append_sheet(wb, ws, unit.substring(0, 31));
  });

  // Сохраняем файл
  XLSX.writeFile(wb, 'Шаблон_списка_сотрудников.xlsx');
}

/**
 * Экспорт списка сотрудников с учётом наработки часов
 * — каждый департамент на своём листе, без колонки «Подразделение»
 * @param {Array} staffList — список сотрудников [{ full, unit, rank, name, baseHours }]
 * @param {Array} rawData — итоговое расписание [ ['Дата', ...], [...], ... ]
 * @param {Array} dutyTypes — виды дежурств с часами [{ name, hoursCounted }]
 */
export function exportStaffWithHours(staffList = [], monthlyStats = []) {
  if (!Array.isArray(staffList) || !staffList.length) return;

  // Группируем сотрудников по подразделениям
  const byUnit = staffList.reduce((acc, s) => {
    acc[s.unit] = acc[s.unit] || [];
    acc[s.unit].push(s);
    return acc;
  }, {});

  const wb = XLSX.utils.book_new();

  Object.entries(byUnit).forEach(([unit, list]) => {
    // Для каждого подразделения формируем табличку
    const result = list.map(s => {
      // Ищем в monthlyStats нужного человека
      const stat = monthlyStats.find(m => m.name === s.full);
      const current = stat ? stat.total : 0;  // если нет статистики — 0

      return {
        Звание:      s.rank,
        ФИО:         s.name,
        'Базовые часы':   s.baseHours ?? 0,
        'Текущие часы':   current
      };
    });

    const ws = XLSX.utils.json_to_sheet(result, {
      header: ['Звание', 'ФИО', 'Базовые часы', 'Текущие часы']
    });
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      // Лимит 31 символ на имя листа
      unit?.substring(0, 31) || 'Без_подразделения'
    );
  });

  XLSX.writeFile(wb, 'Сотрудники_с_часами.xlsx');
}

