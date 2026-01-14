/*:
 * @target MZ
 * @plugindesc Rayo de tormenta realista con seguimiento de evento en movimiento.
 * @author 3DalbiX
 *
 * @command lightningStrike
 * @text Lanzar rayo
 *
 * @arg eventId
 * @type number
 * @min 1
 * @text ID del evento
 *
 * @arg selfSwitch
 * @type string
 * @default A
 * @text Self Switch
 *
 * @arg thickness
 * @type number
 * @min 1
 * @default 4
 * @text Grosor inicial
 *
 * @arg duration
 * @type number
 * @min 1
 * @default 14
 * @text Duración (frames)
 */

(() => {

const PLUGIN_NAME = "LightningStorm";

//-------------------------------------------------------------
// OVERLAY OSCURO
//-------------------------------------------------------------
class Sprite_DarkOverlay extends Sprite {
    constructor(duration) {
        super(new Bitmap(Graphics.width, Graphics.height));
        this.bitmap.fillAll("black");
        this.opacity = 0;
        this._maxOpacity = 120;
        this._life = duration;
    }

    update() {
        super.update();
        if (this._life > 0) {
            this.opacity = Math.min(this._maxOpacity, this.opacity + 30);
        } else {
            this.opacity -= 30;
            if (this.opacity <= 0 && this.parent) {
                this.parent.removeChild(this);
            }
        }
        this._life--;
    }
}

//-------------------------------------------------------------
// SPRITE DEL RAYO (SEGUIMIENTO DE EVENTO)
//-------------------------------------------------------------
class Sprite_Lightning extends Sprite {
    constructor(startX, startY, targetEvent, thickness, duration) {
        super();
        this.bitmap = new Bitmap(Graphics.width, Graphics.height);
        this.opacity = 255;
        this._life = duration;

        this._startX = startX;
        this._startY = startY;
        this._event = targetEvent;

        this._frameCount = 0;
        this._redrawInterval = 20;

        this._thickStart = thickness;
        this._thickEnd = 0.6;
        this._auraRadius = 200;

        this._maxBranches = 3;

        this._colorMain = "rgba(230,245,255,0.95)";
        this._colorGlow = "rgba(140,190,255,0.45)";

        this.redraw();
    }

    redraw() {
        if (!this._event) return;

        this.bitmap.clear();
        this._currentBranches = 0;

        const endX = this._event.screenX();
        const endY = this._event.screenY() - 24;

        this.drawLightning(
            this._startX,
            this._startY,
            endX,
            endY,
            0
        );
    }

    drawAura(x, y, strength) {
        const ctx = this.bitmap.context;
        const radius = this._auraRadius * strength;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(120,170,255,${0.18 * strength})`);
        grad.addColorStop(1, "rgba(120,170,255,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawLightning(x1, y1, x2, y2, depth) {
        if (depth > 3) return;

        const segments = 24;
        let prevX = x1;
        let prevY = y1;

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const factor = 1 - t;

            let nx = x1 + (x2 - x1) * t;
            let ny = y1 + (y2 - y1) * t;

            nx += (Math.random() - 0.5) * 40;
            ny += (Math.random() - 0.5) * 30;

            const width = this._thickEnd + (this._thickStart - this._thickEnd) * factor;
            const glowWidth = width * 2.2;

            this.drawAura(nx, ny, factor);

            const ctx = this.bitmap.context;

            // Glow
            ctx.strokeStyle = this._colorGlow;
            ctx.lineWidth = glowWidth;
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(nx, ny);
            ctx.stroke();

            // Línea principal
            ctx.strokeStyle = this._colorMain;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(nx, ny);
            ctx.stroke();

            // RAMIFICACIONES
            if (
                this._currentBranches < this._maxBranches &&
                Math.random() < 0.16 &&
                depth < 2
            ) {
                this._currentBranches++;

                const bx = nx + (Math.random() - 0.5) * 160;
                const by = ny + Math.random() * 100;

                this.drawLightning(nx, ny, bx, by, depth + 1);
            }

            prevX = nx;
            prevY = ny;
        }

        this.bitmap.baseTexture.update();
    }

    update() {
        super.update();

        this._life--;
        this._frameCount++;

        if (this._frameCount % this._redrawInterval === 0) {
            this.redraw();
        }

        this.opacity = 255 * (this._life / Math.max(1, this._life + 1));

        if (this._life <= 0 && this.parent) {
            this.parent.removeChild(this);
        }
    }
}

//-------------------------------------------------------------
// COMANDO DEL PLUGIN
//-------------------------------------------------------------
PluginManager.registerCommand(PLUGIN_NAME, "lightningStrike", args => {

    const eventId    = Number(args.eventId);
    const selfSwitch = String(args.selfSwitch || "A");
    const thickness = Number(args.thickness || 4);
    const duration  = Number(args.duration || 14);

    const event = $gameMap.event(eventId);
    if (!event) return;

    const startX = Math.random() * Graphics.width;
    const startY = -30;

    const scene = SceneManager._scene;
    if (!scene) return;

    scene.addChild(new Sprite_DarkOverlay(duration));

    $gameScreen.startFlash([255, 255, 255, 150], 6);

    AudioManager.playSe({
        name: "Thunder1",
        volume: 90,
        pitch: 100,
        pan: 0
    });

    scene.addChild(
        new Sprite_Lightning(
            startX,
            startY,
            event,
            thickness,
            duration
        )
    );

    // Activar self switch al finalizar
    setTimeout(() => {
        const key = [$gameMap.mapId(), eventId, selfSwitch];
        $gameSelfSwitches.setValue(key, true);
    }, duration * 16);
});

})();
