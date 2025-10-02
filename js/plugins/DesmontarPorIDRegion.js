/*:
 * @target MZ
 * @plugindesc Bloquea aterrizaje del airship en regiones específicas y marca internamente el intento para usarlo con un evento común. Por defecto: región 11.
 * @author 3DalbiX
 *
 * @param RestrictRegions
 * @text Regiones Prohibidas
 * @desc Lista de ID de regiones donde no se puede aterrizar con el airship. Ej: 11,12
 * @default 11
 *
 * @help
 * Este plugin impide aterrizar el airship en regiones específicas (por defecto: 11).
 * Cuando el aterrizaje es bloqueado, marca una variable interna que puede ser leída
 * por un Evento Común en paralelo para mostrar un mensaje, SE, etc.
 *
 * Cómo usar:
 * - Pinta los tiles prohibidos con las regiones.
 * - Crea un Evento Común (tipo paralelo) con condición de que:
 *      $gameSystem._airshipLandingBlocked === true
 * - Dentro del evento, muestra el mensaje, SE, etc., y luego haz:
 *      Script: $gameSystem._airshipLandingBlocked = false;
 */

(() => {
    const params = PluginManager.parameters("AirshipRegionRestrict");
    const restrictedRegions = (params["RestrictRegions"] || "11")
        .split(",")
        .map(id => Number(id.trim()))
        .filter(id => !isNaN(id));

    // Extiende isLandOk para bloquear aterrizaje en regiones prohibidas
    const _Game_Vehicle_isLandOk = Game_Vehicle.prototype.isLandOk;
    Game_Vehicle.prototype.isLandOk = function(x, y, d) {
        if (this._type === "airship") {
            const regionId = $gameMap.regionId(x, y);
            if (restrictedRegions.includes(regionId)) {
                $gameMessage.setFaceImage("Actor1", 1);
                $gameMessage.add(
                    "¡No puedes aterrizar aqui!\n" +
                    "Estamos demasiado cerca,\n" +
                    "la bolera está detras del ayuntamiento.\n" +
                    "Busca un sitio mas escondido."
                );
				AudioManager.playSe({ name: "Audios/pasado1/AntonAterrizajeValencia", volume: 100, pitch: 100, pan: 0 });
                return false;
            }
        }
        return _Game_Vehicle_isLandOk.call(this, x, y, d);
    };

})();