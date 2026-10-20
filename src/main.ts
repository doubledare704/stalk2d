import Phaser from 'phaser';
import { ZoneScene } from './scenes/ZoneScene';
import './style.css';
document.querySelector('#app')!.innerHTML = `<main><header><a class="brand" href="./">ЗОНА<span>ОСТАННІЙ СИГНАЛ</span></a><div class="status"><i></i> ПОЛЬОВИЙ ТЕРМІНАЛ / X-08</div><button id="sound" title="Увімкнути звук">ЗВУК: ВИМК.</button></header><section class="game-shell"><div id="game"></div><div id="overlay"></div></section><footer><span>WASD <b>РУХ</b> <em>•</em> МИША <b>ПРИЦІЛ / ВОГОНЬ</b> <em>•</em> R <b>ПЕРЕЗАРЯДКА</b></span><span>1–3 <b>ЗБРОЯ</b> <em>•</em> Q <b>АПТЕЧКА</b> <em>•</em> F <b>АНТИРАД</b> <em>•</em> ESC <b>ПАУЗА</b></span></footer></main>`;
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 1280, height: 800, backgroundColor: '#101714', pixelArt: true, antialias: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [ZoneScene] });
