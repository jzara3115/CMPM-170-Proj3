import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockFruitSystem, SOIL_TYPES } from '../src/game/block-fruit-system.js';

const block = (id, options = {}) => ({
  id,
  x: 30,
  y: 30,
  width: 80,
  height: 24,
  type: SOIL_TYPES.HARD,
  hasFruit: false,
  ...options,
});

function advance(system, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 120) {
    system.update(1 / 120);
  }
}

const wholeLevel = { x: -100, y: -100, width: 1200, height: 1000 };
const countEvents = (events, type) => events.filter(event => event.type === type).length;

test('soil types use their intended durability and ball response', () => {
  const system = new BlockFruitSystem({
    blocks: [
      block('top', { type: SOIL_TYPES.TOP }),
      block('hard'),
      block('dense', { type: SOIL_TYPES.CONDENSED }),
    ],
  });

  const top = system.hitBlock('top');
  assert.equal(top.hit, true);
  assert.equal(top.destroyed, true);
  assert.equal(top.response, 'passThrough');

  const hard = system.hitBlock('hard');
  assert.equal(hard.destroyed, true);
  assert.equal(hard.response, 'bounce');

  const firstDenseHit = system.hitBlock('dense');
  assert.equal(firstDenseHit.destroyed, false);
  assert.equal(firstDenseHit.response, 'bounce');
  const dense = system.blocks.find(item => item.id === 'dense');
  assert.equal(dense.maxHp, 2);
  assert.equal(dense.hp, 1);
  const secondDenseHit = system.hitBlock('dense');
  assert.equal(secondDenseHit.destroyed, true);
  assert.equal(secondDenseHit.response, 'bounce');
  assert.equal(dense.hp, 0);
});

test('repeat hits cannot destroy a block or reveal its fruit twice', () => {
  const events = [];
  const system = new BlockFruitSystem({
    blocks: [block('fruit', { hasFruit: true })],
    onEvent: event => events.push(event),
  });
  events.length = 0;

  system.hitBlock('fruit');
  const repeatedHit = system.hitBlock('fruit');
  const missingHit = system.hitBlock('missing');

  assert.equal(repeatedHit.hit, false);
  assert.equal(missingHit.hit, false);
  assert.equal(system.blocks[0].hp, 0);
  assert.equal(system.fruits.length, 1);
  assert.equal(countEvents(events, 'block-destroyed'), 1);
  assert.equal(countEvents(events, 'fruit-revealed'), 1);
});

test('hidden fruit stays still and cannot be collected', () => {
  const system = new BlockFruitSystem({
    blocks: [block('hidden', { hasFruit: true })],
    floorY: 300,
  });
  const fruit = system.fruits[0];
  const startY = fruit.y;

  advance(system, 1);
  assert.equal(fruit.state, 'hidden');
  assert.equal(fruit.y, startY);
  assert.equal(system.collectInRect(wholeLevel), 0);
  assert.equal(system.remainingFruit, 1);
});

test('revealing fruit preserves the count until a player collects it', () => {
  const events = [];
  const system = new BlockFruitSystem({
    blocks: [
      block('first', { hasFruit: true }),
      block('second', { x: 150, hasFruit: true }),
    ],
    onEvent: event => events.push(event),
  });
  events.length = 0;

  assert.equal(system.totalFruit, 2);
  assert.equal(system.remainingFruit, 2);
  system.hitBlock('first');
  assert.equal(system.remainingFruit, 2);
  assert.equal(system.collectInRect(wholeLevel), 1);
  assert.equal(system.remainingFruit, 1);
  assert.equal(system.totalFruit, 2);
  assert.equal(system.collectInRect(wholeLevel), 0);
  assert.equal(countEvents(events, 'fruit-collected'), 1);
  assert.equal(countEvents(events, 'all-fruit-collected'), 0);

  system.hitBlock('second');
  assert.equal(system.collectInRect(wholeLevel), 1);
  assert.equal(system.remainingFruit, 0);
  assert.equal(countEvents(events, 'all-fruit-collected'), 1);
  assert.equal(system.collectInRect(wholeLevel), 0);
  advance(system, 1);
  assert.equal(countEvents(events, 'all-fruit-collected'), 1);
});

test('fruit rests on dirt, then falls when that support is destroyed', () => {
  const system = new BlockFruitSystem({
    blocks: [
      block('source', { x: 20, y: 20, hasFruit: true }),
      block('support', { x: 0, y: 130, width: 140 }),
    ],
    floorY: 300,
    gravity: 760,
  });
  system.hitBlock('source');
  advance(system, 2);
  const fruit = system.fruits[0];

  assert.equal(fruit.state, 'resting');
  assert.ok(Math.abs(fruit.y + fruit.height - 130) < 0.001);
  const restingY = fruit.y;
  system.hitBlock('support');
  advance(system, 0.2);
  assert.ok(fruit.y > restingY, 'fruit should fall after its support disappears');

  advance(system, 3);
  assert.ok(Math.abs(fruit.y + fruit.height - 300) < 0.001);
  assert.equal(fruit.vy, 0);
  assert.equal(system.remainingFruit, 1);
});

test('fruit cannot be collected by a player rectangle that does not touch it', () => {
  const system = new BlockFruitSystem({
    blocks: [block('fruit', { hasFruit: true })],
    floorY: 300,
  });
  system.hitBlock('fruit');
  advance(system, 2);

  assert.equal(system.collectInRect({ x: 500, y: 260, width: 50, height: 40 }), 0);
  assert.equal(system.remainingFruit, 1);
  const fruit = system.fruits[0];
  assert.equal(system.collectInRect({
    x: fruit.x,
    y: fruit.y,
    width: fruit.width,
    height: fruit.height,
  }), 1);
  assert.equal(system.remainingFruit, 0);
});

test('reset restores hidden fruit and allows completion of the new level once', () => {
  const events = [];
  const recipe = [block('fruit', { hasFruit: true })];
  const system = new BlockFruitSystem({
    blocks: recipe,
    onEvent: event => events.push(event),
  });
  system.hitBlock('fruit');
  system.collectInRect(wholeLevel);
  assert.equal(countEvents(events, 'all-fruit-collected'), 1);

  system.reset(recipe);
  assert.equal(system.remainingFruit, 1);
  assert.equal(system.totalFruit, 1);
  assert.equal(system.blocks[0].destroyed, false);
  assert.equal(system.blocks[0].hp, 1);
  assert.equal(system.fruits[0].state, 'hidden');
  assert.equal(system.collectInRect(wholeLevel), 0);
  system.hitBlock('fruit');
  system.collectInRect(wholeLevel);
  system.collectInRect(wholeLevel);
  assert.equal(countEvents(events, 'all-fruit-collected'), 2);
});

test('levels without fruit do not trigger an automatic completion loop', () => {
  const events = [];
  const system = new BlockFruitSystem({
    blocks: [block('empty')],
    onEvent: event => events.push(event),
  });
  system.hitBlock('empty');
  advance(system, 2);
  system.collectInRect(wholeLevel);
  assert.equal(system.remainingFruit, 0);
  assert.equal(system.totalFruit, 0);
  assert.equal(countEvents(events, 'all-fruit-collected'), 0);
});

test('runtime damage and resets do not mutate authored level data', () => {
  const recipe = Object.freeze([
    Object.freeze(block('fruit', { type: SOIL_TYPES.CONDENSED, hasFruit: true })),
  ]);
  const original = JSON.stringify(recipe);
  const system = new BlockFruitSystem({ blocks: recipe, floorY: 300 });
  system.hitBlock('fruit');
  system.hitBlock('fruit');
  advance(system, 2);
  system.collectInRect(wholeLevel);
  system.reset(recipe);
  assert.equal(JSON.stringify(recipe), original);
  assert.notEqual(system.blocks, recipe);
  assert.notEqual(system.blocks[0], recipe[0]);
});
