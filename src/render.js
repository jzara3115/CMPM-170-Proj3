// Plain geometry deliberately keeps this prototype focused on mechanics.
export function renderPrototype(ctx, system, controller) {
  const width = 900, height = 650, floor = 604;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#707070';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 58, width - 72, floor - 58);
  const colors = { top: '#dbe6d6', hard: '#c7c7c7', condensed: '#929292' };
  for (const block of system.blocks) {
    if (block.destroyed) continue;
    ctx.fillStyle = colors[block.type] || colors.hard;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.strokeStyle = '#666666'; ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.width, block.height);
    ctx.fillStyle = '#202020'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '14px Arial, sans-serif';
    ctx.fillText(block.type === 'top' ? 'S' : String(block.hp), block.x + block.width / 2, block.y + block.height / 2);
  }
  for (const fruit of system.fruits) {
    if (fruit.state === 'hidden' || fruit.state === 'collected') continue;
    ctx.fillStyle = '#df852b'; ctx.beginPath();
    ctx.arc(fruit.x + fruit.width / 2, fruit.y + fruit.height / 2, fruit.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const player = controller.player;
  ctx.fillStyle = '#467db3';
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '16px Arial, sans-serif';
  ctx.fillText('P', player.x + player.width / 2, player.y + player.height / 2);
  for (const ball of controller.balls) {
    if (ball.state === 'grounded') {
      ctx.strokeStyle = '#df852b'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(ball.x, ball.y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - ball.floorTime / 3) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = ball.empowered ? '#f2c94c' : '#202020'; ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
    if (ball.empowered) {
      ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  for (const powerup of system.powerups) {
    if (powerup.state === 'collected') continue;
    ctx.fillStyle = '#f2c94c'; ctx.beginPath();
    ctx.arc(powerup.x + powerup.width / 2, powerup.y + powerup.height / 2, powerup.width / 2, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = '#555555'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = '14px Arial, sans-serif';
  ctx.fillText(controller.phase === 'playing' && !controller.hasLaunched ? 'Space or click to throw' : 'Clear the blocks below fruit so it can fall', width / 2, 634);
}
