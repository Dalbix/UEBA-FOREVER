/*:
 * @target MZ
 * @plugindesc Muestra el timestamp del último commit desde version.json en el título (abajo a la izquierda). 
 * @author 3DalbiX
 *
 * @help VersionDisplay.js
 *
 * Este plugin lee el archivo "version.json" en la carpeta del juego
 * y muestra el campo "version" en la pantalla de título.
 */

(() => {
    const fs = require("fs");
    let versionText = "versión desconocida";

    try {
        const data = fs.readFileSync("version.json", "utf8");
        const json = JSON.parse(data);
        versionText = json.version || versionText;
    } catch (e) {
        console.warn("No se encontró version.json, usando texto por defecto.");
    }

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
