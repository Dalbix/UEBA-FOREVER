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
    isNode,          // app NW.js
    isAndroidApp,    // app Android con WebView nativa
    isAndroidWeb,    // navegador web móvil en Android
    isWindowsWeb,    // navegador web de Windows
    isWeb: !isNode   // cualquier cosa que no sea NW.js
  };
}
// === Debug: Mostrar entorno detectado al cargar el plugin ===
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
  this._plataforma2DActiva = false;
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

// Inicializa vacío
const _Game_System_initialize_Platforms = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
  _Game_System_initialize_Platforms.call(this);
  this._platformIds = [];
  this._platformAmplitudes = [];
  this._platformSpeeds = [];
  this._platformDirs = [];
  this._platformOffsets = [];
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
// --- TOUCH PLATFORM ---
// Coordenadas del jugador en pantalla (centrado)
const px = Graphics.width / 2;
const py = Graphics.height / 2;

if (TouchInput.isTriggered()) {
    player._touchHoldFrames = 0;
    player._touchLongHandled = false;
    player._touchStartX = TouchInput.x;
    player._touchStartY = TouchInput.y;
}

if (TouchInput.isPressed()) {
    player._touchHoldFrames++;

    // si se mantiene → movimiento lateral (igual que antes)
    if (player._touchHoldFrames >= HOLD_THRESHOLD) {
        const tx = TouchInput.x;

        if (tx < px - 60) {
            dx = -HORIZONTAL_SPEED;
            player.setDirection(4);
            player._touchLastDir = -1;
        } else if (tx > px + 60) {
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

    // === TAP (sin long press) → SALTO ===
    if (!player._touchLongHandled && grounded) {

        const tx = player._touchStartX;
        const ty = player._touchStartY;

        // ------------------------------
        //   ZONAS DE SALTO:
        //   - Encima del pj → salto vertical
        //   - Delante del pj → salto hacia adelante
        //   - Detrás del pj → salto hacia atrás
        // ------------------------------

        const facing = player.direction(); // 4 izq, 6 der

        const isAbove = (ty < py - 50);       // zona superior
        const isRight = (tx > px + 40);
        const isLeft  = (tx < px - 40);

        if (isAbove) {
            // SALTO VERTICAL
            dx = 0;
            shouldJump = true;

        } else if (facing === 6 && isRight) {
            // mirando derecha y tap delante → salto adelante
            dx = HORIZONTAL_SPEED;
            shouldJump = true;

        } else if (facing === 4 && isLeft) {
            // mirando izquierda y tap delante → salto adelante
            dx = -HORIZONTAL_SPEED;
            shouldJump = true;

        } else {
            // tap en la espalda → salto hacia atrás
            dx = (facing === 6 ? -HORIZONTAL_SPEED : HORIZONTAL_SPEED);
            shouldJump = true;
        }
    }

    player._touchHoldFrames = 0;
    player._touchLongHandled = false;
}

}

// Ejecutar salto si corresponde
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
// Evita salir del mapa por cualquier borde
const mapWidth = $dataMap.width;
const mapHeight = $dataMap.height;

// Límite horizontal
if (newX < 0) {
  newX = 0;
  dx = 0;
}
if (newX > mapWidth - 1) {
  newX = mapWidth - 1;
  dx = 0;
}

// Límite superior (no saltar fuera del mapa)
if (newY < 0) {
  newY = 0;
  vy = 0;
  grounded = false; // por si cae después
}

// Límite inferior (no caer fuera del mapa)
if (newY > mapHeight - 1) {
  newY = mapHeight - 1;
  vy = 0;
  grounded = true; // toca el suelo del límite
}


    const step = 0.02;

    // Colisión con suelo
	function isTileSolid(x, y, dir = 2) {
  // Dir = 2 abajo, 8 arriba
  const tx = Math.floor(x);
  const ty = Math.floor(y);

// Solo el borde inferior y superior del mapa son sólidos
if (ty < 0 || ty >= $dataMap.height) return true;

// Borde izquierdo o derecho: NO son sólidos, para evitar "pared invisible"
if (tx < 0 || tx >= $dataMap.width) return false;

  return !$gameMap.isPassable(tx, ty, dir);
}
//---------
/*
   if (vy > 0) {
  const hitboxWidth = 0.3;
  let pos = player._realY;

  while (pos < newY) {
    const tileBelow = Math.floor(pos + 1);

    const leftSolid = isTileSolid(newX - hitboxWidth, tileBelow, 2);
    const rightSolid = isTileSolid(newX + hitboxWidth, tileBelow, 2);

const floorY = Math.floor(newY); // tile de abajo según nueva posición
if (isTileSolid(newX - hitboxWidth, floorY, 2) || isTileSolid(newX + hitboxWidth, floorY, 2)) {
  newY = floorY;  // te coloca justo **sobre** el tile sólido
  vy = 0;
  grounded = true;
  break;
}
    pos += step;
  }
} else if (vy < 0) {
      let pos = player._realY;
      while (pos > newY) {
const tileToEnter = Math.floor(newY); // tile realmente arriba del jugador
if (!isTilePassableFromBelow(newX, tileToEnter)) {
    newY = tileToEnter + 1;  // colocarlo justo debajo del obstáculo
    vy = 0;
    break;
}
        pos -= step;
      }
    }
	*/
	//------------
	// --- CAÍDA (vy > 0) ---
//
// ===== COLISIÓN SUAVE Y CONTINUA =====
//
const TILE_TOP = (ty) => ty;        // borde superior del tile
const TILE_BOTTOM = (ty) => ty + 1; // borde inferior del tile
const MARGIN = 0.001;               // evita vibraciones

// --- CAÍDA ---
if (vy > 0) {

    const txLeft  = Math.floor(newX - 0.3);
    const txRight = Math.floor(newX + 0.3);
    const ty = Math.floor(newY); // tile al que se va a entrar por abajo
//const FOOT = player._realY + vy + 0.001;  
//const ty = Math.floor(FOOT);
    const canEnterUpLeft  = $gameMap.isPassable(txLeft, ty, 8);
    const canEnterUpRight = $gameMap.isPassable(txRight, ty, 8);

    // Si NO se puede entrar desde arriba → suelo sólido
    if (!canEnterUpLeft || !canEnterUpRight) {
        newY = TILE_TOP(ty) - MARGIN;
        vy = 0;
        grounded = true;
    } 
    // Sí se puede entrar → plataforma unidireccional
    else {
        const bottom = TILE_BOTTOM(ty);
        if (newY > bottom - MARGIN) {
            newY = bottom - MARGIN;
            vy = 0;
            grounded = true;
        }
    }
}



// --- SUBIDA ---
else if (vy < 0) {

    const txLeft  = Math.floor(newX - 0.3);
    const txRight = Math.floor(newX + 0.3);

    const ty = Math.floor(newY); // tile de arriba al que se pretende entrar

    // ¿Permite pasar por abajo (↓) el tile superior?
    const canExitDownLeft  = $gameMap.isPassable(txLeft, ty, 2);
    const canExitDownRight = $gameMap.isPassable(txRight, ty, 2);

    // Si NO permite pasar por abajo → CHOQUE (techo)
    if (!canExitDownLeft || !canExitDownRight) {
        newY = TILE_BOTTOM(ty) + MARGIN;
        vy = 0;
    }
}

//-------------

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

    // === NUEVO: obtener el zoom aplicado ===
    const zoom = event._zoomScale ?? 1.0;

    // === NUEVO: calcular tamaño de colisión basado en zoom ===
    const hitW = 0.5 * zoom;  // ancho de colisión horizontal
    const hitH = 0.5 * zoom;  // y vertical

    // === NUEVO: colisión ajustada al tamaño escalado ===
    const touching =
        Math.abs(player._realX - ex) < hitW &&
        Math.abs(player._realY - ey) < hitH;

    // Mantener flag interior
    if (event._playerInside === undefined) event._playerInside = false;

    if (touching && !event._playerInside) {

        event._playerInside = true;

        // Inicializar flags
        if (!player._jumpEventFlags[event.eventId()])
            player._jumpEventFlags[event.eventId()] = { A: false, B: false };

        // Determinar tipo de colisión (superior, inferior o lateral)
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

    // Salida del área
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


// === PLATAFORMAS ELEVADORAS (desde vectores configurables) ===
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
    const DIR = dirs[i] ?? 0; // 0=vertical, 1=horizontal
    const OFFSET_Y=offsets_y[i] ?? 1; //Offset y de posicion en la plataforma
    // Inicialización
    if (plataforma._baseX === undefined) plataforma._baseX = plataforma._realX;
    if (plataforma._baseY === undefined) plataforma._baseY = plataforma._realY;
    if (plataforma._directionUp === undefined) plataforma._directionUp = true;

    // Movimiento
    if (DIR === 0) {
      // Movimiento vertical
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
      // Movimiento horizontal
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

    // Inicializar posición anterior si no existe
    if (plataforma._prevRealY === undefined) plataforma._prevRealY = plataforma._realY;
    if (plataforma._prevRealX === undefined) plataforma._prevRealX = plataforma._realX;

    const ex = plataforma._realX;
    const ey = plataforma._realY;

    // Detección de si el jugador está encima
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


  }
function isTilePassableFromBelow(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);

    // Fuera del mapa → sólido
    if (ty < 0 || ty >= $dataMap.height) return false;
    if (tx < 0 || tx >= $dataMap.width) return false;

    // 8 = dirección arriba
    return $gameMap.isPassable(tx, ty, 8);
}

// --- Setter seguro para activar/desactivar plataformas 2D ---
Object.defineProperty(Game_System.prototype, "plataforma2DActiva", {
    get: function() { return !!this._plataforma2DActiva; },
    set: function(value) {
        if (this._plataforma2DActiva === value) return;
        this._plataforma2DActiva = value;

        if (!value) {
            const p = $gamePlayer;

            // Eliminar todas las propiedades de física del plugin
            delete p._realX;
            delete p._realY;
            delete p._prevRealY;
            delete p._jumpEventFlags;
            delete p._touchHoldFrames;
            delete p._touchLongHandled;
            delete p._touchStartX;
            delete p._touchLastDir;

            // Restablecer coordenadas a tiles
            p._x = Math.floor(p.x);
            p._y = Math.floor(p.y);
            p._followers.synchronize(p.x, p.y);

            // Restaurar dirección y dash
            p._direction = p._direction || 2;
            p._dashing = false;

            console.log("[Plataformas2D] Modo desactivado: jugador restaurado a movimiento normal.");
        }
    }
});






  // Tecla espacio → saltar
  Input.keyMapper[32] = "jump";
})();
