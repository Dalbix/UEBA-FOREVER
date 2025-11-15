/*:
 * @target MZ
 * @plugindesc Disparo 2D robusto: colisión usando bounds globales de sprites (compatible con zoom) + control por script
 * @author 3DalbiX
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
 *   // Disparar desde un evento:
 *   $gameSystem.shootProjectileFromEvent(eventId, dir, speed, seName, graphicName);
 *   // dir: 0 = izquierda, 1 = derecha
 *   // speed: número (ej. 0.3) - si null se usa el parámetro del plugin
 *   // seName: string del SE en audio/se (ej. "Attack1") - opcional
 *   // graphicName: nombre del archivo en img/pictures (ej. "FireBall") - opcional
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

    function getRuntimeEnvironment() {
      const isNode = Utils.isNwjs();
      const isAndroidApp = !!window.AndroidInterface;
      const ua = navigator.userAgent || "";
      const isAndroidWeb = /Android/i.test(ua) && !isNode && !isAndroidApp;
      const isWindowsWeb = /Windows/i.test(ua) && !isNode;

      return {
        isNode,
        isAndroidApp,
        isAndroidWeb,
        isWindowsWeb,
        isWeb: !isNode
      };
    }

    // Control global
    Game_System.prototype.enableShooting2D = function(enabled) {
        this._shooting2DEnabled = enabled;
    };

    // Permite cambiar el gráfico del proyectil por script
    Game_System.prototype.setProjectileGraphic2D = function(filename) {
        this._projectileGraphic2D = filename;
    };

    // Devuelve el gráfico actual (por si otro sistema lo necesita)
    Game_System.prototype.getProjectileGraphic2D = function() {
        return this._projectileGraphic2D || String(PluginManager.parameters(PLUGIN_NAME)["projectileGraphic"] || GRAPHIC);
    };

    // Inicialización segura para disparo 2D
    const _Game_System_initialize_shoot = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize_shoot.call(this);
        if (this._shooting2DEnabled === undefined) this._shooting2DEnabled = false;
        // inicializar contenedor global de proyectiles en runtime (por si)
        try {
            if ($gameTemp && $gameTemp._globalProjectiles2D === undefined) $gameTemp._globalProjectiles2D = [];
        } catch (e) {}
    };
    Game_System.prototype.isShooting2DEnabled = function() {
        return !!this._shooting2DEnabled;
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

            // valores personalizables
            this._customSpeed = undefined;
            this._customGraphic = undefined;
            this._customSE = undefined;


        }
			checkCollisionWithPlayer() {
    const scene = SceneManager._scene;
    if (!scene?._spriteset?._tilemap || !this._sprite) return false;

    const pGlobal = this._sprite.getGlobalPosition();
    const margin = 6; // pixels de margen para evitar colisiones prematuras

    const playerSprite = scene._spriteset._characterSprites.find(s => s._character === $gamePlayer);
    if (!playerSprite) return false;

    const bounds = playerSprite.getBounds();
    const left   = bounds.x + margin;
    const right  = bounds.x + bounds.width - margin;
    const top    = bounds.y + margin;
    const bottom = bounds.y + bounds.height - margin;

    if (pGlobal.x >= left && pGlobal.x <= right && pGlobal.y >= top && pGlobal.y <= bottom) {
        // activar Self Switch D del evento propietario
        if (this._ownerEventId != null) {
            const key = [$gameMap.mapId(), this._ownerEventId, "D"];
            $gameSelfSwitches.setValue(key, true);
        }
        return true;
    }

    return false;
}
        createSprite() {
            if (this._sprite) return;
            const scene = SceneManager._scene;
            if (!scene?._spriteset?._tilemap) return;

            // elegir bmp: personalizado o global
            const graphicName = this._customGraphic || $gameSystem.getProjectileGraphic2D() || GRAPHIC;
            const bmp = ImageManager.loadPicture(graphicName);

            const sprite = new Sprite(bmp);
            sprite.anchor.set(0.5, 0.5);
            // flip horizontal cuando es izquierda (mantener apariencia)
const finalScale = (this._customScale !== undefined ? this._customScale : SCALE);

// flip horizontal si va a la izquierda
const sx = finalScale * (this._dir === 4 ? -1 : 1);
const sy = finalScale;

sprite.scale.set(sx, sy);


            // Posición en píxeles dentro del tilemap (child del tilemap)
            sprite.x = this.x * $gameMap.tileWidth();
            sprite.y = this.y * $gameMap.tileHeight();

            scene._spriteset._tilemap.addChild(sprite);
            this._sprite = sprite;
        }

        update() {
            if (!this._alive) return;
            if (!this._sprite) this.createSprite();

            // Velocidad efectiva: custom o global
            const currentSpeed = (this._customSpeed !== undefined) ? this._customSpeed : SPEED;
            const step = (this._dir === 6 ? currentSpeed : -currentSpeed);

            // Movimiento
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
// detecta colisión con jugador
if (this._sprite && this.checkCollisionWithPlayer()) {
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
            const pGlobal = this._sprite.getGlobalPosition(); // coordenadas en pantalla
            // margin en píxeles para ajustar sensibilidad (sube para retrasar impacto)
            const margin = 6;

            // Iterar eventos y comparar contra bounds global del sprite del evento
            for (const ev of $gameMap.events()) {
                if (!ev || ev._erased) continue;

                // Buscar sprite correspondiente
                const evSprite = spriteset._characterSprites && spriteset._characterSprites.find(s => s._character === ev);
                if (!evSprite) continue;

                // Obtener bounds global del sprite del evento
                const evBounds = evSprite.getBounds();

                // Aplicar margen (reducir bounds interiormente) para evitar impactos prematuros:
                const left = evBounds.x + margin;
                const right = evBounds.x + evBounds.width - margin;
                const top = evBounds.y + margin;
                const bottom = evBounds.y + evBounds.height - margin;

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

        const env = getRuntimeEnvironment();
        const clickToShoot = (env.isAndroidApp || env.isAndroidWeb || env.isWindowsWeb);

        // Asegurar variables
        this._touchShootLastTime = this._touchShootLastTime || 0;

        if (clickToShoot) {
          const isPlatformerActive = $gameSystem.isPlatformer2DActive && $gameSystem.isPlatformer2DActive();

          if (isPlatformerActive) {
            const platformLastTapFrame = $gameSystem._lastPlatformTapFrame || 0;

            if (TouchInput.isTriggered()) {
              const now = Graphics.frameCount;

              if (platformLastTapFrame === now) {
                this._touchShootLastTime = now;
              } else {
                const elapsed = now - (this._touchShootLastTime || 0);
                if (elapsed > 0 && elapsed < 40) {
                  const centerX = Graphics.width / 2;
                  const dir = (TouchInput.x >= centerX) ? 6 : 4;
                  this.shootProjectileInDirection(dir);
                  this._touchShootLastTime = 0;
                } else {
                  this._touchShootLastTime = now;
                }
              }
            }
          } else {
            if (TouchInput.isTriggered()) {
              const centerX = Graphics.width / 2;
              const dir = (TouchInput.x >= centerX) ? 6 : 4;
              this.shootProjectileInDirection(dir);
            }
          }
        }

        // Tecla A → dispara siempre (PC)
        if (Input.isTriggered("shoot")) {
          this.shootProjectile();
        }

        // Update de proyectiles del jugador
        if (this._projectiles2D) {
            for (const p of this._projectiles2D) p.update();
            this._projectiles2D = this._projectiles2D.filter(p => p._alive);
        }

        // Update de proyectiles globales (eventos)
        if ($gameTemp) {
            $gameTemp._globalProjectiles2D = $gameTemp._globalProjectiles2D || [];
            for (const p of $gameTemp._globalProjectiles2D) p.update();
            $gameTemp._globalProjectiles2D = $gameTemp._globalProjectiles2D.filter(p => p._alive);
        }
    };

    Game_Player.prototype.shootProjectile = function() {
        if (!$gameSystem.isShooting2DEnabled()) return;

        AudioManager.playSe({ name: SE_NAME, pan: 0, pitch: 100, volume: 90 });
        const dir = this.direction(); // 4=izq,6=der
        if (![4, 6].includes(dir)) return;
/*
        const sprite = SceneManager._scene?._spriteset?._characterSprites.find(s => s._character === this);
        let startX = this._realX;
        let startY = this._realY + Y_OFFSET;
        if (sprite) {
            const tileHeight = $gameMap.tileHeight();
            const torsoOffset = 0.55;  // ajuste vertical visual
            startY = sprite.y / tileHeight - torsoOffset + Y_OFFSET;
        }

        // offset lateral (valor fijo como en tu plugin original)
        const offset = 4.0;
        if (dir === 6) startX += offset;
        if (dir === 4) startX += offset;
*/
//-----------
const sprite = SceneManager._scene._spriteset._characterSprites?.find(s => s._character === this);

let startX_px, startY_px;

if (sprite) {
    // posición visual dentro del tilemap
    startX_px = sprite.x;
    startY_px = sprite.y;

    // ajustar altura del torso
    const torsoOffsetPx = 0.55 * $gameMap.tileHeight();
    startY_px -= torsoOffsetPx;

    // lateral según dirección
    const halfWidthPx = (sprite.width * sprite.scale.x) / 2;
    const marginPx = 2; // margen visual
    if (dir === 6) startX_px += halfWidthPx + marginPx; // derecha
    if (dir === 4) startX_px -= halfWidthPx + marginPx; // izquierda
} else {
    // fallback en tiles convertido a píxeles
    startX_px = this._realX * $gameMap.tileWidth();
    startY_px = this._realY * $gameMap.tileHeight();
    if (dir === 6) startX_px += 8;
    if (dir === 4) startX_px -= 8;
}

// convertir a coordenadas en tiles para la lógica del proyectil
const startX = startX_px / $gameMap.tileWidth();
const startY = startY_px / $gameMap.tileHeight();


//------------------
        const p = new Projectile(startX, startY, dir);
		
        this._projectiles2D.push(p);
    };

    Game_Player.prototype.shootProjectileInDirection = function(dir) {
        if (!$gameSystem.isShooting2DEnabled()) return;
        AudioManager.playSe({ name: SE_NAME, pan: 0, pitch: 100, volume: 90 });

        const sprite = SceneManager._scene?._spriteset?._characterSprites.find(s => s._character === this);
        let startX = this._realX;
        let startY = this._realY + Y_OFFSET;
        if (sprite) {
            const tileHeight = $gameMap.tileHeight();
            const torsoOffset = 0.55;
            startY = sprite.y / tileHeight - torsoOffset + Y_OFFSET;
        }

        const offset = 4.00;
        if (dir === 6) startX += offset;
        if (dir === 4) startX += offset;

        const p = new Projectile(startX, startY, dir);
        this._projectiles2D.push(p);
    };

    // -------------------------------------------------------
    // Función pública: disparar desde un evento por script
    // Uso: $gameSystem.shootProjectileFromEvent(evId, dir, speed, seName, graphic)
    // dir: 0 = izquierda, 1 = derecha
    // -------------------------------------------------------
Game_System.prototype.shootProjectileFromEvent = function(eventId, dir, speed, seName, graphic, scale) {
        const ev = $gameMap.event(eventId);
        if (!ev) return;
// ==========================================================
// AUTO-TARGET (dir = 2) → disparar según la posición del jugador
// ==========================================================
if (dir === 2) {
    const playerX = $gamePlayer._realX;
    const eventX = ev._realX;

    // Si el jugador está a la derecha → disparar derecha (6)
    // Si está a la izquierda → disparar izquierda (4)
    dir = (playerX > eventX ? 1 : 0);
}

        // reproducir sonido si se especifica (o usar null para omitir)
        if (seName) {
            AudioManager.playSe({ name: seName, pan: 0, pitch: 100, volume: 90 });
        }

        const realDir = (dir === 0 ? 4 : 6);

const sprite = SceneManager._scene._spriteset._characterSprites?.find(s => s._character === ev);

let startX = ev._realX; // fallback
let startY = ev._realY;

if (sprite) {
    const tileHeight = $gameMap.tileHeight();
    const tileWidth = $gameMap.tileWidth();
    const torsoOffset = 0.55;
    startY = sprite.y / tileHeight - torsoOffset;

    // posición en pixels dentro del tilemap
    const spriteX = sprite.x;
    const halfWidthPx = (sprite.width * sprite.scale.x) / 2;
    const marginPx = 2; // pequeño margen en pixels

    // calcular startX en tiles según dirección
    if (realDir === 6) { // derecha
        startX = (spriteX + halfWidthPx + marginPx) / tileWidth;
    } else if (realDir === 4) { // izquierda
        startX = (spriteX - halfWidthPx - marginPx) / tileWidth;
    }
} else {
    // fallback en tiles
    startX += (realDir === 6 ? 0.5 : -0.5);
}




        const p = new Projectile(startX, startY, realDir);
p._ownerEventId = eventId;
        // aplicar parámetros personalizados si se pasaron
        if (typeof speed === "number") p._customSpeed = speed;
        if (typeof graphic === "string" && graphic.length > 0) p._customGraphic = graphic;
        if (typeof seName === "string" && seName.length > 0) p._customSE = seName;
		if (typeof scale === "number") p._customScale = scale;


        // push al contenedor global de proyectiles (inicializa si hace falta)
        $gameTemp._globalProjectiles2D = $gameTemp._globalProjectiles2D || [];
        $gameTemp._globalProjectiles2D.push(p);
    };
// ===============================
//  FIX: FORZAR UPDATE GLOBAL SIEMPRE
// ===============================
const _Spriteset_Map_update = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.call(this);

    if ($gameTemp && $gameTemp._globalProjectiles2D) {
        for (const p of $gameTemp._globalProjectiles2D) p.update();
        $gameTemp._globalProjectiles2D = $gameTemp._globalProjectiles2D.filter(p => p._alive);
    }
};

})(); 
