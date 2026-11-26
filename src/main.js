import { BlockFruitSystem } from './game/block-fruit-system.js?v=large-fruit';
import { LEVELS } from './game/levels.js';
import { DemoController } from './demo/controller.js?v=arena-touch';
import { createRenderer } from './render.js?v=burst-impact';

const $ = id => document.getElementById(id);
const canvas = $('game');
const guide = $('field-guide');
const renderer = createRenderer(canvas.getContext('2d'));
const W = 900, FLOOR = 604;
const input = { left: false, right: false };
let stage = 0, system, controller, previous = 0, accumulator = 0, pendingClear = false;
let clock = 0, noticeUntil = 0;
let resumeAfterGuide = false;
let drag = null;

function onEvent(event) {
  if (event.type === 'block-destroyed') renderer.onBlockDestroyed(event.block);
  if (event.type === 'burst-pierced') renderer.onBurstPierced(event);
  if (event.type === 'powerups-changed') {
    $('round-notice').textContent = 'Burst ready! Your next throw pierces soil.';
    noticeUntil = clock + 2.3;
  }
  if (event.type === 'powerup-used') {
    $('round-notice').textContent = 'Burst throw!';
    noticeUntil = clock + .8;
  }
  if (event.type === 'fruit-collected') renderer.onFruitCollected(event.fruit);
  if (event.type === 'all-fruit-collected') pendingClear = true;
  if (event.type === 'life-lost') {
    $('round-notice').textContent = event.reason;
    noticeUntil = clock + 2.3;
  }
}
function loadLevel(index, lives = 3) {
  stage = index;
  clearDrag();
  renderer.reset();
  pendingClear = false;
  system = new BlockFruitSystem({ blocks: LEVELS[stage].blocks, floorY: FLOOR, fruitGravity: 460, onEvent });
  controller = new DemoController(system, { width: W, floorY: FLOOR, stage, lives, onEvent });
  $('round-notice').textContent = '';
  noticeUntil = 0;
  controller.start();
  showOverlay();
  updateHud();
}
function showOverlay() {
  const phase = controller.phase;
  const hidden = phase === 'playing';
  $('overlay').hidden = hidden;
  $('pause-button').disabled = ['level-clear', 'game-over'].includes(phase);
  const pauseAction = phase === 'paused' ? 'Resume' : 'Pause';
  $('pause-button').title = pauseAction;
  $('pause-button').setAttribute('aria-label', `${pauseAction} game`);
  $('pause-icon').hidden = phase === 'paused';
  $('resume-icon').hidden = phase !== 'paused';
  const states = {
    paused: ['Paused', 'The game is paused.', 'Resume', 'Press P or Esc to resume.'],
    'level-clear': [stage === LEVELS.length - 1 ? 'Prototype complete' : 'Level complete', `Collected ${system.totalFruit} / ${system.totalFruit} fruit.`, stage === LEVELS.length - 1 ? 'Play again' : 'Next level', stage === LEVELS.length - 1 ? 'All three sample levels cleared.' : 'The balls move faster in the next level.'],
    'game-over': ['Game over', 'All lives used. Catch dropped balls before the timer runs out.', 'Try again', 'Press R to restart.'],
  };
  if (hidden) return;
  const [title, description, button, footnote] = states[phase];
  $('overlay-title').textContent = title;
  $('overlay-description').textContent = description;
  $('start-button').textContent = button;
  $('overlay-footnote').textContent = footnote;
}
function advance() {
  if (controller.phase === 'paused') togglePause();
  else if (controller.phase === 'level-clear' && stage < LEVELS.length - 1) loadLevel(stage + 1, controller.lives);
  else loadLevel(0);
  canvas.focus({ preventScroll: true });
}
function togglePause() {
  if (!['playing', 'paused'].includes(controller.phase)) return;
  controller.phase = controller.phase === 'playing' ? 'paused' : 'playing';
  input.left = input.right = false;
  clearDrag();
  showOverlay();
  if (controller.phase === 'playing') canvas.focus({ preventScroll: true });
}
function updateHud() {
  $('stage-number').textContent = String(stage + 1).padStart(2, '0');
  $('stage-name').textContent = LEVELS[stage].name;
  $('fruit-count').textContent = `${system.totalFruit - system.remainingFruit} / ${system.totalFruit}`;
  $('lives').textContent = String(controller.lives);
  $('lives').setAttribute('aria-label', `${controller.lives} lives`);
  $('balls-count').textContent = `${controller.heldBalls} / 3`;
  $('powerup-count').textContent = `${controller.powerups} / 3`;
  $('burst-stat').classList.toggle('charged', controller.powerups > 0);
  if (controller.phase === 'playing' && clock > noticeUntil) {
    $('round-notice').textContent = controller.allHeldTime > .25 ? 'Throw a ball to keep juggling!' : controller.balls.some(ball => ball.state === 'grounded') ? 'Pick up the fallen ball!' : '';
  } else if (controller.phase !== 'playing') $('round-notice').textContent = '';
}
function tick(time) {
  const dt = previous ? Math.min((time - previous) / 1000, .05) : 0;
  previous = time;
  clock += dt;
  if (controller.phase === 'playing') {
    accumulator += dt;
    while (accumulator >= 1 / 120 && controller.phase === 'playing') {
      system.update(1 / 120);
      controller.update(1 / 120, input);
      accumulator -= 1 / 120;
      if (pendingClear) { controller.phase = 'level-clear'; pendingClear = false; showOverlay(); }
      if (controller.phase === 'game-over') showOverlay();
    }
  } else accumulator = 0;
  renderer.render(system, controller, controller.phase === 'paused' ? 0 : dt);
  updateHud();
  requestAnimationFrame(tick);
}
canvas.tabIndex = -1;
$('guide-button').addEventListener('click', () => {
  resumeAfterGuide = controller.phase === 'playing';
  if (resumeAfterGuide) togglePause();
  guide.showModal();
  updateHud();
});
guide.addEventListener('close', () => {
  if (resumeAfterGuide && controller.phase === 'paused' && !document.hidden) togglePause();
  resumeAfterGuide = false;
  updateHud();
});
$('start-button').addEventListener('click', advance);
$('pause-button').addEventListener('click', togglePause);
$('restart-button').addEventListener('click', () => {
  loadLevel(0);
  canvas.focus({ preventScroll: true });
});
function clearDrag() {
  drag = null;
  delete input.targetX;
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || controller.phase !== 'playing') return;
  event.preventDefault();
  if (event.pointerType !== 'touch') {
    canvas.focus({ preventScroll: true });
    controller.throwBall();
    return;
  }
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    playerCenter: controller.player.x + controller.player.width / 2,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.id) return;
  const dx = event.clientX - drag.x;
  if (!drag.moved && Math.hypot(dx, event.clientY - drag.y) < 7) return;
  drag.moved = true;
  input.targetX = drag.playerCenter + dx * W / canvas.clientWidth;
});
canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== drag?.id) return;
  if (!drag.moved) controller.throwBall();
  clearDrag();
});
for (const eventName of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventName, event => {
    if (event.pointerId === drag?.id) clearDrag();
  });
}
document.addEventListener('keydown', event => {
  if (guide.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (key === ' ' && event.target.closest('button')) return;
  if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'a' || key === 'arrowleft') input.left = true;
  if (key === 'd' || key === 'arrowright') input.right = true;
  if (key === ' ' && !event.repeat) controller.throwBall();
  if ((key === 'p' || key === 'escape') && !event.repeat) togglePause();
  if (key === 'r' && !event.repeat) loadLevel(0);
});
document.addEventListener('keyup', event => { const key = event.key.toLowerCase(); if (key === 'a' || key === 'arrowleft') input.left = false; if (key === 'd' || key === 'arrowright') input.right = false; });
window.addEventListener('blur', () => { input.left = input.right = false; if (controller.phase === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && controller.phase === 'playing') togglePause(); });
loadLevel(0);
requestAnimationFrame(tick);
