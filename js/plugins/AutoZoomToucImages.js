/*:
 * @target MZ
 * @plugindesc Auto ajuste de zoom en mapa, corrección de clics y ajuste de imágenes. Evita doble ejecución al cerrar mensajes.
 * @author 3DalbiX (modificado)
 *
 * @help
 * Este plugin ajusta el zoom del mapa según su tamaño,
 * corrige los clics con zoom, evita clics sobre el HUD,
 * ajusta la posición de imágenes en pantalla y evita
 * ejecuciones dobles de eventos al cerrar mensajes.
 *
 * Comandos por script:
 *   $gameSystem.disableAutoZoom(); // Desactiva zoom + clics ajustados + imágenes
 *   $gameSystem.enableAutoZoom();  // Reactiva todo
 */

(() => {
  console.log("AutoZoomTouchImages Plugin cargado");

  // ==== AUTO ZOOM AL INICIAR MAPA ====

  const _Scene_Map_start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function() {
    _Scene_Map_start.call(this);
    this.applyAutoFitZoom();
  };

  Scene_Map.prototype.applyAutoFitZoom = function() {
    const mapWidthPx = $dataMap.width * $gameMap.tileWidth();
    const mapHeightPx = $dataMap.height * $gameMap.tileHeight();
    const screenWidth = Graphics.width;
    const screenHeight = Graphics.height;

    const zoomX = screenWidth / mapWidthPx;
    const zoomY = screenHeight / mapHeightPx;
    const zoom = Math.max(1.0, Math.min(zoomX, zoomY));

    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    $gameScreen.setZoom(centerX, centerY, zoom);
    $gameScreen._autoFitZoom = zoom;
  };

  const _Game_Screen_update = Game_Screen.prototype.update;
  Game_Screen.prototype.update = function() {
    _Game_Screen_update.call(this);
    if (this._autoFitZoom != null && !$gameSystem._disableAutoZoom) {
      this._zoomScale = this._autoFitZoom;
    }
  };

  Game_System.prototype.disableAutoZoom = function() {
    this._disableAutoZoom = true;
    $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, 1.0);
  };

  Game_System.prototype.enableAutoZoom = function() {
    this._disableAutoZoom = false;
    if ($gameScreen._autoFitZoom != null) {
      $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, $gameScreen._autoFitZoom);
    }
  };

  // ==== FUNCIONES DE ZOOM ====

  function getZoom() {
    return $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
  }

  function adjustedCoord(coord, screenSize, zoom) {
    return (coord - screenSize / 2) / zoom + screenSize / 2;
  }

  // ==== CORRECCIÓN DE COORDENADAS PARA EVENTOS ====

  const _canvasToMapX = Game_Map.prototype.canvasToMapX;
  Game_Map.prototype.canvasToMapX = function(x) {
    const zoom = getZoom();
    const adjX = adjustedCoord(x, Graphics.width, zoom);
    return _canvasToMapX.call(this, adjX);
  };

  const _canvasToMapY = Game_Map.prototype.canvasToMapY;
  Game_Map.prototype.canvasToMapY = function(y) {
    const zoom = getZoom();
    const adjY = adjustedCoord(y, Graphics.height, zoom);
    return _canvasToMapY.call(this, adjY);
  };

  // ==== BLOQUEO DE DOBLE CLIC TRAS MENSAJE ====

  let _lastEventX = -1;
  let _lastEventY = -1;
  let _lastEventFrame = -20;
  let _justClosedMessage = false;

  const _Window_Message_close = Window_Message.prototype.close;
  Window_Message.prototype.close = function() {
    _Window_Message_close.call(this);
    $gameSystem._suppressClickUntil = Graphics.frameCount + 15;
    _lastEventFrame = Graphics.frameCount;
    _justClosedMessage = true;
    TouchInput.clear();
  };

  Game_System.prototype.isClickSuppressed = function() {
    return Graphics.frameCount <= (this._suppressClickUntil || 0);
  };

  // ==== DETECCIÓN DE HUD PERSONALIZADO ====

  function isClickOnHudElement(x, y) {
    const buttonWidth = 64;
    const buttonHeight = 64;
    const buttonX = Graphics.width - buttonWidth;
    const buttonY = 0;
    return (x >= buttonX && x <= Graphics.width && y >= buttonY && y <= buttonHeight);
  }

  // ==== CLIC SOBRE EVENTOS CORREGIDO ====

  let _pendingEvent = null;

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);

    if (_pendingEvent) {
      if ($gameMessage.isBusy() || SceneManager._scene._messageWindow.isOpen()) {
        _pendingEvent = null;
        $gameTemp.clearDestination();
        TouchInput.clear();
        return;
      }

      const player = $gamePlayer;
      if (player.pos(_pendingEvent.x, _pendingEvent.y)) {
        if (_justClosedMessage) {
          _pendingEvent = null;
          _justClosedMessage = false;
          return;
        }

        if ($gameSystem.isClickSuppressed() ||
            (_pendingEvent.x === _lastEventX && _pendingEvent.y === _lastEventY && (Graphics.frameCount - _lastEventFrame) < 15)) {
          _pendingEvent = null;
          return;
        }

        _pendingEvent.start();
        _lastEventX = _pendingEvent.x;
        _lastEventY = _pendingEvent.y;
        _lastEventFrame = Graphics.frameCount;
        _pendingEvent = null;
      }
    }
  };

  Scene_Map.prototype.processMapTouch = function() {
    if ($gameSystem.isClickSuppressed()) {
      TouchInput.clear();
      return;
    }

    if ($gameMessage.isBusy() || SceneManager._scene._messageWindow.isOpen()) {
      TouchInput.clear();
      return;
    }

    if (!TouchInput.isTriggered()) return;

    const x = TouchInput.x;
    const y = TouchInput.y;

    if (isClickOnWindowAt(x, y) || isClickOnHudElement(x, y)) {
      return;
    }

    const mapX = Math.floor($gameMap.canvasToMapX(x));
    const mapY = Math.floor($gameMap.canvasToMapY(y));

    if (mapX < 0 || mapY < 0 || mapX >= $dataMap.width || mapY >= $dataMap.height) {
      return;
    }

    const events = $gameMap.eventsXy(mapX, mapY).filter(e => e.isTriggerIn([0, 1, 2]));
    const actionEvent = events.find(e => e.isTriggerIn([0]));

    if (actionEvent) {
      _pendingEvent = actionEvent;
      $gameTemp.setDestination(actionEvent.x, actionEvent.y);
      this._touchCount = 0;
      return;
    }

    $gameTemp.setDestination(mapX, mapY);
    this._touchCount = 0;
  };

  function isClickOnWindowAt(x, y) {
    const scene = SceneManager._scene;
    if (!scene || !scene._windowLayer) return false;

    return scene._windowLayer.children.some(w => {
      if (!(w instanceof Window)) return false;
      if (!w.visible || !w.isOpen()) return false;

      const rx = w.x;
      const ry = w.y;
      const rw = w.width;
      const rh = w.height;

      return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
    });
  }

  // ==== AJUSTE DE IMÁGENES CON ZOOM ====
const _Game_Picture_scaleX = Game_Picture.prototype.scaleX;
Game_Picture.prototype.scaleX = function() {
    const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
    const original = _Game_Picture_scaleX.call(this);
    return original / zoom; // reducimos para compensar el zoom del mapa
};

const _Game_Picture_scaleY = Game_Picture.prototype.scaleY;
Game_Picture.prototype.scaleY = function() {
    const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
    const original = _Game_Picture_scaleY.call(this);
    return original / zoom;
};
  const _Sprite_Picture_updatePosition = Sprite_Picture.prototype.updatePosition;
  Sprite_Picture.prototype.updatePosition = function() {
    _Sprite_Picture_updatePosition.call(this);

    const picture = this.picture();
    if (!picture || picture.origin() !== 0) return;

    const zoom = getZoom();
    if (zoom === 1.0) return;

    const centerX = Graphics.width / 2;
    const centerY = Graphics.height / 2;

    const rawX = this.x;
    const rawY = this.y;

    const adjX = centerX + (rawX - centerX) / zoom;
    const adjY = centerY + (rawY - centerY) / zoom;

    this.x = adjX;
    this.y = adjY;
  };

  function getZoom() {
    return $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);
  }
})();
