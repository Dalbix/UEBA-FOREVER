/*:
 * @target MZ
 * @plugindesc Video anclado a coordenadas del mapa (X/Y), con auto-pausa/ocultar en menús y control de volumen. 
 * @author 3DalbiX
 *
 * @command playVideoAtXY
 * @text Play Video at Map XY
 * @desc Reproduce un video en coordenadas concretas del mapa.
 *
 * @arg filename
 * @text Video Filename
 * @desc Nombre del archivo en /movies (sin extensión).
 * @type string
 *
 * @arg posX
 * @text Position X (px)
 * @desc Coordenada X en píxeles del mapa.
 * @type number
 * @default 0
 *
 * @arg posY
 * @text Position Y (px)
 * @desc Coordenada Y en píxeles del mapa.
 * @type number
 * @default 0
 *
 * @arg width
 * @text Width
 * @desc Ancho del video en píxeles.
 * @type number
 * @default 96
 *
 * @arg height
 * @text Height
 * @desc Alto del video en píxeles.
 * @type number
 * @default 96
 *
 * @arg volume
 * @text Volume
 * @desc Volumen del video (0-100).
 * @type number
 * @default 100
 *
 * @arg loop
 * @text Loop Video
 * @desc ¿Repetir el video en bucle? (true = sí, false = solo una vez)
 * @type boolean
 * @default true
 *
 * @command pauseVideo
 * @text Pause Video
 * @desc Pausa y oculta el video manualmente.
 *
 * @command resumeVideo
 * @text Resume Video
 * @desc Reanuda y muestra el video manualmente.
 *
 * @command stopVideo
 * @text Stop Video
 * @desc Detiene y elimina el video.
 *
 * @command setVideoVolume
 * @text Set Video Volume
 * @desc Cambia dinámicamente el volumen del video en reproducción.
 *
 * @arg volume
 * @text Volume
 * @desc Volumen del video (0-100)
 * @type number
 * @default 100
 */

(() => {
  const PLUGIN_NAME = "SmallVideoPlayer";

  let videoElement = null;
  let videoCoords = null;          // {x, y} en tiles
  let forcePaused = false;         // Pausa forzada por comando

  // --- Utils ---
  function mapIsReady() {
    return $gameMap && $gameMap._mapId > 0;
  }

function updateVideoPosition() {
  if (!videoElement || !videoCoords || !mapIsReady()) return;

  // 1) Posición base (coordenadas lógicas de RPG Maker, sin zoom)
  const tw = $gameMap.tileWidth();
  const th = $gameMap.tileHeight();
const baseX = $gameMap.adjustX(videoCoords.x / $gameMap.tileWidth()) * $gameMap.tileWidth();
const baseY = $gameMap.adjustY(videoCoords.y / $gameMap.tileHeight()) * $gameMap.tileHeight();

  // 2) Aplicar el zoom interno del mapa alrededor del centro de zoom
  const zoom = ($gameScreen.zoomScale && $gameScreen.zoomScale()) || 1.0;
  const cx   = ($gameScreen.zoomX && $gameScreen.zoomX()) || Graphics.width  / 2;
  const cy   = ($gameScreen.zoomY && $gameScreen.zoomY()) || Graphics.height / 2;

  const zx = cx + (baseX - cx) * zoom; // coords lógicas ya con zoom
  const zy = cy + (baseY - cy) * zoom;

  // 3) Pasar de coords lógicas a coords de página (tener en cuenta escala + offset del canvas)
  const rect   = Graphics._canvas.getBoundingClientRect();
  const scaleX = rect.width  / Graphics.width;   // == Graphics._realScale
  const scaleY = rect.height / Graphics.height;  // idem

  const pageX = rect.left + zx * scaleX;
  const pageY = rect.top  + zy * scaleY;

  // 4) Posicionar y escalar el <video> para que coincida con el mapa
  videoElement.style.left = Math.round(pageX) + "px";
  videoElement.style.top  = Math.round(pageY) + "px";
  videoElement.style.transform = `scale(${zoom * scaleX}, ${zoom * scaleY})`;
  videoElement.style.transformOrigin = "top left";
}
  function ensureVisibilityByScene() {
    if (!videoElement) return;

    const scene = SceneManager._scene;
    const onMap = scene instanceof Scene_Map && mapIsReady() && scene._windowLayer;
    const shouldShow = onMap && !forcePaused;

    if (shouldShow) {
      if (videoElement.style.display !== "block") {
        videoElement.style.display = "block";
      }
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
      }
      updateVideoPosition();
    } else {
      if (!videoElement.paused) videoElement.pause();
      if (videoElement.style.display !== "none") {
        videoElement.style.display = "none";
      }
    }
  }

  // --- Hook al bucle principal ---
  const _SceneManager_updateMain = SceneManager.updateMain;
  SceneManager.updateMain = function() {
    _SceneManager_updateMain.call(this);
    ensureVisibilityByScene();
  };

  // --- Reposicionar cada frame en el mapa ---
  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    updateVideoPosition();
  };

  // --- Commands ---
  PluginManager.registerCommand(PLUGIN_NAME, "playVideoAtXY", args => {
    const filename = args.filename;

    const width = Number(args.width || 96);
    const height = Number(args.height || 96);
    const volume = Math.min(Math.max(Number(args.volume ?? 100), 0), 100) / 100;
const posX = Number(args.posX || 0);
const posY = Number(args.posY || 0);
    const loop = args.loop === "true"; // convierte a boolean

    if (videoElement) {
      document.body.removeChild(videoElement);
      videoElement = null;
    }

videoCoords = { x: posX, y: posY }; // <- en píxeles, no en tiles
    forcePaused = false;

    const v = document.createElement("video");
    v.src = "movies/" + filename + ".webm";
    v.style.position = "absolute";
    v.width = width;
    v.height = height;
    v.autoplay = true;
    v.loop = loop;
    v.muted = false;
    v.volume = volume;
    v.playsInline = true;
    v.style.zIndex = 9999;
    v.style.pointerEvents = "none";
    v.style.imageRendering = "pixelated";
    v.style.backgroundColor = "black";
	
    if (!loop) {
      v.addEventListener("ended", () => {
        if (videoElement) {
          document.body.removeChild(videoElement);
          videoElement = null;
          videoCoords = null;
          forcePaused = false;
        }
      });
    }
    document.body.appendChild(v);
    videoElement = v;

    updateVideoPosition();
    ensureVisibilityByScene();
  });

  PluginManager.registerCommand(PLUGIN_NAME, "pauseVideo", () => {
    forcePaused = true;
    ensureVisibilityByScene();
  });

  PluginManager.registerCommand(PLUGIN_NAME, "resumeVideo", () => {
    forcePaused = false;
    ensureVisibilityByScene();
  });

  PluginManager.registerCommand(PLUGIN_NAME, "stopVideo", () => {
    if (videoElement) {
      document.body.removeChild(videoElement);
      videoElement = null;
    }
    videoCoords = null;
    forcePaused = false;
  });

  PluginManager.registerCommand(PLUGIN_NAME, "setVideoVolume", args => {
    if (!videoElement) return;
    const volume = Math.min(Math.max(Number(args.volume ?? 100), 0), 100) / 100;
    videoElement.volume = volume;
  });

  // --- Seguridad: limpiar al cambiar de mapa ---
  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function() {
    _Game_Player_performTransfer.call(this);
    if (mapIsReady()) {
      setTimeout(() => {
        updateVideoPosition();
        ensureVisibilityByScene();
      }, 0);
    }
  };

  // --- Recalcular en resize ---
  window.addEventListener("resize", () => {
    updateVideoPosition();
    ensureVisibilityByScene();
  });
})();
