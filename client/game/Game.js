import { Input } from "../core/Input.js";
import { Theme } from "../ui/Theme.js";
import { HUD } from "../ui/HUD.js";
import { BottomBar } from "../ui/BottomBar.js";
import { DeckCreator } from "../ui/DeckCreator.js";
import { HandTray } from "../ui/HandTray.js";
import { BattleModal } from "../ui/BattleModal.js";
import { CampaignMap } from "../src/world/CampaignMap.js";
import { IsoRenderer } from "../src/world/IsoRenderer.js";
import { CardLibrary } from "../data/CardLibrary.js";
import { BattleSystem } from "../combat/BattleSystem.js";
import { RoomManager } from "../src/world/RoomManager.js";
import { FluxReactor } from "/systems/FluxReactor.js";
import { PowerReactor } from "/systems/PowerReactor.js";
import { Arsenal } from "/systems/Arsenal.js";
import { WeaponsHold } from "/systems/WeaponsHold.js";
import { Foundry } from "/systems/Foundry.js";

import {
  Store
}
  from
  "/systems/Store.js";

import { Sideboard } from "/cards/Sideboard.js";

import {
  StoreModal
}
  from
  "./../ui/StoreModal.js";

export class Game {
  constructor(canvas) {

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.input = new Input();
    this.input.bindVirtualDpad?.();
    this.theme = Theme;

    this.mode = "explore";
    this.moveCooldown = 0;
    this.moveInterval = 220;
    this.world = {

      rooms: {},

      raids: {},

      drops: {},

      monsters: {},

      chronicle: []

    };
    this.playersOnline = 1;
    this.onlineClientId = Date.now().toString();
    this.clientId = this.loadClientId();
    this.profile = this.loadProfile();

    // ============================
    // WORLD
    // ============================

    this.campaign = new CampaignMap();
    this.roomManager = new RoomManager();

    // future persistent world object
    // this.worldState = new WorldState();

    // ============================
    // PLAYER
    // ============================

    this.state = {

      roomX: 25,
      roomY: 25,
      depth: 1,

      player: {

        x: 2,
        y: 2,

        hp: 20,

        xp: this.profile.xp,
        level: this.profile.level,

        squad: this.createPlayerSquad()

      }

    };

    // ============================
    // ENEMIES
    // ============================

    this.enemySquads = [];
    this.enemyTick = 0;

    // ============================
    // RAID
    // ============================

    this.raidCompleted = 0;
    this.raidsCompleted = 0;
    this.currentRaid = this.getCurrentRaid();
    this.refreshCurrentGrid();

    // ============================
    // CARD DATA
    // ============================

    this.cardLibrary = new CardLibrary([]);

    this.sideboard = new Sideboard();

    // ============================
    // GAME SYSTEMS
    // ============================

    this.hold = new WeaponsHold();

    this.flux = new FluxReactor();

    this.power = new PowerReactor();

    this.arsenal = new Arsenal();

    this.foundry = new Foundry(this);

    this.store = new Store(this.cardLibrary);

    // ============================
    // UI
    // ============================

    this.storeModal = new StoreModal(this);

    this.deckCreator = new DeckCreator(this);

    this.iso = new IsoRenderer(canvas);

    this.modal = new BattleModal(this);

    this.handTray = new HandTray(this);

    this.hud = new HUD(this);

    this.bottomBar = new BottomBar(this);

    // ============================
    // COMBAT
    // ============================

    this.battle = new BattleSystem(this);

    // ============================
    // TIMING
    // ============================

    this.lastFrame = performance.now();

    this._resize = this._resize.bind(this);

    window.addEventListener(
      "resize",
      this._resize
    );

    this._resize();

  }

  buildFoundryCard() {

    const cost =

      this.flux
        .activate(

          this.battle,

          flank,

          this.hold.side

        );

    if (
      !cost)
      return;

    const flank =

      this.state
        .player
        .squad[
      this.hold
        .flank
      ];

    const flux =

      this.flux
        .activate(

          this.profile,

          flank,

          this.hold
            .side

        );

    if (
      !flux
    )
      return;

    const power =

      this.power
        .generate(
          flux
        );

    const arsenal =

      this.arsenal
        .build(

          flank,

          power.energy

        );

    this.hold
      .store(
        arsenal
      );
    this.deck
      .cards
      .push(
        card
      );

    this.deck
      .shuffle
      ?.();
    const card =

      this.foundry
        .createCard(
          arsenal
        );

    this.deck
      .cards
      .push(
        card);
    this.saveProfile?.();
  }

  onBattleResult(
    result
  ) {

    // Close the battle UI first so victory can never leave the modal open.
    this.mode =
      "explore";

    this.modal
      ?.hide?.();

    if (
      result ===
      "victory"
    ) {
      try {
        this.checkRaidCompletion?.();
      } catch (err) {
        console.warn("checkRaidCompletion failed after victory:", err);
      }

      const phi =
        5;

      this.profile.phi =
        (
          this.profile.phi
          || 0
        )
        +
        phi;
    }

    // Keep optional post-victory work from blocking modal close.
    try {
      this.buildFoundryCard?.();
    } catch (err) {
      console.warn("buildFoundryCard failed after battle:", err);
    }

  }

  buildWeapon() {

    const flank =

      this.state
        .player
        .squad[
      this.hold
        .flank
      ];

    if (
      !flank
    )
      return;

    const cost =

      this.flux
        .calculate(
          flank
        );

    if (
      !this.flux
        .consume(
          this.profile,
          cost
        )
    )
      return;

    const power =

      this.power
        .generate(
          cost
        );

    const item =

      this.arsenal
        .create(

          flank,

          this.hold
            .side,

          power
            .energy

        );

    this.hold
      .store(
        item
      );
    this.foundry
      .forge();

  }

  loadProfile() {

    try {

      const key =
        "tre_profile";

      const raw =
        localStorage.getItem(
          key
        );

      if (raw) {

        return JSON.parse(
          raw
        );
      }

    } catch { }

    return {

      level: 1,

      xp: 0,

      gold: 0,

      marketCredit: 0,

      inventory: [],

      cards: [],

      unlocked: [],

      depth: 1,
      packs: 8,
      deck: {
        name: "Starter",
        cards: []
      }
    };
  }

  startOnlineCounter() {

    const update =
      async () => {

        try {

          const id =
            this.onlineClientId ||
            this.clientId ||
            "local";

          const url =
            `online.php?id=${id}&t=${Date.now()}`;

          const r =
            await fetch(
              url
            );

          const txt =
            await r.text();

          let n =
            Number(txt);

          if (
            !Number.isFinite(n)
          ) {
            try {
              const payload =
                JSON.parse(
                  txt
                );

              n =
                Number(
                  payload?.playersOnline ??
                  payload?.count ??
                  payload?.online
                );
            } catch { }
          }

          this.playersOnline =
            Number.isFinite(n)
              ? n
              : 1;

        } catch {

          this.playersOnline =
            1;
        }
      };

    update();

    clearInterval(
      this.onlineTimer
    );

    this.onlineTimer =
      setInterval(
        update,
        30000
      );
  }

  saveProfile() {

    try {

      localStorage.setItem(
        "tre_profile",

        JSON.stringify(
          this.profile
        )
      );

    } catch { }
  }

  getRoomSeed(depth, roomX, roomY) {

    // Supports negative coordinates and virtually unlimited depths.
    return (
      (depth * 73856093) ^
      (roomX * 19349663) ^
      (roomY * 83492791)
    ) >>> 0;

  }

  getCurrentRaid() {
    const raid =
      this.raidsCompleted + 1;

    return {
      id: raid,

      depth:
        Math.min(
          666,
          Math.floor(
            raid / 5
          ) + 1
        ),

      roomX:
        (raid * 17) % 50,

      roomY:
        (raid * 31) % 50
    };
  }

  /* -----------------------------
   * INIT WORLD
   * ----------------------------- */
  initWorld() {
    const grid = this.currentGrid;
    const entrance = this.findTileByType?.(0) || { x: 2, y: 2 };

    this.state.player.x = entrance.x;
    this.state.player.y = entrance.y;
    if (grid[entrance.y]?.[entrance.x]) grid[entrance.y][entrance.x].wall = false;
  }

  completeRaid() {

    if (
      this.raidsCompleted >=
      3000
    ) {

      this.gameComplete();

      return;
    }

    this.raidsCompleted++;

    this.currentRaid =
      this.getCurrentRaid();

    this.profile.raidsCompleted =
      this.raidsCompleted;

    this.saveProfile?.();

    this.onRaidAdvanced?.();
  }

  onRaidAdvanced() {

    const raid =
      this.currentRaid;

    if (!raid) {
      return;
    }

    // refresh HUD
    this.hud?.render?.();

    // future:
    // unlock enemies
    // unlock cards
    // unlock floors
  }

  isRaidRoom() {

    const r =
      this.currentRaid;

    if (!r) {
      return false;
    }

    return (

      this.state.roomX ===
      r.roomX &&

      this.state.roomY ===
      r.roomY &&

      (
        this.campaign
          .currentIndex
        + 1
      ) ===
      r.depth
    );
  }

  raidCleared() {
    if (

      this.enemySquad
        .every(
          e =>
            !e ||
            e.hp <= 0
        )

    ) {

      if (
        result
        ===
        "victory"
      ) {

        this.enemyTurnAuto =
          false;

        this.owner =
          null;

      }

      return;

    }
    return (
      this.enemySquads
        .flatMap(
          s => [
            s.leader,
            ...s.members
          ]
        )
        .every(
          e =>
            !e ||
            e.hp <= 0
        )
    );
  }

  checkRaidCompletion() {

    if (
      !this.isRaidRoom()
    ) {
      return;
    }

    if (
      !this.raidCleared()
    ) {
      return;
    }

    this.completeRaid();
  }

  gameComplete() {

    this.mode =
      "complete";

    alert(
      "TreMaine Complete"
    );
  }



  async init() {
    const csv = await fetch("../client/data/cards.csv", { cache: "no-store" }).then(r => r.text());

    this.cardLibrary = CardLibrary.fromCSVText(csv);
    // Produce enough cards to reach $10,000,000 at $3/pack -> need ~3,333,334 packs -> ~10,000,002 cards
    this.store = new Store(this.cardLibrary, { totalProduced: 10000002, forcedPerExpensive: 10000, seed: 424242 });

    const Deck = (await import("../cards/Deck.js")).Deck;

    this.deck = new Deck(
      this.cardLibrary.drawRandom(24)
    );

    this.deck.drawTo(6);

    this.initWorld();
    this.battle.deck = this.deck;
    this.battle.cardLibrary = this.cardLibrary;
    this.spawnWorldEnemies();
    this.startOnlineCounter();
  }

  /* -----------------------------
   * INPUT / MOVEMENT
   * ----------------------------- */
  handleInput() {
    this.stepPlayerFromInput();
  }

  isWalkable(x, y) {
    const t = this.currentGrid[y]?.[x];
    return t && !t.wall;
  }

  onPlayerStep() {
    const p = this.state.player;
    const tile = this.currentGrid[p.y]?.[p.x];
    if (tile?.type === 4 || tile?.id === 4) {
      const rx = (p.x <= 0 ? -1 : p.x >= this.currentGrid[0].length - 1 ? 1 : 0);
      const ry = (p.y <= 0 ? -1 : p.y >= this.currentGrid.length - 1 ? 1 : 0);
      if (rx || ry) {
        this.state.roomX = (this.state.roomX || 25) + rx;
        this.state.roomY = (this.state.roomY || 25) + ry;
        this.refreshCurrentGrid();
        p.x = Math.floor(this.currentGrid[0].length / 2);
        p.y = Math.floor(this.currentGrid.length / 2);
        return;
      }
    }
    this.checkCaves();
    this.checkEnemyCollisions();
    this.updateWorldEnemies();
  }

  checkCaves() {
    const p = this.state.player;
    const tile = this.currentGrid[p.y]?.[p.x];
    if (!tile) return;

    if (tile.cave === "down" || tile.type === 1) {
      this.refreshCurrentGrid();
    } else if (tile.cave === "up" || tile.type === 0) {
      this.refreshCurrentGrid();
    }
  }

  changeDepth(direction) {

    const previousIndex = this.campaign.currentIndex;

    if (direction > 0)
      this.campaign.nextNode();
    else
      this.campaign.previousNode();

    if (this.campaign.currentIndex === previousIndex)
      return;

    this.state.depth = this.campaign.currentIndex + 1;

    this.state.roomX = 25;
    this.state.roomY = 25;

this.refreshCurrentGrid();

    const entryType =
      direction > 0
        ? "up"
        : "down";

    const entry =

      this.findTile(
        tile => tile.cave === entryType
      )

      ||

      this.findTileByType(
        direction > 0
          ? 0
          : 1
      )

      ||

      {
        x: 2,
        y: 2
      };

    this.state.player.x = entry.x;
    this.state.player.y = entry.y;

    if (this.currentGrid[entry.y]?.[entry.x])
      this.currentGrid[entry.y][entry.x].wall = false;

    this.spawnWorldEnemies();

  }

  getCurrentRoom() {

    const depth = this.state.depth;
    const roomX = this.state.roomX;
    const roomY = this.state.roomY;

    return this.roomManager.get(

      depth,

      roomX,

      roomY,

      () => {
        return this.createRoomGrid(
          depth,
          roomX,
          roomY
        );

      }

    );

  }
  cloneGrid(grid) {
    if (typeof structuredClone === "function") {
      return structuredClone(grid);
    }

    return JSON.parse(
      JSON.stringify(
        grid
      )
    );
  }
  createRoomGrid(depth, roomX, roomY) {
    const node =
      this.campaign?.nodes?.[depth - 1];

    if (
      node &&
      roomX === 25 &&
      roomY === 25
    ) {
      return this.cloneGrid(
        node.grid
      );
    }

    const seed =
      this.getRoomSeed(
        depth,
        roomX,
        roomY
      );

    return this.campaign.generateGrid(
      seed
    );
  }
getRoomKey(depth = this.state.depth,
           roomX = this.state.roomX,
           roomY = this.state.roomY) {

    return this.roomManager.key(
        depth,
        roomX,
        roomY
    );

}
  refreshCurrentGrid() {

    this.currentGrid = this.getCurrentRoom();

  }

  findTile(predicate) {
    for (let y = 0; y < this.currentGrid.length; y++) {
      for (let x = 0; x < this.currentGrid[0].length; x++) {
        if (predicate(this.currentGrid[y][x])) return { x, y };
      }
    }
    return null;
  }

  findTileByType(type) {
    return this.findTile(tile => tile?.type === type);
  }

  /* -----------------------------
   * ENEMIES
   * ----------------------------- */
  spawnWorldEnemies() {
    const g = this.getCurrentRoom();
    this.enemySquads = [];

    const isPlayerTile = (x, y) =>
      x === this.state.player.x &&
      y === this.state.player.y;

    const matchesAny = (x, y, positions = []) =>
      positions.some(
        pos =>
          pos.x === x &&
          pos.y === y
      );

    const findWalkable = (exclude = []) => {
      while (true) {
        const x = Math.floor(Math.random() * g[0].length);
        const y = Math.floor(Math.random() * g.length);
        if (
          !g[y][x].wall &&
          !isPlayerTile(x, y) &&
          !matchesAny(x, y, exclude)
        ) {
          return { x, y };
        }
      }
    };

    const raidCount = Math.max(1, this.campaign.currentNode()?.raidCount || 3);
    for (let i = 0; i < raidCount; i++) {
      const pos = findWalkable();
      const depth = this.campaign.currentIndex + 1;
      const depthHp = (depth - 1) * 5;
      const depthAtk = depth - 1;
      const depthDef = Math.floor((depth - 1) / 2);
      const memberPositions = [
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
        { x: pos.x, y: pos.y + 1 }
      ].reduce((positions, candidate) => {
        const occupied =
          isPlayerTile(candidate.x, candidate.y) ||
          matchesAny(candidate.x, candidate.y, [pos, ...positions]);

        positions.push(
          this.isWalkable(candidate.x, candidate.y) && !occupied
            ? candidate
            : findWalkable([pos, ...positions])
        );

        return positions;
      }, []);

      this.enemySquads.push({
        leader: { id: "l" + i, name: `Depth ${depth} Enemy Leader`, x: pos.x, y: pos.y, hp: 10 + depthHp, atk: 3 + depthAtk, def: 1 + depthDef },
        members: [
          { id: "m1_" + i, name: `Depth ${depth} Enemy Guard`, x: memberPositions[0].x, y: memberPositions[0].y, hp: 6 + depthHp, atk: 2 + depthAtk, def: 1 + depthDef },
          { id: "m2_" + i, name: `Depth ${depth} Enemy Guard`, x: memberPositions[1].x, y: memberPositions[1].y, hp: 6 + depthHp, atk: 2 + depthAtk, def: 1 + depthDef },
          { id: "m3_" + i, name: `Depth ${depth} Enemy Guard`, x: memberPositions[2].x, y: memberPositions[2].y, hp: 6 + depthHp, atk: 2 + depthAtk, def: 1 + depthDef }
        ]
      });
    }
  }

  updateWorldEnemies() {
    this.enemyTick++;

    this.enemySquads =
      this.enemySquads
        .filter(
          s =>
            s &&
            !s.dead
        );

    for (
      const squad
      of
      this.enemySquads
    ) {
      if (squad.cooldown > 0) {
        squad.cooldown -= 1;
        squad.retreating = true;

        // step away for a moment
        for (const e of [squad.leader, ...squad.members]) {
          const p = this.state.player;
          const dx = Math.sign(e.x - p.x);
          const dy = Math.sign(e.y - p.y);
          const choices = [
            { x: dx, y: 0 },
            { x: 0, y: dy },
            { x: dx, y: dy },
            { x: -dy, y: dx }
          ].filter(m => !(m.x === 0 && m.y === 0));

          const move = choices[Math.floor(Math.random() * choices.length)] || { x: 0, y: 0 };
          const nx = e.x + move.x;
          const ny = e.y + move.y;

          if (this.isWalkable(nx, ny)) {
            e.x = nx;
            e.y = ny;
          }
        }

        if (squad.cooldown <= 0) {
          squad.retreating = false;
          squad.inBattle = false;
        }
        continue;
      }

      if (squad.inBattle) {
        continue;
      }

      if (this.enemyTick % 30 !== 0) {
        continue;
      }

      for (const e of [squad.leader, ...squad.members]) {
        const dirs = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 }
        ];

        const move = dirs[Math.floor(Math.random() * dirs.length)];
        const nx = e.x + move.x;
        const ny = e.y + move.y;

        if (this.isWalkable(nx, ny)) {
          e.x = nx;
          e.y = ny;
        }
      }
    }
  }

  checkEnemyCollisions() {
    const p = this.state.player;

    for (
      const squad
      of
      this.enemySquads
        .filter(
          s =>
            s &&
            !s.dead
        )
    ) {
      if (squad.cooldown > 0 || squad.retreating || squad.inBattle) continue;

      const units = [squad.leader, ...squad.members];
      if (units.some(unit => unit.x === p.x && unit.y === p.y)) {
        this.startBattleWithSquad(squad);
        break;
      }
    }
  }

  /* -----------------------------
   * BATTLE
   * ----------------------------- */
  startBattleWithSquad(squad) {
    if (this.mode === "combat") return;

    this.mode = "combat";

    squad.inBattle = true;
    squad.retreating = false;
    squad.cooldown = 0;

    const enemies = [squad.leader, ...squad.members].map(u => ({
      id: u.id,
      name: u.name || "Enemy",
      hp: u.hp,
      atk: u.atk || 2,
      def: u.def || 1,
      status: {}
    }));

    this.battle.startEncounter({ enemies, worldSquad: squad });

    this.modal.render(this.battle.snapshot());
  }

  /* -----------------------------
   * LOOP
   * ----------------------------- */
  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  openStore() {

    this.storeModal
      .open();

  }

  buyCard(
    card
  ) {
    if (this.countCopies(card.id) >= 10) {
      return { error: "You already have 10 copies of that card in your deck." };
    }

    const result = this.store.buy(this.profile, card);
    if (!result) {
      return { error: "Not enough funds to purchase that card." };
    }

    const added = this.sideboard.add(result.card);
    if (!added) {
      this.profile.marketCredit = (this.profile.marketCredit ?? 0) + result.creditUsed;
      this.profile.gold = (this.profile.gold ?? 0) + result.goldUsed;
      return { error: "You already have 10 copies of that card in your deck." };
    }

    this.saveProfile?.();
    return { result: result.card };
  }

  buyPack() {
    // If player has unopened packs, consume one and open from production
    const profile = this.profile || {};
    let pack = null;
    if ((profile.packs || 0) > 0) {
      profile.packs = Math.max(0, (profile.packs || 0) - 1);
      pack = this.store.openPack();
    } else {
      // attempt to buy with gold
      const opened = this.store.buyPack(profile);
      if (!opened || !opened.length) return { error: "Not enough gold to buy a pack or no packs available." };
      pack = opened;
    }

    if (!pack || !pack.length) return { error: "Pack empty or no packs available." };

    const added = [];
    const skipped = [];
    for (const c of pack) {
      const ok = this.sideboard.add(c);
      if (ok) added.push(c);
      else skipped.push(c);
    }

    this.saveProfile?.();
    return { result: added, skipped };
  }

  sellCard(cardId) {
    const card = this.sideboard.cards.find((entry) => String(entry.id) === String(cardId));
    if (!card) {
      return { error: "No card found to sell." };
    }

    const credit = this.store.sell(this.profile, card);
    if (!credit) {
      return { error: "Unable to sell that card." };
    }

    this.sideboard.remove(cardId);
    this.saveProfile?.();
    return { result: credit };
  }

  countCopies(cardId) {
    return this.sideboard.cards.filter((card) => String(card.id) === String(cardId)).length;
  }

  loop(now) {
    const dt = Math.min(33, now - this.lastFrame);
    this.lastFrame = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt = 16) {
    this.bottomBar.setActions(this.getBottomActions());

    if (this.mode === "explore") {
      this.updateExplore(dt);
      this.updateWorldEnemies();
      this.checkEnemyCollisions();
    } else {

      // if (
      //   this.battle
      //     ?.active
      // ) {

      //   this.battle
      //     .refreshBattleModal();

      // }

    }
    this.checkRaidCompletion();

    this.hud.render();
    this.handTray.render();
  }

  onBottomAction(action) {
    const battle = this.battle;

    switch (action) {
      case "prevFlank":
        battle?.prevFlank?.();
        break;

      case "nextFlank":
        battle?.nextFlank?.();
        break;

      case "target":
        battle?.nextTarget?.();
        break;

      case "ability":
        battle?.basicAttack?.();
        break;

      case "discard":
      case "discardHand":
        if (this.mode === "combat") {
          if (typeof battle?.discardHand === "function") {
            battle.discardHand();
          } else {
            const deck = battle?.deck;
            const hand = deck?.hand || battle?.hand || battle?.playerHand || [];
            if (deck?.deck && Array.isArray(hand)) {
              while (hand.length) {
                deck.deck.push(hand.shift());
              }
              if (typeof deck.drawTo === "function") {
                deck.drawTo(6);
              } else if (typeof battle?.drawHand === "function") {
                battle.drawHand();
              }
            }
          }
          this.modal?.render?.(battle?.snapshot?.());
        }
        break;

      case "endPhase":
        battle?.endPhase?.();
        this.modal?.render?.(battle?.snapshot?.());
        break;

      case "retreat":
        if (this.mode === "combat") {
          battle?.retreatBattle?.();
          this.mode = "explore";
          this.modal?.hide?.();
        }
        break;

      case "inspect":
      case "map":
      case "move":
      case "camp":
      case "inventory":
      case "menu":
        break;

      case "store":
        this.openStore();
        break;

      case "deck":
        try { this.deckCreator?.open(); } catch (e) { console.warn(e); }
        break;

      default:
        console.log("Unhandled action:", action);
    }

    if (this.mode === "combat") {
      this.modal?.render?.(battle?.snapshot?.());
    }
  }

  getBottomActions() {

    if (
      this.mode === "combat"
    ) {

      return {

        left: [

          [
            "Prev Flank",
            "prevFlank"
          ],

          [
            "Next Flank",
            "nextFlank"
          ],

          [
            "Target",
            "target"
          ],

          [
            "Ability",
            "ability"
          ]
        ],

        right: [

          [
            "Discard Hand",
            "discardHand"
          ],

          [
            "End Phase",
            "endPhase"
          ],

          [
            "Retreat",
            "retreat"
          ],

          [
            "Menu",
            "menu"
          ]
        ]
      };
    }

    return {

      left: [

        [
          "Inspect",
          "inspect"
        ],

        [
          "Map",
          "map"
        ],

        [
          "Store",
          "store"
        ]
        ,
        [
          "Deck",
          "deck"
        ]
      ],

      right: [

        [
          "Move",
          "move"
        ],

        [
          "Camp",
          "camp"
        ],

        [
          "Menu",
          "menu"
        ]
      ]
    };
  }

  updateExplore(dt = 16) {
    this.moveCooldown = Math.max(0, this.moveCooldown - dt);
    if (this.moveCooldown > 0) return;
    if (!this.stepPlayerFromInput()) return;
    this.moveCooldown = this.moveInterval;
  }

  stepPlayerFromInput() {
    const p = this.state.player;

    let dx = 0;
    let dy = 0;

    if (this.input.consumePressed("ArrowUp") || this.input.consumePressed("w")) dy -= 1;
    if (this.input.consumePressed("ArrowDown") || this.input.consumePressed("s")) dy += 1;
    if (this.input.consumePressed("ArrowLeft") || this.input.consumePressed("a")) dx -= 1;
    if (this.input.consumePressed("ArrowRight") || this.input.consumePressed("d")) dx += 1;

    if (dx === 0 && dy === 0) {
      if (this.input.isDown("ArrowUp") || this.input.isDown("w")) dy -= 1;
      if (this.input.isDown("ArrowDown") || this.input.isDown("s")) dy += 1;
      if (this.input.isDown("ArrowLeft") || this.input.isDown("a")) dx -= 1;
      if (this.input.isDown("ArrowRight") || this.input.isDown("d")) dx += 1;
    }

    if (dx === 0 && dy === 0) return false;

    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!this.isWalkable(nx, ny)) return false;

    p.x = nx;
    p.y = ny;
    this.onPlayerStep();
    return true;
  }

  playCard(index) {
    if (this.mode !== "combat") return false;
    return this.battle?.playCard?.(index) || false;
  }

  onBattleResult(result) {
    this.mode = "explore";
    this.modal?.hide?.();
    this.battle?.exit?.();

    if (result === "win") {
      this.raidCompleted = Math.min(3000, (this.raidCompleted || 0) + 1);
      this.raidsCompleted = this.raidCompleted;
      this.currentRaid = this.getCurrentRaid();
      this.saveProfile?.();
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const originY = Math.max(120, h / 3 - 110);

    if (this.currentGrid && this.iso?.drawGrid) {
      this.iso.drawGrid(
        ctx,
        this.currentGrid,
        w / 2,
        originY,
        this.theme
      );
    }

    if (this.state?.player && this.iso?.drawEntity) {
      this.iso.drawEntity(
        ctx,
        this.state.player.x,
        this.state.player.y,
        w / 2,
        originY,
        this.theme.player || "#00c8ff",
        "P"
      );
    }

    if (Array.isArray(this.enemySquads)) {
      for (const squad of this.enemySquads) {
        for (const unit of [squad.leader, ...(squad.members || [])]) {
          if (!unit || !this.iso?.drawEntity) continue;
          const color = unit.hp <= 0 ? "#666" : (this.theme.enemy || "#ff4d5a");
          this.iso.drawEntity(
            ctx,
            unit.x,
            unit.y,
            w / 2,
            originY,
            color,
            unit.hp <= 0 ? "×" : ""
          );
        }
      }
    }
  }

  /* -----------------------------
   * HELPERS
   * ----------------------------- */
  createPlayerSquad() {
    const level = this.profile?.level || 1;
    const xpBonus = Math.floor((level - 1) / 2);
    return [
      { id: "p1", name: "Frontliner", hp: 10 + level - 1, atk: 3 + xpBonus, def: 2 + xpBonus },
      { id: "p2", name: "Ranger", hp: 7 + level - 1, atk: 4 + xpBonus, def: 1 + xpBonus },
      { id: "p3", name: "Mage", hp: 6 + level - 1, atk: 5 + xpBonus, def: xpBonus }
    ];
  }

  _resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  loadClientId() {
    try {
      const key = "tre_client_id";
      let id = localStorage.getItem(key);

      if (!id) {
        id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(key, id);
      }

      return id;
    } catch {
      return Date.now() + "";
    }
  }
}
