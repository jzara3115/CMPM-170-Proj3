// Temporary player/ball adapter. Teammates can replace it without changing the block/fruit module.
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const segmentIntersectsRect = (x1, y1, x2, y2, rect) => {
  const left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
  const dx = x2 - x1, dy = y2 - y1;
  let near = 0, far = 1;
  for (const [p, q] of [[-dx, x1 - left], [dx, right - x1], [-dy, y1 - top], [dy, bottom - y1]]) {
    if (p === 0) { if (q < 0) return false; }
    else {
      const t = q / p;
      if (p < 0) { if (t > far) return false; near = Math.max(near, t); }
      else { if (t < near) return false; far = Math.min(far, t); }
    }
  }
  return near <= far;
};
export class DemoController {
  constructor(system, { width = 900, floorY = 604, stage = 0, lives = 3, onEvent = () => {} } = {}) {
    this.system = system;
    this.width = width;
    this.floorY = floorY;
    this.stage = stage;
    this.lives = lives;
    this.onEvent = onEvent;
    this.phase = 'ready';
    this.player = { x: width / 2 - 23, y: floorY - 44, width: 46, height: 44 };
    this.balls = [];
    this.heldBalls = 3;
    this.launchCooldown = 0;
    this.hasLaunched = false;
    this.allHeldTime = 0;
    this.lifeNotice = '';
    this.powerups = 0;
  }
  start() { this.phase = 'playing'; }
  throwBall() {
    if (this.phase !== 'playing' || this.heldBalls === 0 || this.launchCooldown > 0) return false;
    const empowered = this.powerups > 0;
    if (empowered) {
      this.powerups--;
      this.onEvent({ type: 'powerup-used' });
    }
    const speed = 1 + this.stage * 0.1;
    this.balls.push({
      x: this.player.x + this.player.width / 2,
      y: this.player.y - 9,
      vx: 0,
      vy: -850 * speed,
      radius: 7,
      state: 'airborne',
      floorTime: 0,
      empowered,
    });
    this.heldBalls--;
    this.launchCooldown = 0.18;
    this.hasLaunched = true;
    this.allHeldTime = 0;
    this.lifeNotice = '';
    this.onEvent({ type: 'throw' });
    return true;
  }
  update(dt, input = {}) {
    if (this.phase !== 'playing') return;
    this.launchCooldown = Math.max(0, this.launchCooldown - dt);
    const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
    const step = 430 * dt;
    const center = this.player.x + this.player.width / 2;
    const movement = input.targetX === undefined
      ? direction * step
      : Math.max(-step, Math.min(step, input.targetX - center));
    this.player.x = Math.max(37, Math.min(this.width - 37 - this.player.width, this.player.x + movement));
    let dropped = false;
    const kept = [];
    for (const ball of this.balls) {
      if (ball.state === 'grounded') {
        ball.floorTime += dt;
        if (Math.abs(ball.x - (this.player.x + this.player.width / 2)) < this.player.width / 2 + 10) {
          this.heldBalls++;
          this.onEvent({ type: 'catch' });
          continue;
        }
        if (ball.floorTime >= 3) { dropped = true; continue; }
        kept.push(ball);
        continue;
      }
      const oldX = ball.x;
      const oldY = ball.y;
      ball.vy += 700 * (1 + this.stage * 0.1) ** 2 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < 36 + ball.radius) { ball.x = 36 + ball.radius; ball.vx = Math.abs(ball.vx); }
      if (ball.x > this.width - 36 - ball.radius) { ball.x = this.width - 36 - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < 58 + ball.radius) { ball.y = 58 + ball.radius; ball.vy = Math.abs(ball.vy); }
      for (const block of this.system.blocks) {
        if (block.destroyed) continue;
        const ballRect = { x: ball.x - ball.radius, y: ball.y - ball.radius, width: ball.radius * 2, height: ball.radius * 2 };
        if (ball.empowered) {
          const hitTrajectory = segmentIntersectsRect(oldX, oldY, ball.x, ball.y, block)
            || overlaps(ballRect, block);
          if (hitTrajectory) {
            const remaining = block.hp;
            for (let hit = 0; hit < remaining; hit++) this.system.hitBlock(block.id);
            this.onEvent({
              type: 'burst-pierced',
              blockId: block.id,
              x: Math.max(block.x, Math.min(ball.x, block.x + block.width)),
              y: Math.max(block.y, Math.min(ball.y, block.y + block.height)),
              direction: Math.sign(ball.vy),
            });
          }
          continue;
        }
        if (!overlaps(ballRect, block)) continue;
        const result = this.system.hitBlock(block.id);
        if (result.response !== 'bounce') continue;
        if (oldY + ball.radius <= block.y) { ball.y = block.y - ball.radius - 0.1; ball.vy = -Math.abs(ball.vy); }
        else if (oldY - ball.radius >= block.y + block.height) { ball.y = block.y + block.height + ball.radius + 0.1; ball.vy = Math.abs(ball.vy); }
        else if (oldX < block.x) { ball.x = block.x - ball.radius - 0.1; ball.vx = -Math.abs(ball.vx); }
        else { ball.x = block.x + block.width + ball.radius + 0.1; ball.vx = Math.abs(ball.vx); }
        break;
      }
      if (ball.vy > 0 && oldY + ball.radius <= this.player.y + 8 && ball.y + ball.radius >= this.player.y && ball.x > this.player.x - 6 && ball.x < this.player.x + this.player.width + 6) {
        this.heldBalls++;
        this.onEvent({ type: 'catch' });
        continue;
      }
      if (ball.y + ball.radius >= this.floorY) {
        ball.y = this.floorY - ball.radius;
        ball.state = 'grounded';
        ball.floorTime = 0;
        this.onEvent({ type: 'drop' });
      }
      kept.push(ball);
    }
    this.balls = kept;
    this.system.collectInRect(this.player);
    const powerupsCollected = this.system.collectPowerupsInRect(this.player);
    if (powerupsCollected > 0) {
      this.powerups += powerupsCollected;
      this.onEvent({ type: 'powerups-changed', count: this.powerups });
    }
    if (dropped) this.loseLife('A ball stayed on the ground too long.');
    if (this.phase !== 'playing') return;
    // A short serve grace avoids an impossible instant loss after catching the final ball.
    if (this.hasLaunched && this.heldBalls === 3) {
      this.allHeldTime += dt;
      if (this.allHeldTime >= 1) this.loseLife('Keep at least one ball in the air.');
    } else this.allHeldTime = 0;
  }
  loseLife(reason) {
    this.lives--;
    this.balls = [];
    this.heldBalls = 3;
    this.hasLaunched = false;
    this.allHeldTime = 0;
    this.lifeNotice = reason;
    if (this.lives <= 0) this.phase = 'game-over';
    this.onEvent({ type: 'life-lost', reason, lives: this.lives });
  }
}
