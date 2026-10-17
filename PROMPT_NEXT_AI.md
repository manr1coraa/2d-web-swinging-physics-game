# ПРОМПТ ДЛЯ СЛЕДУЮЩЕГО ИИ-АГЕНТА (handoff)

Ты продолжаешь работу над игрой **WEBBY!** в репозитории
`manr1coraa/2d-web-swinging-physics-game`, чекаут `/home/user/2d-web-swinging-physics-game`.
Сессия зафиксирована на ветке `arena/a3756672-2d-web-swinging-physics-game` — работай
ТОЛЬКО на ней (коммить, пушить, PR — только с неё; не создавай и не чекауть другие ветки).
Последний коммит с актуальным состоянием на момент передачи: смотри `git log -1`
(коммит с текстом "WEBBY!: city of rooftops, spider-person, auto-web parkour").

## Что уже готово и принято (НЕ переделывать с нуля)

1. Персонаж — человечек-паучок (маска с линзами, эмблема, IK-руки/ноги, позы
   swing/run/land/glide/fall/tuck), а не паук. Рендер: `src/game/renderer.ts`.
2. Мир — бесконечный город плоских/неплоских 2D-крыш (`src/game/world.ts`):
   уступы, террасы, скатные крыши (невысокие), надстройки; фасады с окнами;
   улица внизу — единственная смертельная поверхность. **Потолка нет вообще**
   (`cam.y` не ограничен). lazy-генерация с pruning по x.
3. Автоатака паутины: в воздухе шёлк сам цепляется за ближайший подходящий якорь
   (`engine.findBestAnchor`): ledge-углы парапетов, props (труба/бак/мачта/кран/…),
   wall-точки на фасадах. Пунктир-прицел рисуется. Удержание = pump + **reel вверх
   по нити** (REEL_IN=190), релиз = полёт + cooldown; PERFECT-релиз = только более
   длинная дуга, без ускорителя. Mantle: дотянул нить до края — забежал на крышу.
   Wall-kick: прыжок от фасада (`Game.wallDir`). Глайд с апдрафтом от скорости.
4. Паркур: бег A/D, прыжок W с coyote, спины/флипы с flow-комбо, стомбл на
   медленных ударах, смерть на быстрых (`CRASH_SPEED`), дроны летальны,
   soft-props пробиваются.
5. Уровни-районы по 250 м, 8 тем (`themes.ts`), цикл бесконечный; чекпоинт —
   деревянная арка Waymark с обручем над крышей (пройти сквозь отверстие, без
   магнетизма); сохранение `localStorage webby_save_v2` (unlocked/continue/стата).
6. UI: HUD с чипами, меню с каруселью районов, Field guide (скролл), панели
   Paused / Checkpoint cleared / Run over; тач-кнопки ≥48px + safe-area.
7. A/B: `tools/orig/*` — замороженная rigid-база; `tools/ab.ts` сравнивает её с
   пружинной верёвкой (константы пружины в `engine.ts` менять нельзя без правки ab).

## Незавершено (основная работа следующего агента)

1. **Перевести регресс-тулзы на городской World API** (сейчас они на старом API
   и не собираются/падают): `tools/mechanics.ts` (импортирует удалённые
   `themeForLevel/worldOfLevel/LEVELS_PER_WORLD` → использовать `districtForLevel`/
   `DISTRICTS`), `tools/ab.ts` (flatten() под старый World + assert maxSpeed ≤851,
   а новый `MAXV=900` → согласовать порог), `tools/e2e.ts`, `tools/trace.ts`
   (читает `kind === "spire"`), `tools/spike.ts` (хардкодит приватные методы
   рендера), `tools/shot.ts`, `tools/spidershot.ts`. Рабочие сейчас:
   `sim`, `gaps`, `lazy`, `bot`, `render`.
2. Пересобрать ignored-бандлы (команды в README, секция "Tools & regression
   checks": `npx --prefix tools esbuild ...`), затем прогнать ВСЁ:
   `npx tsc --noEmit`, `npm run build`, `node tools/mechanics.cjs`,
   `node tools/ab.cjs`, `node tools/gaps.cjs`, `node tools/sim.cjs SAFE 1..8`,
   `node tools/lazy.cjs 1`, `node tools/e2e.mjs`, `node tools/perf.mjs`.
3. **Геймплейная доводка бота/физики в узких переулках**: после ledge-прыжка бот
   порой падает в переулок и oscillates на wall-якоре (x≈1230); mantle и
   stall-release уже есть и помогают, но бот не пользуется wall-kick (`jump()`
   при `wallDir !== 0`) — добавить в `tools/bot.ts`; также release-on-upswing
   иногда срабатывает в stuck-состоянии. Цель: `sim SAFE` проходит районы 1..8.
4. **Стиль под скриншоты пользователя**: референсные скриншоты так и не были
   прикреплены — текущий вид выбран «спокойный flat-vector город без неона».
   Если пользователь прикрепит скриншоты — привести палитры/формы к ним
   (НЕ возвращать неон, резкие ямы, магнетизм к целям, аркадные ускорители).
5. Мелочи: `tools/render.ts` пишет PNG в `/tmp/shots*` (dev-инструмент, в git не
   добавлять артефакты); проверить мобильную вёрстку HUD после правок.

## Жёсткие ограничения пользователя

- Не возвращать: неон, «резкие/обрывистые» ямы, магнитное притяжение к целям,
  ускорители/бустеры скорости; потолок/верхнюю границу; паука вместо человека.
- Автоатака паутины на ближайшие крыши — обязательна; персист прогресса и
  уровни — обязательны; трюки исполняет человечек.
- `tools/orig/*` не трогать; A/B-сравнение должно оставаться валидным.
- Бандлы `tools/*.cjs|*.mjs` и `tools/node_modules` в git НЕ коммитить (игнор).
- Dev-сервер: `npm run dev` (vite, strictPort 5173, host 0.0.0.0, allowedHosts
  true) — для LIVE PREVIEW; браузер не должен ходить на localhost напрямую.

## Быстрые факты по коду (чтобы не перечитывать всё)

- `world.ts`: `DistrictId/DISTRICTS/districtForLevel`, `METER=50`,
  `LEVEL_METERS=250`, `gateX(k)` (шаг 12500), `STREET_Y=980`, `LOWEST_ROOF`,
  `HIGHEST_ROOF=130`, `PropKind` (`HARD_PROPS` летальны на скорости),
  `Anchor{x,y,kind:"ledge"|"prop"|"wall",dir?}`, `World.{ensure,at,segAt,roofYAt,
  floorYAt,floorBelow,buildingsNear,anchorsNear,gate,propSolid,solidAt,
  hazardNear(только летальные),wallNear,raycast,highestNear}`; `ensure(aheadX,
  behindX)` — pruning НЕ должен съедать старт (gate() передаёт -Infinity).
- `engine.ts`: константы в шапке (`G=1200, MAXV=900, ROPE_MAX=470, ROPE_K=520,
  REEL_IN=190, ROPE_MIN=58, JUMP_V=640, CRASH_SPEED=430, WEB_COOLDOWN=0.24 …`);
  `findBestAnchor(desperate)` → `{x,y,d,kind,dir}`; mantle + stall-release в
  `pumpSwing`; `land()` ставит `p.y = surf - p.r` ТОЧНО (не ломать: иначе
  grounding «мигает» и бот ползёт ~50 px/s); `propCollide` → причина смерти;
  публичный API Game: `start/continueRun/retry/toMenu/pause/resume/toggleMute/
  setTrick/setGlide/setWeb/jump/resetTutorial/eraseSave/dispose` + поля
  `player, world, cam, aim, wallDir, distM, state, cause, …`.
- `save.ts`: ключ `webby_save_v2`, миграция старых ключей.
- UI-копии (синхронны с asserts в `tools/e2e.ts`): `WEBBY!`, `Field guide`,
  `Paused`, `Checkpoint cleared`, `Run over`, `Retry district`, `Replay hints`,
  `Erase save`, `Back to the rooftops`, `STREET BELOW`.
- Отладка: `node tools/render.mjs` (PNG-кадры), `TRACE_SIM=1 node tools/sim.cjs
  SAFE 1` (семплы), временно можно добавить trace-тулзу по образцу `bot.ts`.

## Рабочий цикл перед каждым коммитом

Пересобрать бандлы тулз → `npx tsc --noEmit` → `npm run build` → прогнать
mechanics/ab/gaps/sim/lazy/e2e → коммит на `arena/a3756672-…` → `git push origin
arena/a3756672-2d-web-swinging-physics-game`. Артефакты (PNG, бандлы) в коммит
не класть.
