/*:
 * @target MZ
 * @plugindesc Login con múltiples usuarios fijos al iniciar el juego; sin reintentos, pantalla de error si falla
 * @author 3DalbiX
 */

(() => {
    // Detectar si estamos en NW.js (PC) o navegador
    const isNode = typeof require === "function";
    if (!isNode) {
    // Array de usuarios y contraseñas
    const USERS = ["albi", "rubio", "aaron","eden"];
    const PASSWORDS = ["Pirulon2025!", "Pirulon2025!", "Pirulon2025!","Pirulon2025!"];

    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        this.showLogin();
    };

    Scene_Boot.prototype.showLogin = function() {
        const usernameInput = prompt("🧨 Introduce tu nombre de usuario:");
        const passwordInput = prompt("🔒 Introduce la contraseña:");

        // Buscar índice del usuario (sin distinguir mayúsculas/minúsculas)
        const userIndex = USERS.findIndex(u => u.toLowerCase() === usernameInput.toLowerCase());

        if (userIndex >= 0 && passwordInput === PASSWORDS[userIndex]) {
            console.log("Login correcto: " + USERS[userIndex]);
            // Continua normalmente al título
        } else {
            SceneManager.goto(Scene_LoginError);
        }
    };

    // Escena de error
    class Scene_LoginError extends Scene_Base {
        create() {
            super.create();
            const text = "Acceso denegado";
            const sprite = new Sprite(new Bitmap(Graphics.width, Graphics.height));
            sprite.bitmap.fontSize = 50;
            sprite.bitmap.textColor = "#ff0000";
            sprite.bitmap.drawText(text, 0, 0, Graphics.width, Graphics.height, "center");
            this.addChild(sprite);
        }

        update() {
            // Bloquear completamente
        }
    }

    window.Scene_LoginError = Scene_LoginError;
}
})();
