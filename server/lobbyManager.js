class Lobby {
  constructor(id, hostId, hostName, maxPlayers) {
    this.id = id;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.players = new Map(); // playerId -> {id, name, team}
    this.gameStarted = false;
    this.createdAt = Date.now();
    
    // Добавляем хоста
    this.addPlayer(hostId, hostName);
  }

  addPlayer(playerId, playerName) {
    if (this.players.size >= this.maxPlayers) {
      return null;
    }

    // Определяем команду
    const team1Count = Array.from(this.players.values()).filter(p => p.team === 'team1').length;
    const team2Count = Array.from(this.players.values()).filter(p => p.team === 'team2').length;
    
    let team;
    if (this.maxPlayers === 2) {
      // 1v1: просто чередуем
      team = this.players.size === 0 ? 'team1' : 'team2';
    } else {
      // 2v2: максимум 2 на команду
      if (team1Count < 2 && team1Count <= team2Count) {
        team = 'team1';
      } else if (team2Count < 2) {
        team = 'team2';
      } else {
        return null; // Все места заняты
      }
    }

    const player = {
      id: playerId,
      name: playerName,
      team: team,
      isReady: false
    };

    this.players.set(playerId, player);
    return team;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    
    // Если удалили хоста, назначаем нового
    if (playerId === this.hostId && this.players.size > 0) {
      this.assignNewHost();
    }
  }

  assignNewHost() {
    if (this.players.size === 0) return null;
    
    const firstPlayer = Array.from(this.players.keys())[0];
    this.hostId = firstPlayer;
    return firstPlayer;
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getHostId() {
    return this.hostId;
  }

  isFull() {
    return this.players.size >= this.maxPlayers;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  isReadyToStart() {
    if (this.gameStarted) return false;
    if (this.players.size < 2) return false;
    
    // Проверяем, что в каждой команде есть игроки
    const teams = new Set();
    for (const player of this.players.values()) {
      teams.add(player.team);
    }
    
    return teams.size >= 2;
  }

  isGameStarted() {
    return this.gameStarted;
  }

  startGame() {
    this.gameStarted = true;
  }

  getInfo() {
    return {
      id: this.id,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      currentPlayers: this.players.size,
      players: this.getPlayers(),
      isFull: this.isFull(),
      isReady: this.isReadyToStart(),
      gameStarted: this.gameStarted
    };
  }
}

class LobbyManager {
  constructor() {
    this.lobbies = new Map(); // lobbyId -> Lobby
  }

  createLobby(id, hostId, hostName, maxPlayers) {
    const lobby = new Lobby(id, hostId, hostName, maxPlayers);
    this.lobbies.set(id, lobby);
    return lobby;
  }

  getLobby(id) {
    return this.lobbies.get(id);
  }

  removeLobby(id) {
    this.lobbies.delete(id);
  }

  getPublicLobbies() {
    const result = [];
    for (const [id, lobby] of this.lobbies) {
      if (!lobby.isGameStarted() && !lobby.isFull()) {
        result.push(lobby.getInfo());
      }
    }
    return result;
  }

  getLobbyByPlayer(playerId) {
    for (const [id, lobby] of this.lobbies) {
      if (lobby.players.has(playerId)) {
        return lobby;
      }
    }
    return null;
  }
}

module.exports = { LobbyManager, Lobby };
