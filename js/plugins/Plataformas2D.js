/*:
 * @target MZ
 * @plugindesc Plataforma 2D con salto lento, colisiones precisas y soporte para autozoom activo. (Versión Android-optimizada)
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
 */

(() => {
  console.log("Plugin Plataformas2D cargado correctamente.");

  const params = PluginManager.parameters("Plataformas2D");
  const DESPLAZAMIENTO = Number(params["desplazamiento"] || 3);
  const ALTURA = Number(params["jumpHeight"] || 3);
  const TIEMPO = parseFloat(params["jumpTime"]) || 1.5;
  const JUMP_SE_NAME = String(params["jumpSE"] || "Jump1");

  // valores base pensados para 60fps (seguirán usándose en PC)
  const FPS = 60;
  const FRAMES_TOTAL = TIEMPO * FPS;
  const FRAMES_SUBIDA = FRAMES_TOTAL / 2;

  const BASE_GRAVITY = (2 * ALTURA) / (FRAMES_SUBIDA * FRAMES_SUBIDA);
  const BASE_JUMP = BASE_GRAVITY * FRAMES_SUBIDA;
  const BASE_HORIZONTAL_SPEED = DESPLAZAMIENTO / FRAMES_TOTAL;

  // estado global básicos
  let vy = 0;
  let grounded = false;

  Game_System.prototype.isPlatformer2DActive = function() {
    return !!this._plataforma2DActiva;
  };

  function getRuntimeEnvironment() {
    const isNode = Utils.isNwjs();
    const isAndroidApp = !!(typeof window !== "undefined" && window.AndroidInterface);
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

  // Utilidades temporales/time-based (robustas para Android)
  function nowSeconds() {
    return (typeof performance !== "undefined" && performance.now)
      ? performance.now() / 1000
      : Date.now() / 1000;
  }

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
    const isAndroid = isTouchPlatform; // alias claro: aplicaremos fixes solo si true

    // Copias de parámetros base (si Android, los recalcularemos con dt)
    const GRAVITY = BASE_GRAVITY;
    const JUMP = BASE_JUMP;
    const HORIZONTAL_SPEED = BASE_HORIZONTAL_SPEED;

    // Parámetros táctiles / umbrales
    const HOLD_THRESHOLD = 15; // frames para considerar "mantenido" (~250ms a 60fps)
    // Para Android usaremos timestamps en vez de frames y tolerancias mayores
    const TOUCH_ABOVE_PX = 48;
    const TOUCH_HORIZ_MARGIN = 40;

    // --- Movimiento y salto con detección de tap vs long-press ---
    let dx = 0;
    let shouldJump = false;

    // Si Android -> usar delta-time scaling y ajustes
    if (isAndroid) {
      // Initialize per-player timing trackers
      if (player._platform_lastTime === undefined) player._platform_lastTime = nowSeconds();
      if (player._platform_lastTouchTime === undefined) player._platform_lastTouchTime = 0;

      // tiempo transcurrido en segundos desde el último frame
      const tNow = nowSeconds();
      let dtSeconds = tNow - player._platform_lastTime;
      // Clamp dt razonable para evitar saltos gigantes si el juego fue minificado o se reanudó
      dtSeconds = Math.max(1/240, Math.min(0.5, dtSeconds)); // entre ~0.004 y 0.5s
      const dtFactor = dtSeconds * 60; // 1 frame equivalente = 1/60s

      player._platform_lastTime = tNow;

      // Ajustes de física escalados por dtFactor
      const gravityScaled = GRAVITY * dtFactor;
      const jumpScaled = JUMP * dtFactor;
      const horizontalScaled = HORIZONTAL_SPEED * dtFactor;

      // táctil robusto: usar timestamps para decidir long-press
      if (!isTouchPlatform) {
        // teclado/PC: igual que antes
        if (Input.isPressed("left")) {
          dx = -horizontalScaled;
          player.setDirection(4);
        }
        if (Input.isPressed("right")) {
          dx = horizontalScaled;
          player.setDirection(6);
        }
        if (Input.isTriggered("ok") || Input.isTriggered("jump")){
          shouldJump = true;
          $gameSystem._lastPlatformTapFrame = Graphics.frameCount;
        }
      } else {
        // TOUCH (Android / móvil)
        const playerScreenX = player.screenX();
        const playerScreenY = player.screenY();

        const ABOVE_THRESHOLD = TOUCH_ABOVE_PX;
        const HORIZ_MARGIN = TOUCH_HORIZ_MARGIN;
        const FAR_MULT = 1.5;

        // Cuando empieza el toque, guardamos timestamp y coords
        if (TouchInput.isTriggered()) {
          player._touchHoldFrames = 0;
          player._touchLongHandled = false;
          player._touchStartX = TouchInput.x;
          player._touchStartY = TouchInput.y;
          player._touchStartTime = nowSeconds();
        }

        if (TouchInput.isPressed()) {
          // En Android contamos tiempo real, no frames
          player._touchHoldFrames = (player._touchHoldFrames || 0) + 1;
          const holdTime = nowSeconds() - (player._touchStartTime || nowSeconds());

          // consideramos long press si se supera umbral en segundos (HOLD_THRESHOLD frames ~ 15/60 = 0.25s)
          const LONG_PRESS_SEC = HOLD_THRESHOLD / 60;
          if (holdTime >= LONG_PRESS_SEC) {
            const currentX = TouchInput.x;

            if (currentX < playerScreenX - 60) {
              dx = -horizontalScaled;
              player.setDirection(4);
              player._touchLastDir = -1;
            } else if (currentX > playerScreenX + 60) {
              dx = horizontalScaled;
              player.setDirection(6);
              player._touchLastDir = 1;
            } else {
              dx = 0;
            }
            player._touchLongHandled = true;
          }
        }

        if (TouchInput.isReleased()) {
          const holdTime = nowSeconds() - (player._touchStartTime || nowSeconds());
          const wasLong = player._touchLongHandled || (holdTime >= (HOLD_THRESHOLD / 60));

          if (!wasLong && grounded) {
            const tx = player._touchStartX;
            const ty = player._touchStartY;

            const dxScreen = tx - playerScreenX;
            const dyScreen = ty - playerScreenY;

            const absDx = Math.abs(dxScreen);
            const absDy = Math.abs(dyScreen);

            if (dyScreen < -ABOVE_THRESHOLD && absDx <= 80) {
              vy = -jumpScaled;
              grounded = false;
              dx = 0;
              player._touchLastDir = 0;
              AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
            } else {
              const touchIsRight = dxScreen > HORIZ_MARGIN;
              const touchIsLeft  = dxScreen < -HORIZ_MARGIN;
              const facing = player.direction();

              let jumpHorizontal = 0;
              if ((facing === 6 && touchIsRight) || (facing === 4 && touchIsLeft)) {
                jumpHorizontal = (facing === 6 ? 1 : -1) * horizontalScaled * FAR_MULT;
                player.setDirection(facing);
              } else if ((facing === 6 && touchIsLeft) || (facing === 4 && touchIsRight)) {
                jumpHorizontal = (facing === 6 ? -1 : 1) * horizontalScaled * FAR_MULT;
                player.setDirection(facing === 6 ? 4 : 6);
              } else if (touchIsRight) {
                jumpHorizontal = horizontalScaled * FAR_MULT;
                player.setDirection(6);
              } else if (touchIsLeft) {
                jumpHorizontal = -horizontalScaled * FAR_MULT;
                player.setDirection(4);
              } else {
                jumpHorizontal = 0;
              }

              if (jumpHorizontal !== 0 || (dyScreen >= -ABOVE_THRESHOLD && absDx <= HORIZ_MARGIN)) {
                vy = -jumpScaled;
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
          player._touchStartTime = 0;
        }

        // mantener dir en aire
        if (!grounded && player._touchLastDir) {
          dx = player._touchLastDir * HORIZONTAL_SPEED * (dtFactor); // nota: horizontalScaled ya incluye dtFactor
          player.setDirection(player._touchLastDir === -1 ? 4 : 6);
        }
      }

      // Si se pulsó salto por teclado y está grounded (aplicable en Android si hay teclado)
      if (shouldJump && grounded) {
        vy = -JUMP * dtFactor;
        grounded = false;
        AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
      }

      // Aplicamos gravedad escalada por dtFactor
      vy += GRAVITY * dtFactor;

      // Nueva posición escalada
      let newX = player._realX + dx;
      let newY = player._realY + vy;

      // límites duros del mapa
      const mapWidth = $dataMap.width;
      const mapHeight = $dataMap.height;

      if (newX < 0) { newX = 0; dx = 0; }
      if (newX > mapWidth - 1) { newX = mapWidth - 1; dx = 0; }
      if (newY < 0) { newY = 0; vy = 0; grounded = false; }
      if (newY > mapHeight - 1) { newY = mapHeight - 1; vy = 0; grounded = true; }

      // --- Colisiones simplificadas y robustas (para subida/caída) ---
      // Aumentamos ligeramente los márgenes en Android para compensar escalados/zoom
      const mobileHitMultiplier = 1.25;

      // CAÍDA
      if (vy > 0) {
        const txLeft  = Math.floor(newX - 0.3);
        const txRight = Math.floor(newX + 0.3);
        const ty = Math.floor(newY);

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
        const txLeft  = Math.floor(newX - 0.3);
        const txRight = Math.floor(newX + 0.3);
        const ty = Math.floor(newY);

        const canExitDownLeft  = $gameMap.isPassable(txLeft, ty, 2);
        const canExitDownRight = $gameMap.isPassable(txRight, ty, 2);

        if (!canExitDownLeft || !canExitDownRight) {
          newY = ty + 1 + 0.001;
          vy = 0;
        }
      }

      // Aplicar posiciones reales (y redondeo para evitar drift flotante)
      player._realX = Number(newX.toFixed(4));
      player._realY = Number(newY.toFixed(4));
      player._x = player._realX;
      player._y = player._realY;
      player._followers.synchronize(player.x, player.y);

      if (!$gameMap || !$gameSystem._plataforma2DActiva) return;

      if (!player._jumpEventFlags) player._jumpEventFlags = {};

      // Colisiones con eventos
      for (const event of $gameMap.events()) {
        if (!event || !event.eventId || event._erased) continue;

        const ex = event._realX;
        const ey = event._realY;

        const zoom = event._zoomScale ?? 1.0;
        const hitW = 0.5 * zoom * mobileHitMultiplier;
        const hitH = 0.5 * zoom * mobileHitMultiplier;

        const touching =
          Math.abs(player._realX - ex) < hitW &&
          Math.abs(player._realY - ey) < hitH;

        if (event._playerInside === undefined) event._playerInside = false;

        if (touching && !event._playerInside) {
          event._playerInside = true;

          if (!player._jumpEventFlags[event.eventId()])
            player._jumpEventFlags[event.eventId()] = { A: false, B: false };

          let collisionType = "";
          const EPS = 0.5 * zoom * mobileHitMultiplier;

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

      // Plataformas móviles
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
              plataforma._realY -= VELOCIDAD * dtFactor;
              if (plataforma._realY <= plataforma._baseY - AMPLITUD)
                plataforma._directionUp = false;
            } else {
              plataforma._realY += VELOCIDAD * dtFactor;
              if (plataforma._realY >= plataforma._baseY + AMPLITUD)
                plataforma._directionUp = true;
            }
            plataforma._y = plataforma._realY;
          } else {
            if (plataforma._directionUp) {
              plataforma._realX += VELOCIDAD * dtFactor;
              if (plataforma._realX >= plataforma._baseX + AMPLITUD)
                plataforma._directionUp = false;
            } else {
              plataforma._realX -= VELOCIDAD * dtFactor;
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

      // Cámara centrada en el jugador (AHORA: se llama AL FINAL, ya resueltas físicas y colisiones)
      if ($gameSystem._plataforma2DActiva && SceneManager._scene instanceof Scene_Map) {
        $gameMap.setDisplayPos(
          player._realX - $gameMap.screenTileX() / 2,
          player._realY - $gameMap.screenTileY() / 2
        );
      }

      return; // fin del flujo Android
    } // end if isAndroid

    // -------------------------
    // Flujo NO-Android (PC/Windows/Web) — mantiene tu lógica original
    // -------------------------
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
      // --- TOUCH (no-Android touch improbable, pero mantenemos la lógica) ---
      const playerScreenX = player.screenX();
      const playerScreenY = player.screenY();

      const ABOVE_THRESHOLD = 48;
      const HORIZ_MARGIN = 40;
      const FAR_MULT = 1.5;

      if (TouchInput.isTriggered()) {
        player._touchHoldFrames = 0;
        player._touchLongHandled = false;
        player._touchStartX = TouchInput.x;
        player._touchStartY = TouchInput.y;
      }

      if (TouchInput.isPressed()) {
        player._touchHoldFrames = (player._touchHoldFrames || 0) + 1;

        if (player._touchHoldFrames >= HOLD_THRESHOLD) {
          const currentX = TouchInput.x;

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
        if (!player._touchLongHandled && grounded) {
          const tx = player._touchStartX;
          const ty = player._touchStartY;

          const dxScreen = tx - playerScreenX;
          const dyScreen = ty - playerScreenY;

          const absDx = Math.abs(dxScreen);
          const absDy = Math.abs(dyScreen);

          if (dyScreen < -ABOVE_THRESHOLD && absDx <= 80) {
            vy = -JUMP;
            grounded = false;
            dx = 0;
            player._touchLastDir = 0;
            AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
          } else {
            const touchIsRight = dxScreen > HORIZ_MARGIN;
            const touchIsLeft  = dxScreen < -HORIZ_MARGIN;

            const facing = player.direction();

            let jumpHorizontal = 0;
            if ((facing === 6 && touchIsRight) || (facing === 4 && touchIsLeft)) {
              jumpHorizontal = (facing === 6 ? 1 : -1) * HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(facing);
            } else if ((facing === 6 && touchIsLeft) || (facing === 4 && touchIsRight)) {
              jumpHorizontal = (facing === 6 ? -1 : 1) * HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(facing === 6 ? 4 : 6);
            } else if (touchIsRight) {
              jumpHorizontal = HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(6);
            } else if (touchIsLeft) {
              jumpHorizontal = -HORIZONTAL_SPEED * FAR_MULT;
              player.setDirection(4);
            } else {
              jumpHorizontal = 0;
            }

            if (jumpHorizontal !== 0 || (dyScreen >= -ABOVE_THRESHOLD && absDx <= HORIZ_MARGIN)) {
              vy = -JUMP;
              grounded = false;
              dx = jumpHorizontal;
              player._touchLastDir = jumpHorizontal === 0 ? 0 : (jumpHorizontal > 0 ? 1 : -1);
              AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
            }
          }
        }

        player._touchHoldFrames = 0;
        player._touchLongHandled = false;
        player._touchStartX = 0;
        player._touchStartY = 0;
      }

      if (!grounded && player._touchLastDir) {
        dx = player._touchLastDir * HORIZONTAL_SPEED;
        player.setDirection(player._touchLastDir === -1 ? 4 : 6);
      }
    }

    // Ejecutar salto si corresponde (teclas/PC)
    if (shouldJump && grounded) {
      vy = -JUMP;
      grounded = false;
      AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
    }

    // Gravedad (PC)
    vy += GRAVITY;

    // Nueva posición (PC)
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

    // --- Colisiones simplificadas y robustas (PC) ---
    function isTilePassableFromBelow(x, y) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (ty < 0 || ty >= $dataMap.height) return false;
      if (tx < 0 || tx >= $dataMap.width) return false;
      return $gameMap.isPassable(tx, ty, 8);
    }

    if (vy > 0) {
      const txLeft  = Math.floor(newX - 0.3);
      const txRight = Math.floor(newX + 0.3);
      const ty = Math.floor(newY);

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
    } else if (vy < 0) {
      const txLeft  = Math.floor(newX - 0.3);
      const txRight = Math.floor(newX + 0.3);
      const ty = Math.floor(newY);

      const canExitDownLeft  = $gameMap.isPassable(txLeft, ty, 2);
      const canExitDownRight = $gameMap.isPassable(txRight, ty, 2);

      if (!canExitDownLeft || !canExitDownRight) {
        newY = ty + 1 + 0.001;
        vy = 0;
      }
    }

    // Aplicar posiciones reales (PC)
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

    // Cámara centrada en el jugador (PC)
    if ($gameSystem._plataforma2DActiva && SceneManager._scene instanceof Scene_Map) {
      $gameMap.setDisplayPos(
        player._realX - $gameMap.screenTileX() / 2,
        player._realY - $gameMap.screenTileY() / 2
      );
    }

    // Plataformas móviles (PC)
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

  } // end updatePlatform

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
