/**
 * Neutral camps: the camp data camp blocking uses (behavior/prehorn).
 *
 * Camp positions: GetNeutralSpawners() gives `location` (pulls use it) and may give the spawn box
 * as `min`/`max`. BoxCentre uses the box when present. One CAMPS line at the first call reports which.
 *
 * Debug (Utils.DebugMode):
 *   CAMPS team=2 n=18 box=true fields=location,max,min,speed,team,type
 */
import { Vector } from "bots/ts_libs/dota";
import * as Utils from "bots/FunLib/utils";

export interface Camp {
    centre: Vector;
    type: string;
    team: number;
    raw: any;
}

let camps: Camp[] | null = null;

/** All camps with the spawn-box centre (min/max when the game gives them, else location). */
export function Camps(): Camp[] {
    if (camps !== null) return camps;
    const out: Camp[] = [];
    let box = false;
    let fields = "";
    for (const raw of GetNeutralSpawners() as any[]) {
        if (raw === null || raw === undefined) continue;
        if (fields === "") {
            const keys: string[] = [];
            for (const k in raw) keys.push(k);
            keys.sort();
            fields = keys.join(",");
        }
        let centre: Vector | null = null;
        if (raw.min !== undefined && raw.min !== null && raw.max !== undefined && raw.max !== null) {
            centre = Vector((raw.min.x + raw.max.x) / 2, (raw.min.y + raw.max.y) / 2, raw.min.z);
            box = true;
        } else if (raw.location !== undefined && raw.location !== null) {
            centre = raw.location;
        }
        if (centre === null) continue;
        out.push({ centre, type: `${raw.type}`, team: raw.team, raw });
    }
    if (Utils.DebugMode) print(`CAMPS team=${GetTeam()} n=${out.length} box=${box} fields=${fields}`);
    camps = out;
    return out;
}
