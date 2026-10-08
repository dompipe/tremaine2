import { Game } from "./game/Game.js";

const canvas = document.getElementById("mapCanvas");
const game = new Game(canvas);
window.game = game;
await game.init();
game.start();
