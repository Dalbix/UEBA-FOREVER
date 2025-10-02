/*:
 * @target MZ
 * @plugindesc Comando para forzar autoguardado (slot 0) desde eventos. 🧠
 * @author ChatGPT
 *
 * @command ForceAutosave
 * @text Forzar autoguardado
 * @desc Guarda automáticamente en el slot 0 (autosave).
 *
 * @help
 * Este plugin añade un comando de plugin llamado "Forzar autoguardado".
 * Guarda en el slot 0, que es el usado para autoguardado en RPG Maker MZ.
 * 
 * No tiene parámetros. Simplemente úsalo desde el menú de comandos de plugin.
 */

(() => {
  PluginManager.registerCommand("ForceAutosave", "ForceAutosave", () => {
    DataManager.saveGame(0);
  });
})();
