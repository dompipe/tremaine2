export class HUD {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById("hud");
    this.notifications = [];
    this.unreadNotifications = 0;
    this.showChronicle = false;
  }

  addNotification(notification) {

    this.notifications.unshift({

      time: Date.now(),

      ...notification

    });

    if (this.notifications.length > 500)
      this.notifications.pop();

    this.unreadNotifications++;

  }

  toggleChronicle() {

    this.showChronicle = !this.showChronicle;

    if (this.showChronicle)
        this.unreadNotifications = 0;

    this.render();

}

renderChronicle() {

    if (!this.showChronicle)
        return "";

    let html = `
        <div class="chronicle">
            <h3>📜 Chronicle</h3>
    `;

    for (const msg of this.notifications) {

        html += `
            <div class="chronicle-entry">

                <b>${msg.title}</b><br>

                ${msg.text}

            </div>
        `;

    }

    html += "</div>";

    return html;

}
  renderMiniMap() {
    const game = this.game;
    const player = game?.state?.player || game?.player || {};
    const roomX = game?.state?.roomX ?? player.roomX ?? 25;
    const roomY = game?.state?.roomY ?? player.roomY ?? 25;
    const raid = game.currentRaid || {};
    const tx = Number(raid.roomX ?? roomX);
    const ty = Number(raid.roomY ?? roomY);
    const dx = tx - roomX;
    const dy = ty - roomY;
    const atTarget = dx === 0 && dy === 0;

    let navX = 0;
    let navY = 0;
    if (!atTarget) {
      if (Math.abs(dx) >= Math.abs(dy)) navX = Math.sign(dx);
      else navY = Math.sign(dy);
    }

    let html = `<div style="display:flex;flex-direction:column;gap:1px;margin-top:4px">`;
    for (let y = -2; y <= 2; y++) {
      html += `<div style="display:flex;gap:1px">`;
      for (let x = -2; x <= 2; x++) {
        let color = "#fff";
        if (x === 0 && y === 0) color = atTarget ? "#f33" : "#39f";
        else if (x === navX && y === navY) color = "#f33";
        html += `<div style="width:6px;height:6px;background:${color};border-radius:1px"></div>`;
      }
      html += `</div>`;
    }

    const xText = dx === 0 ? "X ✓" : `${dx > 0 ? "E" : "W"} ${Math.abs(dx)}`;
    const yText = dy === 0 ? "Y ✓" : `${dy > 0 ? "S" : "N"} ${Math.abs(dy)}`;

    html += `<div style="font-size:10px;margin-top:3px">${xText} · ${yText}</div></div>`;
    return html;
  }
  render() {
    if (!this.el) return;

    const game = this.game;

    const player =
      game?.state?.player ||
      game?.player ||
      {};

    const node =
      game.campaign?.currentNode?.();

    const depth =
      node?.depth ??
      (game.campaign?.currentIndex ?? 0) + 1;

    const roomX =
      game?.state?.roomX ?? player.roomX ?? 25;

    const roomY =
      game?.state?.roomY ?? player.roomY ?? 25;

    const completed =
      node?.raidsCompleted ?? 0;

    const totalRaids =
      node?.raidCount ?? 0;

    // Market scan (top 3 searched cards)
    let marketHtml = "";
    try {
      const top = game.store?.topSearches?.(3) || [];
      if (top.length) {
        marketHtml += `<div style=\"margin-top:6px;\"><strong>Market Scan</strong></div>`;
        marketHtml += `<div style=\"display:flex;gap:6px;margin-top:4px\">`;
        for (const c of top) {
          const dv = Number(game.store?.getDollarValue(c) ?? 0);
          let bg = "#e6f7e6";
          if (dv <= 1.75) bg = "#d4f5d4";
          else if (dv <= 3) bg = "#fff3bf";
          else if (dv <= 4) bg = "#ffd8a8";
          else bg = "#e6d3ff";
          const priceLabel = game.store?.formatCurrency?.(dv) || "";
          const display = `${c.name || c.id} - ${c.price || (game.store?.getPrice(c) || 0)}g (${priceLabel})`;
          marketHtml += `<div style=\"background:${bg};padding:6px;border-radius:6px;min-width:120px;font-size:12px\">${display}</div>`;
        }
        marketHtml += `</div>`;
      }
    } catch (e) { marketHtml = ""; }

    this.el.innerHTML = `
      <div class="hud-pill">
        Depth:
        <b>${depth}</b>
      </div>

      <div class="hud-pill">
        Room:
        <b>(${roomX}, ${roomY})</b>
      </div>

      <div class="hud-pill">
        Raids:
        <b>${completed}/${totalRaids}</b>
      </div>

      <div class="hud-pill">
        Players Online:
        <b>${Math.max(
      1,
      game.playersOnline ?? 1
    )}</b>
      </div>

      <div class="hud-pill">
        XP:
        <b>${game.profile?.xp || 0}</b>
      </div>

      <div class="hud-pill">
        Level:
        <b>${game.profile?.level || 1}</b>
      </div>

      <div class="hud-pill">
        Mode:
        <b>${String(
      game.mode || "explore"
    ).toUpperCase()}</b>
      </div>
      <div class="hud-pill chronicle-button"
     onclick="window.game?.hud?.toggleChronicle()">

📜

${this.unreadNotifications
    ? `<span class="notify-dot"></span>`
    : ""}

</div>

      ${this.renderMiniMap()}

      ${marketHtml}
      ${this.renderChronicle()}
    `;
  }
}
