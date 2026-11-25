# Breakin

A browser game prototype inspired by Breakout and Mr. Do!, based on the team's **CMPM 170 Design Doc - Breakin**.
基于团队设计文档的浏览器游戏原型，玩法参考 Breakout 与 Mr. Do!。

[GitHub Pages deployment / 线上部署](https://jzara3115.github.io/CMPM-170-Proj3/)

Prototype 2 adds original pixel art for the clown, fruit, three soil types, and juggling balls. Pick up a Burst charge to send the next ball straight through any soil it touches.
原型 2 加入原创像素美术，包括小丑、水果、三种土块和杂耍球。拾取穿透道具后，下一颗抛出的球会击碎并穿过沿途的土块。

## Run locally / 本地运行

Install Node.js 20 or newer. The pixel art is bundled in `assets/`. No package installation or game engine is required.
需要 Node.js 20 或更新版本，像素素材已包含在 `assets/`，无需安装第三方依赖或游戏引擎。

From this folder / 在本目录运行：

```sh
node scripts/serve.mjs
```

Open [localhost:5173](http://localhost:5173). To choose a port, run `node scripts/serve.mjs --port 5174`.
打开上述本地地址；如需指定端口，可使用上面的 `--port` 参数。

If npm is available, `npm run dev` starts the same server.
如果已安装 npm，也可以用 `npm run dev` 启动同一个服务。

## Play / 操作

Move with A/D or the left/right arrow keys. Throw with Space or a click. Up to three balls can be active.
使用 A/D 或左右方向键移动，空格或点击抛球，最多同时使用三个球。

P or Esc pauses; R restarts. Break dirt to reveal fruit, clear the blocks below it, and catch the falling fruit.
P 或 Esc 暂停，R 重新开始。打破土块露出水果，清除其下方阻挡，再接住掉落的水果。

## Check / 检查

```sh
node --test
```

Tests cover block durability, fruit support and falling, collection, reset, and completion signals.
测试覆盖土块耐久、水果支撑与下落、收集、重置及完成通知。

## Team handoff / 团队接入

- `src/game/block-fruit-system.js`: dirt and fruit rules / 土块和水果规则。
- `src/game/levels.js`: sample level layouts / 示例关卡布局。
- `src/demo/controller.js`: replaceable player/ball demo / 可替换的玩家和球演示逻辑。
- `src/main.js`: browser entry and presentation / 网页入口与画面。
- [Integration notes / 接入说明](docs/integration.md): module boundaries and decisions to confirm / 模块边界与待确认事项。
- `src/render.js` and `assets/`: art and effects / 美术与特效。
