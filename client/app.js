// ===== В КОНСТРУКТОРЕ ДОБАВЛЯЕМ =====
constructor() {
    // ... остальной код ...
    
    // Для полноэкранного режима
    this.isFullscreen = false;
    this.setupFullscreen();
}

// ===== НОВАЯ ФУНКЦИЯ: ПОЛНОЭКРАННЫЙ РЕЖИМ =====
setupFullscreen() {
    // Обработка поворота экрана
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            this.handleOrientationChange();
        }, 500);
    });
    
    // Обработка нажатия на canvas для перехода в fullscreen
    this.canvas.addEventListener('click', () => {
        this.toggleFullscreen();
    });
    this.canvas.addEventListener('touchend', (e) => {
        // Не переключать если коснулись джостика или кнопок
        const target = e.target;
        if (target.id === 'joystickBase' || target.id === 'joystickThumb' || 
            target.classList.contains('action-btn')) {
            return;
        }
        this.toggleFullscreen();
    });
}

handleOrientationChange() {
    // Если телефон повернули горизонтально - включаем fullscreen
    if (window.innerHeight < window.innerWidth) {
        this.enterFullscreen();
    } else {
        this.exitFullscreen();
    }
    this.resizeCanvas();
}

toggleFullscreen() {
    if (this.isFullscreen) {
        this.exitFullscreen();
    } else {
        this.enterFullscreen();
    }
}

enterFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
    this.isFullscreen = true;
    
    // Блокируем ориентацию на горизонтальную
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
}

exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    this.isFullscreen = false;
    
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// ===== ИСПРАВЛЕННАЯ ФУНКЦИЯ ДВИЖЕНИЯ =====
handleJoystickMove(direction) {
    // Проверяем, что джостик активен и есть движение
    const isMoving = Math.abs(direction.x) > 0.05 || Math.abs(direction.y) > 0.05;
    
    if (!isMoving) {
        // Если джостик отпущен - игрок стоит на месте
        this.moveState = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2
        };
        return;
    }
    
    // Вычисляем позицию на поле
    const fieldWidth = this.canvas.width;
    const fieldHeight = this.canvas.height;
    const margin = 30;
    
    // Масштабируем движение (максимальное смещение - 150px от центра)
    const maxOffset = 150;
    let targetX = fieldWidth / 2 + direction.x * maxOffset;
    let targetY = fieldHeight / 2 + direction.y * maxOffset;
    
    // Ограничиваем полем
    targetX = Math.max(margin, Math.min(fieldWidth - margin, targetX));
    targetY = Math.max(margin, Math.min(fieldHeight - margin, targetY));
    
    this.moveState = {
        x: targetX,
        y: targetY
    };
}

// ===== ИСПРАВЛЕННЫЙ RESIZE =====
resizeCanvas() {
    if (!this.canvas) return;
    
    const headerHeight = document.querySelector('.game-header')?.offsetHeight || 50;
    const controlsHeight = 200;
    
    // Полный экран при горизонтальной ориентации
    if (window.innerHeight < window.innerWidth) {
        // Горизонтальная ориентация - максимум места для поля
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - headerHeight - 80; // Меньше отступ для контролов
    } else {
        // Вертикальная ориентация
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - headerHeight - controlsHeight;
    }
    
    this.fieldWidth = this.canvas.width;
    this.fieldHeight = this.canvas.height;
    
    // Обновляем размеры джостика
    const joystickContainer = document.getElementById('joystickContainer');
    if (window.innerHeight < window.innerWidth) {
        // В горизонтальном режиме увеличиваем джостик
        joystickContainer.style.width = '150px';
        joystickContainer.style.height = '150px';
    } else {
        joystickContainer.style.width = '130px';
        joystickContainer.style.height = '130px';
    }
}
