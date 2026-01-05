/*:
 * @target MZ
 * @plugindesc HUD con dos barras superiores (izquierda y derecha), con icono, variable 0–100, color RGB. Compatible con AutoZoom, menús y vídeos.
 * @author 3DalbiX
 *
 * @command LeftBar
 * @text Configurar barra superior izquierda
 * @arg picture @type string
 * @arg scale @type number @decimals 2 @default 1
 * @arg variableId @type variable
 * @arg color @type string @default 255,0,0
 * @arg visible @type boolean @default true
 *
 * @command RightBar
 * @text Configurar barra superior derecha
 * @arg picture @type string
 * @arg scale @type number @decimals 2 @default 1
 * @arg variableId @type variable
 * @arg color @type string @default 0,255,0
 * @arg visible @type boolean @default true
 */

(() => {
    const PLUGIN_NAME = "DualHudBars";

    // =====================================================
    // DATOS
    // =====================================================
    const HUD = {
        left:  { visible: false },
        right: { visible: false }
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

            this._barWidth = Math.floor(Graphics.width / 2) - 64;
            this._barHeight = 16;
            this._patternOffset = 0;

            this.bitmap = new Bitmap(
                this._barWidth + HUD_LAYOUT.iconWidth + HUD_LAYOUT.iconBarGap,
                36
            );

            this.bitmap.fillRect(0, 0, this.bitmap.width, this.bitmap.height, "rgba(0,0,0,0.01)");

            this._icon = new Sprite();
            this._icon.anchor.set(0.5, 0);
            this._icon.y = 2;
            this.addChild(this._icon);

            this.updatePosition();
        }

        updatePosition() {
            const totalWidth = Graphics.width - HUD_LAYOUT.margin * 2 - HUD_LAYOUT.optionButtonWidth;
            const barWidth = Math.floor((totalWidth - HUD_LAYOUT.iconWidth * 2 - HUD_LAYOUT.barGap) / 2);
            this._barWidth = barWidth;

            if (this._isRight) {
                this.x = Graphics.width
                       - HUD_LAYOUT.margin
                       - HUD_LAYOUT.optionButtonWidth
                       - HUD_LAYOUT.iconWidth
                       - HUD_LAYOUT.iconBarGap
                       - barWidth;

                this._icon.x = barWidth + HUD_LAYOUT.iconBarGap + HUD_LAYOUT.iconWidth / 2;
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

            this.refreshIcon();
            this._patternOffset += 0.3;
            this.redraw();
        }

        refreshIcon() {
            if (!this._data.picture) return;
            if (this._iconName !== this._data.picture) {
                this._iconName = this._data.picture;
                this._icon.bitmap = ImageManager.loadPicture(this._iconName);
            }
            this._icon.scale.set(this._data.scale || 1);
        }

        redraw() {
            const value = this._data.variableId
                ? $gameVariables.value(this._data.variableId)
                : 100;

            const rate = Math.max(0, Math.min(100, value)) / 100;

            const barX = this._isRight ? 0 : HUD_LAYOUT.iconWidth + HUD_LAYOUT.iconBarGap;
            const barY = 10;
            const w = this._barWidth;
            const h = this._barHeight;

            this.bitmap.clear();

            const [r, g, b] = this._data.color.split(",").map(Number);

            // === FONDO ===
            for (let y = 0; y < h; y++) {
                const shade = 30 + (y / h) * 40;
                this.bitmap.fillRect(barX, barY + y, w, 1, `rgb(${shade},${shade},${shade})`);
            }

            // === BORDE ===
            this.bitmap.strokeRect(barX, barY, w, h, `rgb(${r},${g},${b})`);
            this.bitmap.fillRect(barX, barY, w, 1, "rgba(255,255,255,0.6)");
            this.bitmap.fillRect(barX, barY + h - 1, w, 1, "rgba(0,0,0,0.6)");

            // === RELLENO ===
            const fillW = Math.floor((w - 2) * rate);
            if (fillW <= 0) return;

            // ⭐ origen del relleno según lado
            const fillX = this._isRight
                ? barX + w - 1 - fillW
                : barX + 1;

            // degradado base
            for (let y = 0; y < h - 2; y++) {
                const t = y / (h - 2);
                const light = Math.floor(r * (0.6 + 0.4 * Math.sin(t * Math.PI)));
                const lightG = Math.floor(g * (0.6 + 0.4 * Math.sin(t * Math.PI)));
                const lightB = Math.floor(b * (0.6 + 0.4 * Math.sin(t * Math.PI)));

                this.bitmap.fillRect(fillX, barY + 1 + y, fillW, 1, `rgb(${light},${lightG},${lightB})`);
            }

            // === RAYAS DIAGONALES ===
            const stripeSpacing = 8;
            const stripeWidth = 8;
            const cycle = stripeSpacing * 2;

            const darkFactor = 0.35;
            const sr = Math.floor(r * darkFactor);
            const sg = Math.floor(g * darkFactor);
            const sb = Math.floor(b * darkFactor);

            for (let y = 0; y < h - 2; y++) {
                const alpha = 0.15 + 0.15 * Math.sin((y / (h - 2)) * Math.PI);

                for (let i = 0; i < fillW; i++) {
                    const x = this._isRight
                        ? fillX + (fillW - 1 - i)
                        : fillX + i;

                    const d = (i + y + this._patternOffset) % cycle;

                    if (d < stripeWidth) {
                        this.bitmap.fillRect(
                            x,
                            barY + 1 + y,
                            1,
                            1,
                            `rgba(${sr},${sg},${sb},${alpha})`
                        );
                    }
                }
            }

            // === BRILLO SUPERIOR ===
            this.bitmap.fillRect(
                fillX,
                barY + 1,
                fillW,
                Math.floor((h - 2) / 3),
                "rgba(255,255,255,0.15)"
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

        this._leftHudBar  = new Sprite_HudBar(HUD.left, false);
        this._rightHudBar = new Sprite_HudBar(HUD.right, true);

        this._windowLayer.addChild(this._leftHudBar);
        this._windowLayer.addChild(this._rightHudBar);
    };

})();
