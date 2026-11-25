import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoController } from '../src/demo/controller.js';
import { BlockFruitSystem } from '../src/game/block-fruit-system.js';

function setup(options = {}) {
  const events = [];
  const system = new BlockFruitSystem({ blocks: [], floorY: 604 });
  const controller = new DemoController(system, {
    onEvent: event => events.push(event),
    ...options,
  });
  return { controller, system, events };
}

const eventCount = (events, type) => events.filter(event => event.type === type).length;

function arrangeCatch(controller) {
  const ball = controller.balls.at(-1);
  Object.assign(ball, {
    x: controller.player.x + controller.player.width / 2,
    y: controller.player.y - 12,
    vx: 0,
    vy: 120,
    state: 'airborne',
  });
}

test('the ready state prevents movement and throwing until the player starts', () => {
  const { controller, events } = setup();
  const startX = controller.player.x;

  assert.equal(controller.throwBall(), false);
  controller.update(1, { right: true });
  assert.equal(controller.player.x, startX);
  assert.equal(controller.heldBalls, 3);
  assert.equal(controller.balls.length, 0);
  assert.equal(events.length, 0);

  controller.start();
  assert.equal(controller.phase, 'playing');
  assert.equal(controller.throwBall(), true);
  assert.equal(controller.heldBalls, 2);
  assert.equal(controller.balls.length, 1);
  assert.equal(eventCount(events, 'throw'), 1);
});

test('throw cooldown and finite inventory prevent spawning more than three balls', () => {
  const { controller, events } = setup();
  controller.start();

  assert.equal(controller.throwBall(), true);
  assert.equal(controller.throwBall(), false, 'an immediate repeat must respect cooldown');
  controller.update(0.2);
  assert.equal(controller.throwBall(), true);
  controller.update(0.2);
  assert.equal(controller.throwBall(), true);
  controller.update(0.2);
  assert.equal(controller.throwBall(), false, 'no fourth ball exists in the inventory');

  assert.equal(controller.heldBalls, 0);
  assert.equal(controller.balls.length, 3);
  assert.equal(eventCount(events, 'throw'), 3);
  assert.ok(controller.balls.every(ball => ball.state === 'airborne'));
});

test('movement responds to direction and clamps the player inside both field edges', () => {
  const { controller } = setup();
  controller.start();
  const startX = controller.player.x;

  controller.update(0.1, { right: true });
  assert.ok(controller.player.x > startX);
  controller.update(10, { right: true });
  const rightEdge = controller.player.x;
  assert.ok(rightEdge + controller.player.width <= controller.width);
  controller.update(1, { right: true });
  assert.equal(controller.player.x, rightEdge);

  controller.update(10, { left: true });
  const leftEdge = controller.player.x;
  assert.ok(leftEdge >= 0);
  assert.ok(leftEdge < rightEdge);
  controller.update(1, { left: true });
  assert.equal(controller.player.x, leftEdge);
  controller.update(0.1, { left: true, right: true });
  assert.equal(controller.player.x, leftEdge, 'opposing inputs cancel each other');
});

test('catching a descending ball returns it to inventory exactly once', () => {
  const { controller, events } = setup();
  controller.start();
  controller.throwBall();
  arrangeCatch(controller);

  controller.update(0.05);
  assert.equal(controller.balls.length, 0);
  assert.equal(controller.heldBalls, 3);
  assert.equal(eventCount(events, 'catch'), 1);
  controller.update(0.1);
  assert.equal(controller.heldBalls, 3);
  assert.equal(eventCount(events, 'catch'), 1);
});

test('a fallen ball can be recovered before its ground timer expires', () => {
  const { controller, events } = setup();
  controller.start();
  controller.throwBall();
  Object.assign(controller.balls[0], {
    state: 'grounded',
    x: controller.player.x + controller.player.width / 2,
    floorTime: 2,
  });

  controller.update(0.1);
  assert.equal(controller.balls.length, 0);
  assert.equal(controller.heldBalls, 3);
  assert.equal(controller.lives, 3);
  assert.equal(eventCount(events, 'catch'), 1);
  assert.equal(eventCount(events, 'life-lost'), 0);
});

test('multiple ground timeouts in one frame cost one life and reset the full inventory', () => {
  const { controller, events } = setup();
  controller.start();
  controller.throwBall();
  controller.update(0.2);
  controller.throwBall();
  controller.balls.forEach((ball, index) => {
    Object.assign(ball, {
      state: 'grounded',
      x: 80 + index * 80,
      floorTime: 2.99,
    });
  });

  controller.update(0.02);
  assert.equal(controller.lives, 2);
  assert.equal(controller.heldBalls, 3);
  assert.equal(controller.balls.length, 0);
  assert.equal(controller.hasLaunched, false);
  assert.equal(controller.phase, 'playing');
  assert.equal(eventCount(events, 'life-lost'), 1);

  controller.update(2);
  assert.equal(controller.lives, 2, 'a reset round must not inherit expired ball timers');
  assert.equal(eventCount(events, 'life-lost'), 1);
});

test('holding all balls allows an initial serve and a short relaunch grace after catches', () => {
  const { controller, events } = setup();
  controller.start();
  controller.update(5);
  assert.equal(controller.lives, 3, 'waiting to serve must not lose a life');

  controller.throwBall();
  arrangeCatch(controller);
  controller.update(0.05);
  controller.update(0.5);
  assert.equal(controller.lives, 3);
  assert.equal(controller.throwBall(), true, 'a relaunch during grace keeps the round alive');
  assert.equal(controller.allHeldTime, 0);

  arrangeCatch(controller);
  controller.update(0.05);
  controller.update(1);
  assert.equal(controller.lives, 2);
  assert.equal(controller.heldBalls, 3);
  assert.equal(controller.hasLaunched, false);
  assert.equal(eventCount(events, 'life-lost'), 1);
});

test('pausing freezes the player, balls, inventory, and timers', () => {
  const { controller, events } = setup();
  controller.start();
  controller.throwBall();
  controller.phase = 'paused';
  const before = JSON.stringify({
    player: controller.player,
    balls: controller.balls,
    heldBalls: controller.heldBalls,
    lives: controller.lives,
    launchCooldown: controller.launchCooldown,
    allHeldTime: controller.allHeldTime,
  });
  const previousEvents = events.length;

  controller.update(10, { right: true });
  assert.equal(controller.throwBall(), false);
  assert.equal(JSON.stringify({
    player: controller.player,
    balls: controller.balls,
    heldBalls: controller.heldBalls,
    lives: controller.lives,
    launchCooldown: controller.launchCooldown,
    allHeldTime: controller.allHeldTime,
  }), before);
  assert.equal(events.length, previousEvents);
});

test('the last lost life ends the round and prevents further play', () => {
  const { controller, events } = setup({ lives: 1 });
  controller.start();
  controller.throwBall();
  Object.assign(controller.balls[0], { state: 'grounded', x: 80, floorTime: 2.99 });

  controller.update(0.02);
  assert.equal(controller.lives, 0);
  assert.equal(controller.phase, 'game-over');
  assert.equal(controller.throwBall(), false);
  const startX = controller.player.x;
  controller.update(1, { right: true });
  assert.equal(controller.player.x, startX);
  assert.equal(controller.lives, 0);
  assert.equal(eventCount(events, 'life-lost'), 1);
});

test('powerup pickup creates a one-use empowered throw', () => {
  const { controller, system } = setup();
  system.powerups.push({
    id: 'powerup-test', type: 'burst',
    x: controller.player.x, y: controller.player.y,
    width: 20, height: 20, vy: 0, state: 'resting',
  });
  controller.start();
  controller.update(0.01);
  assert.equal(controller.powerups, 1);

  assert.equal(controller.throwBall(), true);
  assert.equal(controller.powerups, 0);
  assert.equal(controller.balls[0].empowered, true);
});
