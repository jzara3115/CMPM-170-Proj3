# Block and fruit integration / 土块和水果模块接入

The module owns block durability, fruit states, and fruit counts. The game controller owns ball motion, player movement, lives, and level changes.
模块负责土块耐久、水果状态和数量；游戏控制器负责球运动、玩家移动、生命及换关。

## Entry points / 调用接口

```js
import { BlockFruitSystem, SOIL_TYPES } from '../game/block-fruit-system.js';

const world = new BlockFruitSystem({
  blocks: level.blocks,
  floorY: 600,
  gravity: 760,
  onEvent: event => handleGameEvent(event),
});

const impact = world.hitBlock(blockId);
world.update(deltaSeconds);
world.collectInRect(playerBounds);
```

Each block input has `id`, `x`, `y`, `width`, `height`, `type`, and `hasFruit`. Positions use canvas coordinates; time uses seconds.
土块输入包含上述字段；位置采用画布坐标，时间单位为秒。

Call `hitBlock` once per valid ball contact. Its `response` is `passThrough`, `bounce`, or `null`; the ball controller applies the motion response.
每次有效碰撞只调用一次 `hitBlock`。返回值决定穿透、反弹或无操作，球控制器负责实际改变运动。

Read `world.blocks` and `world.fruits` to draw the scene. Read `remainingFruit` and `totalFruit` for the HUD. `reset(blocks)` initializes another level.
读取土块和水果状态绘制画面，读取剩余及总水果数更新界面；使用 `reset(blocks)` 初始化新关卡。

## Events / 事件

`onEvent` receives an object with a `type`: `block-destroyed`, `fruit-revealed`, `fruit-collected`, `fruit-count-changed`, or `all-fruit-collected`.
事件对象的 `type` 分别表示土块破坏、水果露出、水果收集、数量变化或全部收集。

Count hidden and revealed fruit together. Revealing does not reduce the count; collecting does. Completion fires once on the last collection, and the controller decides when to change levels.
隐藏与露出的水果都计入剩余数量；露出不减数量，拾取才减少。最后一次拾取仅触发一次完成通知，由控制器决定何时换关。

## Decisions to confirm / 团队待确认事项

- Proposed soil rules: topsoil breaks in one hit and permits passage; hard soil breaks in one hit and bounces; condensed soil takes two hits and bounces on both.
  暂定表土一击破坏并穿透，硬土一击破坏并反弹，压实土两击破坏且每次均反弹。
- The ball owner must prevent duplicate contact damage. Fruit rests on live blocks and falls again when its support is removed.
  球模块需要避免同一次接触重复扣耐久；水果会停在未破坏的土块上，支撑清除后继续下落。
- The demo allows a serve/startup grace period rather than losing a life immediately while all balls are held. Confirm the final timing and rules with the team.
  演示保留开局和发球宽限时间，避免持有所有球时立即失去生命；最终时长和规则需团队确认。
- Agree on who owns pickup bounds and level resets. Prototype 2 loads its sprites from `assets/` and renders them independently of collision bounds.
  明确拾取范围和关卡重置的负责人。原型 2 从 `assets/` 加载像素素材，渲染独立于碰撞范围。
