class GameLogic {
  constructor(gameId) {
    this.gameId = gameId;
    this.isRunning = false;
    this.timer = 120;
    this.timerInterval = null;
    
    this.players = new Map();
    
    this.ball = {
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 8
    };
    
    this.field = {
      width: 800,
      height: 600,
      goalWidth: 100,
      goalHeight: 40
    };
    
    this.score = {
      team1: 0,
      team2: 0
    };
  }

  addPlayer(playerId, playerName, team) {
    const x = team === 'team1' ? 150 : 650;
    const y = 300 + (this.players.size % 2 === 0 ? -50 : 50);
    
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      team: team,
      x: x,
      y: y,
      targetX: x,
      targetY: y,
      radius: 15,
      hasBall: false,
      score: 0,
      speed: 3,
      direction: team === 'team1' ? 1 : -1
    });
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player && player.hasBall) {
      this.ball.vx = player.direction * 2;
      this.ball.vy = 0;
    }
    this.players.delete(playerId);
  }

  startGame() {
    if (this.players.size < 2) return;
    
    this.isRunning = true;
    this.timer = 120;
    this.resetPositions();
    this.startTimer();
    
    const firstPlayer = Array.from(this.players.values())[0];
    if (firstPlayer) {
      this.giveBall(firstPlayer.id);
    }
  }

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      this.timer--;
      if (this.timer <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  endGame() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  resetPositions() {
    let team1Count = 0;
    let team2Count = 0;
    
    for (const [id, player] of this.players) {
      if (player.team === 'team1') {
        player.x = 150 + (team1Count % 2 === 0 ? -30 : 30);
        player.y = 300 + (team1Count % 2 === 0 ? -50 : 50);
        team1Count++;
      } else {
        player.x = 650 + (team2Count % 2 === 0 ? -30 : 30);
        player.y = 300 + (team2Count % 2 === 0 ? -50 : 50);
        team2Count++;
      }
      player.hasBall = false;
    }
    
    this.ball.x = 400;
    this.ball.y = 300;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  giveBall(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    for (const [id, p] of this.players) {
      p.hasBall = false;
    }
    
    player.hasBall = true;
    this.ball.x = player.x + (player.team === 'team1' ? 20 : -20);
    this.ball.y = player.y;
  }

  playerKick(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.hasBall || !this.isRunning) return;
    
    const power = 8;
    const direction = player.direction;
    
    this.ball.vx = power * direction;
    this.ball.vy = (Math.random() - 0.5) * 2;
    player.hasBall = false;
    
    this.checkGoal();
  }

  playerTackle(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.hasBall || !this.isRunning) return;
    
    let tackled = false;
    for (const [id, target] of this.players) {
      if (id === playerId || !target.hasBall) continue;
      
      const distance = Math.hypot(player.x - target.x, player.y - target.y);
      if (distance < 40) {
        target.hasBall = false;
        this.giveBall(playerId);
        tackled = true;
        break;
      }
    }
    
    if (!tackled) {
      if (Math.hypot(player.x - this.ball.x, player.y - this.ball.y) < 30) {
        const angle = Math.atan2(this.ball.y - player.y, this.ball.x - player.x);
        this.ball.vx = Math.cos(angle) * 5;
        this.ball.vy = Math.sin(angle) * 5;
      }
    }
  }

  updatePlayerPosition(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player || !this.isRunning) return;
    
    x = Math.max(20, Math.min(this.field.width - 20, x));
    y = Math.max(20, Math.min(this.field.height - 20, y));
    
    player.targetX = x;
    player.targetY = y;
    
    if (x > player.x) {
      player.direction = 1;
    } else if (x < player.x) {
      player.direction = -1;
    }
  }

  checkGoal() {
    const goalMargin = 10;
    const ballX = this.ball.x;
    const ballY = this.ball.y;
    
    if (ballX < goalMargin + this.ball.radius &&
        ballY > this.field.height/2 - this.field.goalHeight/2 &&
        ballY < this.field.height/2 + this.field.goalHeight/2) {
      this.score.team2++;
      this.resetPositions();
      const player = Array.from(this.players.values()).find(p => p.team === 'team2');
      if (player) this.giveBall(player.id);
      return;
    }
    
    if (ballX > this.field.width - goalMargin - this.ball.radius &&
        ballY > this.field.height/2 - this.field.goalHeight/2 &&
        ballY < this.field.height/2 + this.field.goalHeight/2) {
      this.score.team1++;
      this.resetPositions();
      const player = Array.from(this.players.values()).find(p => p.team === 'team1');
      if (player) this.giveBall(player.id);
      return;
    }
  }

  update() {
    if (!this.isRunning) return;
    
    for (const [id, player] of this.players) {
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist > 2) {
        const speed = Math.min(player.speed, dist);
        player.x += (dx / dist) * speed;
        player.y += (dy / dist) * speed;
      }
    }
    
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;
    
    this.ball.vx *= 0.98;
    this.ball.vy *= 0.98;
    
    let ballOwner = null;
    for (const [id, player] of this.players) {
      if (player.hasBall) {
        ballOwner = player;
        break;
      }
    }
    
    if (ballOwner) {
      const offsetX = ballOwner.team === 'team1' ? 20 : -20;
      this.ball.x = ballOwner.x + offsetX;
      this.ball.y = ballOwner.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
    
    if (this.ball.x < this.ball.radius || this.ball.x > this.field.width - this.ball.radius) {
      this.ball.vx *= -0.5;
      this.ball.x = Math.max(this.ball.radius, Math.min(this.field.width - this.ball.radius, this.ball.x));
    }
    
    if (this.ball.y < this.ball.radius || this.ball.y > this.field.height - this.ball.radius) {
      this.ball.vy *= -0.5;
      this.ball.y = Math.max(this.ball.radius, Math.min(this.field.height - this.ball.radius, this.ball.y));
    }
    
    this.checkGoal();
  }

  getState() {
    const playersState = [];
    for (const [id, player] of this.players) {
      playersState.push({
        id: id,
        name: player.name,
        team: player.team,
        x: player.x,
        y: player.y,
        hasBall: player.hasBall,
        score: player.score
      });
    }
    
    return {
      players: playersState,
      ball: this.ball,
      score: this.score,
      timer: this.timer,
      isRunning: this.isRunning
    };
  }
}

module.exports = { GameLogic };
