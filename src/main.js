import { BlockFruitSystem } from './game/block-fruit-system.js?v=large-fruit';
import { LEVELS } from './game/levels.js';
import { DemoController } from './demo/controller.js?v=burst-impact';
import { createRenderer } from './render.js?v=burst-impact';

const $ = id => document.getElementById(id);
const canvas = $('game');
const guide = $('field-guide');
const renderer = createRenderer(canvas.getContext('2d'));
const W = 900, FLOOR = 604;
const throwHint = matchMedia('(pointer: coarse)').matches
  ? 'Tap Throw ball to shoot straight up' : 'Press Space or click to shoot straight up';
const input = { left: false, right: false };
let stage = 0, system, controller, previous = 0, accumulator = 0, pendingClear = false;
let clock = 0, noticeUntil = 0;
let resumeAfterGuide = false;

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
  $('pause-button').textContent = phase === 'paused' ? 'Resume' : 'Pause';
  $('pause-button').setAttribute('aria-label', phase === 'paused' ? 'Resume game' : 'Pause game');
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
  const statuses = { playing: controller.hasLaunched ? 'Playing' : throwHint, paused: 'Paused', 'level-clear': 'Level complete', 'game-over': 'Game over' };
  $('game-status').textContent = statuses[controller.phase];
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
canvas.tabIndex = 0;
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
canvas.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); canvas.focus({ preventScroll: true }); controller.throwBall(); } });
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
for (const [id, key] of [['move-left', 'left'], ['move-right', 'right']]) {
  const button = $(id);
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); input[key] = true; });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { input[key] = false; });
}
$('throw-button').addEventListener('pointerdown', event => { event.preventDefault(); controller.throwBall(); });
loadLevel(0);
requestAnimationFrame(tick);
