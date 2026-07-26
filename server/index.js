const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const { GameLogic } = require('./gameLogic');
const { LobbyManager } = require('./lobbyManager');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

// Состояние сервера
const games = new Map(); // gameId -> gameLogic
const players = new Map(); // ws -> playerData
const lobbyManager = new LobbyManager();

// WebSocket соединение
wss.on('connection', (ws) => {
  console.log('Новый игрок подключился');
  
  // Отправляем приветствие
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Добро пожаловать в футбольную игру!'
  }));

  // Обработка сообщений от клиента
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Ошибка формата сообщения'
      }));
    }
  });

  // Обработка отключения
  ws.on('close', () => {
    console.log('Игрок отключился');
    handleDisconnect(ws);
  });
});

// Обработчик сообщений
function handleMessage(ws, data) {
  const player = players.get(ws);
  
  switch (data.type) {
    case 'auth':
      handleAuth(ws, data);
      break;
      
    case 'create_lobby':
      handleCreateLobby(ws, data);
      break;
      
    case 'get_lobbies':
      handleGetLobbies(ws);
      break;
      
    case 'join_lobby':
      handleJoinLobby(ws, data);
      break;
      
    case 'leave_lobby':
      handleLeaveLobby(ws);
      break;
      
    case 'start_game':
      handleStartGame(ws);
      break;
      
    case 'game_action':
      if (player && player.gameId) {
        handleGameAction(ws, data);
      }
      break;
      
    case 'player_movement':
      if (player && player.gameId) {
        handlePlayerMovement(ws, data);
      }
      break;
      
    default:
      console.log('Неизвестный тип сообщения:', data.type);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Неизвестный тип сообщения'
      }));
  }
}

// ===== АУТЕНТИФИКАЦИЯ =====
function handleAuth(ws, data) {
  if (!data.playerName || data.playerName.trim() === '') {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Имя не может быть пустым'
    }));
    return;
  }

  const playerId = generatePlayerId();
  players.set(ws, {
    id: playerId,
    name: data.playerName.trim(),
    lobbyId: null,
    gameId: null,
    team: null,
    isHost: false
  });

  ws.send(JSON.stringify({
    type: 'auth_success',
    playerId: playerId,
    playerName: data.playerName.trim()
  }));

  console.log(`✅ Игрок ${data.playerName.trim()} (${playerId}) авторизован`);
}

// ===== СОЗДАНИЕ ЛОББИ =====
function handleCreateLobby(ws, data) {
  const player = players.get(ws);
  if (!player) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Сначала авторизуйтесь'
    }));
    return;
  }

  // Проверяем режим
  if (!data.mode || !['1v1', '2v2'].includes(data.mode)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Выберите режим: 1v1 или 2v2'
    }));
    return;
  }

  // Если игрок уже в лобби
  if (player.lobbyId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Вы уже находитесь в лобби'
    }));
    return;
  }

  // Создаем лобби
  const lobbyId = generateLobbyId();
  const maxPlayers = data.mode === '1v1' ? 2 : 4;
  
  const lobby = lobbyManager.createLobby(lobbyId, player.id, player.name, maxPlayers);
  
  player.lobbyId = lobbyId;
  player.isHost = true;

  ws.send(JSON.stringify({
    type: 'lobby_created',
    lobbyId: lobbyId,
    lobbyCode: lobbyId,
    mode: data.mode,
    maxPlayers: maxPlayers,
    players: lobby.getPlayers()
  }));

  console.log(`🏠 Лобби ${lobbyId} создано игроком ${player.name} (режим: ${data.mode})`);
  
  // Уведомляем всех о новом лобби
  broadcastLobbyList();
}

// ===== ПОЛУЧЕНИЕ СПИСКА ЛОББИ =====
function handleGetLobbies(ws) {
  const lobbies = lobbyManager.getPublicLobbies();
  ws.send(JSON.stringify({
    type: 'lobbies_list',
    lobbies: lobbies
  }));
}

// ===== ПРИСОЕДИНЕНИЕ К ЛОББИ =====
function handleJoinLobby(ws, data) {
  const player = players.get(ws);
  if (!player) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Сначала авторизуйтесь'
    }));
    return;
  }

  if (!data.lobbyId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Укажите ID лобби'
    }));
    return;
  }

  // Проверяем, не в лобби ли уже
  if (player.lobbyId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Вы уже в лобби'
    }));
    return;
  }

  const lobby = lobbyManager.getLobby(data.lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Лобби не найдено'
    }));
    return;
  }

  if (lobby.isFull()) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Лобби заполнено'
    }));
    return;
  }

  if (lobby.isGameStarted()) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Игра уже началась'
    }));
    return;
  }

  // Добавляем игрока в лобби
  const team = lobby.addPlayer(player.id, player.name);
  if (!team) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Не удалось присоединиться'
    }));
    return;
  }

  player.lobbyId = data.lobbyId;
  player.isHost = false;

  ws.send(JSON.stringify({
    type: 'lobby_joined',
    lobbyId: data.lobbyId,
    team: team,
    players: lobby.getPlayers(),
    hostId: lobby.getHostId()
  }));

  console.log(`👤 Игрок ${player.name} присоединился к лобби ${data.lobbyId}`);
  
  // Уведомляем всех в лобби об обновлении
  broadcastLobbyUpdate(data.lobbyId);
  broadcastLobbyList();
}

// ===== ВЫХОД ИЗ ЛОББИ =====
function handleLeaveLobby(ws) {
  const player = players.get(ws);
  if (!player || !player.lobbyId) return;

  const lobbyId = player.lobbyId;
  const lobby = lobbyManager.getLobby(lobbyId);
  
  if (lobby) {
    lobby.removePlayer(player.id);
    
    // Если лобби пустое - удаляем
    if (lobby.isEmpty()) {
      lobbyManager.removeLobby(lobbyId);
      console.log(`🗑️ Лобби ${lobbyId} удалено (пустое)`);
    } else {
      // Если вышел хост - назначаем нового
      if (player.isHost) {
        const newHost = lobby.assignNewHost();
        if (newHost) {
          broadcastLobbyUpdate(lobbyId);
          notifyNewHost(lobbyId, newHost);
        }
      }
      broadcastLobbyUpdate(lobbyId);
    }
  }

  player.lobbyId = null;
  player.isHost = false;

  ws.send(JSON.stringify({
    type: 'left_lobby'
  }));

  broadcastLobbyList();
  console.log(`🚪 Игрок ${player.name} вышел из лобби ${lobbyId}`);
}

// ===== СТАРТ ИГРЫ (только для хоста) =====
function handleStartGame(ws) {
  const player = players.get(ws);
  if (!player || !player.lobbyId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Вы не в лобби'
    }));
    return;
  }

  if (!player.isHost) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Только хост может начать игру'
    }));
    return;
  }

  const lobby = lobbyManager.getLobby(player.lobbyId);
  if (!lobby) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Лобби не найдено'
    }));
    return;
  }

  if (lobby.isGameStarted()) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Игра уже началась'
    }));
    return;
  }

  if (!lobby.isReadyToStart()) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Недостаточно игроков'
    }));
    return;
  }

  // Создаем игру
  const gameId = generateGameId();
  const game = new GameLogic(gameId);
  
  // Добавляем всех игроков из лобби
  const playersInLobby = lobby.getPlayers();
  playersInLobby.forEach(p => {
    game.addPlayer(p.id, p.name, p.team);
  });
  
  games.set(gameId, game);
  
  // Обновляем данные игроков
  playersInLobby.forEach(p => {
    const playerWs = findPlayerWebSocket(p.id);
    if (playerWs) {
      const playerData = players.get(playerWs);
      if (playerData) {
        playerData.gameId = gameId;
        playerData.lobbyId = null;
      }
    }
  });

  // Запускаем игру
  game.startGame();
  
  // Уведомляем всех игроков
  playersInLobby.forEach(p => {
    const playerWs = findPlayerWebSocket(p.id);
    if (playerWs) {
      playerWs.send(JSON.stringify({
        type: 'game_started',
        gameId: gameId,
        team: p.team,
        duration: 120
      }));
    }
  });

  // Удаляем лобби
  lobbyManager.removeLobby(player.lobbyId);
  broadcastLobbyList();

  console.log(`🎮 Игра ${gameId} началась! Игроков: ${playersInLobby.length}`);
}

// ===== ИГРОВЫЕ ДЕЙСТВИЯ =====
function handleGameAction(ws, data) {
  const player = players.get(ws);
  if (!player || !player.gameId) return;

  const game = games.get(player.gameId);
  if (!game || !game.isRunning) return;

  switch (data.action) {
    case 'kick':
      game.playerKick(player.id);
      break;
    case 'tackle':
      game.playerTackle(player.id);
      break;
  }
  
  broadcastGameState(player.gameId);
}

function handlePlayerMovement(ws, data) {
  const player = players.get(ws);
  if (!player || !player.gameId) return;

  const game = games.get(player.gameId);
  if (!game || !game.isRunning) return;

  game.updatePlayerPosition(player.id, data.x, data.y);
}

// ===== ОТКЛЮЧЕНИЕ ИГРОКА =====
function handleDisconnect(ws) {
  const player = players.get(ws);
  if (!player) return;

  console.log(`❌ Игрок ${player.name} отключился`);

  // Если в лобби
  if (player.lobbyId) {
    const lobby = lobbyManager.getLobby(player.lobbyId);
    if (lobby) {
      lobby.removePlayer(player.id);
      
      if (lobby.isEmpty()) {
        lobbyManager.removeLobby(player.lobbyId);
      } else {
        if (player.isHost) {
          const newHost = lobby.assignNewHost();
          if (newHost) {
            broadcastLobbyUpdate(player.lobbyId);
            notifyNewHost(player.lobbyId, newHost);
          }
        }
        broadcastLobbyUpdate(player.lobbyId);
      }
    }
    broadcastLobbyList();
  }

  // Если в игре
  if (player.gameId) {
    const game = games.get(player.gameId);
    if (game) {
      game.removePlayer(player.id);
      if (game.players.size === 0) {
        games.delete(player.gameId);
      } else {
        broadcastGameState(player.gameId);
      }
    }
  }

  players.delete(ws);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function generatePlayerId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateLobbyId() {
  return 'L' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateGameId() {
  return 'G_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
}

function findPlayerWebSocket(playerId) {
  for (const [ws, player] of players) {
    if (player.id === playerId) {
      return ws;
    }
  }
  return null;
}

// ===== BROADCAST ФУНКЦИИ =====
function broadcastLobbyList() {
  const lobbies = lobbyManager.getPublicLobbies();
  for (const [ws, player] of players) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'lobbies_list',
        lobbies: lobbies
      }));
    }
  }
}

function broadcastLobbyUpdate(lobbyId) {
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return;

  const playersInLobby = lobby.getPlayers();
  playersInLobby.forEach(p => {
    const ws = findPlayerWebSocket(p.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'lobby_update',
        players: playersInLobby,
        hostId: lobby.getHostId(),
        isFull: lobby.isFull(),
        canStart: lobby.isReadyToStart()
      }));
    }
  });
}

function notifyNewHost(lobbyId, newHostId) {
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return;

  const playersInLobby = lobby.getPlayers();
  playersInLobby.forEach(p => {
    const ws = findPlayerWebSocket(p.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'new_host',
        hostId: newHostId,
        isHost: p.id === newHostId
      }));
    }
  });
}

function broadcastGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  const state = game.getState();
  game.players.forEach((player, playerId) => {
    const ws = findPlayerWebSocket(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'game_state',
        state: state
      }));
    }
  });
}

// Запуск сервера
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Открыть: http://localhost:${PORT}`);
});
