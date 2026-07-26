class GameLogic {
  constructor(gameId) {
    this.gameId = gameId;
    this.isRunning = false;
    this.timer = 120;
    this.timerInterval = null;
    this.updateInterval = null;
    this.broadcastInterval = null; // 👈 ДЛЯ АВТО-РАССЫЛКИ

    this.players = new Map();

    this.ball = {
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 10,
    };

    this.field = {
      width: 800,
      height: 600,
      goalWidth: 80,
      goalHeight: 120,
    };

    this.score = {
      team1: 0,
      team2: 0,
    };
  }

  // Добавить игрока
  addPlayer(playerId, playerName, team) {
    if (this.players.has(playerId)) return;

    const isTeam1 = team === 'team1';
    const baseX = isTeam1 ? 150 : 650;
    const offsetY = this.players.size % 2 === 0 ? -40 : 40;

    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      team: team,
      x: baseX,
      y: 300 + offsetY,
      targetX: baseX,
      targetY: 300 + offsetY,
      radius: 18,
      hasBall: false,
      speed: 4,
      direction: isTeam1 ? 1 : -1,
    });
  }

  // Удалить игрока
  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  // Старт игры (запускает таймер и физику)
  startGame() {
    if (this.isRunning) return;
    if (this.players.size < 2) {
      console.log('❌ Недостаточно игроков для старта');
      return;
    }

    console.log(`✅ СТАРТ ИГРЫ ${this.gameId}`);
    this.isRunning = true;
    this.timer = 120;

    // Размещаем игроков и даем мяч первому
    this.resetPositions();

    // Запускаем таймер
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timer--;
      if (this.timer <= 0) {
        this.endGame();
      }
    }, 1000);

    // Запускаем цикл обновления (физика) 30 раз в секунду
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000 / 30);
  }

  // Завершить игру
  endGame() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    console.log(`🏁 Игра ${this.gameId} завершена`);
  }

  // Сброс позиций
  resetPositions() {
    let team1Count = 0;
    let team2Count = 0;

    for (const [id, player] of this.players) {
      if (player.team === 'team1') {
        player.x = 150 + (team1Count % 2 === 0 ? -35 : 35);
        player.y = 300 + (team1Count % 2 === 0 ? -40 : 40);
        team1Count++;
      } else {
        player.x = 650 + (team2Count % 2 === 0 ? -35 : 35);
        player.y = 300 + (team2Count % 2 === 0 ? -40 : 40);
        team2Count++;
      }
      player.hasBall = false;
    }

    this.ball.x = 400;
    this.ball.y = 300;
    this.ball.vx = 0;
    this.ball.vy = 0;

    // Даём мяч первому игроку
    const firstPlayer = Array.from(this.players.values())[0];
    if (firstPlayer) this.giveBall(firstPlayer.id);
  }

  // Дать мяч игроку
  giveBall(playerId) {
    for (const [id, p] of this.players) p.hasBall = false;
    const player = this.players.get(playerId);
    if (player) {
      player.hasBall = true;
      this.ball.x = player.x + (player.team === 'team1' ? 25 : -25);
      this.ball.y = player.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
  }

  // Удар
  playerKick(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.hasBall || !this.isRunning) return;

    const power = 9;
    this.ball.vx = power * player.direction;
    this.ball.vy = (Math.random() - 0.5) * 3;
    player.hasBall = false;

    this.checkGoal();
  }

  // Отбор
  playerTackle(playerId) {
    const player = this.players.get(playerId);
    if (!player || !this.isRunning) return;

    for (const [id, target] of this.players) {
      if (id === playerId || !target.hasBall) continue;
      const dist = Math.hypot(player.x - target.x, player.y - target.y);
      if (dist < 40) {
        target.hasBall = false;
        this.giveBall(playerId);
        break;
      }
    }
  }

  // Обновить позицию игрока (из клиента)
  updatePlayerPosition(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player || !this.isRunning) return;

    // Ограничения поля
    const margin = 25;
    player.targetX = Math.max(margin, Math.min(this.field.width - margin, x));
    player.targetY = Math.max(margin, Math.min(this.field.height - margin, y));

    // Направление
    if (x > player.x) player.direction = 1;
    else if (x < player.x) player.direction = -1;
  }

  // Проверка гола
  checkGoal() {
    const bx = this.ball.x;
    const by = this.ball.y;
    const goalY = this.field.height / 2;
    const goalHalf = this.field.goalHeight / 2;

    // Гол в левые ворота (team2 забивает)
    if (bx < 15 && by > goalY - goalHalf && by < goalY + goalHalf) {
      this.score.team2++;
      this.resetPositions();
      const p = Array.from(this.players.values()).find((pl) => pl.team === 'team2');
      if (p) this.giveBall(p.id);
      return;
    }

    // Гол в правые ворота (team1 забивает)
    if (bx > this.field.width - 15 && by > goalY - goalHalf && by < goalY + goalHalf) {
      this.score.team1++;
      this.resetPositions();
      const p = Array.from(this.players.values()).find((pl) => pl.team === 'team1');
      if (p) this.giveBall(p.id);
      return;
    }
  }

  // Обновление физики (вызывается по интервалу)
  update() {
    if (!this.isRunning) return;

    // --- Движение игроков к target ---
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

    // --- Физика мяча ---
    // Если мяч у игрока - следует за ним
    let ballOwner = null;
    for (const [id, p] of this.players) {
      if (p.hasBall) {
        ballOwner = p;
        break;
      }
    }

    if (ballOwner) {
      const offsetX = ballOwner.team === 'team1' ? 25 : -25;
      this.ball.x = ballOwner.x + offsetX;
      this.ball.y = ballOwner.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
    } else {
      // Движение мяча
      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;

      // Трение
      this.ball.vx *= 0.99;
      this.ball.vy *= 0.99;
      if (Math.abs(this.ball.vx) < 0.05) this.ball.vx = 0;
      if (Math.abs(this.ball.vy) < 0.05) this.ball.vy = 0;

      // Отскоки от стен
      const r = this.ball.radius;
      const w = this.field.width;
      const h = this.field.height;

      if (this.ball.x < r || this.ball.x > w - r) {
        this.ball.vx *= -0.6;
        this.ball.x = Math.max(r, Math.min(w - r, this.ball.x));
      }
      if (this.ball.y < r || this.ball.y > h - r) {
        this.ball.vy *= -0.6;
        this.ball.y = Math.max(r, Math.min(h - r, this.ball.y));
      }

      // Проверка голов
      this.checkGoal();
    }
  }

  // Получить состояние игры для клиента
  getState() {
    const playersState = [];
    for (const [id, player] of this.players) {
      playersState.push({
        id: player.id,
        name: player.name,
        team: player.team,
        x: player.x,
        y: player.y,
        hasBall: player.hasBall,
        radius: player.radius,
      });
    }

    return {
      players: playersState,
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        radius: this.ball.radius,
      },
      score: this.score,
      timer: this.timer,
      isRunning: this.isRunning,
    };
  }
}

module.exports = { GameLogic };
