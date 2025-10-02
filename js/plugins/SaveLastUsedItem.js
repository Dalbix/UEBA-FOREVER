/*:
 * @target MZ
 * @plugindesc Guarda el ID del objeto que invoca un evento común en una variable seleccionable.
 * @author 3DalbiX
 *
 * @param VariableID
 * @text Variable para guardar ID del objeto
 * @type variable
 * @desc Se guardará aquí el ID del objeto que invoca el evento común
 * @default 20
 *
 * @help
 * Este plugin guarda automáticamente en una variable el ID del objeto (item)
 * que ha sido usado justo antes de activar un Evento Común desde su lista de efectos.
 * 
 * Esto te permite saber qué objeto llamó al evento común cuando múltiples objetos
 * comparten el mismo evento.
 *
 * - Solo afecta a objetos que tienen efecto de tipo "Evento Común".
 * - El ID del objeto se guarda en la variable configurada en el plugin.
 *
 * No requiere comandos en eventos ni llamadas manuales.
 */

(() => {
  const pluginName = "SaveLastUsedItem";

  const parameters = PluginManager.parameters(pluginName);
  const variableId = Number(parameters["VariableID"] || 20);

  const _Game_Action_applyItemUserEffect = Game_Action.prototype.applyItemUserEffect;
  Game_Action.prototype.applyItemUserEffect = function(target) {
    const item = this.item();
    if (item && item.effects) {
      const hasCommonEvent = item.effects.some(effect => effect.code === Game_Action.EFFECT_COMMON_EVENT);
      if (hasCommonEvent) {
        $gameVariables.setValue(variableId, item.id); // Guarda ID del objeto usado
      }
    }
    _Game_Action_applyItemUserEffect.call(this, target);
  };
})();