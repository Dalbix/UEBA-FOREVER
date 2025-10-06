/*:
 * @target MZ
 * @plugindesc Zoom dinámico centrado en el jugador con modos fijo o adaptativo.
 * @help
 * Script calls:
 *   $gameSystem.enablePlayerZoom(2.0, 0);     // zoom 2x fijo
 *   $gameSystem.enablePlayerZoom(2.0, 1);  // zoom adaptativo cerca de bordes
 *   $gameSystem.disablePlayerZoom();                // vuelve al auto-fit automático
 */

(() => {

  Game_System.prototype.enablePlayerZoom = function(scale, mode = 0) {
    this._playerZoomScale = scale;   // Guardamos el zoom deseado
    this._playerZoomMode = mode;     // Guardamos el modo ("fixed" o "adaptive")
  };

  Game_System.prototype.disablePlayerZoom = function() {
    this._playerZoomScale = null;
    this._playerZoomMode = null;
    if ($gameScreen._autoFitZoom != null) {
      $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, $gameScreen._autoFitZoom);
    } else {
      $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, 1.0);
    }
  };

  const _Game_Screen_update = Game_Screen.prototype.update;
  Game_Screen.prototype.update = function() {
    _Game_Screen_update.call(this);

    if ($gameSystem._playerZoomScale) {
      const targetScale = $gameSystem._playerZoomScale;
      const px = $gamePlayer.screenX();
      const py = $gamePlayer.screenY();
      let scale = targetScale;

      if ($gameSystem._playerZoomMode === 1) {
        const halfWidth = Graphics.width / 2;
        const halfHeight = Graphics.height / 2;
        const mapWidth = $gameMap.width() * $gameMap.tileWidth();
        const mapHeight = $gameMap.height() * $gameMap.tileHeight();

        const distLeft = px;
        const distRight = mapWidth - px;
        const distTop = py;
        const distBottom = mapHeight - py;

        const minScale = scale/2.0;//1.0;

        const scaleX = Math.min(1, distLeft / halfWidth, distRight / halfWidth);
        const scaleY = Math.min(1, distTop / halfHeight, distBottom / halfHeight);
        scale = Math.max(minScale, targetScale * Math.min(scaleX, scaleY));
      }

      this.setZoom(px, py, scale);
      this._zoomScale = scale;
    }
  };

})();
