/*:
 * @target MZ
 * @plugindesc Muestra el número de versión del juego en la pantalla de título (abajo a la izquierda).
 * @author 3DalbiX
 *
 * @param Version
 * @text Número de versión
 * @desc Texto de la versión que se mostrará (ej: v1.0.0).
 * @default v1.0.1
 *
 * @help VersionDisplay.js
 *
 * Este plugin muestra un número de versión en la pantalla de título,
 * abajo a la izquierda. No aparece en el menú ni durante el juego.
 *
 * No requiere comandos de plugin.
 */

(() => {
    const parameters = PluginManager.parameters("VersionDisplay");
    const versionText = String(parameters["Version"] || "v1.0.0");

    // --- En la pantalla de título ---
    const _Scene_Title_drawGameTitle = Scene_Title.prototype.drawGameTitle;
    Scene_Title.prototype.drawGameTitle = function() {
        _Scene_Title_drawGameTitle.call(this);
        const x = 20;
        const y = Graphics.height - 60;
        const maxWidth = Graphics.width - 40;
        this._versionSprite = new Sprite(new Bitmap(Graphics.width, Graphics.height));
        this.addChild(this._versionSprite);
        this._versionSprite.bitmap.fontSize = 20;
        this._versionSprite.bitmap.textColor = "#ffffff";
        this._versionSprite.bitmap.drawText(versionText, x, y, maxWidth, 36, "left");
    };
})();









