/*:
 * @target MZ
 * @plugindesc Muestra el timestamp del último commit desde version.json en PC, o texto por defecto en web.
 * @author 3DalbiX
 */

(() => {
    let versionText = "versión desconocida";

    // Detectar si estamos en NW.js (PC) o navegador
    const isNode = typeof require === "function";

    if (isNode) {
        // --- Código para PC ---
        const fs = require("fs");
        try {
            const data = fs.readFileSync("version.json", "utf8");
            const json = JSON.parse(data);
            versionText = json.version || versionText;
        } catch (e) {
            console.warn("No se encontró version.json, usando texto por defecto.");
        }
    } else {
        // --- Código para web ---
        versionText = "v.20251008.0220"; // Puedes cambiar por algo dinámico si quieres
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

