/*:
 * @target MZ
 * @plugindesc Congela y desbloquea el movimiento del jugador + bloquea teclado y clics. 100% funcional en RPG Maker MZ.
 * @author 3DalbiX
 * 
 * @help
 * Uso:
 * En un evento, usa:
 * 
 * congelarJugador();    // Bloquea movimiento e input del jugador
 * activarJugador();     // Desbloquea todo
 */

(() => {
  let _jugadorCongelado = false;

  // Funciones globales
  window.congelarJugador = function () {
    _jugadorCongelado = true;

    // Ruta vacía para cortar movimientos automáticos
    const route = {
      list: [
        { code: 15, parameters: [1] },
        { code: 0 }
      ],
      repeat: false,
      skippable: false,
      wait: false
    };
    $gamePlayer.forceMoveRoute(route);
  };

  window.activarJugador = function () {
    _jugadorCongelado = false;
    $gamePlayer._moveRouteForcing = false;
  };

  // Sobrescribimos el update del jugador para evitar que se mueva
  const _Game_Player_canMove = Game_Player.prototype.canMove;
  Game_Player.prototype.canMove = function () {
    if (_jugadorCongelado) return false;
    return _Game_Player_canMove.call(this);
  };

  // También bloqueamos el movimiento táctil
  const _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
  Scene_Map.prototype.processMapTouch = function () {
    if (_jugadorCongelado) return; // no tocar mapa
    _Scene_Map_processMapTouch.call(this);
  };

})();

