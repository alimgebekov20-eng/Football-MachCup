class FootballGame {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = '';
        this.lobbyId = null;
        this.gameId = null;
        this.team = null;
        this.isHost = false;
        this.isRunning = false;
        this.timer = 120;
        this.players = {};
        this.ball = {};
        this.score = { team1: 0, team2: 0 };
        this.isFullscreen = false;
        this._hasReceivedState = false; // Флаг, что данные пришли
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.loginScreen = document.getElementById('loginScreen');
        this.menuScreen = document.getElementById('menuScreen');
        this.createLobbyScreen = document.getElementById('createLobbyScreen');
        this.lobbyScreen = document.getElementById('lobbyScreen');
        this.findLobbyScreen = document.getElementById('findLobbyScreen');
        this.gameScreen = document.getElementById('gameScreen');
        
        this.playerNameInput = document.getElementById('playerName');
        this.enterBtn = document.getElementById('enterGameBtn');
        this.displayName = document.getElementById('displayName');
        this.displayId = document.getElementById('displayId');
        
        this.createLobbyBtn = document.getElementById('createLobbyBtn');
        this.findLobbyBtn = document.getElementById('findLobbyBtn');
        
        this.mode1v1Btn = document.getElementById('mode1v1Btn');
        this.mode2v2Btn = document.getElementById('mode2v2Btn');
        this.backFromCreateBtn = document.getElementById('backFromCreateBtn');
        
        this.lobbyCode = document.getElementById('lobbyCode');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        this.lobbyMode = document.getElementById('lobbyMode');
        this.lobbyPlayers = document.getElementById('lobbyPlayers');
        this.playersList = document.getElementById('playersList');
        this.startGameBtn = document.getElementById('startGameBtn');
        this.leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
        this.lobbyStatus = document.getElementById('lobbyStatus');
        
        this.lobbiesList = document.getElementById('lobbiesList');
        this.refreshLobbiesBtn = document.getElementById('refreshLobbiesBtn');
        this.backFromFindBtn = document.getElementById('backFromFindBtn');
        
        this.kickBtn = document.getElementById('kickBtn');
        this.tackleBtn = document.getElementById('tackleBtn');
        this.backToMenuBtn = document.getElementById('backToMenuBtn');
        this.gameOverModal = document.getElementById('gameOverModal');
        
        this.timerElement = document.getElementById('gameTimer');
        this.team1Score = document.getElementById('team1Score');
        this.team2Score = document.getElementById('team2Score');
        this.team1Name = document.getElementById('team1Name');
        this.team2Name = document.getElementById('team2Name');
        
        this.finalTeam1 = document.getElementById('finalTeam1');
        this.finalTeam2 = document.getElementById('finalTeam2');
        this.winnerMessage = document.getElementById('winnerMessage');
        
        this.joystick = new VirtualJoystick('joystickBase', 'joystickThumb');
        this.joystick.onMove((direction) => this.handleJoystickMove(direction));
        
        this.moveState = { x: 0, y: 0 };
        this.moveInterval = null;
        
        this.setupEventListeners();
        this.setupFullscreen();
        this.resizeCanvas();
        this.gameLoop();
    }
    
    setupFullscreen() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 500);
        });
        
        this.canvas.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        this.canvas.addEventListener('touchend', (e) => {
            const target = e.target;
            if (target.id === 'joystickBase' || target.id === 'joystickThumb' || 
                target.classList.contains('action-btn')) {
                return;
            }
            this.toggleFullscreen();
        });
    }
    
    handleOrientationChange() {
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
    
    setupEventListeners() {
        this.enterBtn.addEventListener('click', () => this.handleLogin());
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        this.createLobbyBtn.addEventListener('click', () => this.showScreen('createLobbyScreen'));
        this.findLobbyBtn.addEventListener('click', () => this.handleFindLobbies());
        
        this.mode1v1Btn.addEventListener('click', () => this.handleCreateLobby('1v1'));
        this.mode2v2Btn.addEventListener('click', () => this.handleCreateLobby('2v2'));
        this.backFromCreateBtn.addEventListener('click', () => this.showScreen('menuScreen'));
        
        this.copyCodeBtn.addEventListener('click', () => this.handleCopyCode());
        this.startGameBtn.addEventListener('click', () => this.handleStartGame());
        this.leaveLobbyBtn.addEventListener('click', () => this.handleLeaveLobby());
        
        this.refreshLobbiesBtn.addEventListener('click', () => this.handleFindLobbies());
        this.backFromFindBtn.addEventListener('click', () => this.showScreen('menuScreen'));
        
        this.kickBtn.addEventListener('click', () => this.handleKick());
        this.kickBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleKick();
        });
        
        this.tackleBtn.addEventListener('click', () => this.handleTackle());
        this.tackleBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTackle();
        });
        
        this.backToMenuBtn.addEventListener('click', () => this.handleBackToMenu());
        
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 300);
        });
    }
    
    showScreen(screenId) {
        const screens = ['loginScreen', 'menuScreen', 'createLobbyScreen', 'lobbyScreen', 'findLobbyScreen', 'gameScreen'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (id === screenId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }
    
    handleLogin() {
        const name = this.playerNameInput.value.trim();
        if (!name) {
            this.playerNameInput.style.borderColor = '#f5576c';
            this.playerNameInput.placeholder = '⚠️ Введите имя!';
            setTimeout(() => {
                this.playerNameInput.style.borderColor = 'rgba(255,255,255,0.1)';
                this.playerNameInput.placeholder = 'Введите ваше имя';
            }, 2000);
            return;
        }
        
        this.playerName = name;
        this.connectWebSocket();
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket подключен');
            this.ws.send(JSON.stringify({
                type: 'auth',
                playerName: this.playerName
            }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Ошибка парсинга сообщения:', error);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            alert('Ошибка подключения к серверу. Попробуйте позже.');
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket отключен');
            if (this.isRunning) {
                alert('Соединение потеряно. Игра завершена.');
                this.handleBackToMenu();
            }
        };
    }
    
    handleWebSocketMessage(data) {
        console.log('📨 Получено:', data.type);
        
        switch (data.type) {
            case 'auth_success':
                this.playerId = data.playerId;
                this.displayName.textContent = data.playerName;
                this.displayId.textContent = `ID: ${data.playerId.slice(0, 8)}`;
                this.showScreen('menuScreen');
                break;
                
            case 'auth_error':
                alert(data.message);
                break;
                
            case 'lobby_created':
                this.lobbyId = data.lobbyId;
                this.isHost = true;
                this.lobbyCode.textContent = data.lobbyCode;
                this.updateLobbyUI(data);
                this.showScreen('lobbyScreen');
                break;
                
            case 'lobby_joined':
                this.lobbyId = data.lobbyId;
                this.team = data.team;
                this.isHost = false;
                this.updateLobbyUI(data);
                this.showScreen('lobbyScreen');
                break;
                
            case 'lobby_update':
                this.updateLobbyUI(data);
                break;
                
            case 'new_host':
                this.isHost = data.isHost;
                if (this.isHost) {
                    this.lobbyStatus.textContent = '👑 Вы новый хост!';
                    this.lobbyStatus.className = 'lobby-status ready';
                }
                break;
                
            case 'left_lobby':
                this.lobbyId = null;
                this.isHost = false;
                this.showScreen('menuScreen');
                break;
                
            case 'lobbies_list':
                this.renderLobbies(data.lobbies);
                break;
                
            case 'game_started':
                console.log('🎮 СТАРТ ИГРЫ!', data);
                this.gameId = data.gameId;
                this.team = data.team;
                this.startGame(data);
                break;
                
            case 'game_state':
                console.log('📊 СОСТОЯНИЕ ИГРЫ:', data.state);
                this._hasReceivedState = true;
                this.updateGameState(data.state);
                break;
                
            case 'error':
                alert(data.message);
                break;
                
            default:
                console.log('Неизвестное сообщение:', data);
        }
    }
    
    handleCreateLobby(mode) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Нет соединения с сервером');
            return;
        }
        
        this.ws.send(JSON.stringify({
            type: 'create_lobby',
            mode: mode
        }));
    }
    
    handleFindLobbies() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Нет соединения с сервером');
            return;
        }
        
        this.lobbiesList.innerHTML = '<div class="loading-text">⏳ Загрузка...</div>';
        this.showScreen('findLobbyScreen');
        
        this.ws.send(JSON.stringify({
            type: 'get_lobbies'
        }));
    }
    
    renderLobbies(lobbies) {
        if (!lobbies || lobbies.length === 0) {
            this.lobbiesList.innerHTML = '<div class="loading-text">😕 Нет доступных лобби</div>';
            return;
        }
        
        this.lobbiesList.innerHTML = '';
        lobbies.forEach(lobby => {
            const item = document.createElement('div');
            item.className = 'lobby-item';
            
            const info = document.createElement('div');
            info.className = 'lobby-info-text';
            info.innerHTML = `
                <span class="lobby-id-text">🏠 ${lobby.id}</span>
                <span class="lobby-details-text">${lobby.currentPlayers}/${lobby.maxPlayers} игроков • ${lobby.maxPlayers === 2 ? '1v1' : '2v2'}</span>
            `;
            
            const joinBtn = document.createElement('button');
            joinBtn.className = 'lobby-join-btn';
            joinBtn.textContent = 'Присоединиться';
            joinBtn.addEventListener('click', () => this.handleJoinLobby(lobby.id));
            
            item.appendChild(info);
            item.appendChild(joinBtn);
            this.lobbiesList.appendChild(item);
        });
    }
    
    handleJoinLobby(lobbyId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Нет соединения с сервером');
            return;
        }
        
        this.ws.send(JSON.stringify({
            type: 'join_lobby',
            lobbyId: lobbyId
        }));
    }
    
    updateLobbyUI(data) {
        if (data.players) {
            this.playersList.innerHTML = '';
            data.players.forEach(player => {
                const item = document.createElement('div');
                item.className = `player-item ${player.team}`;
                item.innerHTML = `
                    <span class="player-name-display">${player.name}</span>
                    <span class="player-team">${player.team === 'team1' ? '🔵 Синие' : '🔴 Красные'}</span>
                    ${player.id === data.hostId ? '<span class="player-host-badge">👑</span>' : ''}
                `;
                this.playersList.appendChild(item);
            });
            
            this.lobbyPlayers.textContent = `Игроков: ${data.players.length}/${data.maxPlayers || 4}`;
            
            if (this.isHost) {
                const canStart = data.players && data.players.length >= 2;
                this.startGameBtn.disabled = !canStart;
                if (canStart) {
                    this.lobbyStatus.textContent = '✅ Можно начинать!';
                    this.lobbyStatus.className = 'lobby-status ready';
                } else {
                    this.lobbyStatus.textContent = '⏳ Ожидание игроков...';
                    this.lobbyStatus.className = 'lobby-status';
                }
            } else {
                this.startGameBtn.disabled = true;
                this.startGameBtn.textContent = '🚀 Ожидание хоста';
                this.lobbyStatus.textContent = '⏳ Ожидание начала игры...';
                this.lobbyStatus.className = 'lobby-status';
            }
        }
    }
    
    handleStartGame() {
        if (!this.isHost) {
            alert('Только хост может начать игру');
            return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Нет соединения с сервером');
            return;
        }
        
        this.ws.send(JSON.stringify({
            type: 'start_game'
        }));
    }
    
    handleLeaveLobby() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        if (confirm('Выйти из лобби?')) {
            this.ws.send(JSON.stringify({
                type: 'leave_lobby'
            }));
        }
    }
    
    handleCopyCode() {
        const code = this.lobbyCode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.copyCodeBtn.textContent = '✅';
            setTimeout(() => {
                this.copyCodeBtn.textContent = '📋';
            }, 2000);
        }).catch(() => {
            const input = document.createElement('input');
            input.value = code;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.copyCodeBtn.textContent = '✅';
            setTimeout(() => {
                this.copyCodeBtn.textContent = '📋';
            }, 2000);
        });
    }
    
    startGame(data) {
        this.isRunning = true;
        this.timer = data.duration || 120;
        this.team = data.team;
        this._hasReceivedState = false;
        
        this.team1Name.textContent = this.team === 'team1' ? '👤 Вы' : '👤 Соперник';
        this.team2Name.textContent = this.team === 'team2' ? '👤 Вы' : '👤 Соперник';
        
        this.showScreen('gameScreen');
        this.resizeCanvas();
        this.gameOverModal.classList.remove('active');
        
        // ✅ НЕ ОТПРАВЛЯЕМ ДВИЖЕНИЕ ПРИ СТАРТЕ — ЖДЁМ ПОЗИЦИИ ОТ СЕРВЕРА
        // this.moveState = {
        //     x: this.canvas.width / 2,
        //     y: this.canvas.height / 2
        // };
        this.moveState = { x: null, y: null };
        
        this.startMovementLoop();
        
        setTimeout(() => {
            if (!this._hasReceivedState) {
                console.log('⚠️ Данные не пришли, создаём тестовых игроков');
                this.players = {
                    'test1': {
                        id: 'test1',
                        name: this.playerName || 'Вы',
                        team: 'team1',
                        x: 200,
                        y: 300,
                        hasBall: true,
                        radius: 14
                    },
                    'test2': {
                        id: 'test2',
                        name: 'Соперник',
                        team: 'team2',
                        x: 600,
                        y: 300,
                        hasBall: false,
                        radius: 14
                    }
                };
                this.ball = {
                    x: 400,
                    y: 300,
                    radius: 10
                };
                this.score = { team1: 0, team2: 0 };
            }
        }, 2000);
    }
    
    startMovementLoop() {
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
        }
        
        this.moveInterval = setInterval(() => {
            if (this.isRunning && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'player_movement',
                    x: this.moveState.x,
                    y: this.moveState.y
                }));
            }
        }, 50);
    }
    
    updateGameState(state) {
        if (!state) return;
        
        this._hasReceivedState = true;
        
        // Проверяем, что данные есть
        if (state.players && state.players.length > 0) {
            this.players = {};
            state.players.forEach(player => {
                this.players[player.id] = player;
            });
            console.log(`✅ Загружено ${Object.keys(this.players).length} игроков`);
        } else {
            console.warn('⚠️ В состоянии нет игроков!');
        }
        
        this.ball = state.ball || { x: 400, y: 300, radius: 10 };
        this.score = state.score || { team1: 0, team2: 0 };
        this.timer = state.timer || 0;
        this.isRunning = state.isRunning || false;
        
        this.team1Score.textContent = this.score.team1;
        this.team2Score.textContent = this.score.team2;
        this.timerElement.textContent = this.timer;
        
        if (this.timer <= 0 && this.isRunning) {
            this.isRunning = false;
            this.showGameOver();
        }
    }
    
    showGameOver() {
        this.finalTeam1.textContent = this.score.team1;
        this.finalTeam2.textContent = this.score.team2;
        
        if (this.score.team1 > this.score.team2) {
            this.winnerMessage.textContent = '🏆 Победа команды 1!';
        } else if (this.score.team2 > this.score.team1) {
            this.winnerMessage.textContent = '🏆 Победа команды 2!';
        } else {
            this.winnerMessage.textContent = '🤝 Ничья!';
        }
        
        this.gameOverModal.classList.add('active');
    }
    
    handleBackToMenu() {
        this.isRunning = false;
        this._hasReceivedState = false;
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        this.gameOverModal.classList.remove('active');
        this.showScreen('menuScreen');
    }
    
    handleJoystickMove(direction) {
        const isMoving = Math.abs(direction.x) > 0.05 || Math.abs(direction.y) > 0.05;
        
        if (!isMoving) {
            this.moveState = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2
            };
            return;
        }
        
        const fieldWidth = this.canvas.width;
        const fieldHeight = this.canvas.height;
        const margin = 35;
        
        const maxOffsetX = fieldWidth * 0.25;
        const maxOffsetY = fieldHeight * 0.25;
        
        let targetX = fieldWidth / 2 + direction.x * maxOffsetX;
        let targetY = fieldHeight / 2 + direction.y * maxOffsetY;
        
        targetX = Math.max(margin, Math.min(fieldWidth - margin, targetX));
        targetY = Math.max(margin, Math.min(fieldHeight - margin, targetY));
        
        this.moveState = {
            x: targetX,
            y: targetY
        };
    }
    
    handleKick() {
        if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'game_action',
            action: 'kick'
        }));
        
        this.kickBtn.style.transform = 'scale(0.8)';
        setTimeout(() => {
            this.kickBtn.style.transform = 'scale(1)';
        }, 150);
    }
    
    handleTackle() {
        if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'game_action',
            action: 'tackle'
        }));
        
        this.tackleBtn.style.transform = 'scale(0.8)';
        setTimeout(() => {
            this.tackleBtn.style.transform = 'scale(1)';
        }, 150);
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const headerHeight = document.querySelector('.game-header')?.offsetHeight || 50;
        const controlsHeight = window.innerHeight < window.innerWidth ? 80 : 200;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - headerHeight - controlsHeight;
        
        this.fieldWidth = this.canvas.width;
        this.fieldHeight = this.canvas.height;
        
        const joystickContainer = document.getElementById('joystickContainer');
        if (window.innerHeight < window.innerWidth) {
            joystickContainer.style.width = '150px';
            joystickContainer.style.height = '150px';
        } else {
            joystickContainer.style.width = '130px';
            joystickContainer.style.height = '130px';
        }
    }
    
    gameLoop() {
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    if (!w || !h) return;
    
    ctx.clearRect(0, 0, w, h);
    
    // --- ПОЛЕ ---
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#2d8a4e');
    gradient.addColorStop(0.5, '#3ca55c');
    gradient.addColorStop(1, '#1a6a3a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // Полосы
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < h; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    }
    
    // --- РАЗМЕТКА ---
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(w/2, 20);
    ctx.lineTo(w/2, h-20);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(w/2, h/2, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(w/2, h/2, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    
    // --- ВОРОТА ---
    const goalWidth = 50;
    const goalHeight = h * 0.2;
    const goalY = h/2 - goalHeight/2;
    const goalDepth = 15;
    
    // Левые ворота
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, goalY);
    ctx.lineTo(goalDepth, goalY);
    ctx.lineTo(goalDepth, goalY + goalHeight);
    ctx.lineTo(0, goalY + goalHeight);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    const gridSize = 8;
    for (let y = goalY + 5; y < goalY + goalHeight - 5; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(1, y);
        ctx.lineTo(goalDepth - 1, y);
        ctx.stroke();
    }
    for (let x = 2; x < goalDepth - 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, goalY + 5);
        ctx.lineTo(x, goalY + goalHeight - 5);
        ctx.stroke();
    }
    
    // Правые ворота
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w, goalY);
    ctx.lineTo(w - goalDepth, goalY);
    ctx.lineTo(w - goalDepth, goalY + goalHeight);
    ctx.lineTo(w, goalY + goalHeight);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let y = goalY + 5; y < goalY + goalHeight - 5; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(w - 1, y);
        ctx.lineTo(w - goalDepth + 1, y);
        ctx.stroke();
    }
    for (let x = w - 2; x > w - goalDepth + 2; x -= gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, goalY + 5);
        ctx.lineTo(x, goalY + goalHeight - 5);
        ctx.stroke();
    }
    
    // --- ШТРАФНЫЕ ---
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    const penaltyWidth = 80;
    const penaltyHeight = goalHeight + 40;
    const penaltyY = h/2 - penaltyHeight/2;
    ctx.strokeRect(0, penaltyY, penaltyWidth, penaltyHeight);
    ctx.strokeRect(w - penaltyWidth, penaltyY, penaltyWidth, penaltyHeight);
    
    // ============================================================
    // ===== МЯЧ (МАСШТАБИРУЕМ ОТ 0-800 К РАЗМЕРУ CANVAS) =====
    // ============================================================
    if (this.ball && this.ball.x !== undefined) {
        // ✅ МАСШТАБИРУЕМ: от 0-800 к 0-w / 0-600 к 0-h
        const bx = (this.ball.x / 800) * w;
        const by = (this.ball.y / 600) * h;
        const br = Math.max(6, (this.ball.radius || 10) / 800 * w * 1.2);
        
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bx + 2, by + 2, br, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
        
        ctx.shadowColor = 'rgba(255,255,255,0.2)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(bx - br*0.3, by - br*0.3, 0, bx, by, br);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.7, '#f0f0f0');
        ballGrad.addColorStop(1, '#cccccc');
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = 'rgba(100,100,100,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx - br, by);
        ctx.lineTo(bx + br, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by - br);
        ctx.lineTo(bx, by + br);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, br * 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // ============================================================
    // ===== ИГРОКИ (МАСШТАБИРУЕМ ОТ 0-800 К РАЗМЕРУ CANVAS) =====
    // ============================================================
    const playersList = Object.values(this.players);
    if (playersList.length > 0) {
        playersList.forEach(player => {
            if (player.x === undefined || player.y === undefined) return;
            
            // ✅ МАСШТАБИРУЕМ: от 0-800 к 0-w / 0-600 к 0-h
            const px = (player.x / 800) * w;
            const py = (player.y / 600) * h;
            const pr = Math.max(12, (player.radius || 14) / 800 * w * 0.9);
            
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px + 2, py + 3, pr, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();
            
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 6;
            const color = player.team === 'team1' ? '#4facfe' : '#f5576c';
            const grad = ctx.createRadialGradient(px - pr*0.3, py - pr*0.3, 0, px, py, pr);
            grad.addColorStop(0, color);
            grad.addColorStop(0.6, color);
            grad.addColorStop(1, player.team === 'team1' ? '#2d7dd2' : '#c0392b');
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = `${Math.max(9, pr * 0.6)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const nameDisplay = (player.name || 'Игрок').length > 8 ? (player.name || 'Игрок').slice(0, 7) + '…' : (player.name || 'Игрок');
            ctx.fillText(nameDisplay, px, py - pr - 3);
            
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = `${Math.max(10, pr * 0.6)}px Arial`;
            ctx.textBaseline = 'middle';
            ctx.fillText('7', px, py + 1);
            
            if (player.hasBall) {
                ctx.shadowColor = 'rgba(255,215,0,0.4)';
                ctx.shadowBlur = 15;
                ctx.strokeStyle = 'rgba(255,215,0,0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, py, pr + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        });
    } else {
        // Если игроков нет — рисуем сообщение
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⏳ Ожидание игроков...', w/2, h/2);
    }
}
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new FootballGame();
    window.game = game;
});
