/*:
 * @target MZ
 * @plugindesc Login + Doble Splash robusto (funciona en HTML5 y NW.js). Intercepta la pantalla de título para garantizar la aparición de los splash tras el login. (Nombre esperado del plugin: LoginAndDoubleSplash)
 * @author 3DalbiX (unificado)
 *
 * @param USERS
 * @text Usuarios
 * @type string
 * @default User1,User2
 *
 * @param PASSWORDS
 * @text Contraseñas
 * @type string
 * @default Pass1,Pass2
 *
 * @param Splash1
 * @text Imagen Splash 1
 * @type file
 * @dir img/system/
 * @default splash1
 *
 * @param Splash2
 * @text Imagen Splash 2
 * @type file
 * @dir img/system/
 * @default splash2
 *
 * @param SE1
 * @text Sonido 1
 * @type file
 * @dir audio/se/
 * @default start1
 *
 * @param SE2
 * @text Sonido 2
 * @type file
 * @dir audio/se/
 * @default start2
 *
 * @param Duration
 * @text Duración (frames)
 * @type number
 * @default 120
 *
 * @param FadeSpeed
 * @text Velocidad de fundido
 * @type number
 * @default 16
 *
 * @help
 * - En navegador (HTML5): pide usuario y contraseña (prompt).
 * - Si login correcto -> muestra 2 splash (con sonido) y luego título.
 * - Si login falla -> pantalla bloqueante "ACCESO DENEGADO".
 * - En NW.js / editor -> salta el login y muestra directamente el doble splash.
 *
 * IMPORTANTE: nombra el plugin exactamente "LoginAndDoubleSplash" en el gestor de plugins (y el archivo .js preferiblemente igual).
 */

(() => {
  const PLUGIN_NAME = "Login";
  const rawParams = PluginManager.parameters(PLUGIN_NAME) || {};

  function parseListParam(raw, fallback) {
    if (!raw) return fallback.slice();
    raw = raw.trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // no es JSON -> split por comas
    }
    return raw.split(",").map(s => s.trim()).filter(s => s.length > 0);
  }

  const USERS = parseListParam(rawParams["USERS"], ["User1", "User2"]);
  const PASSWORDS = parseListParam(rawParams["PASSWORDS"], ["Pass1", "Pass2"]);
  const splash1 = String(rawParams["Splash1"] || "splash1");
  const splash2 = String(rawParams["Splash2"] || "splash2");
  const se1 = String(rawParams["SE1"] || "");
  const se2 = String(rawParams["SE2"] || "");
  const duration = Number(rawParams["Duration"] || 120);
  const fadeSpeed = Number(rawParams["FadeSpeed"] || 16);

  const isNode = Utils.isNwjs(); // recomendado en MZ
    function isAndroid() {
        return !!window.AndroidInterface;
    }
  console.log(`[${PLUGIN_NAME}] cargando. isNode=${isNode}`, { USERS, PASSWORDS, splash1, splash2 });

  // -------------------------
  // Scene_Login
  // -------------------------
  class Scene_Login extends Scene_Base {
    create() {
      super.create();
      // Deferimos el prompt un frame para evitar problemas de foco en algunos browsers
      setTimeout(() => this.startLogin(), 0);
    }
    startLogin() {
      const username = prompt("🧨 Introduce tu nombre de usuario:");
      const password = prompt("🔒 Introduce la contraseña:");

      if (!username || !password) {
        console.warn(`[${PLUGIN_NAME}] login cancelado o vacío.`);
        SceneManager.goto(Scene_LoginError);
        return;
      }

      const idx = USERS.findIndex(u => u.toLowerCase() === username.toLowerCase());
      if (idx >= 0 && password === (PASSWORDS[idx] || "")) {
        console.log(`[${PLUGIN_NAME}] Login correcto:`, USERS[idx]);
        $gameSystem._loginSucceeded = true;
        // Deferir la navegación para evitar que el motor anule la escena
        setTimeout(() => SceneManager.goto(Scene_DoubleSplash), 0);
      } else {
        console.warn(`[${PLUGIN_NAME}] Login incorrecto para:`, username);
        SceneManager.goto(Scene_LoginError);
      }
    }
  }

  // -------------------------
  // Scene_LoginError (bloqueante)
  // -------------------------
  class Scene_LoginError extends Scene_Base {
    create() {
      super.create();
      const bmp = new Bitmap(Graphics.width, Graphics.height);
      bmp.fontSize = 48;
      bmp.textColor = "#ff0000";
      bmp.drawText("ACCESO DENEGADO", 0, 0, Graphics.width, Graphics.height, "center");
      this.addChild(new Sprite(bmp));
    }
    update() {
      // no hacer nada: escena bloqueante
    }
  }

  // -------------------------
  // Scene_DoubleSplash
  // -------------------------
  class Scene_DoubleSplash extends Scene_Base {
    create() {
      super.create();
      this._index = 0;
      this._bitmaps = [
        ImageManager.loadBitmap("img/system/", splash1),
        ImageManager.loadBitmap("img/system/", splash2)
      ];
      this._ses = [se1, se2];
      this._sprite = new Sprite(this._bitmaps[0]);
      this._sprite.opacity = 0;
      this.addChild(this._sprite);
      this._phase = "fadeIn";
      this._timer = duration;

      if (this._ses[0]) {
        AudioManager.playSe({ name: this._ses[0], pan: 0, pitch: 100, volume: 90 });
      }
      $gameSystem._splashShowing = true;
    }

    update() {
      super.update();
      const s = this._sprite;
      const bmp = s?.bitmap;
      if (!bmp || !bmp.isReady()) return;

      if (!s._scaledOnce) {
        const scaleX = Graphics.width / bmp.width;
        const scaleY = Graphics.height / bmp.height;
        const scale = Math.max(scaleX, scaleY);
        s.scale.set(scale, scale);
        s.x = (Graphics.width - bmp.width * scale) / 2;
        s.y = (Graphics.height - bmp.height * scale) / 2;
        s._scaledOnce = true;
      }

      switch (this._phase) {
        case "fadeIn":
          s.opacity += fadeSpeed;
          if (s.opacity >= 255) {
            s.opacity = 255;
            this._phase = "hold";
            this._timer = duration;
          }
          break;
        case "hold":
          this._timer--;
          if (this._timer <= 0) this._phase = "fadeOut";
          break;
        case "fadeOut":
          s.opacity -= fadeSpeed;
          if (s.opacity <= 0) {
            this._index++;
            if (this._index < this._bitmaps.length) {
              s.bitmap = this._bitmaps[this._index];
              s.opacity = 0;
              s._scaledOnce = false;
              this._phase = "fadeIn";
              if (this._ses[this._index]) {
                AudioManager.playSe({ name: this._ses[this._index], pan: 0, pitch: 100, volume: 90 });
              }
            } else {
              $gameSystem._splashShown = true;
              $gameSystem._splashShowing = false;
              SceneManager.goto(Scene_Title);
            }
          }
          break;
      }
    }
  }

  // -------------------------
  // Interceptar Scene_Title.create para inyectar Login/Splash una sola vez
  // -------------------------
  const _Scene_Title_create = Scene_Title.prototype.create;
  Scene_Title.prototype.create = function() {
    _Scene_Title_create.call(this);

    // Solo actuar la primera vez que se crea título en esta ejecución
if (window._LoginSplashDone) return;
window._LoginSplashDone = true;

    // Si estamos en NW.js/editor -> mostrar splash directamente (si no mostrado todavía)
    if (isNode||isAndroid()) {
      if (!$gameSystem._splashShown && !$gameSystem._splashShowing) {
        console.log(`[${PLUGIN_NAME}] NW.js: mostrando DoubleSplash directamente.`);
        SceneManager.goto(Scene_DoubleSplash);
      }
      return;
    }

    // En HTML5: necesitamos login
    if (!$gameSystem._loginSucceeded) {
      console.log(`[${PLUGIN_NAME}] HTML5: redirigiendo a Scene_Login.`);
      SceneManager.goto(Scene_Login);
      return;
    }

    // Si el login ya fue correcto pero aún no se mostraron splashes -> mostrarlos
    if ($gameSystem._loginSucceeded && !$gameSystem._splashShown && !$gameSystem._splashShowing) {
      console.log(`[${PLUGIN_NAME}] Login previo detectado: mostrando DoubleSplash.`);
      SceneManager.goto(Scene_DoubleSplash);
    }
  };

  // Registrar globalmente para compatibilidad
  window.Scene_Login = Scene_Login;
  window.Scene_LoginError = Scene_LoginError;
  window.Scene_DoubleSplash = Scene_DoubleSplash;

  console.log(`[${PLUGIN_NAME}] listo. Consejos: asegura que el plugin está activado con el nombre "${PLUGIN_NAME}" en el Plugin Manager.`);
})();
