export const SOIL_TYPES = Object.freeze({
  TOP: 'top',
  HARD: 'hard',
  CONDENSED: 'condensed',
});

export const POWERUP_TYPES = Object.freeze({
  BURST: 'burst',
});

const FRUIT_WIDTH = 16;
const FRUIT_HEIGHT = 18;
const SUPPORT_EPSILON = 0.05;

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

function overlapsHorizontally(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

/** Dirt durability, fruit reveal, gravity, and collection; dt is in seconds. */
export class BlockFruitSystem {
  constructor({ blocks = [], floorY = 600, gravity = 760, onEvent = () => {}, powerupChance = 0.18, powerupLimit = 3, rng = Math.random } = {}) {
    this.floorY = floorY;
    this.gravity = gravity;
    this.onEvent = onEvent;
    this.powerupChance = powerupChance;
    this.powerupLimit = powerupLimit;
    this.rng = rng;
    this.reset(blocks);
  }

  get remainingFruit() {
    return this._remainingFruit;
  }

  get totalFruit() {
    return this._totalFruit;
  }

  get remainingPowerups() {
    return this.powerups.filter(powerup => powerup.state !== 'collected').length;
  }

  reset(blocks = this._layout ?? []) {
    // Copy the layout so destroying blocks never changes the authored level.
    this._layout = blocks.map((block) => ({ ...block }));
    this.blocks = this._layout.map((block, index) => {
      const type = Object.values(SOIL_TYPES).includes(block.type)
        ? block.type : SOIL_TYPES.HARD;
      const maxHp = type === SOIL_TYPES.CONDENSED ? 2 : 1;
      return {
        ...block,
        id: block.id ?? `block-${index + 1}`,
        type,
        hasFruit: Boolean(block.hasFruit),
        hp: maxHp,
        maxHp,
        destroyed: false,
      };
    });
    this._blocksById = new Map(this.blocks.map((block) => [block.id, block]));
    this.fruits = this.blocks.filter((block) => block.hasFruit).map((block) => ({
      id: `fruit-${block.id}`,
      blockId: block.id,
      x: block.x + (block.width - FRUIT_WIDTH) / 2,
      y: block.y + (block.height - FRUIT_HEIGHT) / 2,
      width: FRUIT_WIDTH,
      height: FRUIT_HEIGHT,
      vy: 0,
      state: 'hidden',
    }));
    this._fruitsByBlockId = new Map(this.fruits.map((fruit) => [fruit.blockId, fruit]));
    this._totalFruit = this.fruits.length;
    this._remainingFruit = this._totalFruit;
    this._completionEmitted = false;
    this._powerupsEarned = 0;
    this.powerups = [];
    this._emitCount();
  }

  hitBlock(blockId) {
    const block = this._blocksById.get(blockId);
    if (!block || block.destroyed) {
      return { hit: false, destroyed: false, response: null };
    }

    block.hp = Math.max(0, block.hp - 1);
    const response = block.type === SOIL_TYPES.TOP ? 'passThrough' : 'bounce';
    if (block.hp > 0) return { hit: true, destroyed: false, response };

    block.destroyed = true;
    this.onEvent({ type: 'block-destroyed', blockId: block.id, block: { ...block } });
    if (this._powerupsEarned < this.powerupLimit && this.rng() < this.powerupChance) {
      this._powerupsEarned++;
      const powerup = {
        id: `powerup-${block.id}`,
        type: POWERUP_TYPES.BURST,
        x: block.x + block.width / 2 - 10,
        y: block.y + block.height / 2 - 10,
        width: 20,
        height: 20,
        vy: 0,
        state: 'falling',
      };
      this.powerups.push(powerup);
      this.onEvent({ type: 'powerup-dropped', powerupId: powerup.id, powerup: { ...powerup } });
    }
    const fruit = this._fruitsByBlockId.get(block.id);
    if (fruit && fruit.state === 'hidden') {
      fruit.state = 'falling';
      fruit.vy = 0;
      this.onEvent({ type: 'fruit-revealed', fruitId: fruit.id, fruit: { ...fruit } });
    }
    return { hit: true, destroyed: true, response };
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const liveBlocks = this.blocks.filter((block) => !block.destroyed);

    for (const fruit of this.fruits) {
      if (fruit.state === 'hidden' || fruit.state === 'collected') continue;
      const oldBottom = fruit.y + fruit.height;
      const supported = Math.abs(oldBottom - this.floorY) <= SUPPORT_EPSILON
        || liveBlocks.some((block) => overlapsHorizontally(fruit, block)
          && Math.abs(oldBottom - block.y) <= SUPPORT_EPSILON);

      if (fruit.state === 'resting' && supported) {
        fruit.vy = 0;
        continue;
      }
      if (fruit.state === 'resting') fruit.vy = 0;
      fruit.state = 'falling';

      const nextBottom = oldBottom + fruit.vy * dt + 0.5 * this.gravity * dt * dt;
      const nextVelocity = fruit.vy + this.gravity * dt;
      // Sweep across surfaces instead of testing only the end position. Fast
      // fruit therefore cannot tunnel through a thin block during a long frame.
      let landingY = nextBottom >= this.floorY ? this.floorY : Infinity;
      for (const block of liveBlocks) {
        if (overlapsHorizontally(fruit, block)
          && oldBottom <= block.y + SUPPORT_EPSILON
          && nextBottom >= block.y) {
          landingY = Math.min(landingY, block.y);
        }
      }

      if (landingY !== Infinity) {
        fruit.y = landingY - fruit.height;
        fruit.vy = 0;
        fruit.state = 'resting';
      } else {
        fruit.y = nextBottom - fruit.height;
        fruit.vy = nextVelocity;
      }
    }

    for (const powerup of this.powerups) {
      if (powerup.state === 'collected') continue;
      const oldBottom = powerup.y + powerup.height;

      if (powerup.state === 'resting' && oldBottom >= this.floorY - SUPPORT_EPSILON) {
        powerup.vy = 0;
        powerup.y = this.floorY - powerup.height;
        continue;
      }
      powerup.state = 'falling';

      const nextBottom = oldBottom + powerup.vy * dt + 0.5 * this.gravity * dt * dt;
      const nextVelocity = powerup.vy + this.gravity * dt;

      if (nextBottom >= this.floorY) {
        powerup.y = this.floorY - powerup.height;
        powerup.vy = 0;
        powerup.state = 'resting';
      } else {
        powerup.y = nextBottom - powerup.height;
        powerup.vy = nextVelocity;
      }
    }
  }

  collectInRect(rect) {
    let collected = 0;
    for (const fruit of this.fruits) {
      if (fruit.state === 'hidden' || fruit.state === 'collected'
        || !rectsOverlap(fruit, rect)) continue;
      fruit.state = 'collected';
      fruit.vy = 0;
      this._remainingFruit -= 1;
      collected += 1;
      this.onEvent({ type: 'fruit-collected', fruitId: fruit.id, fruit: { ...fruit } });
      this._emitCount();
    }

    // Empty levels do not instantly complete; a last pickup triggers completion.
    if (collected > 0 && this._remainingFruit === 0 && !this._completionEmitted) {
      this._completionEmitted = true;
      this.onEvent({ type: 'all-fruit-collected', ...this._countPayload() });
    }
    return collected;
  }

  collectPowerupsInRect(rect) {
    let collected = 0;
    for (const powerup of this.powerups) {
      if (powerup.state === 'collected' || !rectsOverlap(powerup, rect)) continue;
      powerup.state = 'collected';
      powerup.vy = 0;
      collected++;
      this.onEvent({ type: 'powerup-collected', powerupId: powerup.id, powerup: { ...powerup } });
    }
    return collected;
  }

  _countPayload() {
    return {
      remaining: this.remainingFruit,
      total: this.totalFruit,
      remainingFruit: this.remainingFruit,
      totalFruit: this.totalFruit,
    };
  }

  _emitCount() {
    this.onEvent({ type: 'fruit-count-changed', ...this._countPayload() });
  }
}
