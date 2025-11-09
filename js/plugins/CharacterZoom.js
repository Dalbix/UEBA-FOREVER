/*:
 * @target MZ
 * @plugindesc Aplica zoom visual independiente al jugador o eventos (compatible con AutoZoomTouchImages)
 * @author 3DalbiX
 *
 * @command set
 * @text Set Character Zoom
 * @desc Escala el jugador o un evento concreto.
 *
 * @arg target
 * @type select
 * @option player
 * @option event
 * @default player
 *
 * @arg eventId
 * @type number
 * @default 1
 *
 * @arg scale
 * @type number
 * @decimals 2
 * @default 1.5
 *
 * @arg duration
 * @type number
 * @default 0
 *
 * @command reset
 * @text Reset Character Zoom
 * @desc Restaura el tamaño original.
 *
 * @arg target
 * @type select
 * @option player
 * @option event
 * @default player
 *
 * @arg eventId
 * @type number
 * @default 1
 */

(() => {

  // --- Escalado del sprite ---
  const _Sprite_Character_update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function() {
    _Sprite_Character_update.call(this);
    const ch = this._character;
    if (ch) {
      if (ch._zoomScale == null) ch._zoomScale = 1.0;
      this.scale.set(ch._zoomScale, ch._zoomScale);
    }
  };

  // --- Lógica de actualización de zoom ---
  const _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
  Game_CharacterBase.prototype.update = function() {
    _Game_CharacterBase_update.call(this);
    if (this._zoomTarget != null && this._zoomDuration > 0) {
      const step = (this._zoomTarget - (this._zoomScale || 1.0)) / this._zoomDuration;
      this._zoomScale = (this._zoomScale || 1.0) + step;
      this._zoomDuration--;
      if (this._zoomDuration <= 0) this._zoomScale = this._zoomTarget;
    }
  };

  Game_CharacterBase.prototype.setCharacterZoom = function(scale, duration = 0) {
    this._zoomTarget = scale;
    if (duration <= 0) {
      this._zoomScale = scale;
      this._zoomDuration = 0;
    } else {
      this._zoomDuration = duration;
    }
  };

  Game_CharacterBase.prototype.resetCharacterZoom = function() {
    this._zoomTarget = 1.0;
    this._zoomDuration = 10;
  };

  // --- Comandos del plugin ---
  PluginManager.registerCommand("CharacterZoom", "set", args => {
    const target = args.target;
    const scale = Number(args.scale || 1.0);
    const duration = Number(args.duration || 0);
    if (target === "player") {
      $gamePlayer.setCharacterZoom(scale, duration);
    } else if (target === "event") {
      const id = Number(args.eventId);
      const ev = $gameMap.event(id);
      if (ev) ev.setCharacterZoom(scale, duration);
    }
  });

  PluginManager.registerCommand("CharacterZoom", "reset", args => {
    const target = args.target;
    if (target === "player") {
      $gamePlayer.resetCharacterZoom();
    } else if (target === "event") {
      const id = Number(args.eventId);
      const ev = $gameMap.event(id);
      if (ev) ev.resetCharacterZoom();
    }
  });

window.CharacterZoom = {
  setPlayer: (scale, duration = 0) => {
    if ($gamePlayer) $gamePlayer.setCharacterZoom(scale, duration);
  },
  resetPlayer: (duration = 0) => {
    if ($gamePlayer) {
      if (duration > 0) {
        $gamePlayer.setCharacterZoom(1.0, duration);
      } else {
        $gamePlayer.setCharacterZoom(1.0, 0);
      }
    }
  },
  setEvent: (id, scale, duration = 0) => {
    const ev = $gameMap.event(id);
    if (ev) ev.setCharacterZoom(scale, duration);
  },
  resetEvent: (id, duration = 0) => {
    const ev = $gameMap.event(id);
    if (ev) {
      if (duration > 0) {
        ev.setCharacterZoom(1.0, duration);
      } else {
        ev.setCharacterZoom(1.0, 0);
      }
    }
  },
};

})();
