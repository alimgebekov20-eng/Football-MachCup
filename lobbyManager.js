class Lobby {
  constructor(id, hostId, hostName, maxPlayers) {
    this.id = id;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
    this.gameStarted = false;
    this.createdAt = Date.now();
    this.addPlayer(hostId, hostName);
  }

  addPlayer(playerId, playerName) {
    if (this.players.size >= this.maxPlayers) return null;

    const team1Count = Array.from(this.players.values()).filter(p => p.team === 'team1').length;
    const team2Count = Array.from(this.players.values()).filter(p => p.team === 'team2').length;

    let team;
    if (this.maxPlayers === 2) {
      team = this.players.size === 0 ? 'team1' : 'team2';
    } else {
      if (team1Count < 2 && team1Count <= team2Count) team = 'team1';
      else if (team2Count < 2) team = 'team2';
      else return null;
    }

    this.players.set(playerId, { id: playerId, name: playerName, team: team });
    return team;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (playerId === this.hostId && this.players.size > 0) this.assignNewHost();
  }

  assignNewHost() {
    if (this.players.size === 0) return null;
    this.hostId = Array.from(this.players.keys())[0];
    return this.hostId;
  }

  getPlayers() { return Array.from(this.players.values()); }
  getHostId() { return this.hostId; }
  isFull() { return this.players.size >= this.maxPlayers; }
  isEmpty() { return this.players.size === 0; }

  isReadyToStart() {
    if (this.gameStarted || this.players.size < 2) return false;
    const teams = new Set();
    for (const p of this.players.values()) teams.add(p.team);
    return teams.size >= 2;
  }

  isGameStarted() { return this.gameStarted; }
  startGame() { this.gameStarted = true; }

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
  constructor() { this.lobbies = new Map(); }

  createLobby(id, hostId, hostName, maxPlayers) {
    const lobby = new Lobby(id, hostId, hostName, maxPlayers);
    this.lobbies.set(id, lobby);
    return lobby;
  }

  getLobby(id) { return this.lobbies.get(id); }
  removeLobby(id) { this.lobbies.delete(id); }

  getPublicLobbies() {
    const result = [];
    for (const [id, lobby] of this.lobbies) {
      if (!lobby.isGameStarted() && !lobby.isFull()) {
        result.push(lobby.getInfo());
      }
    }
    return result;
  }
}

module.exports = { LobbyManager, Lobby };
