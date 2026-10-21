const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'database.sqlite');

// Удаляем старый файл базы данных, чтобы начать с чистого листа
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Старый файл database.sqlite удален.');
}

// Подключаемся к базе данных (она создастся автоматически)
const db = new sqlite3.Database(dbPath);

// Используем serialize, чтобы запросы выполнялись строго по очереди
db.serialize(() => {
  // 1. Инициализация структуры таблиц (если их нет)
  db.run(`CREATE TABLE IF NOT EXISTS forms (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, fields TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id TEXT NOT NULL, answers TEXT NOT NULL, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS dropoffs (id INTEGER PRIMARY KEY AUTOINCREMENT, form_id TEXT NOT NULL, field_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE)`);

  console.log('Структура таблиц готова.');

  // ==========================================
  // 2. Генерация тестовых данных для Формы 1
  // ==========================================
  const form1Id = 'form-frontend-2026';
  const fields1 = JSON.stringify([
    { id: 'f1_name', label: 'ФИО кандидата', type: 'text', required: true, min: null, max: null },
    { id: 'f1_email', label: 'Электронная почта (Email)', type: 'email', required: true, min: null, max: null },
    { id: 'f1_github', label: 'Ссылка на GitHub / Портфолио', type: 'text', required: true, min: null, max: null },
    { id: 'f1_exp', label: 'Опыт коммерческой разработки (лет)', type: 'number', required: false, min: 0, max: 15 },
    { id: 'f1_resume', label: 'Резюме (PDF / DOCX)', type: 'file', required: true, allowedExtensions: ['.pdf', '.doc', '.docx'] },
    { id: 'f1_ready', label: 'Готовность работать от 30 часов в неделю', type: 'checkbox', required: true }
  ]);

  db.run(
    'INSERT INTO forms (id, title, description, fields) VALUES (?, ?, ?, ?)', 
    [form1Id, 'Стажировка Frontend Developer', 'Описание стажировки', fields1], 
    (err) => {
      if (err) console.error('Ошибка при создании Формы 1:', err);
      else console.log('Форма 1 создана.');
    }
  );

  // Массив тестовых ответов для Формы 1
  const subs1 = [
    { 'f1_name': 'Алексей Смирнов', 'f1_email': 'alex.smirnov@mail.ru', 'f1_github': 'https://github.com/alex', 'f1_exp': '1', 'f1_resume': '/uploads/sample1.pdf', 'f1_ready': 'Да' },
    { 'f1_name': 'Елена Васильева', 'f1_email': 'elena.v@gmail.com', 'f1_github': 'https://github.com/elena', 'f1_exp': '2', 'f1_resume': '/uploads/sample2.docx', 'f1_ready': 'Да' },
    { 'f1_name': 'Дмитрий Ковалев', 'f1_email': 'dmitry.dev@yandex.ru', 'f1_github': 'https://github.com/dmitry', 'f1_exp': '0', 'f1_resume': '/uploads/sample3.pdf', 'f1_ready': 'Да' },
    { 'f1_name': 'Ольга Петрова', 'f1_email': 'olga.petrova@bk.ru', 'f1_github': 'https://github.com/olga', 'f1_exp': '3', 'f1_resume': '/uploads/sample4.pdf', 'f1_ready': 'Да' },
    { 'f1_name': 'Максим Иванов', 'f1_email': 'max.ivanov@gmail.com', 'f1_github': 'https://github.com/max', 'f1_exp': '1', 'f1_resume': '/uploads/sample5.docx', 'f1_ready': 'Да' }
  ];

  // Сохраняем ответы
  subs1.forEach((ans, i) => {
    db.run('INSERT INTO submissions (form_id, answers) VALUES (?, ?)', [form1Id, JSON.stringify(ans)], (err) => {
      if (err) console.error('Ошибка при добавлении ответа для Формы 1:', err);
      else if (i === subs1.length - 1) console.log('5 ответов для Формы 1 добавлены.');
    });
  });

  // Добавляем статистику отвалов (drop-offs)
  ['f1_github', 'f1_github', 'f1_resume', 'f1_github', 'f1_ready'].forEach(fId => {
    db.run('INSERT INTO dropoffs (form_id, field_id) VALUES (?, ?)', [form1Id, fId]);
  });


  // ==========================================
  // 3. Генерация тестовых данных для Формы 2
  // ==========================================
  const form2Id = 'form-design-2026';
  const fields2 = JSON.stringify([
    { id: 'f2_name', label: 'Имя и Фамилия', type: 'text', required: true, min: null, max: null },
    { id: 'f2_email', label: 'Контактный Email', type: 'email', required: true, min: null, max: null },
    { id: 'f2_behance', label: 'Ссылка на портфолио (Behance / Dribbble)', type: 'text', required: true, min: null, max: null },
    { id: 'f2_tool', label: 'Основной инструмент проектирования', type: 'text', required: true, min: null, max: null },
    { id: 'f2_motivation', label: 'Почему вам интересна эта сфера?', type: 'textarea', required: false, min: null, max: null }
  ]);

  db.run(
    'INSERT INTO forms (id, title, description, fields) VALUES (?, ?, ?, ?)', 
    [form2Id, 'Летняя школа UI/UX Дизайна', 'Описание школы', fields2], 
    (err) => {
      if (err) console.error('Ошибка при создании Формы 2:', err);
      else console.log('Форма 2 создана.');
    }
  );

  // Массив тестовых ответов для Формы 2
  const subs2 = [
    { 'f2_name': 'Анна Соколова', 'f2_email': 'anna.design@gmail.com', 'f2_behance': 'https://behance.net/anna', 'f2_tool': 'Figma', 'f2_motivation': 'Хочу создавать интерфейсы.' },
    { 'f2_name': 'Сергей Морозов', 'f2_email': 'sergey.ui@yandex.ru', 'f2_behance': 'https://dribbble.com/sergey', 'f2_tool': 'Figma / Sketch', 'f2_motivation': 'Развиваться в финтехе.' },
    { 'f2_name': 'Кристина Романова', 'f2_email': 'kristina.rom@mail.ru', 'f2_behance': 'https://behance.net/kristina', 'f2_tool': 'Figma', 'f2_motivation': '' },
    { 'f2_name': 'Игорь Васильев', 'f2_email': 'igor.ux@gmail.com', 'f2_behance': 'https://behance.net/igor', 'f2_tool': 'Figma', 'f2_motivation': 'Интересен ИИ.' }
  ];

  // Сохраняем ответы
  subs2.forEach((ans, i) => {
    db.run('INSERT INTO submissions (form_id, answers) VALUES (?, ?)', [form2Id, JSON.stringify(ans)], (err) => {
      if (err) console.error('Ошибка при добавлении ответа для Формы 2:', err);
      else if (i === subs2.length - 1) console.log('4 ответа для Формы 2 добавлены.');
    });
  });

  // Добавляем статистику отвалов
  ['f2_behance', 'f2_behance', 'f2_tool'].forEach(fId => {
    db.run('INSERT INTO dropoffs (form_id, field_id) VALUES (?, ?)', [form2Id, fId]);
  });

  // Задержка перед закрытием базы, чтобы все асинхронные операции гарантированно завершились
  setTimeout(() => {
    console.log('Заполнение базы данных успешно завершено.');
    db.close();
  }, 500);
});