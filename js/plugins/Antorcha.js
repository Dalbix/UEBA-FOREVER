/*:
 * @target MZ
 * @plugindesc Luz tipo antorcha alrededor del jugador con varios modos de radio. Autor: 3DalbiX.
 *
 * @help
 * Script Calls:
 *   $gameSystem.enableDarkRadiusTorch(3, 0); // radio 3 tiles, modo círculo
 *   $gameSystem.enableDarkRadiusTorch(3, 1); // dentado
 *   $gameSystem.enableDarkRadiusTorch(4, 2); // cuadrado
 *   $gameSystem.enableDarkRadiusTorch(3, 3); // parpadeante
 *   $gameSystem.enableDarkRadiusTorch(3, 4); // dentado + parpadeante
 *   $gameSystem.disableDarkRadiusTorch();    // desactiva el efecto
 */

(() => {
  // ------------------ Game_System ------------------
  Game_System.prototype.enableDarkRadiusTorch = function(radius, mode) {
    this._darkRadius = radius;
    this._darkMode = mode || 0;
  };

  Game_System.prototype.disableDarkRadiusTorch = function() {
    this._darkRadius = null;
    this._darkMode = null;
  };

  // ------------------ Sprite_DarkMask ------------------
  class Sprite_DarkMask extends Sprite {
    initialize() {
      super.initialize();
      this.bitmap = new Bitmap(Graphics.width, Graphics.height);
      this.z = 1000;
    }

    update() {
      super.update();
      if (!$gameSystem._darkRadius) {
        this.visible = false;
        return;
      }
      this.visible = true;

      const radiusTiles = $gameSystem._darkRadius;
      const tileSize = $gameMap.tileWidth();
      const baseRadius = radiusTiles * tileSize;
      const px = $gamePlayer.screenX();
      const py = $gamePlayer.screenY();
      const mode = $gameSystem._darkMode || 0;

      // Limpiar pantalla y dibujar capa negra
      this.bitmap.clear();
      this.bitmap.fillAll("rgba(0,0,0,0.85)");

      const ctx = this.bitmap.context;

      // --------- Dibujar radio según modo ---------
      let pulse = 0;
      if (mode === 3 || mode === 4) {
        pulse = Math.sin(Graphics.frameCount / 60) * tileSize * 0.1; // parpadeo lento
      }

      let points = null;
      if (mode === 1 || mode === 4) {
        // dentado
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
        points = this._irregularCache;
      }

      // 1️⃣ Dibujar agujero en la capa negra
      ctx.save();
      ctx.globalCompositeOperation = "destination-out"; // hace agujero
      ctx.beginPath();
      switch(mode) {
        case 0: // círculo perfecto
        case 3: // parpadeante
          ctx.arc(px, py, baseRadius + pulse, 0, Math.PI*2, false);
          break;
        case 1: // dentado
        case 4: // dentado+parpadeante
          ctx.beginPath();
          points.forEach((p, i) => {
            const r2 = p.r + pulse;
            const x = px + Math.cos(p.angle) * r2;
            const y = py + Math.sin(p.angle) * r2;
            if(i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
          });
          ctx.closePath();
          break;
        case 2: // cuadrado
          ctx.rect(px-baseRadius, py-baseRadius, baseRadius*2, baseRadius*2);
          break;
      }
      ctx.fill();
      ctx.restore();

      // 2️⃣ Dibujar luz cálida encima del agujero
      ctx.save();
      ctx.globalCompositeOperation = "lighter"; // mezcla para simular luz cálida
      const gradientRadius = baseRadius + pulse;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, gradientRadius);
      gradient.addColorStop(0, "rgba(255,230,150,0.4)");
      gradient.addColorStop(0.3, "rgba(255,160,50,0.2)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;

      switch(mode) {
        case 0:
        case 3:
          ctx.beginPath();
          ctx.arc(px, py, gradientRadius, 0, Math.PI*2, false);
          ctx.fill();
          break;
        case 1:
        case 4:
          ctx.beginPath();
          points.forEach((p, i) => {
            const r2 = p.r + pulse;
            const x = px + Math.cos(p.angle) * r2;
            const y = py + Math.sin(p.angle) * r2;
            if(i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
          });
          ctx.closePath();
          ctx.fill();
          break;
        case 2:
          ctx.fillRect(px-baseRadius, py-baseRadius, baseRadius*2, baseRadius*2);
          break;
      }
      ctx.restore();

      this.bitmap._baseTexture.update();
    }
  }

  // ------------------ Integración en Spriteset ------------------
  const _Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
  Spriteset_Map.prototype.createUpperLayer = function() {
    _Spriteset_Map_createUpperLayer.call(this);
    this._darkMask = new Sprite_DarkMask();
    this.addChild(this._darkMask);
  };
})();
