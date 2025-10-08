/*:
 * @target MZ
 * @plugindesc Muestra dos pantallas splash antes del menú, con fundidos y sonidos SE opcionales.
 * @author 3DalbiX
 *
 * @param Splash1
 * @text Imagen Splash 1
 * @desc Nombre de la imagen (sin extensión) en img/pictures/
 * @default splash1
 *
 * @param Splash2
 * @text Imagen Splash 2
 * @desc Nombre de la imagen (sin extensión) en img/pictures/
 * @default splash2
 *
 * @param SE1
 * @text Sonido Splash 1
 * @desc Nombre del SE en audio/se (sin extensión)
 * @default
 *
 * @param SE2
 * @text Sonido Splash 2
 * @desc Nombre del SE en audio/se (sin extensión)
 * @default
 *
 * @param Duration
 * @text Duración de cada splash (frames)
 * @type number
 * @min 30
 * @default 120
 *
 * @param FadeSpeed
 * @text Velocidad del fundido
 * @type number
 * @min 1
 * @default 16
 *
 * @help
 * Coloca tus imágenes en: img/pictures/
 * Coloca tus sonidos (SE) en: audio/se/
 *
 * Ejemplo de archivos:
 *   img/pictures/splash1.png
 *   img/pictures/splash2.png
 *   audio/se/start1.ogg
 *   audio/se/start2.ogg
 *
 * Configura los nombres de los SE en los parámetros SE1 y SE2.
 *
 * El plugin muestra ambos splash antes del título, con fade in/out y
 * reproduce el sonido SE configurado al iniciar cada pantalla.
 */

(() => {
  const params = PluginManager.parameters("DoubleSplashSE");
  const splash1 = String(params["Splash1"] || "splash1");
  const splash2 = String(params["Splash2"] || "splash2");
  const se1 = String(params["SE1"] || "");
  const se2 = String(params["SE2"] || "");
  const duration = Number(params["Duration"] || 120);
  const fadeSpeed = Number(params["FadeSpeed"] || 16);

  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    this.startDoubleSplash();
  };

  Scene_Boot.prototype.startDoubleSplash = function() {
    this._splashIndex = 0;
    this._splashBitmaps = [
      ImageManager.loadBitmap("img/pictures/", splash1),
      ImageManager.loadBitmap("img/pictures/", splash2)
    ];
    this._splashSEs = [se1, se2];
    this._splashSprite = new Sprite(this._splashBitmaps[0]);
    this._splashSprite.opacity = 0;
    this.addChild(this._splashSprite);

    this._splashTimer = duration;
    this._fadePhase = "fadeIn";

    if (this._splashSEs[0]) {
      AudioManager.playSe({ name: this._splashSEs[0], pan: 0, pitch: 100, volume: 90 });
    }
  };

  Scene_Boot.prototype.update = function() {
    if (this._splashSprite) {
      this.updateDoubleSplash();
    } else {
      Scene_Base.prototype.update.call(this);
    }
  };

  Scene_Boot.prototype.updateDoubleSplash = function() {
    const s = this._splashSprite;

    switch (this._fadePhase) {
      case "fadeIn":
        s.opacity += fadeSpeed;
        if (s.opacity >= 255) {
          s.opacity = 255;
          this._fadePhase = "hold";
          this._splashTimer = duration;
        }
        break;

      case "hold":
        this._splashTimer--;
        if (this._splashTimer <= 0) {
          this._fadePhase = "fadeOut";
        }
        break;

      case "fadeOut":
        s.opacity -= fadeSpeed;
        if (s.opacity <= 0) {
          this._splashIndex++;
          if (this._splashIndex < this._splashBitmaps.length) {
            this.removeChild(s);
            this._splashSprite = new Sprite(this._splashBitmaps[this._splashIndex]);
            this._splashSprite.opacity = 0;
            this.addChild(this._splashSprite);
            this._fadePhase = "fadeIn";

            if (this._splashSEs[this._splashIndex]) {
              AudioManager.playSe({
                name: this._splashSEs[this._splashIndex],
                pan: 0,
                pitch: 100,
                volume: 90
              });
            }
          } else {
            this.removeChild(s);
            delete this._splashSprite;
            _Scene_Boot_start.call(this);
          }
        }
        break;
    }
  };
})();
