/*:
 * @target MZ
 * @plugindesc Plataforma 2D con salto lento, colisiones precisas y soporte para autozoom activo.
 * @author 3DalbiX / ChatGPT
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
 * - setJumpSE
 *   Cambia el SE usado al saltar.
 *   Parámetros:
 *     - name: Nombre del archivo en Audio/SE
 *
 * @command activar
 * @text Activar Plataforma 2D
 * @desc Activa el modo de plataformas 2D en el mapa actual.
 *
 * @command desactivar
 * @text Desactivar Plataforma 2D
 * @desc Desactiva el modo plataformas 2D y vuelve al movimiento normal.
 *
 * @command setJumpSE
 * @text Cambiar SE de salto
 * @desc Cambia el sonido de salto cuando el modo plataforma está activo.
 *
 * @arg name
 * @text Nuevo SE
 * @desc Nombre del archivo SE dentro de Audio/SE
 * @type file
 * @dir audio/se
 */

(() => {
  console.log("Plugin Plataformas2D cargado correctamente.");

  const params = PluginManager.parameters("Plataformas2D");
  const DESPLAZAMIENTO = Number(params["desplazamiento"] || 3);
  const ALTURA = Number(params["jumpHeight"] || 3);
  const TIEMPO = parseFloat(params["jumpTime"]) || 1.5;
  let JUMP_SE_NAME = String(params["jumpSE"] || "Jump1");

  const FPS = 60;
  const FRAMES_TOTAL = TIEMPO * FPS;
  const FRAMES_SUBIDA = FRAMES_TOTAL / 2;

  const GRAVITY = (2 * ALTURA) / (FRAMES_SUBIDA * FRAMES_SUBIDA);
  const JUMP = GRAVITY * FRAMES_SUBIDA;
  const HORIZONTAL_SPEED = DESPLAZAMIENTO / FRAMES_TOTAL;

  let vy = 0;
  let grounded = false;

  Game_System.prototype.isPlatformer2DActive = function() {
    return !!this._plataforma2DActiva;
  };

  function getRuntimeEnvironment() {
    const isNode = Utils.isNwjs();
    const isAndroidApp = !!window.AndroidInterface;
    const ua = navigator.userAgent || "";
    const isAndroidWeb = /Android/i.test(ua) && !isNode && !isAndroidApp;
    const isWindowsWeb = /Windows/i.test(ua) && !isNode;

    return {
      isNode,
      isAndroidApp,
      isAndroidWeb,
      isWindowsWeb,
      isWeb: !isNode
    };
  }

  const __envCheck = getRuntimeEnvironment();
  console.log(
    "%c[Plataformas2D] Entorno detectado:",
    "color: #00ccff; font-weight: bold;"
  );
  console.log({
    isNode: __envCheck.isNode,
    isAndroidApp: __envCheck.isAndroidApp,
    isAndroidWeb: __envCheck.isAndroidWeb,
    isWindowsWeb: __envCheck.isWindowsWeb,
    isWeb: __envCheck.isWeb,
    userAgent: navigator.userAgent
  });

  // Inicialización segura del flag global
const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
  _Game_System_initialize.call(this);

  // Inicialización del modo plataforma
  this._plataforma2DActiva = false;

  // Inicialización de plataformas móviles
  this._platformIds = [];
  this._platformAmplitudes = [];
  this._platformSpeeds = [];
  this._platformDirs = [];
  this._platformOffsets = [];
};


  // === NUEVO BLOQUE: configuración de plataformas por mapa ===
  Game_System.prototype.setPlatforms = function(ids, amplitudes, speeds, dirs, offsets) {
    this._platformIds = Array.isArray(ids) ? ids : [];
    this._platformAmplitudes = Array.isArray(amplitudes) ? amplitudes : [];
    this._platformSpeeds = Array.isArray(speeds) ? speeds : [];
    this._platformDirs = Array.isArray(dirs) ? dirs : [];
    this._platformOffsets = Array.isArray(offsets) ? offsets : [];
    console.log("[Plataformas2D] Configuradas plataformas dinámicas:", this._platformIds);
  };

 

  // Comandos
  PluginManager.registerCommand("Plataformas2D", "activar", () => {
    $gameSystem._plataforma2DActiva = true;
    console.log("Modo Plataforma 2D activado manualmente");
  });

  PluginManager.registerCommand("Plataformas2D", "desactivar", () => {
    $gameSystem._plataforma2DActiva = false;
    console.log("Modo Plataforma 2D desactivado manualmente");
  });
  // cambiar sonido del salto
PluginManager.registerCommand("Plataformas2D", "setJumpSE", args => {
  const newName = args.name || "";
  if (newName.trim() !== "") {
    JUMP_SE_NAME = newName;
    //console.log("[Plataformas2D] Sonido de salto cambiado a:", newName);
  } else {
    console.warn("[Plataformas2D] (setJumpSE) Nombre vacío, ignorado.");
  }
});


  // Actualizar jugador
  const _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function (sceneActive) {
    _Game_Player_update.call(this, sceneActive);

    if ($gameSystem._plataforma2DActiva) updatePlatform(this);
  };

  function updatePlatform(player) {
    if ($gameMessage.isBusy() || !$gamePlayer.canMove()) return;

    // --- Detección del entorno actual ---
    const env = getRuntimeEnvironment();
    const isTouchPlatform = (env.isAndroidApp || env.isAndroidWeb);

    // --- Movimiento y salto con detección de tap vs long-press ---
    let dx = 0;
    let shouldJump = false;

    // Parámetros (ajustables)
    const HOLD_THRESHOLD = 15; // frames para considerar "mantenido" (~15 frames = 250ms a 60fps)

    // --- TECLADO / PC: comportamiento normal ---
    if (!isTouchPlatform) {
      if (Input.isPressed("left")) {
        dx = -HORIZONTAL_SPEED;
        player.setDirection(4);
      }
      if (Input.isPressed("right")) {
        dx = HORIZONTAL_SPEED;
        player.setDirection(6);
      }
      if (Input.isTriggered("ok") || Input.isTriggered("jump")){
        shouldJump = true;
        $gameSystem._lastPlatformTapFrame = Graphics.frameCount;
      }
    } else {
      // --- TOUCH (Android / móvil) ---
      // Usamos COORDENADAS EN PANTALLA del jugador para ser compatibles con zoom
      const playerScreenX = player.screenX();
      const playerScreenY = player.screenY();

      // Umbrales en píxeles para decidir "encima / delante / detrás"
      const ABOVE_THRESHOLD = 48; // si tocas más arriba que esta distancia → salto vertical
      const HORIZ_MARGIN = 40;    // margen horizontal para considerar "centro"
      const FAR_MULT = 1.5;       // multiplicador de velocidad horizontal cuando salta adelantado/atrás

      if (TouchInput.isTriggered()) {
        player._touchHoldFrames = 0;
        player._touchLongHandled = false;
        player._touchStartX = TouchInput.x;
        player._touchStartY = TouchInput.y;
      }

      if (TouchInput.isPressed()) {
        player._touchHoldFrames = (player._touchHoldFrames || 0) + 1;

        // Si mantiene más de HOLD_THRESHOLD → moverse lateralmente
        if (player._touchHoldFrames >= HOLD_THRESHOLD) {
          const currentX = TouchInput.x;

          // Movimiento relativo a la pantalla del jugador (permite autozoom)
          if (currentX < playerScreenX - 60) {
            dx = -HORIZONTAL_SPEED;
            player.setDirection(4);
            player._touchLastDir = -1;
          } else if (currentX > playerScreenX + 60) {
            dx = HORIZONTAL_SPEED;
            player.setDirection(6);
            player._touchLastDir = 1;
          } else {
            dx = 0;
          }
          player._touchLongHandled = true;
        }
      }

      if (TouchInput.isReleased()) {
        // Si NO fue long press → es TAP (saltar)
        if (!player._touchLongHandled && grounded) {
          const tx = player._touchStartX;
          const ty = player._touchStartY;

          // Distancias en pantalla
          const dxScreen = tx - playerScreenX;
          const dyScreen = ty - playerScreenY;

          const absDx = Math.abs(dxScreen);
          const absDy = Math.abs(dyScreen);

          // 1) SALTO VERTICAL (tap suficientemente por encima del sprite)
          if (dyScreen < -ABOVE_THRESHOLD && absDx <= 80) {
            // salto vertical puro
            vy = -JUMP;
            grounded = false;
            dx = 0;
            player._touchLastDir = 0;
            AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
          }
          // 2) SALTO HACIA ADELANTE / ATRÁS (según donde se toca comparado con la X del jugador)
          else {
            // Determina si el toque está a la derecha o a la izquierda en pantalla respecto al jugador
            const touchIsRight = dxScreen > HORIZ_MARGIN;
            const touchIsLeft  = dxScreen < -HORIZ_MARGIN;

            // Dirección a la que mira el jugador: 4 = izq, 6 = der (si quieres considerar 2/8 puedes extenderlo)
            const facing = player.direction();

            // Si tocas en la dirección donde mira → saltar hacia delante
            let jumpHorizontal = 0;
            if ((facing === 6 && touchIsRight) || (facing === 4 && touchIsLeft)) {
              // adelante
              jumpHorizontal = (facing === 6 ? 1 : -1) * HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(facing);
            }
            // Si tocas en la dirección opuesta → saltar hacia atrás
            else if ((facing === 6 && touchIsLeft) || (facing === 4 && touchIsRight)) {
              jumpHorizontal = (facing === 6 ? -1 : 1) * HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(facing === 6 ? 4 : 6);
            }
            // Caso neutro: si no está claramente a izquierda/derecha, usar la X absoluta del touch
            else if (touchIsRight) {
              jumpHorizontal = HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(6);
            } else if (touchIsLeft) {
              jumpHorizontal = -HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(4);
            } else {
              // toque muy centrado (ni arriba ni lateral claro) → salto vertical
              jumpHorizontal = 0;
            }

            // Aplicar salto si hemos decidido saltar (salto vertical ya aplicado antes)
            if (jumpHorizontal !== 0 || (dyScreen >= -ABOVE_THRESHOLD && absDx <= HORIZ_MARGIN)) {
              vy = -JUMP;
              grounded = false;
              dx = jumpHorizontal;
              player._touchLastDir = jumpHorizontal === 0 ? 0 : (jumpHorizontal > 0 ? 1 : -1);
              AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
            }
          }
        }

        // reset flags
        player._touchHoldFrames = 0;
        player._touchLongHandled = false;
        player._touchStartX = 0;
        player._touchStartY = 0;
      }

      // Si está en el aire, mantener dirección mientras se mueve
      if (!grounded && player._touchLastDir) {
        dx = player._touchLastDir * HORIZONTAL_SPEED;
        player.setDirection(player._touchLastDir === -1 ? 4 : 6);
      }
    }

    // Ejecutar salto si corresponde (teclas/PC usan shouldJump; touch ya pone vy directo)
    if (shouldJump && grounded) {
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

    // === LIMITE DURO DEL MAPA ===
    const mapWidth = $dataMap.width;
    const mapHeight = $dataMap.height;

    if (newX < 0) {
      newX = 0;
      dx = 0;
    }
    if (newX > mapWidth - 1) {
      newX = mapWidth - 1;
      dx = 0;
    }

    if (newY < 0) {
      newY = 0;
      vy = 0;
      grounded = false;
    }

    if (newY > mapHeight - 1) {
      newY = mapHeight - 1;
      vy = 0;
      grounded = true;
    }

    // --- Colisiones simplificadas y robustas (para subida/caída) ---
    function isTilePassableFromBelow(x, y) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (ty < 0 || ty >= $dataMap.height) return false;
      if (tx < 0 || tx >= $dataMap.width) return false;
      return $gameMap.isPassable(tx, ty, 8);
    }

const zoom = $gameSystem._disableAutoZoom ? 1.0 : ($gameScreen._zoomScale || 1.0);

// CAÍDA
if (vy > 0) {
  const txLeft  = Math.floor((newX - 0.3) / zoom);
  const txRight = Math.floor((newX + 0.3) / zoom);
  const ty      = Math.floor(newY / zoom);

  const canEnterUpLeft  = $gameMap.isPassable(txLeft, ty, 8);
  const canEnterUpRight = $gameMap.isPassable(txRight, ty, 8);

  if (!canEnterUpLeft || !canEnterUpRight) {
    newY = ty - 0.001;
    vy = 0;
    grounded = true;
  } else {
    const bottom = ty + 1;
    if (newY > bottom - 0.001) {
      newY = bottom - 0.001;
      vy = 0;
      grounded = true;
    }
  }
}

// SUBIDA
else if (vy < 0) {
  const txLeft  = Math.floor((newX - 0.3) / zoom);
  const txRight = Math.floor((newX + 0.3) / zoom);
  const ty      = Math.floor(newY / zoom);

  const canExitDownLeft  = $gameMap.isPassable(txLeft, ty, 2);
  const canExitDownRight = $gameMap.isPassable(txRight, ty, 2);

  if (!canExitDownLeft || !canExitDownRight) {
    newY = ty + 1 + 0.001;
    vy = 0;
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

    // Colisiones con eventos (mantengo tu lógica principal)
    for (const event of $gameMap.events()) {
      if (!event || !event.eventId || event._erased) continue;

      const ex = event._realX;
      const ey = event._realY;

      const zoom = event._zoomScale ?? 1.0;
      const hitW = 0.5 * zoom;
      const hitH = 0.5 * zoom;

      const touching =
        Math.abs(player._realX - ex) < hitW &&
        Math.abs(player._realY - ey) < hitH;

      if (event._playerInside === undefined) event._playerInside = false;

      if (touching && !event._playerInside) {

        event._playerInside = true;

        if (!player._jumpEventFlags[event.eventId()])
          player._jumpEventFlags[event.eventId()] = { A: false, B: false };

        let collisionType = "";
        const EPS = 0.5 * zoom;

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

    // Plataformas móviles (mantengo tu implementación)
    if ($gameSystem._platformIds && $gameSystem._platformIds.length > 0) {
      const ids = $gameSystem._platformIds;
      const amplitudes = $gameSystem._platformAmplitudes;
      const speeds = $gameSystem._platformSpeeds;
      const dirs = $gameSystem._platformDirs;
      const offsets_y = $gameSystem._platformOffsets;

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const plataforma = $gameMap.event(id);
        if (!plataforma) continue;

        const AMPLITUD = amplitudes[i] ?? 3;
        const VELOCIDAD = speeds[i] ?? 0.03;
        const DIR = dirs[i] ?? 0;
        const OFFSET_Y=offsets_y[i] ?? 1;

        if (plataforma._baseX === undefined) plataforma._baseX = plataforma._realX;
        if (plataforma._baseY === undefined) plataforma._baseY = plataforma._realY;
        if (plataforma._directionUp === undefined) plataforma._directionUp = true;

        if (DIR === 0) {
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
        } else {
          if (plataforma._directionUp) {
            plataforma._realX += VELOCIDAD;
            if (plataforma._realX >= plataforma._baseX + AMPLITUD)
              plataforma._directionUp = false;
          } else {
            plataforma._realX -= VELOCIDAD;
            if (plataforma._realX <= plataforma._baseX - AMPLITUD)
              plataforma._directionUp = true;
          }
          plataforma._x = plataforma._realX;
        }

        if (plataforma._prevRealY === undefined) plataforma._prevRealY = plataforma._realY;
        if (plataforma._prevRealX === undefined) plataforma._prevRealX = plataforma._realX;

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
          player._realY = ey - OFFSET_Y;
          player._realY += (plataforma._realY - plataforma._prevRealY) || 0;
          player._realX += (plataforma._realX - plataforma._prevRealX) || 0;
        }

        plataforma._prevRealY = plataforma._realY;
        plataforma._prevRealX = plataforma._realX;
      }
    }
/*	// === FIX DE ANIMACIÓN LATERAL ===
if ($gameSystem._plataforma2DActiva) {
    if (dx !== 0 && grounded) {
        // Marca que el jugador está "moviendo los pies"
        player._stopCount = 0;
        player._stepAnime = true;
        player.updateAnimation();
    } else {
        // Si está quieto, detener animación
        player._stepAnime = false;
    }
}*/
    // === FIX DE ANIMACIÓN LATERAL (SEGURO) ===
    if ($gameSystem._plataforma2DActiva && !SceneManager.isSceneChanging()) {

        // Asegurar que el actor no está transferido o bloqueado
        if (!$gamePlayer.isTransferring() && $gamePlayer.canMove()) {

            if (dx !== 0 && grounded) {
                player._stopCount = 0;
                player._stepAnime = true;
                player.updateAnimation();
            } else {
                player._stepAnime = false;
            }

        } else {
            // Si está transfiriéndose o bloqueado, siempre desactivar
            player._stepAnime = false;
        }
    } else {
        // Si se desactiva plataformas2D, animación normal OFF
        player._stepAnime = false;
    }

  }

  // Setter seguro para activar/desactivar plataformas 2D
  Object.defineProperty(Game_System.prototype, "plataforma2DActiva", {
    get: function() { return !!this._plataforma2DActiva; },
    set: function(value) {
      if (this._plataforma2DActiva === value) return;
      this._plataforma2DActiva = value;

      if (!value) {
        const p = $gamePlayer;

        delete p._realX;
        delete p._realY;
        delete p._prevRealY;
        delete p._jumpEventFlags;
        delete p._touchHoldFrames;
        delete p._touchLongHandled;
        delete p._touchStartX;
        delete p._touchLastDir;

        p._x = Math.floor(p.x);
        p._y = Math.floor(p.y);
        p._followers.synchronize(p.x, p.y);

        p._direction = p._direction || 2;
        p._dashing = false;

        console.log("[Plataformas2D] Modo desactivado: jugador restaurado a movimiento normal.");
      }
    }
  });
const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
Game_Player.prototype.performTransfer = function() {
  _Game_Player_performTransfer.call(this);

  if ($gameSystem._plataforma2DActiva) {
    this._realX = this.x;
    this._realY = this.y;
    vy = 0;
    grounded = true;
  }
};
// ============================================
// FIX UNIVERSAL: Reiniciar estado al cargar partida
// ============================================
const _Scene_Load_onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
Scene_Load.prototype.onLoadSuccess = function() {
  _Scene_Load_onLoadSuccess.call(this);

  if ($gameSystem._plataforma2DActiva) {
    const p = $gamePlayer;

    p._realX = p.x;
    p._realY = p.y;
    p._prevRealY = p._realY;

    vy = 0;
    grounded = true;

    console.log("[Plataformas2D] Estado reiniciado tras cargar partida.");
  }
};

  // Tecla espacio → saltar
  Input.keyMapper[32] = "jump";
})();
