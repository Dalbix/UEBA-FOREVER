/*:
 * @target MZ
 * @plugindesc Temporizador personalizado con texto grande verde, parámetro para ID evento común y funciones start/stop/show/hide/destroy.
 * @author 3DalbiX
 *
 *
 * @help
 * Controla un temporizador independiente.
 * Usa startTimer(segundos), stopTimer(), showTimer(), hideTimer(), destroyTimer() para manejarlo.
 */

(() => {
  // Ya no usamos parámetro global para el Common Event
  //const parameters = PluginManager.parameters('CustomTimerPlugin');
  //const COMMON_EVENT_ID = Number(parameters.CommonEventId) || 0;

  const MARGIN_BOTTOM = 80;//40;
  const MARGIN_TOP = 20;
  let _blockTimerRestart = false;
  let _timerDuration = 0;
  let _timerRemaining = 0;
  let _timerRunning = false;
  let _timerVisible = true;
  let _timerSprite = null;
  let _commonEventId = 0; // Guardamos aquí el id que se pasa en startTimer

function createTimerSprite() {
  if (_timerSprite) return;

  const bmp = new Bitmap(Graphics.width, 100); // tamaño fijo
  _timerSprite = new Sprite(bmp);
  _timerSprite.x = 0;
  _timerSprite.y = MARGIN_TOP; // parte superior
  _timerSprite.visible = _timerVisible;

  updateTimerText();

  const scene = SceneManager._scene;
  if (scene && scene.addChild) {
    scene.addChild(_timerSprite);
  }
}

function updateTimerText() {
  if (!_timerSprite || !_timerSprite.bitmap || !_timerSprite.parent) return;

  const bmp = _timerSprite.bitmap;
  bmp.clear();

  const minutes = Math.floor(_timerRemaining / 60);
  const seconds = _timerRemaining % 60;
  const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  bmp.fontSize = 48;
  bmp.fontFace = 'Arial';

  const textWidth = bmp.measureTextWidth(timeText);
  const boxWidth = textWidth + 40;
  const boxHeight = 72;

  const bgColor = (_timerRemaining <= 10)
    ? 'rgba(255, 0, 0, 0.6)'
    : 'rgba(0, 255, 0, 0.6)';

  const x = (Graphics.width - boxWidth) / 2;
  const y = 0;

  bmp.fillRect(x, y, boxWidth, boxHeight, bgColor);
  bmp.drawText(timeText, x, 10, boxWidth, boxHeight - 10, 'center');

  _timerSprite.x = 0;
  _timerSprite.y = MARGIN_TOP;
}


  // Ahora el id del evento común se pasa en startTimer
window.startTimer = function(seconds, commonEventId = 0) {
	
	_blockTimerRestart = false;
	console.trace();
  if (!seconds || seconds <= 0) return;
  createTimerSprite();
  _timerDuration = seconds;
  _timerRemaining = seconds;
  _timerRunning = true;
  _timerVisible = true;
  _commonEventId = commonEventId || 0;

  // Guardar el tiempo original y evento común en gameSystem
  $gameSystem._customTimerData = {
    duration: seconds,
    eventId: _commonEventId
  };

  if (_timerSprite) _timerSprite.visible = true;
  updateTimerText();
  console.log(`Temporizador iniciado: ${seconds}s, evento común ID: ${_commonEventId}`);
};

window.stopTimer = function() {
  _timerRunning = false;
  _timerVisible = false;
  if (_timerSprite) _timerSprite.visible = false;

  // Elimina datos persistentes para evitar reinicio automático
  $gameSystem._customTimerData = null;

  console.log('Temporizador detenido y datos borrados');
};
  window.pauseTimer = function() {
    if (_timerRunning) {
      _timerRunning = false;
      console.log('Temporizador pausado');
    }
  };

  window.continueTimer = function() {
    if (!_timerRunning && _timerRemaining > 0) {
      _timerRunning = true;
      console.log('Temporizador reanudado');
    }
  };

  window.showTimer = function() {
    _timerVisible = true;
    if (_timerSprite) _timerSprite.visible = true;
    console.log('Temporizador visible');
  };

  window.hideTimer = function() {
    _timerVisible = false;
    if (_timerSprite) _timerSprite.visible = false;
    console.log('Temporizador oculto');
  };

window.destroyTimer = function() {
  destroyTimerSpriteOnly();
  _timerRunning = false;
  _timerVisible = false;
  _timerDuration = 0;
  _timerRemaining = 0;
  _commonEventId = 0;
  _blockTimerRestart = true; // ← clave para impedir reaparición
  // Elimina los datos del sistema para que no se restaure automáticamente
  $gameSystem._customTimerData = null;
   // delete $gameSystem._customTimerData;
console.log($gameSystem._customTimerData); // debería ser null
  console.log('Temporizador destruido');
};
  function recreateTimerSprite() {
  destroyTimerSpriteOnly(); // eliminar sprite anterior sin borrar datos
  createTimerSprite();      // crear sprite de nuevo en la escena actual
}
function destroyTimerSpriteOnly() {
  if (_timerSprite) {
    const scene = SceneManager._scene;
    if (scene && scene.removeChild) {
      scene.removeChild(_timerSprite);
    }
    _timerSprite.bitmap?.destroy(); // destruimos el bitmap de forma segura
    _timerSprite = null;
  }
}
function destroyTimerSpriteOnly() {
  if (_timerSprite) {
    try {
      const scene = SceneManager._scene;
      if (scene && scene.removeChild && _timerSprite.parent) {
        scene.removeChild(_timerSprite);
      }
      _timerSprite.bitmap?.destroy(); // destruye bitmap de forma segura
    } catch (e) {
      console.warn('Error eliminando sprite de temporizador:', e);
    }
    _timerSprite = null;
  }
}
/*const _Scene_Map_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
  _Scene_Map_start.call(this);

  // Si el temporizador sigue activo, recreamos el sprite completamente
  if (_timerRunning) {
  // recrea si el sprite no existe o su bitmap está dañado
  if (!_timerSprite || !_timerSprite.bitmap) {
    recreateTimerSprite();
  }
}
};*/
const _Scene_Map_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
  _Scene_Map_start.call(this);
  
  if (_blockTimerRestart) {
    console.log('Reinicio de temporizador bloqueado por _blockTimerRestart');
    return;
  }
  const data = $gameSystem._customTimerData;

  // Si no hay datos válidos, salimos
  if (!data || typeof data !== 'object' || !data.duration || data.duration <= 0) {
    return;
  }

  if (_timerRunning) {
    // Solo recreamos sprite si hace falta
    if (!_timerSprite || !_timerSprite.bitmap || !_timerSprite.parent) {
      recreateTimerSprite();
    }
  } else {
    // Reiniciamos el temporizador desde los datos
    startTimer(data.duration, data.eventId);
  }
};

const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
  _Scene_Map_update.call(this);

  // Restaurar el temporizador con seguridad
  if (this._shouldRestoreTimer) {
    const data = $gameSystem._customTimerData;
    if (data) {
      startTimer(data.duration, data.eventId);
    }
    this._shouldRestoreTimer = false;
  }

  if (!_timerSprite) return;

  if (_timerRunning && _timerRemaining > 0) {
    if (Graphics.frameCount % 60 === 0) {
      _timerRemaining--;
      updateTimerText();

      if (_timerRemaining <= 0) {
        _timerRemaining = 0;
        _timerRunning = false;
        if (_commonEventId > 0) {
          $gameTemp.reserveCommonEvent(_commonEventId);
        }
        console.log('Temporizador terminado!');
      }
    }
  }
};

const _Scene_Load_onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
Scene_Load.prototype.onLoadSuccess = function() {
  _Scene_Load_onLoadSuccess.call(this);

  if (_blockTimerRestart) {
    console.log('No se reinicia el temporizador por _blockTimerRestart');
    return;
  }

  const data = $gameSystem._customTimerData;
  if (data) {
    // Resetea sin llamar a destroyTimer()
    _timerRunning = false;
    _timerRemaining = data.duration;
    _timerDuration = data.duration;
    _commonEventId = data.eventId;

    // Fuerza crear sprite si no existe o está roto
    if (!_timerSprite || !_timerSprite.bitmap || !_timerSprite.parent) {
      recreateTimerSprite();
    }

    // Inicia desde cero
    startTimer(data.duration, data.eventId);
  }
};


window.isTimerRunning = function() {
  return _timerRunning === true;
};
})();
