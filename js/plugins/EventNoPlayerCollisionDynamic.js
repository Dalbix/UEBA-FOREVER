/*:
 * @target MZ
 * @plugindesc Eventos concretos pueden atravesar al jugador sin perder colisiones normales. IDs añadidos dinámicamente.
 * @author 3DalbiX
 *
 * @command Activar
 * @text Activar sistema
 *
 * @command Desactivar
 * @text Desactivar sistema
 *
 * @command AddEvento
 * @text Añadir evento
 * @arg id
 * @type number
 * @text ID del evento
 *
 * @command RemoveEvento
 * @text Quitar evento
 * @arg id
 * @type number
 * @text ID del evento
 *
 * @command Clear
 * @text Limpiar lista
 *
 * @help
 * Los eventos añadidos:
 * - No colisionan con el jugador
 * - Sí colisionan con tiles y otros eventos
 *
 * Se pueden añadir o quitar en cualquier momento.
 */

(() => {

  let enabled = true;
  const eventIdSet = new Set();

  PluginManager.registerCommand(
    "EventNoPlayerCollisionDynamic",
    "Activar",
    () => enabled = true
  );

  PluginManager.registerCommand(
    "EventNoPlayerCollisionDynamic",
    "Desactivar",
    () => enabled = false
  );

 /* PluginManager.registerCommand(
    "EventNoPlayerCollisionDynamic",
    "AddEvento",
    args => {
      const id = Number(args.id);
      if (!isNaN(id)) eventIdSet.add(id);
    }
  );*/
PluginManager.registerCommand(
  "EventNoPlayerCollisionDynamic",
  "AddEvento",
  args => {
    const ids = String(args.id)
      .replace(/[\[\]]/g, "")
      .split(",")
      .map(n => Number(n.trim()))
      .filter(n => !isNaN(n));

    for (const id of ids) {
      eventIdSet.add(id);
    }
  }
);
  PluginManager.registerCommand(
    "EventNoPlayerCollisionDynamic",
    "RemoveEvento",
    args => {
      const id = Number(args.id);
      eventIdSet.delete(id);
    }
  );

  PluginManager.registerCommand(
    "EventNoPlayerCollisionDynamic",
    "Clear",
    () => eventIdSet.clear()
  );

  // 🔑 AQUÍ está el cambio real
  const _canPass = Game_CharacterBase.prototype.canPass;

  Game_CharacterBase.prototype.canPass = function(x, y, d) {

    if (!enabled) {
      return _canPass.call(this, x, y, d);
    }

    const x2 = $gameMap.roundXWithDirection(x, d);
    const y2 = $gameMap.roundYWithDirection(y, d);

    // EVENTO marcado → puede pasar por el jugador
    if (
      this instanceof Game_Event &&
      eventIdSet.has(this.eventId()) &&
      $gamePlayer.pos(x2, y2)
    ) {
      return true;
    }

    // JUGADOR → puede pasar por eventos marcados
    if (this === $gamePlayer) {
      const events = $gameMap.eventsXyNt(x2, y2);
      for (const ev of events) {
        if (eventIdSet.has(ev.eventId())) {
          return true;
        }
      }
    }

    return _canPass.call(this, x, y, d);
  };
  // Exponer el set globalmente para otros plugins
window.EventNoPlayerCollisionDynamic = {
    eventIdSet: eventIdSet
};

})();
