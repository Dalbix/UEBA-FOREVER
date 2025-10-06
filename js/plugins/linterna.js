/*:
 * @target MZ
 * @plugindesc Oscurece el mapa fuera de un radio alrededor del jugador con varios modos y luz tipo antorcha. Autor: 3DalbiX.
 *
 * @help
 * Script Calls:
 *   $gameSystem.enableDarkRadius(3, 0); // radio 3 tiles, modo círculo perfecto
 *   $gameSystem.enableDarkRadius(3, 1); // modo dentado
 *   $gameSystem.enableDarkRadius(4, 2); // modo cuadrado
 *   $gameSystem.enableDarkRadius(3, 3); // modo parpadeante
 *   $gameSystem.enableDarkRadius(3, 4); // modo dentado+parpadeante
 *   $gameSystem.disableDarkRadius();    // desactiva el efecto
 */

(() => {
  Game_System.prototype.enableDarkRadius = function(radius, mode) {
    this._darkRadius = radius;
    this._darkMode = mode || 0;
  };

  Game_System.prototype.disableDarkRadius = function() {
    this._darkRadius = null;
    this._darkMode = null;
  };

  class Sprite_DarkMask extends Sprite {
    initialize() {
      super.initialize();
      this.bitmap = new Bitmap(Graphics.width, Graphics.height);
      this.z = 1000;
    }

    update() {
      super.update();
      this.visible = !!$gameSystem._darkRadius;
      if (!this.visible) return;

      const radiusTiles = $gameSystem._darkRadius;
      const tileSize = $gameMap.tileWidth();
      const baseRadius = radiusTiles * tileSize;
      const px = $gamePlayer.screenX();
      const py = $gamePlayer.screenY();
      const mode = $gameSystem._darkMode || 0;

      // Limpiar pantalla
      this.bitmap.clear();
      this.bitmap.fillAll("rgba(0,0,0,0.98)"); // capa de oscuridad

      this.bitmap.context.save();
      this.bitmap.context.globalCompositeOperation = "destination-out";

      switch(mode) {
        case 0: // círculo perfecto
          this.drawTorchGradient(px, py, baseRadius);
          break;

        case 1: // dentado suave
          if (!this._irregularCache || Graphics.frameCount % 15 === 0) {
            this._irregularCache = [];
            const steps = 40;
            for (let i = 0; i <= steps; i++) {
              const angle = (i / steps) * Math.PI * 2;
              const noise = (Math.random() - 0.5) * tileSize * 0.4;
              const r = baseRadius + noise;
              const x = px + Math.cos(angle) * r;
              const y = py + Math.sin(angle) * r;
              this._irregularCache.push({x, y, r});
            }
          }
          this.drawTorchGradientDentado(px, py, this._irregularCache);
          break;

        case 2: // cuadrado
          this.drawTorchGradientSquare(px, py, baseRadius);
          break;

        case 3: // parpadeante
          const pulse = Math.sin(Graphics.frameCount / 60) * tileSize * 0.2;
          this.drawTorchGradient(px, py, baseRadius + pulse);
          break;

        case 4: // dentado + parpadeante
if (!this._irregularCache || Graphics.frameCount % 15 === 0) {
  this._irregularCache = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const noise = (Math.random() - 0.5) * tileSize * 0.4;
    const r = baseRadius + noise;
    this._irregularCache.push({r, angle});
  }
}
const pulse2 = Math.sin(Graphics.frameCount / 60) * tileSize * 0.2;
this.drawTorchGradientDentado(px, py, this._irregularCache, pulse2);
          break;
      }

      this.bitmap.context.restore();
      this.bitmap._baseTexture.update();
    }

    drawTorchGradient(px, py, radius) {
      const ctx = this.bitmap.context;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
gradient.addColorStop(0, "rgba(255,230,150,1)");   // centro más brillante, más amarillo
gradient.addColorStop(0.5, "rgba(255,160,50,0.8)"); // naranja más intenso
gradient.addColorStop(1, "rgba(0,0,0,0)");  
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI*2, false);
      ctx.fill();
    }

/* drawTorchGradientDentado(px, py, points, pulse=0) {
  const ctx = this.bitmap.context;

  const maxR = Math.max(...points.map(p => p.r)) + pulse;
  const gradient = ctx.createRadialGradient(px, py, 0, px, py, maxR);
gradient.addColorStop(0, "rgba(255,230,150,1)");   // centro más brillante, más amarillo
gradient.addColorStop(0.5, "rgba(255,160,50,0.8)"); // naranja más intenso
gradient.addColorStop(1, "rgba(0,0,0,0)");  
  ctx.fillStyle = gradient;

  ctx.beginPath();
  points.forEach((p, i) => {
    const r2 = p.r + pulse;
    const x = px + Math.cos(p.angle) * r2;
    const y = py + Math.sin(p.angle) * r2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();

}*/
drawTorchGradientDentado(px, py, points, pulse=0) {
  const ctx = this.bitmap.context;

  // Calculamos radio máximo
  const maxR = Math.max(...points.map(p => p.r)) + pulse;

  // Creamos gradiente suave que cubra todo el perímetro dentado
  const gradient = ctx.createRadialGradient(px, py, 0, px, py, maxR);
  gradient.addColorStop(0, "rgba(255,230,150,1)");
  gradient.addColorStop(0.5, "rgba(255,160,50,0.8)");
  gradient.addColorStop(0.85, "rgba(0,0,0,0.1)"); // suaviza borde dentado
  gradient.addColorStop(1, "rgba(0,0,0,0)");       // borde totalmente transparente
  ctx.fillStyle = gradient;

  // Dibujamos el perímetro dentado suavizado
  ctx.beginPath();
  points.forEach((p, i) => {
    const r2 = p.r + pulse;
    const x = px + Math.cos(p.angle) * r2;
    const y = py + Math.sin(p.angle) * r2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();

  // Opcional: aplicar un desenfoque adicional si quieres más suavidad
   ctx.filter = 'blur(2px)';
   ctx.fill();
   ctx.filter = 'none';
}

    drawTorchGradientSquare(px, py, radius) {
      const ctx = this.bitmap.context;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
gradient.addColorStop(0, "rgba(255,230,150,1)");   // centro más brillante, más amarillo
gradient.addColorStop(0.5, "rgba(255,160,50,0.8)"); // naranja más intenso
gradient.addColorStop(1, "rgba(0,0,0,0)");  
      ctx.fillStyle = gradient;
      ctx.fillRect(px-radius, py-radius, radius*2, radius*2);
    }
  }

  const _Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
  Spriteset_Map.prototype.createUpperLayer = function() {
    _Spriteset_Map_createUpperLayer.call(this);
    this._darkMask = new Sprite_DarkMask();
    this.addChild(this._darkMask);
  };
})();
