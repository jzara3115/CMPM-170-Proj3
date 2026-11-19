// Temporary player/ball adapter. Teammates can replace it without changing the block/fruit module.
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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
    this.launchSide = 1;
    this.launchCooldown = 0;
    this.hasLaunched = false;
    this.allHeldTime = 0;
    this.lifeNotice = '';
  }
  start() { this.phase = 'playing'; }
  throwBall() {
    if (this.phase !== 'playing' || this.heldBalls === 0 || this.launchCooldown > 0) return false;
    const speed = 1 + this.stage * 0.1;
    this.balls.push({ x: this.player.x + this.player.width / 2 + this.launchSide * 12, y: this.player.y - 9, vx: this.launchSide * 165 * speed, vy: -850 * speed, radius: 7, state: 'airborne', floorTime: 0 });
    this.launchSide *= -1;
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
    this.player.x = Math.max(37, Math.min(this.width - 37 - this.player.width, this.player.x + direction * 430 * dt));
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
        if (block.destroyed || !overlaps({ x: ball.x - ball.radius, y: ball.y - ball.radius, width: ball.radius * 2, height: ball.radius * 2 }, block)) continue;
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
