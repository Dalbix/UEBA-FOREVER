/*:
 * @target MZ
 * @plugindesc Reproduce un SE en bucle mientras el jugador camina. Soporta duración (en segundos) y volumen personalizados. Se detiene al dejar de caminar o con stopLoop().
 * @author 3DalbiX
 *
 * @help
 * Llama a:
 *   SoundOnMove.startLoop("NombreDelSE", duraciónEnSegundos, volumen);
 *     - duraciónEnSegundos: opcional (por defecto: 1)
 *     - volumen: opcional (por defecto: 90)
 *
 *   SoundOnMove.stopLoop(); // Detiene el bucle
 *
 * El SE debe estar en la carpeta audio/se.
 */

(() => {
    const SoundOnMove = {
        _enabled: false,
        _seName: "",
        _isPlaying: false,
        _intervalId: null,
        _loopTimer: null,
        _loopDuration: 1000, // en ms
        _volume: 90,

        startLoop(seName, durationSec = 1, volume = 90) {
            this._seName = seName;
            this._loopDuration = durationSec * 1000; // Convertimos a milisegundos
            this._volume = volume;
            this._enabled = true;
            this._startCheckLoop();
        },

        stopLoop() {
            this._enabled = false;
            this._stopSELoop();
        },

        _startCheckLoop() {
            if (this._intervalId) return; // Ya está corriendo
            this._intervalId = setInterval(() => {
                const player = $gamePlayer;
                if (!this._enabled) {
                    this._stopSELoop();
                    clearInterval(this._intervalId);
                    this._intervalId = null;
                    return;
                }

                if (player.isMoving()) {
                    if (!this._isPlaying) {
                        this._playSELoop();
                    }
                } else {
                    if (this._isPlaying) {
                        this._stopSELoop();
                    }
                }
            }, 100);
        },

        _playSELoop() {
            if (this._seName) {
                this._isPlaying = true;
                AudioManager.playSe({
                    name: this._seName,
                    volume: this._volume,
                    pitch: 100,
                    pan: 0
                });
                this._loopTimer = setInterval(() => {
                    AudioManager.playSe({
                        name: this._seName,
                        volume: this._volume,
                        pitch: 100,
                        pan: 0
                    });
                }, this._loopDuration);
            }
        },

        _stopSELoop() {
            this._isPlaying = false;
            clearInterval(this._loopTimer);
            this._loopTimer = null;
        }
    };

    window.SoundOnMove = SoundOnMove;
})();