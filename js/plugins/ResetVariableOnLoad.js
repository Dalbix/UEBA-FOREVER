/*:
 * @target MZ
 * @plugindesc Resetea una variable seleccionable a 0 cada vez que se carga una partida.
 * @author 3DalbiX
 *
 * @param sessionVariable
 * @text Variable de sesión
 * @type variable
 * @desc Variable que se pondrá a 0 cada vez que se carga una partida.
 * @default 0
 *
 * @help
 * La variable seleccionada se reinicia a 0
 * cada vez que se carga una partida.
 *
 * Uso típico:
 * - Eventos que deben ejecutarse una vez por carga
 * - Flags de sesión
 * - Control de eventos paralelos
 */

(() => {

    const pluginName = document.currentScript.src
        .split('/')
        .pop()
        .replace('.js', '');

    const params = PluginManager.parameters(pluginName);
    const sessionVariableId = Number(params.sessionVariable || 0);

    if (sessionVariableId > 0) {

        const _extractSaveContents = DataManager.extractSaveContents;
        DataManager.extractSaveContents = function(contents) {
            _extractSaveContents.call(this, contents);

            // AQUÍ ya existen $gameVariables y compañía
            $gameVariables.setValue(sessionVariableId, 0);
        };
    }

})();
