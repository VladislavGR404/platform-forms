const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при подключении к базе данных SQLite:', err.message);
  } else {
    console.log('Успешное подключение к локальной базе данных SQLite.');
    initDb();
  }
});

// Инициализация схемы базы данных
function initDb() {
  db.serialize(() => {
    // Включение поддержки внешних ключей для каскадного удаления
    db.run("PRAGMA foreign_keys = ON;");

    // Таблица форм: fields хранит JSON-описание полей, description — Markdown-описание
    db.run(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        fields TEXT NOT NULL, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица ответов: answers хранит JSON с ответами по полям формы
    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id TEXT NOT NULL,
        answers TEXT NOT NULL, 
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
      )
    `);

    // Таблица аналитики брошенных попыток: фиксирует поле, на котором пользователь прервал заполнение
    db.run(`
      CREATE TABLE IF NOT EXISTS dropoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
      )
    `);
  });
}

module.exports = db;