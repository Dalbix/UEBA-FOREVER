/*:
 * @target MZ
 * @plugindesc Explosión eléctrica sobre un evento (auto calcula posición y respeta zoom) 
 * @author 3DalbiX
 *
 * @command electricExplosion
 * @text Explosión eléctrica
 * @desc Crea una explosión eléctrica sobre un evento dado.
 *
 * @arg eventId
 * @type number
 * @default 0
 * @text ID del evento
 * @desc 0 = este evento
 *
 * @arg duration
 * @type number
 * @default 30
 * @text Duración en frames
 *
 * @command electricSparks
 * @text Chispas eléctricas
 * @desc Genera chispas tipo cortocircuito sobre un evento.
 *
 * @arg eventId
 * @type number
 * @default 0
 * @text ID del evento
 * @desc 0 = este evento
 *
 * @arg duration
 * @type number
 * @default 40
 * @text Duración en frames
 *
 * @arg smoke
 * @type boolean
 * @default false
 * @text Añadir humo
 * @desc Genera una nube de humo negro que se desvanece con el tiempo.
 */


(() => {

    class SpriteElectricExplosion extends Sprite {
        constructor(x, y, duration) {
            super();
            this.size = 64; // tamaño de la explosión
            this.bitmap = new Bitmap(this.size, this.size);
            this.anchor.set(0.5, 0.5);

            this.baseX = x;
            this.baseY = y;

            this.duration = duration;
            this.frameCount = 0;
        }

        update() {
            super.update();
            this.bitmap.clear();
            const ctx = this.bitmap.context;

            // Rayos aleatorios
            const lines = 6 + Math.floor(Math.random() * 4);
            ctx.strokeStyle = "#00ffff";
            ctx.lineWidth = 3;
            for (let i = 0; i < lines; i++) {
                const startX = this.size / 2;
                const startY = this.size / 2;
                const endX = startX + (Math.random() - 0.5) * this.size;
                const endY = startY + (Math.random() - 0.5) * this.size;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }

            // Pulsos circulares
            const pulseRadius = 8 + Math.random() * (this.size / 2);
            ctx.beginPath();
            ctx.arc(this.size / 2, this.size / 2, pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = "#00ffff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Ajustar posición según zoom (para tu plugin AutoZoom)
            const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
            this.x = this.baseX / zoom;
            this.y = this.baseY / zoom;
            this.scale.x = zoom;
            this.scale.y = zoom;

            this.frameCount++;
            if (this.frameCount >= this.duration) {
                if (this.parent) this.parent.removeChild(this);
            }
        }
    }
	
	

    PluginManager.registerCommand("ElectricExplosion", "electricExplosion", args => {
        const eventId = Number(args.eventId);
        const duration = Number(args.duration);

        let ev;
        if (eventId === 0) {
            ev = $gameMap.event($gameMap._interpreter?._eventId || 1); // este evento
        } else {
            ev = $gameMap.event(eventId);
        }

        if (!ev) return;

        // Posición en pantalla del evento
        const x = ev.screenX();
        const y = ev.screenY();

        const explosion = new SpriteElectricExplosion(x, y, duration);

        // Agregar al Spriteset_Map para que se vea correctamente
        if (SceneManager._scene._spriteset) {
            SceneManager._scene._spriteset.addChild(explosion);
        }
    });
	

class SpriteSmokeCloud extends Sprite {
    constructor(x, y, duration) {
        super();
        this.bitmap = new Bitmap(200, 200);
        this.anchor.set(0.5, 0.5);

        this.baseX = x;
        this.baseY = y;
        this.duration = duration;
        this.frameCount = 0;

        this.puffs = [];
        this._createSmoke();
    }

    _createSmoke() {
        const count = 6 + Math.randomInt(4);
        for (let i = 0; i < count; i++) {
            this.puffs.push({
                x: 100 + (Math.random() - 0.5) * 30,
                y: 110 + (Math.random() - 0.5) * 20,
                radius: 25 + Math.random() * 20,
                grow: 0.15 + Math.random() * 0.2,
                driftX: (Math.random() - 0.5) * 0.15,
                driftY: -0.05 - Math.random() * 0.1,
                alpha: 0.35
            });
        }
    }

    update() {
        super.update();
        this.bitmap.clear();
        const ctx = this.bitmap.context;

        const lifeRatio = 1 - (this.frameCount / this.duration);
        const baseAlpha = 0.35 * lifeRatio;

        for (const p of this.puffs) {
            p.x += p.driftX;
            p.y += p.driftY;
            p.radius += p.grow;

            ctx.globalAlpha = baseAlpha;
            ctx.fillStyle = "#111111";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1.0;

        // AutoZoom
        const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
        this.x = this.baseX / zoom;
        this.y = this.baseY / zoom;
        this.scale.set(zoom, zoom);

        this.frameCount++;
        if (this.frameCount >= this.duration) {
            if (this.parent) this.parent.removeChild(this);
        }
    }
}

class SpriteElectricSparks extends Sprite {
    constructor(x, y, duration) {
        super();
        this.bitmap = new Bitmap(160, 160);
        this.anchor.set(0.5, 0.5);

        this.baseX = x;
        this.baseY = y;

        this.duration = duration;
        this.frameCount = 0;

        this.particles = [];
        this._createParticles();
    }

    _createParticles() {
        const colors = [
            "#ffffff", "#ffffff",
            "#ffffcc", "#ffff66",
            "#ffcc33", "#ff9933",
            "#ff6633" // muy pocas rojizas
        ];

        const baseCount = 24;

        const createGroup = (count, sizeMin, sizeMax, speedMin, speedMax, gravityMin, gravityMax, alphaLoss) => {
            for (let i = 0; i < count; i++) {
                const angle =
                    Math.random() * Math.PI * 2 +
                    (Math.random() - 0.5) * 0.4;

                const speed =
                    speedMin + Math.random() * (speedMax - speedMin);

                this.particles.push({
                    x: 80,
                    y: 80,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: gravityMin + Math.random() * (gravityMax - gravityMin),
                    friction: 0.985 + Math.random() * 0.01,
                    life: this.duration,
                    alpha: 1.0,
                    alphaLoss: alphaLoss,
                    size: sizeMin + Math.random() * (sizeMax - sizeMin),
                    color: colors[Math.randomInt(colors.length)]
                });
            }
        };

        // 🔸 Gruesas (núcleo)
        createGroup(
            baseCount,
            2.5, 4.0,
            1.4, 2.2,
            0.05, 0.08,
            1.0
        );

        // 🔹 Medias
        createGroup(
            baseCount,
            1.5, 2.5,
            1.0, 1.8,
            0.04, 0.07,
            1.3
        );

        // 🔺 Finas (muchas, ligeras)
        createGroup(
            baseCount,
            0.7, 1.3,
            0.6, 1.2,
            0.02, 0.05,
            1.6
        );
    }

    update() {
        super.update();
        this.bitmap.clear();
        const ctx = this.bitmap.context;

        ctx.globalCompositeOperation = "lighter";

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            p.vy += p.gravity;
            p.vx *= p.friction;
            p.vy *= p.friction;

            p.alpha -= (p.alphaLoss / p.life);
            if (p.alpha <= 0) continue;

            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;

        // AutoZoom
        const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
        this.x = this.baseX / zoom;
        this.y = this.baseY / zoom;
        this.scale.set(zoom, zoom);

        this.frameCount++;
        if (this.frameCount >= this.duration) {
            if (this.parent) this.parent.removeChild(this);
        }
    }
}

PluginManager.registerCommand("ElectricExplosion", "electricSparks", args => {
    const eventId = Number(args.eventId);
    const duration = Number(args.duration);
    const smoke = args.smoke === "true";

    let ev;
    if (eventId === 0) {
        ev = $gameMap.event($gameMap._interpreter?._eventId || 1);
    } else {
        ev = $gameMap.event(eventId);
    }
    if (!ev) return;

    const x = ev.screenX();
    const y = ev.screenY() - 24;

    const spriteset = SceneManager._scene._spriteset;
    if (!spriteset) return;

    // 🌫️ Humo (debajo)
    if (smoke) {
        const smokeSprite = new SpriteSmokeCloud(x, y, duration);
        spriteset.addChild(smokeSprite);
    }

    // ⚡ Chispas (encima)
    const sparks = new SpriteElectricSparks(x, y, duration);
    spriteset.addChild(sparks);
});


})();
