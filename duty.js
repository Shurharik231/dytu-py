(() => {
  // Переключение табов
  document.querySelectorAll('#tabs li').forEach(li => {
    li.addEventListener('click', () => {
      document.querySelectorAll('#tabs li').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      document.getElementById(li.dataset.tab).classList.add('active');
    });
  });

  let deptsData = null, schedData = null;

  // Загрузка списка подразделений
  document.getElementById('file-depts').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      deptsData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      checkReady();
    };
    reader.readAsBinaryString(f);
  });

  // Загрузка графика дежурств
  document.getElementById('file-schedule').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      schedData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      checkReady();
    };
    reader.readAsBinaryString(f);
  });

  // Включаем кнопку, когда оба файла загружены
  function checkReady() {
    document.getElementById('btn-generate').disabled = !(deptsData && schedData);
  }

  // Генерация итогового графика
  document.getElementById('btn-generate').addEventListener('click', () => {
    const headers = schedData[0].slice(1); // даты из первой строки, начиная со второго столбца
    const resultTable = [];
    resultTable.push(['Дата', 'Подразделение', 'Сотрудник']);

    // Собираем сотрудников по подразделениям
    const deptMap = {};
    deptsData.slice(1).forEach(row => {
      const [dept, person] = row;
      if (!deptMap[dept]) deptMap[dept] = [];
      deptMap[dept].push(person);
    });

    // Проходим по строкам графика
    schedData.slice(1).forEach(row => {
      const [deptName, ...marks] = row;
      marks.forEach((mark, idx) => {
        if (mark) {
          const date = headers[idx];
          const people = deptMap[deptName] || ['—'];
          const person = people[Math.floor(Math.random() * people.length)];
          resultTable.push([date, deptName, person]);
        }
      });
    });

    renderTable(resultTable);
  });

  // Рендер таблицы в контейнер #result
  function renderTable(data) {
    const container = document.getElementById('result');
    container.innerHTML = '';
    const table = document.createElement('table');
    table.classList.add('duty-table');
    data.forEach((row, i) => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const cellEl = document.createElement(i === 0 ? 'th' : 'td');
        cellEl.textContent = cell;
        tr.appendChild(cellEl);
      });
      table.appendChild(tr);
    });
    container.appendChild(table);
  }
})();
