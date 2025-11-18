/*:
 * @target MZ
 * @plugindesc Disparo 2D robusto con impacto opcional: colisión usando bounds globales + runtime SE/Gráfico/Escala/Animación por script
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
 * @text Sonido por defecto del disparo
 * @type file
 * @dir audio/se
 * @default Attack3
 *
 * @param projectileGraphic
 * @text Gráfico por defecto del proyectil
 * @type file
 * @dir img/pictures
 * @default Bullet
 *
 * @param projectileScale
 * @text Escala por defecto
 * @type number
 * @decimals 2
 * @default 1.0
 *
 * @param projectileYOffset
 * @text Offset vertical
 * @type number
 * @decimals 2
 * @default 0
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

    Input.keyMapper[65] = "shoot";
	
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

    // ------------------------------------------------------------
    // MODIFICADO ► enableShooting2D pasa SE, Gráfico, Escala y Anim
    // ------------------------------------------------------------
    Game_System.prototype.enableShooting2D = function(enabled, seName, graphicName, scale, impactAnimationId) {
        this._shooting2DEnabled = enabled;

        if (enabled) {
            if (typeof seName === "string") this._shootSE_Player = seName;
            if (typeof graphicName === "string") this._projectileGraphic_Player = graphicName;
            if (typeof scale === "number") this._projectileScale_Player = scale;
            if (impactAnimationId !== undefined && impactAnimationId !== null)
                this._projectileImpact_Player = impactAnimationId;
        }
    };

    Game_System.prototype.isShooting2DEnabled = function() {
        return !!this._shooting2DEnabled;
    };

    Game_System.prototype.setProjectileGraphic2D = function(filename) {
        this._projectileGraphic2D = filename;
    };

    Game_System.prototype.getProjectileGraphic2D = function() {
        return this._projectileGraphic2D || GRAPHIC;
    };

    // Inicialización
    const _Game_System_initialize_shoot = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize_shoot.call(this);
        if (this._shooting2DEnabled === undefined) this._shooting2DEnabled = false;
        if ($gameTemp && $gameTemp._globalProjectiles2D === undefined)
            $gameTemp._globalProjectiles2D = [];
    };

    // ----------------------------------------------------
    // Clase PROYECTIL (incluye animación de impacto nueva)
    // ----------------------------------------------------
    class Projectile {
        constructor(x, y, dir) {
            this.x = x;
            this.y = y;
            this._dir = dir;
            this._distance = 0;
            this._alive = true;
            this._sprite = null;

            this._customSpeed = undefined;
            this._customGraphic = undefined;
            this._customScale = undefined;

            this._customImpact = undefined;
            this._ownerEventId = null;
        }

        playImpactAnimation() {
            const anim = this._customImpact;
            if (!anim || anim === "none") return;

            try {
                const scene = SceneManager._scene;
                if (!scene || !scene._spriteset) return;

                const screenX = this._sprite.x;
                const screenY = this._sprite.y;

                const ani = $dataAnimations[anim];
                if (ani) {
                    scene._spriteset.createAnimation([this._sprite], anim, false, 0);
                }
            } catch(e) {}
        }

        checkCollisionWithPlayer() {
            const scene = SceneManager._scene;
            if (!scene?._spriteset || !this._sprite) return false;

            try {
                const pGlobal = this._sprite.getGlobalPosition();
                const margin = 6;

                const playerSprite = scene._spriteset._characterSprites.find(s => s._character === $gamePlayer);
                if (!playerSprite) return false;

                const bounds = playerSprite.getBounds();
                const left = bounds.x + margin;
                const right = bounds.x + bounds.width - margin;
                const top = bounds.y + margin;
                const bottom = bounds.y + bounds.height - margin;

                if (pGlobal.x >= left && pGlobal.x <= right && pGlobal.y >= top && pGlobal.y <= bottom) {
                    if (this._ownerEventId != null) {
                        const key = [$gameMap.mapId(), this._ownerEventId, "D"];
                        $gameSelfSwitches.setValue(key, true);
                    }
                    return true;
                }
            } catch(e) {}

            return false;
        }

        checkEventCollisionUsingGlobalBounds() {
            const scene = SceneManager._scene;
            const spriteset = scene?._spriteset;
            if (!spriteset || !this._sprite) return false;

            try {
                const pGlobal = this._sprite.getGlobalPosition();
                const margin = 6;

                for (const ev of $gameMap.events()) {
                    if (!ev || ev._erased) continue;
                    const evSprite = spriteset._characterSprites.find(s => s._character === ev);
                    if (!evSprite) continue;

                    const evBounds = evSprite.getBounds();
                    const left = evBounds.x + margin;
                    const right = evBounds.x + evBounds.width - margin;
                    const top = evBounds.y + margin;
                    const bottom = evBounds.y + evBounds.height - margin;

                    if (pGlobal.x >= left && pGlobal.x <= right && pGlobal.y >= top && pGlobal.y <= bottom) {
                        const key = [$gameMap.mapId(), ev.eventId(), "C"];
                        $gameSelfSwitches.setValue(key, true);
                        return true;
                    }
                }
            } catch(e) {}

            return false;
        }

        createSprite() {
            if (this._sprite) return;

            const scene = SceneManager._scene;
            const tilemap = scene?._spriteset?._tilemap;
            if (!tilemap) return;

            const graphicName = this._customGraphic || GRAPHIC;
            const bmp = ImageManager.loadPicture(graphicName);

            const sprite = new Sprite(bmp);
            sprite.anchor.set(0.5, 0.5);

            const finalScale = this._customScale ?? SCALE;
            const sx = finalScale * (this._dir === 4 ? -1 : 1);
            const sy = finalScale;
            sprite.scale.set(sx, sy);

            sprite.x = this.x * $gameMap.tileWidth();
            sprite.y = this.y * $gameMap.tileHeight();

            tilemap.addChild(sprite);
            this._sprite = sprite;
        }

        destroy() {
            this._alive = false;
            if (this._sprite) {
                this.playImpactAnimation(); // <<< NUEVA ANIMACIÓN DE IMPACTO

                try {
                    if (this._sprite.parent)
                        this._sprite.parent.removeChild(this._sprite);
                } catch(_) {}

                try { this._sprite.destroy({ children: true }); } catch(_) {}
                this._sprite = null;
            }
        }

        update() {
            if (!this._alive) return;

            const scene = SceneManager._scene;
            const tilemap = scene?._spriteset?._tilemap;

            if (!tilemap) return this.destroy();
            if (!this._sprite) this.createSprite();
            if (!this._sprite) return;

            if (!this._sprite.parent) return this.destroy();

            const currentSpeed = this._customSpeed ?? SPEED;
            const step = (this._dir === 6 ? currentSpeed : -currentSpeed);
            this.x += step;
            this._distance += Math.abs(step);

            this._sprite.x = this.x * $gameMap.tileWidth();
            this._sprite.y = this.y * $gameMap.tileHeight();

            if (this.checkEventCollisionUsingGlobalBounds()) return this.destroy();
            if (this.checkCollisionWithPlayer()) return this.destroy();

            if (this._distance >= RANGE) return this.destroy();
        }
    }

    // --------------------------------------------------------
    // PLAYER
    // --------------------------------------------------------
    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        this.updateShooting2D();
    };

    Game_Player.prototype.updateShooting2D = function() {
        if (!this._projectiles2D) this._projectiles2D = [];
        if (!$gameSystem.isShooting2DEnabled()) return;

        if (Input.isTriggered("shoot")) {
            this.shootProjectile();
        }
		const env = getRuntimeEnvironment();

 const clickToShoot = (env.isAndroidApp || env.isAndroidWeb || env.isWindowsWeb);
     // >>> DISPARO POR TOUCH <<<
    if (TouchInput.isTriggered()&&clickToShoot) {
        this.shootProjectile();
    }
        for (const p of this._projectiles2D) p.update();
        this._projectiles2D = this._projectiles2D.filter(p => p._alive);

        if ($gameTemp?._globalProjectiles2D) {
            for (const p of $gameTemp._globalProjectiles2D) p.update();
            $gameTemp._globalProjectiles2D =
                $gameTemp._globalProjectiles2D.filter(p => p._alive);
        }
    };

    Game_Player.prototype.shootProjectile = function() {
        if (!$gameSystem.isShooting2DEnabled()) return;

        const seUsed = $gameSystem._shootSE_Player || SE_NAME;
        AudioManager.playSe({ name: seUsed, pan: 0, pitch: 100, volume: 90 });

        const dir = this.direction();
        if (![4,6].includes(dir)) return;

        const sprite = SceneManager._scene._spriteset._characterSprites.find(s => s._character === this);
        let startX_px = sprite.x;
        let startY_px = sprite.y - 0.55 * $gameMap.tileHeight();

        const halfWidthPx = (sprite.width * sprite.scale.x) / 2;
        if (dir === 6) startX_px += halfWidthPx + 2;
        if (dir === 4) startX_px -= halfWidthPx + 2;

        const startX = startX_px / $gameMap.tileWidth();
        const startY = startY_px / $gameMap.tileHeight();

        const p = new Projectile(startX, startY, dir);
        p._customGraphic = $gameSystem._projectileGraphic_Player;
        p._customScale = $gameSystem._projectileScale_Player;
        p._customImpact = $gameSystem._projectileImpact_Player;

        this._projectiles2D.push(p);
    };

    // --------------------------------------------------------
    // EVENTOS DISPARANDO
    // --------------------------------------------------------
    Game_System.prototype.shootProjectileFromEvent = function(eventId, dir, speed, seName, graphic, scale, impactAnim) {
        const ev = $gameMap.event(eventId);
        if (!ev) return;

        if (dir === 2) dir = ($gamePlayer._realX > ev._realX ? 1 : 0);

        if (seName) {
            AudioManager.playSe({ name: seName, pan: 0, pitch: 100, volume: 90 });
        }

        const realDir = (dir === 0 ? 4 : 6);

        const sprite = SceneManager._scene._spriteset._characterSprites.find(s => s._character === ev);
        let startX = ev._realX;
        let startY = ev._realY;

        if (sprite) {
            startY = sprite.y / $gameMap.tileHeight() - 0.55;

            const halfWidthPx = (sprite.width * sprite.scale.x) / 2;
            const px = sprite.x;

            if (realDir === 6)
                startX = (px + halfWidthPx + 2) / $gameMap.tileWidth();
            else
                startX = (px - halfWidthPx - 2) / $gameMap.tileWidth();
        }

        const p = new Projectile(startX, startY, realDir);
        p._ownerEventId = eventId;

        if (typeof speed === "number") p._customSpeed = speed;
        if (typeof graphic === "string") p._customGraphic = graphic;
        if (typeof scale === "number") p._customScale = scale;

        if (impactAnim !== undefined && impactAnim !== null)
            p._customImpact = impactAnim;

        $gameTemp._globalProjectiles2D.push(p);
    };

    // --------------------------------------------------------
    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);

        if ($gameTemp && $gameTemp._globalProjectiles2D) {
            for (const p of $gameTemp._globalProjectiles2D) p.update();
            $gameTemp._globalProjectiles2D =
                $gameTemp._globalProjectiles2D.filter(p => p._alive);
        }
    };

})();
