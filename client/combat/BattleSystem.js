import { Deck } from "../cards/Deck.js";
import { EnemyAI } from "../ai/EnemyAI.js";
import { RulesEngine } from "./RulesEngine.js";
import { StatusSystem } from "./StatusSystem.js";

export class BattleSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.owner = "player";
    this.phase = "attack";
    this.phaseRoll = 0;
    this.turnRoll = 0;
    this.phaseBudget = 0;
    this.round = 1;
    this.logs = [];
    this.status = new StatusSystem();
    this.rules = new RulesEngine(this.status);
    this.enemyAI = new EnemyAI(game.cardLibrary);
    this.selectedPlayer = 0;
    this.selectedEnemy = 0;
    this.playerSquad = [];
    this.enemySquad = [];
    this.worldSquad = null;
    this.deck = new Deck([]);
    this.enemyDeck = new Deck([]);
    this.enemyTurnAuto = false;
    this.discardMode = false;
    this.node = null;
    this.battlePhi = 0;
  }

  phi() {
    return this.battlePhi;
  }
  phaseLabel() { return `${this.owner.toUpperCase()} ${this.phase.toUpperCase()}`; }

  retreatBattle() {

    const squad =
      this.worldSquad;

    if (
      squad
    ) {

      squad.retreating =
        true;

      squad.cooldown =
        90;

      squad.inBattle =
        false;
    }

    this.finishBattle(
      "retreat"
    );
  }

  finishBattle(result = "victory") {

    this.battlePhi = 0;
    const squad =
      this.node?.worldSquad;

    if (
      squad
    ) {

      squad.inBattle =
        false;

      squad.retreating =
        false;

      squad.cooldown =
        0;
    }

    this.active =
      false;

    this.enemySquad =
      null;

    this.phase =
      null;

    this.game.mode =
      "explore";

    this.game.modal
      ?.hide?.();

    this.game.onBattleResult
      ?.(
        result
      );
  }

  updateEnemy(enemy) {
    if (enemy.retreating) {
      return;
    }

    if (enemy.state === "hunt") {
      enemy.moveToward(this.game.player);
    }
  }

  gainPhi(
    amount
  ) {

    this.battlePhi +=
      amount;

    return this.battlePhi;
  }

  consumePhi(amount) {

    if (
      this.battlePhi
      <
      amount
    ) {
      return false;
    }

    this.battlePhi
      -=
      amount;

    return true;
  }

  startEncounter(node) {
    this.battlePhi = 0;
    this.node = node;
    this.worldSquad = node?.worldSquad || null;
    this.active = true;
    this.owner = "player";
    this.phase = "attack";
    this.turnRoll = 0;
    this.round = 1;
    this.logs = [];
    this.discardMode = false;
    this.status = new StatusSystem();
    this.rules = new RulesEngine(this.status);

    this.deck = new Deck(this.game.cardLibrary.drawRandom(24));
    this.deck.drawTo(6);

    this.enemyDeck = new Deck(this.game.cardLibrary.drawRandom(18));
    this.enemyDeck.drawTo(6);

    this.playerSquad = this.game.createPlayerSquad();

    if (this.worldSquad) {
      this.enemySquad = [
        this.worldSquad.leader,
        ...(this.worldSquad.members || [])
      ].filter(Boolean);
    } else {
      this.enemySquad = (node?.enemies || []).map(enemy => ({
        id: enemy.id,
        name: enemy.name || "Enemy",
        hp: enemy.hp ?? 5,
        atk: enemy.atk ?? 2,
        def: enemy.def ?? 0,
        status: enemy.status || {}
      }));
    }

    if (!this.enemySquad.length) {
      this.enemySquad = [
        { id: "e1", name: "Raider", hp: 5, atk: 2, def: 0, status: {} }
      ];
    }

    this.selectedPlayer = 0;
    this.selectedEnemy = 0;

    this.beginPhase();
    this.syncUI("Battle begins.");
  }

  beginPhase() {
    this.rules.phase = this.phase;
    if (this.phase === "attack" || !this.turnRoll) {
      this.turnRoll = this.rules.rollPhase();
    }
    this.phaseRoll = this.turnRoll;
    this.phaseBudget = this.phaseRoll;
    this.rules.phaseRoll = this.phaseRoll;
    this.rules.phaseBudget = this.phaseBudget;
    this.tickPhaseStatuses();
    this.syncUI(`${this.phaseLabel()} begins with roll ${this.phaseRoll}.`);
    if (this.owner === "enemy") {
      this.enemyTurnAuto = true;
      queueMicrotask(() => this.runEnemyPhase());
    } else {
      this.enemyTurnAuto = false;
    }
  }

  tickPhaseStatuses() {
    const sides = ["player", "enemy"];
    for (const side of sides) {
      const squad = side === "player" ? this.playerSquad : this.enemySquad;
      for (let i = 0; i < squad.length; i++) {
        const unit = squad[i];
        if (!unit) continue;
        const st = this.status.get(side, unit.id);
        if (st.poison) this.rules.enqueue({ type: "DAMAGE", targetSide: side, targetIndex: i, amount: st.poison.value, meta: { pierce: true } });
        if (st.burn) this.rules.enqueue({ type: "DAMAGE", targetSide: side, targetIndex: i, amount: st.burn.value, meta: { pierce: true } });
        if (st.regen) this.rules.enqueue({ type: "HEAL", targetSide: side, targetIndex: i, amount: st.regen.value });
      }
    }
    this.rules.resolveQueue(this);
  }

  log(message) {

    this.logs.push(message);

    if (
      this.logs.length > 80
    ) {
      this.logs.shift();
    }

    this.onLog?.(message, this);

  }

  emit(event, data = {}) {

    this.onEvent?.({

      event,

      battle: this,

      ...data

    });

  }

  canPlayCard(card) {
    if (!this.active) return false;
    if (this.phaseBudget <= 0) return false;

    if (
      card.requirementValues?.length &&
      !card.requirementValues.includes(this.phaseRoll)
    ) {
      return false;
    }

    if (
      card.type === "Spell" &&
      this.rules.phi[this.owner] < card.cost
    ) {
      return false;
    }

    switch (this.phase) {

      case "attack":
        return (
          card.type === "Attack" ||
          card.type === "Spell"
        );

      case "defense":
        return (
          card.type === "Defense" ||
          card.type === "Spell"
        );

      default:
        return false;
    }
  }

  getSelectedIndex(side) {
    return side === "player" ? this.selectedPlayer : this.selectedEnemy;
  }

  getCardTarget(card) {
    const selfSide = this.owner;
    const enemySide = selfSide === "player" ? "enemy" : "player";
    const selfIndex = this.getSelectedIndex(selfSide) ?? 0;
    const enemyIndex = this.getSelectedIndex(enemySide) ?? 0;

    const selfTargetSpecials = new Set(["Shield", "Barrier", "Reflect", "Regen", "Nullify", "Counterattack", "Lifesteal", "DrainMana"]);
    const isSelfTarget =
      card.type === "Defense" ||
      (card.type === "Spell" && (card.defense > 0 || selfTargetSpecials.has(card.special)));

    const targetSide = isSelfTarget ? selfSide : enemySide;
    const targetIndex = targetSide === "player" ? selfIndex : enemyIndex;
    return { targetSide, targetIndex };
  }

  playCard(handIndex) {
    if (!this.active || this.owner !== "player") return false;
    if (this.discardMode) return this.discardCard(handIndex);
    const card = this.deck.hand[handIndex];
    if (!card || !this.canPlayCard(card)) return false;

    const { targetSide, targetIndex } = this.getCardTarget(card);

    if (!this.rules.playCard(card, this.owner, targetSide, targetIndex, this)) return false;
    this.phaseBudget = this.rules.phaseBudget;
    this.deck.play(handIndex);

    this.emit("cardPlayed", {

      owner: this.owner,

      card,

      handIndex

    });

    this.deck.drawTo(6);
    this.rules.resolveQueue(this);

    this.checkDeaths();
    this.syncUI(`Played ${card.name}.`);
    return true;
  }

  discardCard(handIndex) {
    if (!this.active || this.owner !== "player") return false;
    const card = this.deck.discardFromHand(handIndex);
    if (!card) return false;
    this.deck.drawTo(6);
    this.syncUI(`Discarded ${card.name} to the bottom of the deck.`);
    return true;
  }

  toggleDiscardMode() {
    if (!this.active || this.owner !== "player") return;
    this.discardMode = !this.discardMode;
    this.syncUI(this.discardMode ? "Discard mode on." : "Discard mode off.");
  }

  endPhase() {
    if (!this.active) return;

    this.rules.endPhase(this.owner, this);

    if (this.owner === "player" && this.phase === "attack") {
      this.phase = "defense";
    } else if (this.owner === "player" && this.phase === "defense") {
      this.owner = "enemy";
      this.phase = "attack";
      this.round += 1;
    } else if (this.owner === "enemy" && this.phase === "attack") {
      this.phase = "defense";
    } else {
      this.owner = "player";
      this.phase = "attack";
      this.round += 1;
    }
    this.checkDeaths();
    this.beginPhase();
  }

  runEnemyPhase() {
    if (!this.active || this.owner !== "enemy") return;
    const maxPlays = this.phaseBudget;
    let attempts = 0;

    while (this.active && this.owner === "enemy" && this.phaseBudget > 0 && attempts < maxPlays + 4) {
      attempts += 1;
      const card = this.enemyAI.chooseCard(this.enemyDeck.hand, this.phase, this.phaseBudget, this.rules.phi.enemy);
      if (!card) break;

      const idx = this.enemyDeck.hand.findIndex(c => c.id === card.id);
      const targetSide = "player";
      const targetIndex = this.selectedPlayer;

      if (!this.rules.playCard(card, "enemy", targetSide, targetIndex, this)) break;
      this.phaseBudget = this.rules.phaseBudget;
      this.enemyDeck.play(idx);
      this.enemyDeck.drawTo(6);
      this.rules.resolveQueue(this);

      this.checkDeaths();
      this.syncUI(`Enemy played ${card.name}.`);
      if (!this.active || this.phaseBudget <= 0) break;
    }

    if (this.active) {
      this.endPhase();
    }
  }

  damageUnit(side, index, amount, meta = {}) {
    const unit = this.getUnit(side, index);
    if (!unit) return;

    if (unit.status?.nullify?.duration > 0) {
      this.log(`${unit.name} nullifies the incoming effect.`);
      return;
    }

    let dmg = Math.max(0, amount);
    const st = this.status.get(side, unit.id);
    if (!meta.pierce) {
      if (st.barrier) {
        const absorb = Math.min(st.barrier.value, dmg);
        st.barrier.value -= absorb;
        dmg -= absorb;
        if (st.barrier.value <= 0) delete st.barrier;
      }
      if (dmg > 0 && st.shield) {
        const absorb = Math.min(st.shield.value, dmg);
        st.shield.value -= absorb;
        dmg -= absorb;
        if (st.shield.value <= 0) delete st.shield;
      }
    }

    if (dmg > 0) unit.hp -= dmg;

    this.emit("damage", {

      side,

      unit,

      amount: dmg

    });

    if (st.reflect && meta.sourceSide && dmg > 0) {
      const reflected = Math.max(1, Math.floor(dmg * (st.reflect.value / 100)));
      const srcIndex = this.getActiveIndex(meta.sourceSide);
      this.rules.enqueue({ type: "DAMAGE", targetSide: meta.sourceSide, targetIndex: srcIndex, amount: reflected, meta: { pierce: true } });
    }

    if (st.counterattack && dmg > 0) {
      const srcIndex = this.getActiveIndex(meta.sourceSide || (side === "player" ? "enemy" : "player"));
      this.rules.enqueue({ type: "DAMAGE", targetSide: meta.sourceSide || (side === "player" ? "enemy" : "player"), targetIndex: srcIndex, amount: st.counterattack.value, meta: { pierce: true } });
    }

    if (st.freeze) {
      unit.skipPhase = true;
    }
    if (st.stun) {
      unit.skipPhase = true;
    }

    if (dmg > 0) {
      this.log(`${unit.name} takes ${dmg} damage.`);
    }

    if (unit.hp <= 0) {
      this.log(`${unit.name} is destroyed.`);
      this.emit("unitDestroyed", {

        side,

        unit

      });
    }

    this.refreshBattleModal();
  }

  healUnit(side, index, amount) {
    const unit = this.getUnit(side, index);
    if (!unit) return;
    unit.hp += amount;
    this.log(`${unit.name} heals ${amount}.`);
    this.refreshBattleModal();
  }

  applyStatus(side, index, status, value, duration) {
    const unit = this.getUnit(side, index);
    if (!unit) return;
    this.status.apply(side, unit.id, status, value, duration);
    this.log(`${unit.name} gains ${status}.`);
    this.refreshBattleModal();
  }

  markPierce(side, index, on = true) {
    const unit = this.getUnit(side, index);
    if (!unit) return;
    unit.pierce = on;
  }

  damageAdjacent(side, index, amount, sourceSide) {
    const targets = [index - 1, index + 1].filter(i => this.getUnit(side, i));
    targets.forEach(i => this.rules.enqueue({ type: "DAMAGE", targetSide: side, targetIndex: i, amount, meta: { pierce: false, sourceSide } }));
  }

  drawCards(side, amount) {
    if (side !== "player") return;
    this.deck.draw(amount);
  }

  tickStatuses(side) {
    const squad = side === "player" ? this.playerSquad : this.enemySquad;
    for (const unit of squad) {
      if (!unit) continue;
      const st = this.status.get(side, unit.id);
      for (const [name, data] of Object.entries({ ...st })) {
        if (name === "poison" || name === "burn" || name === "regen") {
          // queued in begin phase
        }
        data.duration -= 1;
        if (data.duration <= 0) delete st[name];
      }
      this.status.sides[side].set(unit.id, st);
    }
  }

  getLeader(side) {
    return this.getUnit(side, 0);
  }

  getActiveIndex(side) {
    const squad = side === "player" ? this.playerSquad : this.enemySquad;
    for (let i = 0; i < squad.length; i++) {
      if (squad[i] && squad[i].hp > 0) return i;
    }
    return 0;
  }

  getUnit(side, index = 0) {
    const squad = side === "player" ? this.playerSquad : this.enemySquad;
    return squad[index] || null;
  }

  aliveUnits(side) {
    return (side === "player" ? this.playerSquad : this.enemySquad).filter(u => u && u.hp > 0);
  }

  checkDeaths() {

    this.playerSquad =
      (
        this.playerSquad
        ||
        []
      )
        .filter(
          u =>
            u &&
            u.hp >
            0
        );

    this.enemySquad =
      (
        this.enemySquad
        ||
        []
      )
        .filter(
          u =>
            u &&
            u.hp >
            0
        );

    // sync back to world

    if (
      this.worldSquad
    ) {

      const alive =
        this.enemySquad;

      this.worldSquad.leader =
        alive[0]
        ||
        null;

      this.worldSquad.members =
        alive
          .slice(
            1
          );

    }

    if (
      this.playerSquad
        .length
      ===
      0
    ) {

      this.emit("battleLost", {

        room: this.node

      });

      this.finishBattle(
        "lose"
      );

      return true;

    }

    if (
      this.enemySquad
        .length
      ===
      0
    ) {

      // remove world squad NOW

      if (
        this.worldSquad
      ) {

        this.worldSquad.dead =
          true;

        this.worldSquad.inBattle =
          false;

      }

      this.emit("battleWon", {

        room: this.node,

        squad: this.worldSquad

      });

      this.finishBattle(
        "victory"
      );

      return true;

    }

    return false;

  }

  discardHand() {
    if (!this.active || this.owner !== "player") return false;
    const deck = this.deck;
    const hand = deck?.hand || [];
    if (!deck || !Array.isArray(hand) || hand.length === 0) return false;

    while (hand.length) {
      deck.sendToBottom(hand.shift());
    }

    deck.drawTo(6);
    this.syncUI("Discarded hand to bottom of deck.");
    return true;
  }

  exit() {
    const squad = this.worldSquad || this.node?.worldSquad;
    if (squad) {
      squad.inBattle = false;
      squad.retreating = false;
      squad.cooldown = 0;
    }

    this.enemySquad = [];
    this.node = null;
    this.worldSquad = null;
    this.active = false;
  }

  prevFlank() {
    this.selectNext("player", -1);
  }

  nextFlank() {
    this.selectNext("player", 1);
  }

  nextTarget() {
    this.selectNext("enemy", 1);
  }

  basicAttack() {
    if (!this.active || this.owner !== "player") return false;
    const attacker = this.getUnit("player", this.selectedPlayer) || this.getLeader("player");
    const target = this.getUnit("enemy", this.selectedEnemy);
    if (!attacker || !target) return false;
    const amount = this.resolveAttackAmount("player", attacker.atk || 1, `${attacker.name}'s strike`);
    this.damageUnit("enemy", this.selectedEnemy, amount, { sourceSide: "player" });
    this.checkDeaths();

    this.refreshBattleModal();
    this.syncUI(`${attacker.name} strikes ${target.name}.`);
    return true;
  }

  resolveAttackAmount(side, baseAmount, label = "attack") {
    if (baseAmount <= 0) return 0;
    const isPlayer = side === "player";
    const level = isPlayer ? (this.game.profile?.level || 1) : 1;
    const hitChance = Math.min(0.95, 0.72 + level * 0.03);
    const hit = Math.random() <= hitChance;

    if (!hit) {
      const graze = isPlayer ? Math.floor(level / 3) : 0;
      this.log(`${label} misses${graze > 0 ? ` but grazes for ${graze}` : ""}.`);
      return graze;
    }

    const bonus = isPlayer ? Math.floor(level / 2) : 0;
    return baseAmount + bonus;
  }

  resolveDefenseAmount(side, baseAmount) {
    if (side !== "player") return baseAmount;
    return baseAmount + Math.floor((this.game.profile?.level || 1) / 3);
  }

  snapshot() {
    return {
      active: this.active,
      owner: this.owner,
      phase: this.phase,
      // phaseText: this.phaseLabel(),
      playerPhaseText: `Your squad: ${this.playerSquad.length} flank(s) alive`,
      enemyPhaseText: `Enemy squad: ${this.enemySquad.length} flank(s) alive`,
      phi: this.rules.phi.player,
      roll: this.phaseRoll,
      log: [...this.logs],
      playerSquad: this.playerSquad.map((u, idx) => ({
        ...u,
        selected: idx === this.selectedPlayer,
        statusText: this.statusText("player", u)
      })),
      enemySquad: this.enemySquad.map((u, idx) => ({
        ...u,
        selected: idx === this.selectedEnemy,
        statusText: this.statusText("enemy", u)
      }))
    };
  }

  statusText(side, unit) {
    const st = this.status.get(side, unit.id);
    const bits = [];
    for (const [k, v] of Object.entries(st)) {
      bits.push(`${k}:${v.duration}`);
    }
    return bits.length ? bits.join(" • ") : "Ready";
  }

  refreshBattleModal() {
    if (!this.active) {
      this.game.modal?.hide?.();
      return;
    }

    this.game.modal.render(this.snapshot());
    this.game.handTray.render();
  }

  syncUI(msg) {
    if (msg) this.log(msg);
    this.refreshBattleModal();
  }

  selectNext(side, dir) {
    const squad = side === "player" ? this.playerSquad : this.enemySquad;
    if (!squad.length) return;
    if (side === "player") {
      this.selectedPlayer = (this.selectedPlayer + dir + squad.length) % squad.length;
    } else {
      this.selectedEnemy = (this.selectedEnemy + dir + squad.length) % squad.length;
    }
    this.refreshBattleModal();
  }
}
