import { SOIL_TYPES } from './block-fruit-system.js';

const FIRST_ROW_Y = 142; // Leave room above the soil for the in-game HUD.
const TYPES = { T: SOIL_TYPES.TOP, H: SOIL_TYPES.HARD, C: SOIL_TYPES.CONDENSED };

// Eight aligned columns leave generous space at both walls. A star marks fruit;
// a dot leaves a clear shaft. Stacked columns make clearing fruit support visible.
function makeBlocks(levelId, rows) {
  return rows.flatMap((row, rowIndex) => row.split(' ').flatMap((cell, column) => {
    if (cell === '.') return [];
    return [{
      id: `${levelId}-r${rowIndex}-c${column}`,
      x: 141 + column * 78,
      y: FIRST_ROW_Y + rowIndex * 36,
      width: 72,
      height: 30,
      type: TYPES[cell[0]],
      hasFruit: cell.includes('*'),
    }];
  }));
}

export const LEVELS = [
  {
    id: 'first-harvest',
    name: 'First Harvest',
    subtitle: 'Clear soft soil, uncover fruit, and open a path down.',
    blocks: makeBlocks('first-harvest', [
      'T* T T* . . T* T T*',
      '. H T . . T H .',
      '. . T H* H T . .',
    ]),
  },
  {
    id: 'buried-orchard',
    name: 'Buried Orchard',
    subtitle: 'Hard soil bounces balls. Dense soil takes two hits.',
    blocks: makeBlocks('buried-orchard', [
      'H* H H* . . H* H H*',
      'T H T C C T H T',
      '. . H* T T H* . .',
      '. H T . . T H .',
    ]),
  },
  {
    id: 'deep-roots',
    name: 'Deep Roots',
    subtitle: 'Carve channels through dense soil to free the last harvest.',
    blocks: makeBlocks('deep-roots', [
      'C* H C* H H C* H C*',
      'H T H C C H T H',
      '. C* T H H T C* .',
      'T H . H* H . H T',
      '. T . . . . T .',
    ]),
  },
];
