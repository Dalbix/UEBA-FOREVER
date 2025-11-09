/*:
 * @target MZ
 * @plugindesc Plataforma 2D con salto lento, colisiones precisas y soporte para autozoom activo.
 * @author 3DalbiX
 *
 * @param desplazamiento
 * @text Desplazamiento horizontal total (tiles durante el salto)
 * @type number
 * @default 3
 *
 * @param jumpHeight
 * @text Altura del salto (tiles)
 * @type number
 * @default 3
 *
 * @param jumpTime
 * @text Tiempo total del salto (segundos)
 * @type number
 * @default 1.5
 *
 * @param jumpSE
 * @text Sonido al saltar
 * @desc Nombre del SE en Audio/SE para reproducir al saltar
 * @type file
 * @dir audio/se
 * @default Jump1
 *
 * @help
 * Activa el modo de plataforma 2D con salto lento, colisiones precisas
 * y compatibilidad con AutoZoomTouchImages.
 *
 * Controles:
 *  - Flechas izquierda/derecha → mover
 *  - Z o Espacio → saltar
 *
 * ======================
 * ⚙️ Comandos de plugin
 * ======================
 * - activar
 *   Activa el modo Plataforma 2D en cualquier mapa.
 *
 * - desactivar
 *   Desactiva el modo Plataforma 2D y devuelve el control normal.
 *
 * Puedes usarlos desde un evento:
 *   Plugin Command → Plataformas2D → activar
 *   Plugin Command → Plataformas2D → desactivar
 *
 * O con script:
 *   $gameSystem._plataforma2DActiva = true;   // activar
 *   $gameSystem._plataforma2DActiva = false;  // desactivar
 *
 * No es necesario renombrar los mapas ni reiniciar el editor.
 */

(() => {
  console.log("Plugin Plataformas2D cargado correctamente.");

  const params = PluginManager.parameters("Plataformas2D");
  const DESPLAZAMIENTO = Number(params["desplazamiento"] || 3);
  const ALTURA = Number(params["jumpHeight"] || 3);
  const TIEMPO = parseFloat(params["jumpTime"]) || 1.5;
  const JUMP_SE_NAME = String(params["jumpSE"] || "Jump1");

  const FPS = 60;
  const FRAMES_TOTAL = TIEMPO * FPS;
  const FRAMES_SUBIDA = FRAMES_TOTAL / 2;

  const GRAVITY = (2 * ALTURA) / (FRAMES_SUBIDA * FRAMES_SUBIDA);
  const JUMP = GRAVITY * FRAMES_SUBIDA;
  const HORIZONTAL_SPEED = DESPLAZAMIENTO / FRAMES_TOTAL;

  let vy = 0;
  let grounded = false;

  // Inicialización segura del flag global
const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
  _Game_System_initialize.call(this);
  this._plataforma2DActiva = false;
};

  // Registrar comandos de plugin
  PluginManager.registerCommand("Plataformas2D", "activar", () => {
    $gameSystem._plataforma2DActiva = true;
    console.log("Modo Plataforma 2D activado manualmente");
  });

  PluginManager.registerCommand("Plataformas2D", "desactivar", () => {
    $gameSystem._plataforma2DActiva = false;
    console.log("Modo Plataforma 2D desactivado manualmente");
  });

  // Actualizar jugador
  const _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function (sceneActive) {
    _Game_Player_update.call(this, sceneActive);
	
    if ($gameSystem._plataforma2DActiva) updatePlatform(this);
  };

  function updatePlatform(player) {
    if ($gameMessage.isBusy() || !$gamePlayer.canMove()) return;

    // Movimiento horizontal
    let dx = 0;
    if (Input.isPressed("left")) dx = -HORIZONTAL_SPEED;
    if (Input.isPressed("right")) dx = HORIZONTAL_SPEED;

    // Salto
    if ((Input.isTriggered("ok") || Input.isTriggered("jump")) && grounded) {
      vy = -JUMP;
      grounded = false;
      AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
    }

    // Gravedad
    vy += GRAVITY;

    // Nueva posición
    let newX = player._realX + dx;
    newX = Math.max(0, Math.min(newX, $dataMap.width - 1));
    let newY = player._realY + vy;

    const step = 0.02;

    // Colisión con suelo
    if (vy > 0) {
      let pos = player._realY;
      const hitboxWidth = 0.3;
      while (pos < newY) {
        const tileBelow = Math.floor(pos + 1);
        const left = Math.floor(newX - hitboxWidth);
        const right = Math.floor(newX + hitboxWidth);
        if (
          !$gameMap.isPassable(left, tileBelow, 2) ||
          !$gameMap.isPassable(right, tileBelow, 2)
        ) {
          newY = tileBelow - 1;
          vy = 0;
          grounded = true;
          break;
        }
        pos += step;
      }
    } else if (vy < 0) {
      let pos = player._realY;
      while (pos > newY) {
        const tileAbove = Math.floor(pos);
        if (!$gameMap.isPassable(Math.floor(newX), tileAbove, 8)) {
          newY = tileAbove + 1;
          vy = 0;
          break;
        }
        pos -= step;
      }
    }

    // Aplicar posiciones reales
    player._realX = newX;
    player._realY = newY;
    player._x = newX;
    player._y = newY;
    player._followers.synchronize(player.x, player.y);

    if (!$gameMap || !$gameSystem._plataforma2DActiva) return;

    if (!player._jumpEventFlags) player._jumpEventFlags = {};

    for (const event of $gameMap.events()) {
      if (!event || !event.eventId || event._erased) continue;
      const ex = event._realX;
      const ey = event._realY;
      const dx = Math.abs(player._realX - ex);
      const dy = Math.abs(player._realY - ey);
      const touching = dx < 0.5 && dy < 0.5;

      if (event._playerInside === undefined) event._playerInside = false;

      if (touching && !event._playerInside) {
        event._playerInside = true;
        if (!player._jumpEventFlags[event.eventId()])
          player._jumpEventFlags[event.eventId()] = { A: false, B: false };

        let collisionType = "";
        const EPS = 0.5;
        if (vy > 0 && player._realY + EPS >= ey) collisionType = "top";
        else if (vy < 0 && player._realY - EPS <= ey) collisionType = "bottom";
        else collisionType = "side";

        const keyA = [$gameMap.mapId(), event.eventId(), "A"];
        const keyB = [$gameMap.mapId(), event.eventId(), "B"];
        const activePage = event.page();

        if (activePage) {
          const trigger = activePage.trigger;
          if (trigger === 1 || trigger === 2) {
            if (collisionType === "top") {
              if (!player._jumpEventFlags[event.eventId()].A) {
                $gameSelfSwitches.setValue(keyB, true);
                $gameSelfSwitches.setValue(keyA, false);
                player._jumpEventFlags[event.eventId()].B = true;
              }
            } else {
              $gameSelfSwitches.setValue(keyA, true);
              $gameSelfSwitches.setValue(keyB, false);
              player._jumpEventFlags[event.eventId()].A = true;
            }
          }
        }
      }

      if (!touching && event._playerInside) {
        event._playerInside = false;
      }
    }

    if (grounded) player._jumpEventFlags = {};
    player._prevRealY = player._realY;

    // Cámara centrada en el jugador
    if ($gameSystem._plataforma2DActiva && SceneManager._scene instanceof Scene_Map) {
      $gameMap.setDisplayPos(
        player._realX - $gameMap.screenTileX() / 2,
        player._realY - $gameMap.screenTileY() / 2
      );
    }

    // Plataforma elevadora (ID fijo)
    const PLATAFORMA_ID = 63;
    const plataforma = $gameMap.event(PLATAFORMA_ID);
    if (plataforma) {
      if (plataforma._baseY === undefined) {
        plataforma._baseY = plataforma._realY;
        plataforma._directionUp = true;
      }

      const AMPLITUD = 3;
      const VELOCIDAD = 0.03;

      if (plataforma._directionUp) {
        plataforma._realY -= VELOCIDAD;
        if (plataforma._realY <= plataforma._baseY - AMPLITUD)
          plataforma._directionUp = false;
      } else {
        plataforma._realY += VELOCIDAD;
        if (plataforma._realY >= plataforma._baseY + AMPLITUD)
          plataforma._directionUp = true;
      }

      plataforma._y = plataforma._realY;

      if (plataforma._prevRealY === undefined)
        plataforma._prevRealY = plataforma._realY;

      const ex = plataforma._realX;
      const ey = plataforma._realY;
      const onTop =
        vy >= 0 &&
        player._realY + 1 >= ey &&
        player._realY < ey &&
        Math.abs(player._realX - ex) < 0.8;

      if (onTop) {
        vy = 0;
        grounded = true;
        player._realY = ey - 1;
        player._realY += plataforma._realY - plataforma._prevRealY;
      }

      plataforma._prevRealY = plataforma._realY;
    }
  }

  // Tecla espacio → saltar
  Input.keyMapper[32] = "jump";
})();
