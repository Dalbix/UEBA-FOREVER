/*:
 * @target MZ
 * @plugindesc Exportar/Importar saves de forma fiable en Web/IIS/WebView. Añade un menú "Save Manager" con subopciones. 
 * @author 3DalbiX
 *
 * @help
 * Este plugin añade un menú "Save Manager" al menú principal,
 * situado justo debajo de "Guardar".
 *
 * Dentro de "Save Manager" encontrarás dos subopciones:
 * - Exportar Save: permite elegir ranura y descargarla.
 * - Importar Save: permite elegir ranura y cargar desde archivo.
 *
 * Funciona en navegadores, IIS y Android WebView, incluso si IndexedDB falla.
 */

(() => {

    // ============================================================
    // EXPORTAR SAVE
    // ============================================================
    StorageManager.exportSaveMemory = async function(savefileId) {
        try {
            const ok = await DataManager.loadGame(savefileId);
            const saveData = DataManager.makeSaveContents();
            console.log(ok ? `Exportando ranura ${savefileId} desde disco` : `Ranura ${savefileId} vacía → exportando estado actual`);

            const text = (typeof JsonEx !== "undefined") ? JsonEx.stringify(saveData) : JSON.stringify(saveData);

            const blob = new Blob([text], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `save${savefileId}.rmmzsave`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`Partida exportada en ranura ${savefileId}`);
        } catch (e) {
            console.error(e);
            alert("Error al exportar la partida.");
        }
    };

    // ============================================================
    // IMPORTAR SAVE
    // ============================================================
    StorageManager.importSaveMemory = function(savefileId, file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = async () => {
            const raw = reader.result;
            try {
                let data;
                if (StorageManager && StorageManager.jsonToObject) {
                    data = await StorageManager.jsonToObject(raw);
                } else if (typeof JsonEx !== "undefined") {
                    try {
                        data = JsonEx.parse(raw);
                    } catch (e) {
                        data = JSON.parse(raw);
                    }
                } else {
                    data = JSON.parse(raw);
                }

                DataManager.createGameObjects();
                DataManager.extractSaveContents(data);
                DataManager.correctDataErrors && DataManager.correctDataErrors();

                await DataManager.saveGame(savefileId);

                DataManager.loadAllSavefileImages && DataManager.loadAllSavefileImages();
                $gameSystem && $gameSystem.onAfterLoad && $gameSystem.onAfterLoad();

                alert(`Partida importada y guardada en ranura ${savefileId}.`);
                console.log(`Importado en ranura ${savefileId} correctamente.`);
            } catch (e) {
                console.error(e);
                alert("Error al importar: archivo inválido o corrupto.");
            }
        };
    };

// ============================================================
// COMANDO "SAVE MANAGER" EN EL MENÚ PRINCIPAL
// ============================================================
const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
Window_MenuCommand.prototype.makeCommandList = function() {
    _Window_MenuCommand_makeCommandList.call(this);

    // reconstruir la lista para insertar debajo de "Guardar"
    const newList = [];
    for (let i = 0; i < this._list.length; i++) {
        newList.push(this._list[i]);
        if (this._list[i].symbol === "save") {
            // justo después de Guardar
            newList.push({ name: "Save Manager", symbol: "saveManager", enabled: true, ext: null });
        }
    }
    this._list = newList;
};

const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler("saveManager", () => SceneManager.push(Scene_SaveManager));
};

// ============================================================
// ESCENA DEL SUBMENÚ SAVE MANAGER
// ============================================================
function Scene_SaveManager() { this.initialize(...arguments); }
Scene_SaveManager.prototype = Object.create(Scene_MenuBase.prototype);
Scene_SaveManager.prototype.constructor = Scene_SaveManager;

Scene_SaveManager.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createCommandWindow();
};

Scene_SaveManager.prototype.createCommandWindow = function() {
    const rect = this.commandWindowRect();
    this._commandWindow = new Window_SaveManagerCommand(rect);
    this._commandWindow.setHandler("exportSave", () => SceneManager.push(Scene_ExportSave));
    this._commandWindow.setHandler("importSave", () => SceneManager.push(Scene_ImportSave));
    this._commandWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._commandWindow);
};

Scene_SaveManager.prototype.commandWindowRect = function() {
    const ww = 240;
    const wh = this.calcWindowHeight(2, true);
    const wx = (Graphics.boxWidth - ww) / 2;
    const wy = (Graphics.boxHeight - wh) / 2;
    return new Rectangle(wx, wy, ww, wh);
};

function Window_SaveManagerCommand() { this.initialize(...arguments); }
Window_SaveManagerCommand.prototype = Object.create(Window_Command.prototype);
Window_SaveManagerCommand.prototype.constructor = Window_SaveManagerCommand;

Window_SaveManagerCommand.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
};

Window_SaveManagerCommand.prototype.makeCommandList = function() {
    this.addCommand("Exportar Save", "exportSave");
    this.addCommand("Importar Save", "importSave");
};


    // ============================================================
    // ESCENAS DE EXPORTAR / IMPORTAR 
    // ============================================================
    function Scene_ExportSave() { this.initialize(...arguments); }
    Scene_ExportSave.prototype = Object.create(Scene_File.prototype);
    Scene_ExportSave.prototype.constructor = Scene_ExportSave;
    Scene_ExportSave.prototype.onSavefileOk = function() {
        const savefileId = this.savefileId();
        console.log("Export Save seleccionado en ranura", savefileId);
        StorageManager.exportSaveMemory(savefileId);
        this.popScene();
    };

    function Scene_ImportSave() { this.initialize(...arguments); }
    Scene_ImportSave.prototype = Object.create(Scene_File.prototype);
    Scene_ImportSave.prototype.constructor = Scene_ImportSave;
    Scene_ImportSave.prototype.onSavefileOk = function() {
        const savefileId = this.savefileId();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".rmmzsave,.json";
        input.onchange = e => {
            const file = e.target.files[0];
            if (file) StorageManager.importSaveMemory(savefileId, file);
        };
        input.click();
        this.popScene();
    };

})();
