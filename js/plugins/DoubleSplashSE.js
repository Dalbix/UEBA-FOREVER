/*:
 * @target MZ
 * @plugindesc Muestra dos pantallas splash con sonido antes del título. Compatible con LoginMultipleUsers y FullscreenToggle.
 * @author Tú
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
 * @min 1
 * @default 120
 *
 * @param FadeSpeed
 * @text Velocidad del fundido
 * @type number
 * @min 1
 * @default 16
 *
 * @help
 * Este plugin muestra dos pantallas splash (con fundido y sonido)
 * justo antes de la pantalla de título.
 *
 * Si está presente el plugin LoginMultipleUsers.js,
 * el splash se mostrará automáticamente después de un login exitoso.
 */

(() => {
  const params = PluginManager.parameters("DoubleSplashSE");
  const splash1 = String(params["Splash1"] || "splash1");
  const splash2 = String(params["Splash2"] || "splash2");
  const se1 = String(params["SE1"] || "");
  const se2 = String(params["SE2"] || "");
  const duration = Number(params["Duration"] || 120);
  const fadeSpeed = Number(params["FadeSpeed"] || 16);

  // -----------------------------
  // NUEVA ESCENA: Scene_DoubleSplash
  // -----------------------------
class Scene_DoubleSplash extends Scene_Base {
  create() {
    super.create();
    this._splashIndex = 0;
    this._bitmaps = [
      ImageManager.loadBitmap("img/system/", splash1),
      ImageManager.loadBitmap("img/system/", splash2)
    ];
    this._sounds = [se1, se2];
    this._sprite = new Sprite(this._bitmaps[0]);
    this._sprite.opacity = 0;
    this.addChild(this._sprite);
    this._phase = "fadeIn";
    this._timer = duration;

    if (this._sounds[0]) {
      AudioManager.playSe({ name: this._sounds[0], pan: 0, pitch: 100, volume: 90 });
    }
  }

  update() {
    super.update();
    const s = this._sprite;
    const bmp = s?.bitmap;
    if (!s || !bmp || !bmp.isReady()) return;

    // 🔧 Escalado automático una vez cargada la imagen
    if (!s._scaledOnce) {
      const scaleX = Graphics.width / bmp.width;
      const scaleY = Graphics.height / bmp.height;
      const scale = Math.max(scaleX, scaleY); // llena la pantalla manteniendo proporción
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
          this._splashIndex++;
          if (this._splashIndex < this._bitmaps.length) {
            s.bitmap = this._bitmaps[this._splashIndex];
            s.opacity = 0;
            s._scaledOnce = false; // volver a escalar el siguiente logo
            this._phase = "fadeIn";
            if (this._sounds[this._splashIndex]) {
              AudioManager.playSe({
                name: this._sounds[this._splashIndex],
                pan: 0,
                pitch: 100,
                volume: 90
              });
            }
          } else {
            SceneManager.goto(Scene_Title);
          }
        }
        break;
    }
  }
}


  window.Scene_DoubleSplash = Scene_DoubleSplash;

  // -----------------------------
  // Integración con login
  // -----------------------------
  // Si existe un plugin de login, lo modificamos para ir al splash tras login exitoso.
  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    _Scene_Boot_start.call(this);

    // Solo si el plugin de login está activo
    if (typeof Scene_LoginError !== "undefined" && Scene_Boot.prototype.showLogin) {
      const originalShowLogin = Scene_Boot.prototype.showLogin;

      Scene_Boot.prototype.showLogin = function() {
        // Reutiliza la función original
        const result = originalShowLogin.call(this);

        // Si el login fue exitoso, redirigimos al splash
        if (result === "success") {
          SceneManager.goto(Scene_DoubleSplash);
        }

        return result;
      };
    } else {
      // Si no hay login, mostrar el splash directamente
      SceneManager.goto(Scene_DoubleSplash);
    }
  };
})();
