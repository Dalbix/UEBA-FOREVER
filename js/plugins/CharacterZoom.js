/*:
 * @target MZ
 * @plugindesc Aplica zoom visual independiente al jugador o eventos (versión corregida)
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

  // ---------------------------------------------------------
  // A: Funciones de utilidad para asegurar zoom limpio
  // ---------------------------------------------------------

  function hardResetZoom(ch) {
    if (!ch) return;
    ch._zoomScale = 1.0;
    ch._zoomTarget = 1.0;
    ch._zoomDuration = 0;
  }

// ---------------------------------------------------------
// Reset SOLO cuando se cambia de mapa
// ---------------------------------------------------------

const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
Game_Player.prototype.performTransfer = function() {
  _Game_Player_performTransfer.call(this);

  // Reset seguro SOLO al cambiar de mapa
  hardResetZoom($gamePlayer);
  for (const ev of $gameMap.events()) {
    hardResetZoom(ev);
  }
};

  // ---------------------------------------------------------
  // C: Sprite_Character (aplicación del zoom)
  // ---------------------------------------------------------

  const _Sprite_Character_update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function() {
    _Sprite_Character_update.call(this);
    const ch = this._character;

    if (ch) {
      // Valor seguro
      if (ch._zoomScale == null) ch._zoomScale = 1.0;

      this.scale.set(ch._zoomScale, ch._zoomScale);
    }
  };

  // ---------------------------------------------------------
  // D: Lógica de interpolación
  // ---------------------------------------------------------

  const _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
  Game_CharacterBase.prototype.update = function() {
    _Game_CharacterBase_update.call(this);

    if (this._zoomTarget != null && this._zoomDuration > 0) {

      const current = this._zoomScale ?? 1.0;
      const step = (this._zoomTarget - current) / this._zoomDuration;

      this._zoomScale = current + step;
      this._zoomDuration--;

      if (this._zoomDuration <= 0) {
        this._zoomScale = this._zoomTarget;
      }
    }
  };

  // ---------------------------------------------------------
  // E: Métodos públicos de zoom por personaje
  // ---------------------------------------------------------

  Game_CharacterBase.prototype.setCharacterZoom = function(scale, duration = 0) {
    this._zoomTarget = scale;
    if (duration <= 0) {
      this._zoomScale = scale;
      this._zoomDuration = 0;
    } else {
      const current = this._zoomScale ?? 1.0;
      this._zoomDuration = duration;
      this._zoomScale = current;
    }
  };

  Game_CharacterBase.prototype.resetCharacterZoom = function() {
    this.setCharacterZoom(1.0, 10);
  };

  // ---------------------------------------------------------
  // F: Comandos del plugin
  // ---------------------------------------------------------

  PluginManager.registerCommand("CharacterZoom", "set", args => {
    const target = args.target;
    const scale = Number(args.scale);
    const duration = Number(args.duration);

    if (target === "player") {
      $gamePlayer.setCharacterZoom(scale, duration);
    } else {
      const id = Number(args.eventId);
      const ev = $gameMap.event(id);
      if (ev) ev.setCharacterZoom(scale, duration);
    }
  });

  PluginManager.registerCommand("CharacterZoom", "reset", args => {
    const target = args.target;

    if (target === "player") {
      $gamePlayer.setCharacterZoom(1.0, 0);
    } else {
      const id = Number(args.eventId);
      const ev = $gameMap.event(id);
      if (ev) ev.setCharacterZoom(1.0, 0);
    }
  });

  // ---------------------------------------------------------
  // G: Acceso global (opcional)
  // ---------------------------------------------------------

  window.CharacterZoom = {
    setPlayer: (scale, duration = 0) => {
      $gamePlayer?.setCharacterZoom(scale, duration);
    },
    resetPlayer: (duration = 0) => {
      $gamePlayer?.setCharacterZoom(1.0, duration);
    },
    setEvent: (id, scale, duration = 0) => {
      $gameMap.event(id)?.setCharacterZoom(scale, duration);
    },
    resetEvent: (id, duration = 0) => {
      $gameMap.event(id)?.setCharacterZoom(1.0, duration);
    },
  };

})();
