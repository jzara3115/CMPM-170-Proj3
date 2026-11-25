const soilSprites = { top: 'topsoil', hard: 'hard-soil', condensed: 'dense-soil' };
const soilDebris = {
  top: ['#a9dc63', '#b07845', '#ebbb6b'],
  hard: ['#ffaf76', '#bc6748', '#8f493c'],
  condensed: ['#d4bad9', '#a584b0', '#76567f'],
};
const fruitSprites = ['orange', 'apple', 'pear'];
const sprites = {};
for (const name of [
  'cavern', 'clown-1', 'clown-2', 'ball', 'burst-ball', 'burst', ...fruitSprites,
  ...Object.values(soilSprites).flatMap(soil => [1, 2, 3].map(variant => `${soil}-${variant}`)),
]) {
  const image = new Image();
  const version = fruitSprites.includes(name) ? '?v=fruit-pickup' : '';
  image.src = new URL(`../assets/${name}.png${version}`, import.meta.url);
  sprites[name] = image;
}

const TAU = Math.PI * 2;

export function createRenderer(ctx) {
  let previousPlayerX = null;
  let facing = 1;
  let steps = 0;
  let particles = [];
  let fruitGains = [];

  function sprite(name, x, y, width, height) {
    const image = sprites[name];
    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, Math.round(x), Math.round(y), width, height);
    }
  }

  function drawSoil(block, index) {
    const { x, y, width, height, type, hp, maxHp } = block;
    sprite(`${soilSprites[type]}-${index % 3 + 1}`, x, y, width, height);
    if (hp < maxHp) {
      const center = x + width / 2;
      ctx.fillStyle = '#2a1a32';
      ctx.fillRect(center - 4, y + 2, 4, 7);
      ctx.fillRect(center - 2, y + 8, 6, 4);
      ctx.fillRect(center + 2, y + 11, 4, 7);
      ctx.fillRect(center + 4, y + 17, 6, 4);
      ctx.fillRect(center + 8, y + 20, 4, height - 22);
      ctx.fillRect(center - 5, y + 12, 9, 3);
      ctx.fillStyle = '#deabc1';
      ctx.fillRect(center + 12, y + 21, 2, 6);
      ctx.fillRect(center + 6, y + 11, 2, 6);
    }
  }

  function drawPlayer(player) {
    const movement = previousPlayerX === null ? 0 : player.x - previousPlayerX;
    if (movement) {
      facing = Math.sign(movement);
      steps += Math.abs(movement);
    }
    previousPlayerX = player.x;
    const frame = movement ? 1 + Math.floor(steps / 13) % 2 : 1;

    ctx.save();
    ctx.translate(Math.round(player.x + player.width / 2), player.y);
    ctx.scale(facing, 1);
    sprite(`clown-${frame}`, -25, 0, 50, player.height);
    ctx.restore();
  }

  function drawBall(ball) {
    const { x, y, radius, state, empowered } = ball;
    if (state === 'grounded') {
      ctx.strokeStyle = '#ffc86a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + Math.max(0, 1 - ball.floorTime / 3) * TAU);
      ctx.stroke();
    } else if (empowered) {
      const speed = Math.hypot(ball.vx, ball.vy) || 1;
      ctx.fillStyle = '#3ae4dc';
      for (let dot = 1; dot <= 5; dot++) {
        const size = 9 - dot;
        const offset = 7 + dot * 6;
        ctx.globalAlpha = (6 - dot) / 8;
        ctx.fillRect(Math.round(x - ball.vx / speed * offset - size / 2),
          Math.round(y - ball.vy / speed * offset - size / 2), size, size);
      }
      ctx.globalAlpha = 1;
    }
    sprite(empowered ? 'burst-ball' : 'ball', x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawParticles(dt) {
    for (const particle of particles) {
      particle.age += dt;
      const { x, y, age, life, vx, vy, size, color } = particle;
      if (age >= life) continue;
      ctx.globalAlpha = 1 - age / life;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x + vx * age), Math.round(y + vy * age + 165 * age ** 2), size, size);
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(particle => particle.age < particle.life);
  }

  function drawFruitGains(dt) {
    const duration = .72;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 26px ui-monospace, monospace';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#21182f';
    ctx.fillStyle = '#d5fb8b';
    for (const gain of fruitGains) {
      gain.age += dt;
      if (gain.age >= duration) continue;
      const y = Math.round(gain.y - 48 * gain.age);
      ctx.globalAlpha = Math.min(1, (duration - gain.age) / .25);
      ctx.strokeText('+1', gain.x, y);
      ctx.fillText('+1', gain.x, y);
    }
    ctx.restore();
    fruitGains = fruitGains.filter(gain => gain.age < duration);
  }

  return {
    reset() {
      previousPlayerX = null;
      facing = 1;
      steps = 0;
      particles = [];
      fruitGains = [];
    },
    onBlockDestroyed(block) {
      const colors = soilDebris[block.type];
      for (let index = 0; index < 10; index++) {
        particles.push({
          x: block.x + block.width * (index + 1) / 11,
          y: block.y + block.height / 2,
          vx: 19 * (index - 4.5),
          vy: -32 - index % 4 * 28,
          size: 3 + index % 4,
          color: colors[index % colors.length],
          age: 0,
          life: .28 + index % 4 * .06,
        });
      }
    },
    onFruitCollected(fruit) {
      const x = Math.round(fruit.x + fruit.width / 2);
      const nearby = fruitGains.filter(gain => Math.abs(gain.x - x) < 30 && gain.age < .16).length;
      fruitGains.push({ x, y: Math.round(fruit.y - 8 - nearby * 25), age: 0 });
    },
    render(system, controller, dt) {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#211c31';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      sprite('cavern', 0, 0, ctx.canvas.width, ctx.canvas.height);

      system.blocks.forEach((block, index) => {
        if (!block.destroyed) drawSoil(block, index);
      });
      drawParticles(dt);
      system.fruits.forEach((fruit, index) => {
        if (fruit.state === 'hidden' || fruit.state === 'collected') return;
        sprite(fruitSprites[index % fruitSprites.length], fruit.x, fruit.y, fruit.width, fruit.height);
      });
      for (const powerup of system.powerups) {
        if (powerup.state === 'collected') continue;
        const { x, y, width, height } = powerup;
        ctx.fillStyle = '#5cfbe433';
        ctx.fillRect(Math.round(x + 2), Math.round(y - 2), width - 4, height + 2);
        ctx.fillRect(Math.round(x - 2), Math.round(y + 2), width + 4, height - 4);
        sprite('burst', x, y, width, height);
      }
      drawPlayer(controller.player);
      for (const ball of controller.balls) drawBall(ball);
      if (fruitGains.length) drawFruitGains(dt);
    },
  };
}
