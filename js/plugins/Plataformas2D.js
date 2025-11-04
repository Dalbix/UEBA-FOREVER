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
 * Añade <Plataforma2D> en las notas del mapa para activar el modo.
 * Controles:
 *  - Flechas izquierda/derecha → mover
 *  - Z o Espacio → saltar
 * 
 * Compatible con el plugin AutoZoomTouchImages.
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

  const GRAVITY = 2 * ALTURA / (FRAMES_SUBIDA * FRAMES_SUBIDA);
  const JUMP = GRAVITY * FRAMES_SUBIDA;
  const HORIZONTAL_SPEED = DESPLAZAMIENTO / FRAMES_TOTAL;

  let active = false;
  let vy = 0;
  let grounded = false;


const _Game_Map_setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId) {
  _Game_Map_setup.call(this, mapId);

  setTimeout(() => {
    // Buscar el nombre del mapa en $dataMapInfos
    const mapInfo = $dataMapInfos ? $dataMapInfos[mapId] : null;
    const mapName = mapInfo ? mapInfo.name.toLowerCase() : "";
    active = mapName.includes("2d");

    console.log("Mapa cargado:", mapName, "Modo plataforma activo:", active);

    vy = 0;
    grounded = false;
  }, 0);
};

  const _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.call(this, sceneActive);
    if (active) updatePlatform(this);
  };

  function updatePlatform(player) {
	//  if (Math.random() < 0.01) console.log("Update plataforma activo, grounded:", grounded, "vy:", vy);
if ($gameMessage.isBusy() || !$gamePlayer.canMove()) return;
	// Movimiento horizontal						
    let dx = 0;
    if (Input.isPressed("left")) dx = -HORIZONTAL_SPEED;
    if (Input.isPressed("right")) dx = HORIZONTAL_SPEED;

	// Salto		
    if ((Input.isTriggered("ok") || Input.isTriggered("jump")) && grounded) {
      vy = -JUMP;
      grounded = false;
	  // Reproducir sonido de salto
	  AudioManager.playSe({ name: JUMP_SE_NAME, pan: 0, pitch: 100, volume: 90 });
    }

	// Gravedad		   
    vy += GRAVITY;

	// Nueva posición horizontal							 
    let newX = player._realX + dx;
    newX = Math.max(0, Math.min(newX, $dataMap.width - 1));

	// Nueva posición vertical con colisiones paso a paso													  
    let newY = player._realY + vy;
    const step = 0.02;

   /* if (vy > 0) { // cayendo
      let pos = player._realY;
      while (pos < newY) {
        const tileBelow = Math.floor(pos + 1);
        if (!$gameMap.isPassable(Math.floor(newX), tileBelow, 2)) {
          newY = tileBelow - 1;
          vy = 0;
          grounded = true;
          break;
        }
        pos += step;
      }
    }*/
if (vy > 0) { // cayendo
  let pos = player._realY;
  const hitboxWidth = 0.3; // margen horizontal de colisión
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
}	else if (vy < 0) { // subiendo
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


    if (!$gameMap || !active) return;

    if (!player._jumpEventFlags) player._jumpEventFlags = {};

    for (const event of $gameMap.events()) {
      if (!event || !event.eventId || event._erased) continue;

      const ex = event._realX;
      const ey = event._realY;
      const dx = Math.abs(player._realX - ex);
      const dy = Math.abs(player._realY - ey);

      const touching = dx < 0.5 && dy < 0.5;

      if (event._playerInside === undefined) event._playerInside = false;

      // Entrada por primera vez
      if (touching && !event._playerInside) {
        event._playerInside = true;

        // inicializar flags de salto
        if (!player._jumpEventFlags[event.eventId()])
          player._jumpEventFlags[event.eventId()] = { A: false, B: false };

        // detectar colisión
        let collisionType = "";
        const diffY = player._realY - ey;
        const EPS = 0.5; // tolerancia

        if (vy > 0 && player._realY + EPS >= ey) {
          collisionType = "top"; // caída encima
        } else if (vy < 0 && player._realY - EPS <= ey) {
          collisionType = "bottom"; // sube desde abajo
        } else {
          collisionType = "side";
        }

// === Activar Self Switches solo si la página activa permite contacto físico ===
const keyA = [$gameMap.mapId(), event.eventId(), "A"];
const keyB = [$gameMap.mapId(), event.eventId(), "B"];

// Obtener la página activa actual del evento
const activePage = event.page();
if (activePage) {
  const trigger = activePage.trigger; // 0=ActionButton, 1=PlayerTouch, 2=EventTouch, 3=Autorun, 4=Parallel

  // Solo si el trigger actual es de tipo contacto físico
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

      // Reset cuando el jugador sale del área
      if (!touching && event._playerInside) {
        event._playerInside = false;
      }
    }

    // Reset flags de salto al tocar suelo
    if (grounded) player._jumpEventFlags = {};

    // Guardar Y anterior para siguiente frame
    player._prevRealY = player._realY;
	
	// === Forzar centrado de cámara en el jugador ===
if (active && SceneManager._scene instanceof Scene_Map) {
  $gameMap.setDisplayPos(
    player._realX - ($gameMap.screenTileX() / 2),
    player._realY - ($gameMap.screenTileY() / 2)
  );
}

//Plataforma
// === Plataforma elevadora por ID ===
// Cambia este número por el ID real de tu evento en el mapa
const PLATAFORMA_ID = 63;
const plataforma = $gameMap.event(PLATAFORMA_ID);

if (plataforma) {
  // Inicializar valores base una sola vez
  if (plataforma._baseY === undefined) {
    plataforma._baseY = plataforma._realY;
    plataforma._directionUp = true;
  }

  const AMPLITUD = 3;     // Cuántos tiles sube/baja desde su posicion origen
  const VELOCIDAD = 0.03; // Velocidad vertical por frame

  // Movimiento oscilante arriba/abajo
  if (plataforma._directionUp) {
    plataforma._realY -= VELOCIDAD;
    if (plataforma._realY <= plataforma._baseY - AMPLITUD) plataforma._directionUp = false;
  } else {
    plataforma._realY += VELOCIDAD;
    if (plataforma._realY >= plataforma._baseY + AMPLITUD) plataforma._directionUp = true;
  }

  plataforma._y = plataforma._realY;

  // Guardar la posición anterior para mover al jugador con ella
  if (plataforma._prevRealY === undefined) plataforma._prevRealY = plataforma._realY;

  // Detección del jugador encima de la plataforma
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
    // Mantener al jugador justo encima
    player._realY = ey - 1;
    // Mover al jugador junto con la plataforma
    player._realY += plataforma._realY - plataforma._prevRealY;
  }

  plataforma._prevRealY = plataforma._realY;
}


  }

  // Tecla espacio para saltar
  Input.keyMapper[32] = "jump";

//Comprobar si el Game_Map lo tiene este plugin
  const _setupCheck = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId) {
  console.log("Interceptado setup del mapa desde Plataformas2D");
  _setupCheck.call(this, mapId);
};
// === Reforzar hook de setup del mapa ===
const _setupAlias_Plataformas2D = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId) {
  _setupAlias_Plataformas2D.call(this, mapId);
  try {
    console.log("Interceptado setup del mapa desde Plataformas2D (hook reforzado)");
    if ($dataMapInfos && $dataMapInfos[mapId]) {
      const mapName = $dataMapInfos[mapId].name.toLowerCase();
      active = mapName.includes("2d");
      console.log("Mapa cargado:", mapName, "Modo plataforma activo:", active);
    }
  } catch (e) {
    console.warn("Error en hook Plataformas2D:", e);
  }
};

})();