// Plugin: AirshipTransfer.js
// Autor: 3DalbiX
// Permite transferirse de mapa mientras estás en una aeronave sin desmontar

(() => {
  const _Game_Player_reserveTransfer = Game_Player.prototype.reserveTransfer;
  Game_Player.prototype.reserveTransfer = function(mapId, x, y, d, fadeType) {
    this._vehicleTypeBeforeTransfer = this._vehicleType;
    _Game_Player_reserveTransfer.call(this, mapId, x, y, d, fadeType);
  };

  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function() {
    const isInAirship = this.isInAirship();
    const airshipX = this.x;
    const airshipY = this.y;

    _Game_Player_performTransfer.call(this);

    if (isInAirship) {
      const airship = $gameMap.airship();
      if (airship) {
        airship.setPosition(this.x, this.y);
        this.vehicle().refresh();
        this._vehicleGettingOn = true;
        this._followers.synchronize(this.x, this.y, this.direction());
      }
    }
  };
})();