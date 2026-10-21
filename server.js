const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка папки для локального сохранения загруженных файлов
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeName = originalName.replace(/\s+/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

// Ограничение размера загружаемого файла — 3 МБ
const upload = multer({
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }
});

// Поддержка JSON и текстового формата для sendBeacon
app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(express.urlencoded({ extended: true }));

// Раздача статических файлов фронтенда и загруженных файлов
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Корневой маршрут перенаправляет в админ-панель
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Получение списка форм
app.get('/api/forms', (req, res) => {
  db.all("SELECT * FROM forms ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const forms = rows.map(row => ({ ...row, fields: JSON.parse(row.fields) }));
    res.json(forms);
  });
});

// Создание новой формы или обновление существующей
app.post('/api/forms', (req, res) => {
  const { id, title, description, fields } = req.body;
  if (!title || !fields) {
    return res.status(400).json({ error: 'Название и поля формы обязательны' });
  }

  const fieldsString = JSON.stringify(fields);
  const descText = description || '';

  if (id) {
    db.run(
      "UPDATE forms SET title = ?, description = ?, fields = ? WHERE id = ?",
      [title, descText, fieldsString, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, formId: id, publicUrl: `/form/${id}` });
      }
    );
  } else {
    const formId = uuidv4();
    db.run(
      "INSERT INTO forms (id, title, description, fields) VALUES (?, ?, ?, ?)",
      [formId, title, descText, fieldsString],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, formId, publicUrl: `/form/${formId}` });
      }
    );
  }
});

// Удаление формы вместе со связанными ответами и аналитикой
app.delete('/api/forms/:id', (req, res) => {
  const formId = req.params.id;

  db.run("DELETE FROM submissions WHERE form_id = ?", [formId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    db.run("DELETE FROM forms WHERE id = ?", [formId], function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Форма не найдена' });
      }
      res.json({ success: true, message: 'Форма успешно удалена' });
    });
  });
});

// Получение ответов по форме
app.get('/api/forms/:id/submissions', (req, res) => {
  const formId = req.params.id;
  
  db.all("SELECT * FROM submissions WHERE form_id = ? ORDER BY submitted_at DESC", [formId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const submissions = rows.map(row => ({
      ...row,
      answers: JSON.parse(row.answers)
    }));

    res.json(submissions);
  });
});

// Запись события отвала по конкретному полю формы
app.post('/api/form/:id/dropoff', (req, res) => {
  const formId = req.params.id;
  let bodyData = req.body;

  if (typeof bodyData === 'string') {
    try { 
      bodyData = JSON.parse(bodyData); 
    } catch (e) {
      bodyData = { fieldId: req.body }; 
    }
  }

  const fieldId = bodyData ? bodyData.fieldId : null;
  if (!fieldId) return res.status(400).end();

  db.run(
    "INSERT INTO dropoffs (form_id, field_id) VALUES (?, ?)",
    [formId, fieldId],
    (err) => {
      if (err) console.error('Ошибка записи dropoff:', err.message);
      res.status(200).end();
    }
  );
});

// Получение агрегированной аналитики по форме
app.get('/api/forms/:id/analytics', (req, res) => {
  const formId = req.params.id;

  db.get("SELECT COUNT(*) as completed_count FROM submissions WHERE form_id = ?", [formId], (err, subRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      "SELECT field_id, COUNT(*) as drop_count FROM dropoffs WHERE form_id = ? GROUP BY field_id",
      [formId],
      (err, dropRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const completedCount = subRow ? subRow.completed_count : 0;
        const dropMap = {};
        let totalDropouts = 0;

        dropRows.forEach(row => {
          dropMap[row.field_id] = row.drop_count;
          totalDropouts += row.drop_count;
        });

        res.json({
          completedCount,
          totalDropouts,
          totalViews: completedCount + totalDropouts,
          dropMap
        });
      }
    );
  });
});

// Страница админ-панели
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Страница создания формы
app.get('/admin/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create.html'));
});

// Страница редактирования формы
app.get('/admin/edit/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create.html'));
});

// Получение данных формы по идентификатору
app.get('/api/form/:id', (req, res) => {
  const formId = req.params.id;
  db.get("SELECT * FROM forms WHERE id = ?", [formId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Форма не найдена' });
    
    row.fields = JSON.parse(row.fields);
    res.json(row);
  });
});

// Публичная страница заполнения формы
app.get('/form/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

// Приём ответов с валидацией обязательных полей, лимитов символов и расширений файлов
app.post('/api/form/:id', upload.any(), (req, res, next) => {
  const formId = req.params.id;

  db.get("SELECT * FROM forms WHERE id = ?", [formId], (err, form) => {
    if (err || !form) {
      if (req.files) {
        req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
      }
      return res.status(404).json({ success: false, error: 'Форма не найдена' });
    }

    const fields = JSON.parse(form.fields);
    const answers = {};

    // Проверка обязательных полей на сервере
    for (const field of fields) {
      const uploadedFile = req.files ? req.files.find(f => f.fieldname === field.id) : null;
      const textValue = req.body[field.id];

      if (field.required) {
        if (field.type === 'file' && !uploadedFile) {
          if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
          return res.status(400).json({ success: false, error: `Поле "${field.label}" обязательно для заполнения (файл не загружен)` });
        }
        if (field.type !== 'file' && (textValue === undefined || textValue.trim() === '')) {
          if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
          return res.status(400).json({ success: false, error: `Поле "${field.label}" обязательно для заполнения` });
        }
      }

      // Постоянная проверка длины текста на сервере
      if (textValue && field.type !== 'file') {
        const strLength = String(textValue).length;
        
        if (field.type === 'textarea' && strLength > 2000) {
          if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
          return res.status(400).json({ success: false, error: `Поле "${field.label}" не должно превышать 2000 символов` });
        }
        
        if (field.type !== 'textarea' && strLength > 255) {
          if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
          return res.status(400).json({ success: false, error: `Поле "${field.label}" не должно превышать 255 символов` });
        }
      }
    }

    // Проверка допустимых расширений загруженных файлов
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fieldConfig = fields.find(f => f.id === file.fieldname);
        if (fieldConfig && fieldConfig.type === 'file') {
          const allowed = fieldConfig.allowedExtensions || ['.pdf', '.doc', '.docx'];
          const ext = path.extname(file.originalname).toLowerCase();
          if (!allowed.includes(ext)) {
            req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
            return res.status(400).json({ 
              success: false, 
              error: `Запрещенный формат файла для поля "${fieldConfig.label}". Разрешены только: ${allowed.join(', ')}` 
            });
          }
        }
      }
    }

    // Формирование объекта ответов на основе конфигурации полей
    fields.forEach(field => {
      if (field.type === 'file') {
        const uploadedFile = req.files ? req.files.find(f => f.fieldname === field.id) : null;
        answers[field.id] = uploadedFile ? `/uploads/${uploadedFile.filename}` : null;
      } else {
        answers[field.id] = req.body[field.id] !== undefined ? req.body[field.id] : null;
      }
    });

    const answersString = JSON.stringify(answers);

    db.run(
      "INSERT INTO submissions (form_id, answers) VALUES (?, ?)",
      [formId, answersString],
      function (err) {
        if (err) {
          if (req.files) {
            req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
          }
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Ответы успешно отправлены!' });
      }
    );
  });
});

// Глобальный обработчик ошибок, включая ошибки multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Превышен максимальный размер файла (лимит 3 МБ)' });
    }
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Админ-панель: http://localhost:${PORT}/admin`);
});