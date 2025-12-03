/*:
 * @target MZ
 * @plugindesc Aplica zoom visual independiente al jugador y eventos. Soporte actorId manteniendo compatibilidad plena con llamadas antiguas. 
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
 * @text actorId / eventId
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
 * @text actorId / eventId
 * @type number
 * @default 1
 */

(() => {

  // ---------------------------------------------------------
  // A: Utilidades
  // ---------------------------------------------------------

  function hardResetZoom(ch) {
    if (!ch) return;
    ch._zoomScale = 1.0;
    ch._zoomTarget = 1.0;
    ch._zoomDuration = 0;
  }

  function findCharacterByActorId(actorId) {
    const leader = $gameParty.leader();
    if (!leader) return null;

    if (leader.actorId() === actorId) {
      return $gamePlayer;
    }

    const followers = $gamePlayer.followers()._data;
    for (const f of followers) {
      if (f.actor && f.actor() && f.actor().actorId() === actorId) {
        return f;
      }
    }

    return null;
  }

  // ---------------------------------------------------------
  // Reset en cambio de mapa
  // ---------------------------------------------------------

  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function() {
    _Game_Player_performTransfer.call(this);

    hardResetZoom($gamePlayer);
    for (const ev of $gameMap.events()) {
      hardResetZoom(ev);
    }
  };

  // ---------------------------------------------------------
  // Aplicación visual del zoom
  // ---------------------------------------------------------

  const _Sprite_Character_update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function() {
    _Sprite_Character_update.call(this);
    const ch = this._character;

    if (ch) {
      if (ch._zoomScale == null) ch._zoomScale = 1.0;
      this.scale.set(ch._zoomScale, ch._zoomScale);
    }
  };

  // ---------------------------------------------------------
  // Interpolación al actualizar personaje
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
  // Métodos públicos
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
  // Comandos del plugin
  // ---------------------------------------------------------

  PluginManager.registerCommand("CharacterZoom", "set", args => {
    const target = args.target;
    const scale = Number(args.scale);
    const duration = Number(args.duration);
    const id = Number(args.eventId);

    // Player ahora admite actorId manteniendo compatibilidad
    if (target === "player") {
      const ch = findCharacterByActorId(id) ?? $gamePlayer;
      ch.setCharacterZoom(scale, duration);

    } else {
      const ev = $gameMap.event(id);
      if (ev) ev.setCharacterZoom(scale, duration);
    }
  });

  PluginManager.registerCommand("CharacterZoom", "reset", args => {
    const target = args.target;
    const id = Number(args.eventId);

    if (target === "player") {
      const ch = findCharacterByActorId(id) ?? $gamePlayer;
      ch.setCharacterZoom(1.0, 0);

    } else {
      const ev = $gameMap.event(id);
      if (ev) ev.setCharacterZoom(1.0, 0);
    }
  });

  // ---------------------------------------------------------
  // API GLOBAL (100% COMPATIBLE CON VERSIONES ANTERIORES)
  // ---------------------------------------------------------

  window.CharacterZoom = {

    // === API antigua: NO SE MODIFICA NADA ===
    setPlayer: (scale, duration = 0) => {
      $gamePlayer?.setCharacterZoom(Number(scale), Number(duration));
    },

    resetPlayer: (duration = 0) => {
      $gamePlayer?.setCharacterZoom(1.0, Number(duration));
    },

    setEvent: (id, scale, duration = 0) => {
      $gameMap.event(Number(id))?.setCharacterZoom(Number(scale), Number(duration));
    },

    resetEvent: (id, duration = 0) => {
      $gameMap.event(Number(id))?.setCharacterZoom(1.0, Number(duration));
    },

    // === API interna del nuevo actorId, sin romper nada ===
    setActor: (actorId, scale, duration = 0) => {
      const ch = findCharacterByActorId(Number(actorId));
      ch?.setCharacterZoom(Number(scale), Number(duration));
    },

    resetActor: (actorId, duration = 0) => {
      const ch = findCharacterByActorId(Number(actorId));
      ch?.setCharacterZoom(1.0, Number(duration));
    }
  };

})();
