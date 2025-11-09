/*:
 * @target MZ
 * @plugindesc Disparo 2D robusto: colisión usando bounds globales de sprites (compatible con zoom) + control por script
 * @author 3DalbiX (ajustado)
 *
 * @param shootSpeed
 * @text Velocidad del proyectil
 * @type number
 * @default 0.25
 *
 * @param shootRange
 * @text Alcance del proyectil (tiles)
 * @type number
 * @default 8
 *
 * @param shootSE
 * @text Sonido del disparo
 * @type file
 * @dir audio/se
 * @default Attack3
 *
 * @param projectileGraphic
 * @text Gráfico del proyectil
 * @type file
 * @dir img/pictures
 * @default Bullet
 *
 * @param projectileScale
 * @text Escala del proyectil
 * @type number
 * @decimals 2
 * @default 1.0
 *
 * @param projectileYOffset
 * @text Desplazamiento vertical (tiles)
 * @type number
 * @decimals 2
 * @default 0
 *
 * @help
 * - Tecla A → dispara.
 * - Usa bounds globales de los sprites para colisión (funciona con CharacterZoom y AutoZoom).
 * - Self Switch C se activa en el frame exacto del contacto visual.
 *
 * Script:
 *   $gameSystem.enableShooting2D(true);  // activar
 *   $gameSystem.enableShooting2D(false); // desactivar
 *
 */

(() => {
    const PLUGIN_NAME = "Disparo2D";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const SPEED = Number(params["shootSpeed"] || 0.25);
    const RANGE = Number(params["shootRange"] || 8);
    const SE_NAME = String(params["shootSE"] || "Attack3");
    const GRAPHIC = String(params["projectileGraphic"] || "Bullet");
    const SCALE = Number(params["projectileScale"] || 1.0);
    const Y_OFFSET = Number(params["projectileYOffset"] || 0);

    Input.keyMapper[65] = "shoot"; // Tecla A

    // Control global
    Game_System.prototype.enableShooting2D = function(enabled) {
        this._shooting2DEnabled = enabled;
    };
Game_System.prototype.isShooting2DEnabled = function() {
    if (this._shooting2DEnabled === undefined) this._shooting2DEnabled = false; // ← por defecto deshabilitado
    return this._shooting2DEnabled;
};

    // Projectile class
    class Projectile {
        constructor(x, y, dir) {
            this.x = x;
            this.y = y;
            this._dir = dir; // 4=izq,6=der
            this._distance = 0;
            this._alive = true;
            this._sprite = null;
            this._framesAlive = 0; // para posible retardo inicial
        }

        createSprite() {
            if (this._sprite) return;
            const scene = SceneManager._scene;
            if (!scene?._spriteset?._tilemap) return;

            const bmp = ImageManager.loadPicture(GRAPHIC);
            const sprite = new Sprite(bmp);
            sprite.anchor.set(0.5, 0.5);
            sprite.scale.set(SCALE * (this._dir === 4 ? -1 : 1), SCALE);

            // Posición en píxeles dentro del tilemap (child del tilemap)
            sprite.x = this.x * $gameMap.tileWidth();
            sprite.y = this.y * $gameMap.tileHeight();

            scene._spriteset._tilemap.addChild(sprite);
            this._sprite = sprite;
        }

        update() {
            if (!this._alive) return;
            if (!this._sprite) this.createSprite();

            // Movimiento
            const step = (this._dir === 6 ? SPEED : -SPEED);
            this.x += step;
            this._distance += Math.abs(step);

            if (this._sprite) {
                this._sprite.x = this.x * $gameMap.tileWidth();
                this._sprite.y = this.y * $gameMap.tileHeight();
            }

            this._framesAlive++;

            // Detectar colisión VISUAL usando bounds globales del sprite del evento
            if (this._sprite && this.checkEventCollisionUsingGlobalBounds()) {
                this.destroy();
                return;
            }

            if (this._distance >= RANGE) {
                this.destroy();
            }
        }

        checkEventCollisionUsingGlobalBounds() {
            const scene = SceneManager._scene;
            const spriteset = scene?._spriteset;
            if (!spriteset || !this._sprite) return false;

            // Obtener posición global (pantalla) del proyectil
            // getGlobalPosition devuelve un PIXI.Point
            const pGlobal = this._sprite.getGlobalPosition(); // coordenadas en pantalla
            // margin en píxeles para ajustar sensibilidad (sube para retrasar impacto)
            const margin = 6; // prueba con 6, aumenta a 10 si impacta aún pronto

            // Iterar eventos y comparar contra bounds global del sprite del evento
            for (const ev of $gameMap.events()) {
                if (!ev || ev._erased) continue;

                // Buscar sprite correspondiente
                const evSprite = spriteset._characterSprites && spriteset._characterSprites.find(s => s._character === ev);
                if (!evSprite) continue;

                // Obtener bounds global del sprite del evento
                // getBounds() devuelve rectángulo en coordenadas globales
                const evBounds = evSprite.getBounds();

                // Aplicar margen (reducir bounds interiormente) para evitar impactos prematuros:
                const left = evBounds.x + margin;
                const right = evBounds.x + evBounds.width - margin;
                const top = evBounds.y + margin;
                const bottom = evBounds.y + evBounds.height - margin;

                // Puedes descomentar la siguiente línea para depurar:
                // console.log("Proj:", pGlobal.x.toFixed(1), pGlobal.y.toFixed(1), "EvBounds:", evBounds.x.toFixed(1), evBounds.y.toFixed(1), evBounds.width.toFixed(1), evBounds.height.toFixed(1));

                // Comparación punto vs rectángulo
                if (pGlobal.x >= left && pGlobal.x <= right && pGlobal.y >= top && pGlobal.y <= bottom) {
                    // Activar self switch C inmediatamente
                    const key = [$gameMap.mapId(), ev.eventId(), "C"];
                    $gameSelfSwitches.setValue(key, true);
                    return true;
                }
            }

            return false;
        }

        destroy() {
            this._alive = false;
            if (this._sprite && SceneManager._scene?._spriteset?._tilemap) {
                try {
                    SceneManager._scene._spriteset._tilemap.removeChild(this._sprite);
                } catch (_) {}
            }
        }
    }

    // Player hooks
    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        this.updateShooting2D();
    };

    Game_Player.prototype.updateShooting2D = function() {
        if (!this._projectiles2D) this._projectiles2D = [];
        if (!$gameSystem.isShooting2DEnabled()) return;

        if (Input.isTriggered("shoot") || TouchInput.isTriggered()) {
            this.shootProjectile();
        }

        for (const p of this._projectiles2D) p.update();
        this._projectiles2D = this._projectiles2D.filter(p => p._alive);
    };

    Game_Player.prototype.shootProjectile = function() {
        // Evitar disparar si hay alguna condición de bloqueo (opcional)
        if (!$gameSystem.isShooting2DEnabled()) return;

        AudioManager.playSe({ name: SE_NAME, pan: 0, pitch: 100, volume: 90 });
        const dir = this.direction(); // 4=izq,6=der
        if (![4, 6].includes(dir)) return;

        const sprite = SceneManager._scene?._spriteset?._characterSprites.find(s => s._character === this);
        let startX = this._realX;
        let startY = this._realY + Y_OFFSET;
        if (sprite) {
            const tileHeight = $gameMap.tileHeight();
            const torsoOffset = 0.55;  // ajuste vertical visual
            startY = sprite.y / tileHeight - torsoOffset + Y_OFFSET;
        }

const zoom = $gameScreen.zoomScale ? $gameScreen.zoomScale() : 4.0;
  console.log("Zoom:"+zoom);
const baseOffset = 0.65;  // el valor normal sin zoom
let offset = baseOffset * zoom;
offset=4.0;
        if (dir === 6) startX += offset;
        if (dir === 4) startX += offset;

        const p = new Projectile(startX, startY, dir);
        this._projectiles2D.push(p);
    };

})();
