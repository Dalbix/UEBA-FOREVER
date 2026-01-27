/*:
 * @target MZ
 * @plugindesc HUD con dos barras superiores optimizadas (redibujo inteligente + rayas a 20fps).
 * @author 3DalbiX
 *
 * @command LeftBar
 * @arg picture @type string
 * @arg scale @type number @decimals 2 @default 1
 * @arg variableId @type variable
 * @arg color @type string @default 255,0,0
 * @arg visible @type boolean @default true
 *
 * @command RightBar
 * @arg picture @type string
 * @arg scale @type number @decimals 2 @default 1
 * @arg variableId @type variable
 * @arg color @type string @default 0,255,0
 * @arg visible @type boolean @default true
 */

(() => {
    const PLUGIN_NAME = "DualHudBars";
 window.DualHudBars = {};
const HUD = {
    left:  {
        visible: false,
        picture: "",
        scale: 1,
        variableId: 0,
        color: "255,0,0"
    },
    right: {
        visible: false,
        picture: "",
        scale: 1,
        variableId: 0,
        color: "0,255,0"
    }
};

    const HUD_LAYOUT = {
        margin: 8,
        barGap: 82,
        iconBarGap: 12,
        optionButtonWidth: 74,
        iconWidth: 32,
        barHeight: 16
    };

    // =====================================================
    // COMMANDS
    // =====================================================
    PluginManager.registerCommand(PLUGIN_NAME, "LeftBar", args => {
        Object.assign(HUD.left, {
            picture: args.picture || "",
            scale: Number(args.scale || 1),
            variableId: Number(args.variableId || 0),
            color: args.color || "255,0,0",
            visible: args.visible === "true"
        });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "RightBar", args => {
        Object.assign(HUD.right, {
            picture: args.picture || "",
            scale: Number(args.scale || 1),
            variableId: Number(args.variableId || 0),
            color: args.color || "0,255,0",
            visible: args.visible === "true"
        });
    });

    // =====================================================
    // SPRITE
    // =====================================================
    class Sprite_HudBar extends Sprite {
        constructor(data, isRight) {
            super();
            this._data = data;
            this._isRight = isRight;

            this._lastRate = null;
            this._patternOffset = 0;
            this._stripeFrame = 0;
this._forceRefresh=false;
            this.updateDimensions();

              this._bgBitmap    = new Bitmap(this._width, 36);
        this._fillBitmap  = new Bitmap(this._width, 36);
        this._finalBitmap = new Bitmap(this._width, 36);

        // el sprite SIEMPRE muestra el bitmap final
        this.bitmap = this._finalBitmap;

            this._icon = new Sprite();
            this._icon.anchor.set(0.5, 0);
            this._icon.y = 2;
            this.addChild(this._icon);

            this.drawBackground();
            this.updatePosition();
        }

        updateDimensions() {
            const totalWidth = Graphics.width - HUD_LAYOUT.margin * 2 - HUD_LAYOUT.optionButtonWidth;
            this._barWidth = Math.floor(
                (totalWidth - HUD_LAYOUT.iconWidth * 2 - HUD_LAYOUT.barGap) / 2
            );
            this._barHeight = HUD_LAYOUT.barHeight;
            this._width = this._barWidth + HUD_LAYOUT.iconWidth + HUD_LAYOUT.iconBarGap;
        }

        updatePosition() {
            if (this._isRight) {
                this.x = Graphics.width
                       - HUD_LAYOUT.margin
                       - HUD_LAYOUT.optionButtonWidth
                       - HUD_LAYOUT.iconWidth
                       - HUD_LAYOUT.iconBarGap
                       - this._barWidth;
                this._icon.x = this._barWidth + HUD_LAYOUT.iconBarGap + HUD_LAYOUT.iconWidth / 2;
            } else {
                this.x = HUD_LAYOUT.margin;
                this._icon.x = HUD_LAYOUT.iconWidth / 2;
            }
        }

        update() {
            super.update();

            const scene = SceneManager._scene;
            const onMap = scene instanceof Scene_Map && scene._windowLayer;
            const noVideo = typeof Video !== "undefined" ? !Video.isPlaying() : true;

            this.visible = this._data.visible && onMap && noVideo;
            if (!this.visible) return;

// 🔑 refresco forzado diferido
if (this._forceRefresh) {
    this._forceRefresh = false;
    this._lastRate = null;

    const value = this._data.variableId
        ? $gameVariables.value(this._data.variableId)
        : 100;

    const rate = Math.max(0, Math.min(100, value)) / 100;
    this.redrawFill(rate);
}

            this.refreshIcon();

            const value = this._data.variableId
                ? $gameVariables.value(this._data.variableId)
                : 100;

            const rate = Math.max(0, Math.min(100, value)) / 100;

            // === Mejora 1: solo redibujar si cambia el valor
            if (rate !== this._lastRate) {
                this._lastRate = rate;
                this.redrawFill(rate);
            }

            // === Mejora 3 (Opción A): animar rayas cada 3 frames
            this._stripeFrame++;
            if (this._stripeFrame % 3 === 0) {
                this._patternOffset += 1;
                this.redrawFill(this._lastRate);
            }
        }

        refreshIcon() {
            if (!this._data.picture) return;
            if (this._iconName !== this._data.picture) {
                this._iconName = this._data.picture;
                this._icon.bitmap = ImageManager.loadPicture(this._iconName);
            }
            this._icon.scale.set(this._data.scale || 1);
        }

        // =====================================================
        // DRAW STATIC BACKGROUND (ONCE)
        // =====================================================
        drawBackground() {
            const barX = this._isRight ? 0 : HUD_LAYOUT.iconWidth + HUD_LAYOUT.iconBarGap;
            const barY = 10;
            const w = this._barWidth;
            const h = this._barHeight;

            this._bgBitmap.clear();

            for (let y = 0; y < h; y++) {
                const shade = 30 + (y / h) * 40;
                this._bgBitmap.fillRect(barX, barY + y, w, 1, `rgb(${shade},${shade},${shade})`);
            }

            const [r, g, b] = this._data.color.split(",").map(Number);

            this._bgBitmap.strokeRect(barX, barY, w, h, `rgb(${r},${g},${b})`);
            this._bgBitmap.fillRect(barX, barY, w, 1, "rgba(255,255,255,0.6)");
            this._bgBitmap.fillRect(barX, barY + h - 1, w, 1, "rgba(0,0,0,0.6)");
        }

        // =====================================================
        // DRAW DYNAMIC FILL
        // =====================================================
        redrawFill(rate) {
            this._fillBitmap.clear();

            const barX = this._isRight ? 0 : HUD_LAYOUT.iconWidth + HUD_LAYOUT.iconBarGap;
            const barY = 10;
            const w = this._barWidth;
            const h = this._barHeight;

            const fillW = Math.floor((w - 2) * rate);
    if (fillW <= 0) {
    // fondo sin relleno, pero usando SIEMPRE el bitmap final
    this._finalBitmap.clear();
    this._finalBitmap.blt(
        this._bgBitmap,
        0, 0,
        this._bgBitmap.width,
        this._bgBitmap.height,
        0, 0
    );
    return;
}

            const fillX = this._isRight
                ? barX + w - 1 - fillW
                : barX + 1;

            const [r, g, b] = this._data.color.split(",").map(Number);

            for (let y = 0; y < h - 2; y++) {
                const t = y / (h - 2);
                const s = Math.sin(t * Math.PI);
                this._fillBitmap.fillRect(
                    fillX,
                    barY + 1 + y,
                    fillW,
                    1,
                    `rgb(${r * (0.6 + 0.4 * s)},${g * (0.6 + 0.4 * s)},${b * (0.6 + 0.4 * s)})`
                );
            }

            const stripeSpacing = 8;
            const stripeWidth = 8;
            const cycle = stripeSpacing * 2;
            const dark = 0.35;

            for (let y = 0; y < h - 2; y++) {
                for (let i = 0; i < fillW; i++) {
                    const d = (i + y + this._patternOffset) % cycle;
                    if (d < stripeWidth) {
                        this._fillBitmap.fillRect(
                            fillX + i,
                            barY + 1 + y,
                            1,
                            1,
                            `rgba(${r * dark},${g * dark},${b * dark},0.2)`
                        );
                    }
                }
            }

            this._fillBitmap.fillRect(
                fillX,
                barY + 1,
                fillW,
                Math.floor((h - 2) / 3),
                "rgba(255,255,255,0.15)"
            );

// reconstruir SIEMPRE desde el fondo
this._finalBitmap.clear();
this._finalBitmap.blt(
    this._bgBitmap,
    0, 0,
    this._bgBitmap.width,
    this._bgBitmap.height,
    0, 0
);

// superponer relleno actual
this._finalBitmap.blt(
    this._fillBitmap,
    0, 0,
    this._fillBitmap.width,
    this._fillBitmap.height,
    0, 0
);

        }
    }

    // =====================================================
    // SCENE_MAP
    // =====================================================
const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows = function() {
    _Scene_Map_createAllWindows.call(this);

    if (this._dualHudBarsCreated) return;
    this._dualHudBarsCreated = true;

    // crear barras
    this._leftHudBar  = new Sprite_HudBar(HUD.left, false);
    this._rightHudBar = new Sprite_HudBar(HUD.right, true);

    // añadir al windowLayer (respeta menús, vídeos, etc.)
    this._windowLayer.addChild(this._leftHudBar);
    this._windowLayer.addChild(this._rightHudBar);

    // exponer referencias para llamadas por script
    if (window.DualHudBars) {
        DualHudBars._left  = this._leftHudBar;
        DualHudBars._right = this._rightHudBar;
    }
};

DualHudBars.refresh = function() {
    if (this._left)  this._left._forceRefresh  = true;
    if (this._right) this._right._forceRefresh = true;
};
// =====================================================
// RESET HUD AL CARGAR PARTIDA O NUEVO JUEGO
// =====================================================
const _DualHudBars_extractSaveContents = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    _DualHudBars_extractSaveContents.call(this, contents);

    // ocultar barras al cargar
    HUD.left.visible = false;
    HUD.right.visible = false;

    // refrescar sprites si existen
    if (window.DualHudBars) {
        DualHudBars.refresh();
    }
};
})();
