/*:
 * @target MZ
 * @plugindesc Control completo del autosave: permite desactivarlo temporalmente sin interferir con los guardados normales (compatible MZ 1.6+)
 * @author 3DalbiX
 *
 * @command EnableAutosave
 * @text Activar autosave
 *
 * @command DisableAutosave
 * @text Desactivar autosave
 *
 * @help
 * Este plugin bloquea el autosave incluso cuando está activado en Sistema 2,
 * pero solo mientras esté deshabilitado manualmente mediante comando o script.
 *
 * ✅ Compatible con RPG Maker MZ 1.6 y 1.7.
 *
 * Uso:
 *  - Plugin Command → "Desactivar autosave"
 *  - Transfer Player o cualquier cambio de mapa
 *  - Plugin Command → "Activar autosave"
 *
 * También puedes usar por script:
 *   $gameSystem._autosaveAllowed = false; // bloquea temporalmente
 *   $gameSystem._autosaveAllowed = true;  // permite autosave
 */

(() => {
  const pluginName = "Control_Autosave";

  // Asegurar compatibilidad incluso antes de cargar partida
  const isAutosaveAllowed = () => {
    return !$gameSystem || $gameSystem._autosaveAllowed !== false;
  };

  // Inicialización de la bandera
  const _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this._autosaveAllowed = true;
  };

  // Comandos de plugin
  PluginManager.registerCommand(pluginName, "EnableAutosave", () => {
    if ($gameSystem) $gameSystem._autosaveAllowed = true;
    console.log("[PLUGIN] Autosave habilitado");
  });

  PluginManager.registerCommand(pluginName, "DisableAutosave", () => {
    if ($gameSystem) $gameSystem._autosaveAllowed = false;
    console.log("[PLUGIN] Autosave deshabilitado");
  });

  // Interceptar autosave
  const _DataManager_autosave = DataManager.autosave;
  DataManager.autosave = async function() {
    if (!isAutosaveAllowed()) {
      console.log("[PLUGIN] Autosave cancelado (bloque temporal activo).");
      return Promise.resolve(false);
    }
    return _DataManager_autosave.call(this);
  };

  // Interceptar saveGame (para asegurar bloqueo de slot 0)
  const _DataManager_saveGame = DataManager.saveGame;
  DataManager.saveGame = async function(savefileId) {
    if (
      savefileId === 0 && // slot de autosave
      !isAutosaveAllowed()
    ) {
      console.log("[PLUGIN] Guardado automático bloqueado (slot 0).");
      return Promise.resolve(false);
    }
    return _DataManager_saveGame.call(this, savefileId);
  };
})();
