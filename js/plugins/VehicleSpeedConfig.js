/*:
 * @target MZ
 * @plugindesc Cambia la velocidad de Boat/Ship/Airship desde parámetros y comandos de plugin.
 * @author 3DalbiX
 *
 * @param Boat Speed
 * @type number
 * @min 1
 * @max 8
 * @default 4
 * @desc Velocidad del Boat (bote). Por defecto 4.
 *
 * @param Ship Speed
 * @type number
 * @min 1
 * @max 8
 * @default 5
 * @desc Velocidad del Ship (barco). Por defecto 5.
 *
 * @param Airship Speed
 * @type number
 * @min 1
 * @max 8
 * @default 6
 * @desc Velocidad del Airship (aeronave). Por defecto 6.
 *
 * @command SetVehicleSpeed
 * @text Set Vehicle Speed
 * @desc Cambia en tiempo real la velocidad de un vehículo.
 * @arg Type
 * @type select
 * @option boat
 * @option ship
 * @option airship
 * @default ship
 * @arg Speed
 * @type number
 * @min 1
 * @max 8
 * @default 5
 *
 * @help
 * - Coloca este archivo como: VehicleSpeedConfig.js
 * - Ajusta las velocidades en los parámetros del plugin.
 * - También puedes usar el comando de plugin "Set Vehicle Speed" para
 *   cambiar la velocidad durante la partida (por eventos).
 *
 * Nota: Pon este plugin DEBAJO de otros plugins que modifiquen vehículos
 * (VisuStella, etc.) para que su velocidad final sea la de este plugin.
 */

(() => {
  const pluginName = "VehicleSpeedConfig";
  const params = PluginManager.parameters(pluginName);

  let BOAT_SPEED    = Number(params["Boat Speed"] || 4);
  let SHIP_SPEED    = Number(params["Ship Speed"] || 5);
  let AIRSHIP_SPEED = Number(params["Airship Speed"] || 6);

  // Comando para cambiar en tiempo real
  PluginManager.registerCommand(pluginName, "SetVehicleSpeed", args => {
    const type  = String(args.Type || "ship");
    const speed = Number(args.Speed || 5);
    if (type === "boat")      BOAT_SPEED = speed;
    if (type === "ship")      SHIP_SPEED = speed;
    if (type === "airship")   AIRSHIP_SPEED = speed;

    // Actualiza la moveSpeed de los vehículos existentes para mantener la animación coherente
    if ($gameMap && $gameMap.boat) {
      $gameMap.boat().setMoveSpeed($gameMap.boat().speed());
      $gameMap.ship().setMoveSpeed($gameMap.ship().speed());
      $gameMap.airship().setMoveSpeed($gameMap.airship().speed());
    }
  });

  // Usa nuestras velocidades para el cálculo real del jugador en vehículo
  Game_Vehicle.prototype.speed = function() {
    if (this._type === "boat")    return BOAT_SPEED;
    if (this._type === "ship")    return SHIP_SPEED;
    if (this._type === "airship") return AIRSHIP_SPEED;
    return 4;
  };

  // Cuando el motor asigna el tipo, sincronizamos moveSpeed para que la animación vaya acorde
  const _Game_Vehicle_setType = Game_Vehicle.prototype.setType;
  Game_Vehicle.prototype.setType = function(type) {
    _Game_Vehicle_setType.call(this, type);
    this.setMoveSpeed(this.speed());
  };
})();
