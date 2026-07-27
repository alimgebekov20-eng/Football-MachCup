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

app.use(cors());
app.use(express.static(path.join(__dirname, 'client')));

const games = new Map();
const players = new Map();
const lobbyManager = new LobbyManager();

wss.on('connection', (ws) => {
  console.log('Новый игрок подключился');
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Добро пожаловать в футбольную игру!'
  }));

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

  ws.on('close', () => {
    console.log('Игрок отключился');
    handleDisconnect(ws);
  });
});

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
      if (player && player.gameId) handleGameAction(ws, data);
      break;
    case 'player_movement':
      if (player && player.gameId) handlePlayerMovement(ws, data);
      break;
    case 'player_stop':
      if (player && player.gameId) handlePlayerStop(ws);
      break;
    default:
      console.log('Неизвестный тип:', data.type);
      ws.send(JSON.stringify({ type: 'error', message: 'Неизвестный тип сообщения' }));
  }
}

function handleAuth(ws, data) {
  if (!data.playerName || data.playerName.trim() === '') {
    ws.send(JSON.stringify({ type: 'auth_error', message: 'Имя не может быть пустым' }));
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

  console.log(`✅ Игрок ${data.playerName.trim()} авторизован`);
}

function handleCreateLobby(ws, data) {
  const player = players.get(ws);
  if (!player) return ws.send(JSON.stringify({ type: 'error', message: 'Авторизуйтесь' }));
  if (!data.mode || !['1v1', '2v2'].includes(data.mode)) {
    return ws.send(JSON.stringify({ type: 'error', message: 'Выберите режим: 1v1 или 2v2' }));
  }
  if (player.lobbyId) return ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в лобби' }));

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

  console.log(`🏠 Лобби ${lobbyId} создано (${data.mode})`);
  broadcastLobbyList();
}

function handleGetLobbies(ws) {
  const lobbies = lobbyManager.getPublicLobbies();
  ws.send(JSON.stringify({ type: 'lobbies_list', lobbies: lobbies }));
}

function handleJoinLobby(ws, data) {
  const player = players.get(ws);
  if (!player) return ws.send(JSON.stringify({ type: 'error', message: 'Авторизуйтесь' }));
  if (!data.lobbyId) return ws.send(JSON.stringify({ type: 'error', message: 'Укажите ID лобби' }));
  if (player.lobbyId) return ws.send(JSON.stringify({ type: 'error', message: 'Вы уже в лобби' }));

  const lobby = lobbyManager.getLobby(data.lobbyId);
  if (!lobby) return ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
  if (lobby.isFull()) return ws.send(JSON.stringify({ type: 'error', message: 'Лобби заполнено' }));
  if (lobby.isGameStarted()) return ws.send(JSON.stringify({ type: 'error', message: 'Игра уже началась' }));

  const team = lobby.addPlayer(player.id, player.name);
  if (!team) return ws.send(JSON.stringify({ type: 'error', message: 'Не удалось присоединиться' }));

  player.lobbyId = data.lobbyId;
  player.isHost = false;

  ws.send(JSON.stringify({
    type: 'lobby_joined',
    lobbyId: data.lobbyId,
    team: team,
    players: lobby.getPlayers(),
    hostId: lobby.getHostId()
  }));

  console.log(`👤 ${player.name} присоединился к ${data.lobbyId}`);
  broadcastLobbyUpdate(data.lobbyId);
  broadcastLobbyList();
}

function handleLeaveLobby(ws) {
  const player = players.get(ws);
  if (!player || !player.lobbyId) return;

  const lobbyId = player.lobbyId;
  const lobby = lobbyManager.getLobby(lobbyId);

  if (lobby) {
    lobby.removePlayer(player.id);
    if (lobby.isEmpty()) {
      lobbyManager.removeLobby(lobbyId);
      console.log(`🗑️ Лобби ${lobbyId} удалено (пустое)`);
    } else {
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
  ws.send(JSON.stringify({ type: 'left_lobby' }));
  broadcastLobbyList();
}

function handleStartGame(ws) {
  const player = players.get(ws);
  if (!player || !player.lobbyId) {
    return ws.send(JSON.stringify({ type: 'error', message: 'Вы не в лобби' }));
  }
  if (!player.isHost) {
    return ws.send(JSON.stringify({ type: 'error', message: 'Только хост может начать игру' }));
  }

  const lobby = lobbyManager.getLobby(player.lobbyId);
  if (!lobby) return ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
  if (lobby.isGameStarted()) return ws.send(JSON.stringify({ type: 'error', message: 'Игра уже началась' }));
  if (!lobby.isReadyToStart()) return ws.send(JSON.stringify({ type: 'error', message: 'Недостаточно игроков' }));

  console.log(`🎯 Хост ${player.name} запускает игру в ${player.lobbyId}`);

  const gameId = generateGameId();
  const game = new GameLogic(gameId);

  const playersInLobby = lobby.getPlayers();
  playersInLobby.forEach(p => game.addPlayer(p.id, p.name, p.team));

  games.set(gameId, game);

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

  game.startGame();

  // Автоматическая рассылка состояния
  const broadcastInterval = setInterval(() => {
    if (!game.isRunning) {
      clearInterval(broadcastInterval);
      return;
    }
    broadcastGameState(gameId);
  }, 50);
  game.broadcastInterval = broadcastInterval;

  playersInLobby.forEach(p => {
    const playerWs = findPlayerWebSocket(p.id);
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
      playerWs.send(JSON.stringify({
        type: 'game_started',
        gameId: gameId,
        team: p.team,
        duration: 120
      }));

      const state = game.getState();
      playerWs.send(JSON.stringify({
        type: 'game_state',
        state: state
      }));
    }
  });

  lobbyManager.removeLobby(player.lobbyId);
  broadcastLobbyList();

  console.log(`🎮 ИГРА ${gameId} УСПЕШНО ЗАПУЩЕНА! Игроков: ${playersInLobby.length}`);
}

function handleGameAction(ws, data) {
  const player = players.get(ws);
  if (!player || !player.gameId) return;
  const game = games.get(player.gameId);
  if (!game || !game.isRunning) return;

  if (data.action === 'kick') game.playerKick(player.id);
  else if (data.action === 'tackle') game.playerTackle(player.id);

  broadcastGameState(player.gameId);
}

function handlePlayerMovement(ws, data) {
  const player = players.get(ws);
  if (!player || !player.gameId) return;
  const game = games.get(player.gameId);
  if (!game || !game.isRunning) return;

  game.updatePlayerPosition(player.id, data.x, data.y);
}

// ========== НОВАЯ ФУНКЦИЯ ДЛЯ ОСТАНОВКИ ==========
function handlePlayerStop(ws) {
  const player = players.get(ws);
  if (!player || !player.gameId) return;
  
  const game = games.get(player.gameId);
  if (!game) return;
  
  game.stopPlayer(player.id);
}
// =================================================

function handleDisconnect(ws) {
  const player = players.get(ws);
  if (!player) return;

  console.log(`❌ ${player.name} отключился`);

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
    if (player.id === playerId) return ws;
  }
  return null;
}

function broadcastLobbyList() {
  const lobbies = lobbyManager.getPublicLobbies();
  for (const [ws, player] of players) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'lobbies_list', lobbies: lobbies }));
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Открыть: http://localhost:${PORT}`);
});
