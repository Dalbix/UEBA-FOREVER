/*:
 * @target MZ
 * @plugindesc Controla el volumen de Sound Effects (SE) en tiempo real mediante IDs.
 * @author 3DalbiX
 *
 * @command PlaySE
 * @text Play SE with ID
 * @desc Reproduce un SE con un ID para poder controlarlo luego.
 *
 * @arg id
 * @type string
 * @desc Identificador único del SE.
 *
 * @arg name
 * @type file
 * @dir audio/se/
 * @desc Archivo de sonido.
 *
 * @arg volume
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @arg pitch
 * @type number
 * @default 100
 *
 * @arg pan
 * @type number
 * @default 0
 *
 * @command SetVolume
 * @text Set SE Volume
 * @desc Cambia el volumen de un SE que está sonando.
 *
 * @arg id
 * @type string
 *
 * @arg volume
 * @type number
 * @min 0
 * @max 100
 *
 * @command FadeVolume
 * @text Fade SE Volume
 * @desc Hace un fade de volumen.
 *
 * @arg id
 * @type string
 *
 * @arg volume
 * @type number
 *
 * @arg duration
 * @type number
 * @desc Duración en frames (60 = 1 segundo)
 *
 * @command StopSE
 * @text Stop SE by ID
 * @desc Detiene un SE concreto.
 *
 * @arg id
 * @type string
 *
 * @command ClearBuffer
 * @text Clear SE Buffer
 * @desc Detiene y elimina el buffer de un SE.
 *
 * @arg id
 * @type string
 * @desc ID del SE a limpiar
 */

(() => {

const seBuffers = {};

function getBuffer(id) {
    return seBuffers[id];
}

PluginManager.registerCommand("ControlSE", "ClearBuffer", args => {
    const id = args.id;
    const buffer = seBuffers[id];

    if (buffer) {
        if (buffer.isPlaying()) {
            buffer.stop();
        }
        delete seBuffers[id];
    }
});
PluginManager.registerCommand("ControlSE", "PlaySE", args => {
    const id = args.id;

    const se = {
        name: args.name,
        volume: Number(args.volume),
        pitch: Number(args.pitch),
        pan: Number(args.pan)
    };

    // Reproduce usando el sistema oficial
    AudioManager.playSe(se);

    // Captura el último buffer SE creado
    const buffer = AudioManager._seBuffers[AudioManager._seBuffers.length - 1];

    if (buffer) {
        seBuffers[id] = buffer;
    }
});

PluginManager.registerCommand("ControlSE", "SetVolume", args => {
    const buffer = getBuffer(args.id);
    if (buffer) {
        buffer.volume = Number(args.volume) / 100;
    }
});

PluginManager.registerCommand("ControlSE", "FadeVolume", args => {
    const buffer = getBuffer(args.id);
    if (!buffer) return;

    const target = Number(args.volume) / 100;
    const duration = Number(args.duration);
    const start = buffer.volume;
    let frame = 0;

    const fade = () => {
        if (!buffer.isPlaying()) return;
        frame++;
        buffer.volume = start + (target - start) * (frame / duration);
        if (frame < duration) {
            requestAnimationFrame(fade);
        }
    };
    fade();
});

PluginManager.registerCommand("ControlSE", "StopSE", args => {
    const buffer = getBuffer(args.id);
    if (buffer) {
        buffer.stop();
        delete seBuffers[args.id];
    }
});

})();