// ---------- Утилиты ----------
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const id = (n) => document.getElementById(n);

// ---------- АВТОРИЗАЦИЯ: хранение пользователей в localStorage ----------
function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '{}');
}
function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}
function registerUser(username, password) {
    const users = getUsers();
    if (users[username]) return false;
    users[username] = { password: password, tasks: [] };
    saveUsers(users);
    return true;
}
function loginUser(username, password) {
    const users = getUsers();
    if (users[username] && users[username].password === password) {
        localStorage.setItem('currentUser', username);
        return true;
    }
    return false;
}
function getCurrentUser() {
    return localStorage.getItem('currentUser');
}
function logoutUser() {
    localStorage.removeItem('currentUser');
}

// ---------- МОДАЛ / ОБЩИЕ UI ----------
const overlay = id('overlay');
const modalContent = id('modalContent');

function openModal(html) {
    modalContent.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
}
function closeModal() {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = '';
}
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

// ---------- ОБНОВЛЕНИЕ UI АВТОРИЗАЦИИ ----------
function updateAuthUI() {
    const loginBtn = id('loginBtn');
    const registerBtn = id('registerBtn');
    const header = document.querySelector('header');
    const current = getCurrentUser();

    const existing = id('userBox');
    if (existing) existing.remove();

    if (current) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';

        const userBox = document.createElement('div');
        userBox.id = 'userBox';
        userBox.style.display = 'flex';
        userBox.style.alignItems = 'center';
        userBox.style.gap = '10px';
        userBox.innerHTML = `
            <div class="username" style="font-weight:600">${current}</div>
            <button id="logoutBtn" class="btn plain">Выйти</button>
        `;
        header.appendChild(userBox);

        id('logoutBtn').addEventListener('click', () => {
            logoutUser();
            tasks = [];
            renderDayGrid();
            updateAuthUI();
        });
    } else {
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
    }
}

// ---------- ОКНО ВХОДА / РЕГИСТРАЦИИ ----------
function openAuthModal(type = 'login') {
    const html = `
        <h3 style="margin-top:0">${type === 'login' ? 'Вход' : 'Регистрация'}</h3>
        <div style="margin:8px 0">
            <input id="authUsername" placeholder="Имя пользователя" style="width:100%;padding:8px;margin-bottom:6px">
            <input id="authPassword" type="password" placeholder="Пароль" style="width:100%;padding:8px">
        </div>
        <div style="display:flex;gap:8px">
            <button id="authSubmit" class="btn">${type === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
            <button id="authCancel" class="btn plain" style="margin-left:auto">Отмена</button>
        </div>
    `;
    openModal(html);

    id('authCancel').addEventListener('click', closeModal);

    id('authSubmit').addEventListener('click', () => {
        const u = id('authUsername').value.trim();
        const p = id('authPassword').value.trim();
        if (!u || !p) return alert('Заполните все поля');

        if (type === 'login') {
            if (loginUser(u, p)) {
                closeModal();
                updateAuthUI();
                tasks = loadTasks();
                renderDayGrid();
                alert('Вы вошли как ' + u);
            } else {
                alert('Неверный логин или пароль');
            }
        } else {
            if (registerUser(u, p)) {
                closeModal();
                alert('Пользователь зарегистрирован');
            } else {
                alert('Пользователь уже существует');
            }
        }
    });
}

// кнопки вход/рег
document.addEventListener('DOMContentLoaded', () => {
    const lb = id('loginBtn'); if (lb) lb.addEventListener('click', () => openAuthModal('login'));
    const rb = id('registerBtn'); if (rb) rb.addEventListener('click', () => openAuthModal('register'));
});

// ---------- ПРИВЯЗАННЫЕ К ПОЛЬЗОВАТЕЛЮ ЗАДАЧИ ----------
let tasks = [];

// элементы UI
const taskInput = id('taskInput');
const taskTag = id('taskTag');
const addBtn = id('addBtn');
const showDone = id('showDone');
const filterTag = id('filterTag');
const clearBtn = id('clearBtn');
const exportBtn = id('exportBtn');
const dayGrid = id('dayGrid');
const tasksList = id('tasksList');

function loadTasks() {
    const u = getCurrentUser();
    if (!u) return [];
    const users = getUsers();
    return users[u] && users[u].tasks ? users[u].tasks.slice() : [];
}
function saveTasks() {
    const u = getCurrentUser();
    if (!u) return;
    const users = getUsers();
    users[u] = users[u] || { password: '', tasks: [] };
    users[u].tasks = tasks.slice();
    saveUsers(users);
}

function createTaskCard(task, index) {
    const el = document.createElement('div');
    el.className = 'task';
    if (task.done) el.classList.add('done');
    el.innerHTML = `
        <input type="checkbox" ${task.done ? 'checked' : ''} data-index="${index}">
        <div class="title">${escapeHtml(task.title)}</div>
        <div class="meta">${escapeHtml(task.tag || '')}</div>
    `;
    return el;
}

function renderDayGrid() {
    if (!dayGrid) return;
    dayGrid.innerHTML = '';

    if (!getCurrentUser()) {
        const hint = document.createElement('div');
        hint.className = 'panel';
        hint.style.background = 'transparent';
        hint.style.padding = '0';
        hint.innerHTML = `<div class="sub">Вы не вошли. Войдите, чтобы сохранять задачи в аккаунте.</div>`;
        dayGrid.appendChild(hint);
        return;
    }

    let filtered = tasks.filter(t => showDone.checked || !t.done);
    if (filterTag.value !== 'all') filtered = filtered.filter(t => t.tag === filterTag.value);

    filtered.forEach((t, i) => {
        dayGrid.appendChild(createTaskCard(t, i));
    });
}

// ---------- Добавление задачи Требуется авторизация ----------
function addTaskHandler() {
    // Проверяем, авторизован ли пользователь
    const user = getCurrentUser();
    if (!user) {
        // Если нет — открываем модальное окно входа
        openAuthModal('login');
        return;
    }

    // Берём текст задачи
    const title = taskInput.value.trim();

    // Если поле пустое — ничего не делаем
    if (!title) return;

    // Добавляем задачу в массив текущего пользователя
    tasks.push({
        title: title,        // текст задачи
        tag: taskTag.value,  // тег (Работа / Дом / Учёба)
        done: false          // выполнена или нет
    });

    // Очищаем поле ввода
    taskInput.value = '';

    // Сохраняем задачи в localStorage (привязка к аккаунту)
    saveTasks();

    // Перерисовываем список задач
    renderDayGrid();
}

// ---------- Обработчики UI ----------

// Кнопка "Добавить"
if (addBtn) {
    addBtn.addEventListener('click', addTaskHandler);
}

// Добавление задачи по Enter
if (taskInput) {
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTaskHandler();
    });
}

// Переключатель "Показать выполненные"
if (showDone) {
    showDone.addEventListener('change', renderDayGrid);
}

// Фильтр по тегам
if (filterTag) {
    filterTag.addEventListener('change', renderDayGrid);
}

// ---------- Обработка чекбокса задачи ----------

if (dayGrid) {
    dayGrid.addEventListener('change', (e) => {
        // Проверяем, что изменился именно checkbox
        if (e.target && e.target.matches('input[type="checkbox"]')) {

            // Индекс задачи берётся из data-index
            const idx = +e.target.dataset.index;

            // Защита от некорректных данных
            if (!Number.isFinite(idx)) return;

            // Обновляем статус задачи
            tasks[idx].done = e.target.checked;

            // Сохраняем изменения
            saveTasks();

            // Перерисовываем список
            renderDayGrid();
        }
    });
}

// ---------- Очистка всех задач (Требуется авторизация) ----------
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        if (!getCurrentUser()) {
            openAuthModal('login');
            return;
        }

        // Подтверждение действия
        if (!confirm('Очистить все задачи?')) return;

        // Полностью очищаем массив задач
        tasks = [];

        // Сохраняем
        saveTasks();

        // Обновляем UI
        renderDayGrid();
    });
}

// ---------- Экспорт задач в JSON (Требуется авторизация) ----------
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (!getCurrentUser()) {
            openAuthModal('login');
            return;
        }

        // Создаём файл JSON
        const blob = new Blob(
            [JSON.stringify(tasks, null, 2)],
            { type: 'application/json' }
        );

        // Генерируем ссылку для скачивания
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${getCurrentUser()}-tasks.json`;

        // Автоматически скачиваем файл
        a.click();

        // Освобождаем память
        URL.revokeObjectURL(a.href);
    });
}

// ---------- ТАЙМЕР ----------
let timer = null;
let remaining = 50 * 60;
let isRunning = false;
let currentMode = 'Работа';

let workDuration = 50 * 60;
let breakDuration = 15 * 60;

const timerDisplay = id('timerDisplay');
const startBtn = id('startBtn');
const pauseBtn = id('pauseBtn');
const resetBtn = id('resetBtn');
const preset = id('preset');
const modeLabel = id('modeLabel');
const autoBreak = id('autoBreak');

// ---------- Формат времени ----------
function formatTime(t) {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ---------- Обновление UI ----------
function updateTimerUI() {
    if (timerDisplay) timerDisplay.textContent = formatTime(remaining);
    if (modeLabel) modeLabel.textContent = currentMode;
}

// ---------- Переключение режима через select ----------
function applyPreset() {
    pauseTimer();

    const value = +preset.value;

    if (value === 50) {
        currentMode = 'Работа';
        workDuration = value * 60;
        remaining = workDuration;
    } else {
        currentMode = 'Перерыв';
        breakDuration = value * 60;
        remaining = breakDuration;
    }

    updateTimerUI();
}

// ---------- Tick ----------
function tick() {
    if (remaining > 0) {
        remaining--;
        updateTimerUI();
        return;
    }

    clearInterval(timer);
    isRunning = false;

    if (currentMode === 'Работа') {
        if (autoBreak && autoBreak.checked) {
            preset.value = '15';
            applyPreset();
            startTimer();
        } else {
            alert('Сессия работы завершена!');
        }
    } else {
        preset.value = '50';
        applyPreset();
        startTimer();
    }
}

// ---------- Управление ----------
function startTimer() {
    if (isRunning) return;
    timer = setInterval(tick, 1000);
    isRunning = true;
}

function pauseTimer() {
    if (timer) clearInterval(timer);
    isRunning = false;
}

function resetTimer() {
    pauseTimer();
    remaining = currentMode === 'Работа' ? workDuration : breakDuration;
    updateTimerUI();
}

// ---------- События ----------
if (preset) {
    applyPreset();
    preset.addEventListener('change', applyPreset);
}
if (startBtn) startBtn.addEventListener('click', startTimer);
if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
if (resetBtn) resetBtn.addEventListener('click', resetTimer);

updateTimerUI();


// ---------- Тренажёр систем счисления ----------
function startBasesTrainer() {
    const systems = ['2','8','16'];
    
    const systemNames = { 
        '2':'двоичная',
        '8':'восьмеричная',
        '16':'шестнадцатеричная' };

    function randomInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }

    let fromSys = systems[randomInt(0, systems.length-1)];
    let num = randomInt(0, 255);
    let question;
    switch(fromSys){
        case '2': question = num.toString(2); break;
        case '8': question = num.toString(8); break;
        case '16': question = num.toString(16).toUpperCase(); break;
    }

    const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <h3>Тренажёр систем счисления</h3>
            <div class="sub">Переведи число из ${systemNames[fromSys]} в десятичную систему</div>
        </div>
        <div style="margin-bottom:8px;font-size:20px"><strong>${question} (${systemNames[fromSys]}) → ? (10)</strong></div>
        <input id="basesAnswer" type="text" placeholder="Введите ответ" style="padding:10px; border-radius:8px; border:1px solid #eaeaea; width:100%; font-size:16px;"/>
        <div style="margin-top:10px;display:flex;gap:8px">
            <button id="basesCheck" class="btn">Проверить</button>
            <button id="basesNext" class="btn plain">Следующее</button>
            <button id="basesClose" class="btn plain" style="margin-left:auto">Закрыть</button>
        </div>
        <div id="basesFeedback" class="sub" style="margin-top:6px"></div>
    `;

    openModal(html);

    const answerInput = id('basesAnswer');
    const feedback = id('basesFeedback');

    function checkAnswer(){
        const correct = num.toString(10);
        if(answerInput.value.trim() === correct){
            feedback.textContent = '✅ Верно!';
            feedback.style.color = 'green';
        } else {
            feedback.textContent = `❌ Ошибка! Правильный ответ: ${correct}`;
            feedback.style.color = 'red';
        }
    }

    function nextQuestion(){
        fromSys = systems[randomInt(0, systems.length-1)];
        num = randomInt(0, 255);
        switch(fromSys){
            case '2': question = num.toString(2); break;
            case '8': question = num.toString(8); break;
            case '16': question = num.toString(16).toUpperCase(); break;
        }
        id('modalContent').querySelector('strong').textContent = `${question} (${systemNames[fromSys]}) → ? (10)`;
        answerInput.value = '';
        feedback.textContent = '';
    }

    id('basesCheck').addEventListener('click', checkAnswer);
    id('basesNext').addEventListener('click', nextQuestion);
    id('basesClose').addEventListener('click', closeModal);
}

// ---------- Candy Crush (мини) ----------
function startCandyCrush() {
    const rows = 6, cols = 6;
    const colors = ['red','green','blue','yellow','purple'];
    let grid = Array.from({length:rows},()=>Array.from({length:cols},()=>colors[Math.floor(Math.random()*colors.length)]));
    let selected = null;

    function htmlGrid(){
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <h3>Candy Crush</h3>
            <div class="sub">Меняй конфеты местами, чтобы собрать линии</div>
        </div>
        <div id="candyGrid" style="display:grid;grid-template-columns:repeat(${cols},50px);gap:4px;margin-bottom:10px;position:relative;"></div>
        <div style="display:flex;gap:8px">
            <button id="candyClose" class="btn plain" style="margin-left:auto">Закрыть</button>
        </div>`;
    }

    openModal(htmlGrid());
    const candyGrid = id('candyGrid');

    let cellElems = Array.from({length: rows}, () => Array(cols));

    function animateCandy(cell, targetY, delay = 0) {
        let y = -300;
        let vy = 0;
        const gravity = 1.5;
        const bounce = 0.25;

        cell.style.transform = `translateY(${y}px)`;
        cell.style.opacity = '0';

        setTimeout(() => {
            cell.style.opacity = '1';
            function frame() {
                vy += gravity;
                y += vy;
                if (y >= targetY) {
                    y = targetY;
                    vy = -vy * bounce;
                    if (Math.abs(vy) < 1) {
                        cell.style.transform = `translateY(${targetY}px)`;
                        return;
                    }
                }
                cell.style.transform = `translateY(${y}px)`;
                requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }, delay);
    }

    function draw(firstRender = false) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = grid[r][c];
                let cell = cellElems[r][c];
                if (!cell) {
                    cell = document.createElement('div');
                    cell.style.width = '50px';
                    cell.style.height = '50px';
                    cell.style.borderRadius = '8px';
                    cell.style.background = color;
                    cell.style.cursor = 'pointer';
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    candyGrid.appendChild(cell);
                    cellElems[r][c] = cell;
                    animateCandy(cell, 0, (c * 60 + r * 40));
                } else if (cell.style.background !== color) {
                    cell.style.background = color;
                    animateCandy(cell, 0, 0);
                }
            }
        }
    }

    function swap(r1,c1,r2,c2){
        [grid[r1][c1],grid[r2][c2]]=[grid[r2][c2],grid[r1][c1]];
        checkMatches();
    }

    function checkMatches(){
        let removed=false;
        // горизонталь
        for(let r=0;r<rows;r++){
            for(let c=0;c<cols-2;c++){
                if(grid[r][c] && grid[r][c]===grid[r][c+1] && grid[r][c]===grid[r][c+2]){
                    removed=true;
                    for(let k=0;k<3;k++) grid[r][c+k]=null;
                }
            }
        }
        // вертикаль
        for(let c=0;c<cols;c++){
            for(let r=0;r<rows-2;r++){
                if(grid[r][c] && grid[r][c]===grid[r+1][c] && grid[r][c]===grid[r+2][c]){
                    removed=true;
                    for(let k=0;k<3;k++) grid[r+k][c]=null;
                }
            }
        }
        // падение
        for(let c=0;c<cols;c++){
            for(let r=rows-1;r>=0;r--){
                if(grid[r][c]===null){
                    let k=r-1;
                    while(k>=0 && grid[k][c]===null) k--;
                    if(k>=0){ grid[r][c]=grid[k][c]; grid[k][c]=null; }
                    else { grid[r][c]=colors[Math.floor(Math.random()*colors.length)]; }
                }
            }
        }
        draw(false);
        if(removed) setTimeout(checkMatches, 300);
    }

    candyGrid.addEventListener('click', e=>{
        const cell = e.target.closest('div');
        if(!cell) return;
        const r = +cell.dataset.r;
        const c = +cell.dataset.c;
        if(!selected) selected={r,c};
        else{
            if(Math.abs(selected.r-r)+Math.abs(selected.c-c)===1){
                swap(selected.r, selected.c, r, c);
            }
            selected=null;
        }
    });

    id('candyClose').addEventListener('click', closeModal);
    draw(true);
}

// ---------- ОТКРЫТИЕ ИГР ----------
function openGame(name){
    if(name==='wordle') startWordle();
    else if(name==='bases') startBasesTrainer();
    else if(name==='candy') startCandyCrush();
}
$$('.game-card').forEach(el => el.addEventListener('click', () => openGame(el.dataset.game)));

// ---------- КЛАВИШИ (Wordle support) ----------
document.addEventListener('keydown', (e)=>{
    const overlayShown = overlay.style.display==='flex';
    if(!overlayShown) return;
    const key = e.key.toLowerCase();
    if (key === 'enter') { const btn = id('wSubmit'); if (btn) btn.click(); }
    if (key === 'backspace') { const btn = document.querySelector('#wBack'); if (btn) btn.click(); }
    if (/^[а-яё]$/.test(key)) {
        const el = Array.from(document.querySelectorAll('.key')).find(k => k.textContent === key);
        if (el) el.click();
    }
});

// ---------- HELPERS ----------
function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---------- ИНИЦИАЛИЗАЦИЯ НА СТАРТЕ ----------
updateAuthUI();
tasks = loadTasks();
renderDayGrid();
