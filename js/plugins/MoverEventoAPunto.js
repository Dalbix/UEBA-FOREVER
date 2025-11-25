/*:
 * @target MZ
 * @plugindesc Movimiento continuo hacia un punto con A* simple y SelfSwitch opcional al llegar.
 * @author 3DalbiX
 */

(() => {

    // Calcula dirección entre tiles
    function directionBetween(fromX, fromY, toX, toY) {
        if (toX > fromX) return 6;
        if (toX < fromX) return 4;
        if (toY > fromY) return 2;
        if (toY < fromY) return 8;
        return 0;
    }

    // A* simplificado solo 4 direcciones
    function aStarSimple(startX, startY, goalX, goalY) {
        const openSet = [[startX, startY]];
        const cameFrom = {};
        const gScore = {};
        gScore[`${startX},${startY}`] = 0;

        function neighbors4(x, y) {
            return [
                [8, x, y-1],
                [2, x, y+1],
                [4, x-1, y],
                [6, x+1, y]
            ];
        }

        while (openSet.length) {
            let bestIdx = 0;
            let bestF = Infinity;
            for (let i = 0; i < openSet.length; i++) {
                const [x, y] = openSet[i];
                const f = gScore[`${x},${y}`] + Math.abs(goalX - x) + Math.abs(goalY - y);
                if (f < bestF) { bestF = f; bestIdx = i; }
            }

            const [cx, cy] = openSet.splice(bestIdx, 1)[0];
            if (cx === goalX && cy === goalY) {
                // reconstruir ruta
                const path = [[cx, cy]];
                let key = `${cx},${cy}`;
                while (cameFrom[key]) {
                    const parts = cameFrom[key].split(",");
                    path.push([Number(parts[0]), Number(parts[1])]);
                    key = cameFrom[key];
                }
                path.reverse();
                return path;
            }

            for (const [dir, nx, ny] of neighbors4(cx, cy)) {
                if (!$gameMap.isPassable(cx, cy, dir)) continue;
                const key = `${nx},${ny}`;
                const tentativeG = (gScore[`${cx},${cy}`] || Infinity) + 1;
                if (tentativeG < (gScore[key] || Infinity)) {
                    cameFrom[key] = `${cx},${cy}`;
                    gScore[key] = tentativeG;
                    if (!openSet.some(e => e[0] === nx && e[1] === ny)) openSet.push([nx, ny]);
                }
            }
        }

        return null; // sin ruta
    }

    /**
     * Movimiento continuo hacia un punto
     * @param {number} targetX Tile X destino
     * @param {number} targetY Tile Y destino
     * @param {number} freqMs Intervalo entre pasos en ms
     * @param {string|null} selfSwitch SelfSwitch a activar al llegar (A-D) o null
     */
    Game_Character.prototype.approachPointContinuous = function(targetX, targetY, freqMs = 150, selfSwitch = null) {
        if (!this._approachInterval) {
            const ev = this;
            this._approachInterval = setInterval(() => {
                if (!ev) {
                    clearInterval(ev._approachInterval);
                    return;
                }

                if (ev.x === targetX && ev.y === targetY) {
                    if (selfSwitch) {
                        const mapId = $gameMap.mapId();
                        $gameSelfSwitches.setValue([mapId, ev.eventId(), selfSwitch], true);
                    }
                    clearInterval(ev._approachInterval);
                    ev._approachInterval = null;
                    return;
                }

                const dx = targetX - ev.x;
                const dy = targetY - ev.y;
                let moved = false;

                // Prioridad horizontal
                if (dx !== 0) {
                    const dirX = dx > 0 ? 6 : 4;
                    if ($gameMap.isPassable(ev.x, ev.y, dirX)) {
                        ev.moveStraight(dirX);
                        moved = true;
                    }
                }

                // Prioridad vertical si no se movió
                if (!moved && dy !== 0) {
                    const dirY = dy > 0 ? 2 : 8;
                    if ($gameMap.isPassable(ev.x, ev.y, dirY)) {
                        ev.moveStraight(dirY);
                        moved = true;
                    }
                }

                // Intentar A* si bloqueado
                if (!moved) {
                    const path = aStarSimple(ev.x, ev.y, targetX, targetY);
                    if (path && path.length > 1) {
                        const next = path[1];
                        const dir = directionBetween(ev.x, ev.y, next[0], next[1]);
                        if (dir !== 0) ev.moveStraight(dir);
                    }
                }
            }, freqMs);
        }
    };

})();
