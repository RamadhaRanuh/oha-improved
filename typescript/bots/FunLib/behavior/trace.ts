/**
 * Debug trace of each bot hero (Utils.DebugMode only): where it is, what it carries, what it casts.
 * Each team's bots trace themselves, so in a bot-vs-bot game the two teams' lines together cover
 * all 10 heroes, fog or not. Called every frame from mode_retreat_generic's GetDesire.
 *
 *   POS  team=2 hero=axe t=612.0 x=-1234 y=567 hp=0.81 mp=0.40 lvl=9 mode=16 nw=6150      every POS_PERIOD s while alive
 *   ITEM team=2 hero=axe t=615.3 +item_blink -item_recipe_x                                when the items in slots 0-16 change
 *   CAST team=2 hero=axe t=618.9 ability=axe_berserkers_call lvl=3 cd=10.0 mp=0.32 e=3 a=2  when a cooldown starts
 *
 * CAST comes from cooldown starts (sampled every CAST_PERIOD s), so it covers spells and items with a
 * cooldown, instant casts included; toggles and passives without cooldown are not seen. e / a: enemy /
 * ally heroes within 1200 of the caster at that moment.
 */
import * as Utils from "bots/FunLib/utils";
import { BotMode, Unit } from "bots/ts_libs/dota";

const POS_PERIOD = 2;
const ITEM_PERIOD = 1;
const CAST_PERIOD = 0.2;
const ITEM_SLOTS = 17; // 0-5 inventory, 6-8 backpack, 9-14 stash, 15 TP, 16 neutral
const ABILITY_SLOTS = 24;
const CAST_RANGE = 1200;

interface TraceState {
    pos: number;
    item: number;
    cast: number;
    items: string[] | null;
    ready: Record<string, boolean>; // name -> off cooldown at the last sample
}

const states: Record<number, TraceState> = {};

function Short(bot: Unit): string {
    return bot.GetUnitName().replace("npc_dota_hero_", "");
}

function Items(bot: Unit): string[] {
    const out: string[] = [];
    for (let i = 0; i < ITEM_SLOTS; i++) {
        const it = bot.GetItemInSlot(i);
        if (it !== null && it !== undefined) out.push(it.GetName());
    }
    return out.sort();
}

// Multiset difference: names in a that are not matched in b.
function Minus(a: string[], b: string[]): string[] {
    const left = [...b];
    const out: string[] = [];
    for (const x of a) {
        const i = left.indexOf(x);
        if (i >= 0) left.splice(i, 1);
        else out.push(x);
    }
    return out;
}

function Head(bot: Unit, tag: string, now: number): string {
    return `${tag} team=${GetTeam()} hero=${Short(bot)} t=${now.toFixed(1)}`;
}

function Pos(bot: Unit, now: number): void {
    const l = bot.GetLocation();
    const hp = bot.GetHealth() / Math.max(1, bot.GetMaxHealth());
    const mp = bot.GetMana() / Math.max(1, bot.GetMaxMana());
    print(
        `${Head(bot, "POS", now)} x=${Math.floor(l.x)} y=${Math.floor(l.y)} hp=${hp.toFixed(2)} mp=${mp.toFixed(2)} lvl=${bot.GetLevel()} mode=${bot.GetActiveMode()} nw=${bot.GetNetWorth()}`
    );
}

function CheckItems(bot: Unit, s: TraceState, now: number): void {
    const cur = Items(bot);
    if (s.items !== null) {
        const gained = Minus(cur, s.items);
        const lost = Minus(s.items, cur);
        if (gained.length > 0 || lost.length > 0) print(`${Head(bot, "ITEM", now)} ${[...gained.map(x => "+" + x), ...lost.map(x => "-" + x)].join(" ")}`);
    }
    s.items = cur;
}

function Cooldowns(bot: Unit): { name: string; cd: number; lvl: number }[] {
    const out: { name: string; cd: number; lvl: number }[] = [];
    for (let i = 0; i < ABILITY_SLOTS; i++) {
        const ab = bot.GetAbilityInSlot(i);
        if (ab === null || ab === undefined) continue;
        const name = ab.GetName();
        if (name.startsWith("special_bonus") || ab.GetLevel() < 1) continue;
        out.push({ name, cd: ab.GetCooldownTimeRemaining(), lvl: ab.GetLevel() });
    }
    for (let i = 0; i < ITEM_SLOTS; i++) {
        if (i >= 6 && i <= 14) continue; // backpack and stash items are not cast
        const it = bot.GetItemInSlot(i);
        if (it === null || it === undefined) continue;
        out.push({ name: it.GetName(), cd: it.GetCooldownTimeRemaining(), lvl: 0 });
    }
    return out;
}

function CheckCasts(bot: Unit, s: TraceState, now: number): void {
    const mp = bot.GetMana() / Math.max(1, bot.GetMaxMana());
    let e = -1;
    let a = -1;
    const seen: Record<string, boolean> = {};
    for (const c of Cooldowns(bot)) {
        seen[c.name] = true;
        const ready = c.cd <= 0;
        if (!ready && s.ready[c.name] === true) {
            if (e < 0) {
                e = bot.GetNearbyHeroes(CAST_RANGE, true, BotMode.None).length;
                a = bot.GetNearbyHeroes(CAST_RANGE, false, BotMode.None).length - 1;
            }
            print(`${Head(bot, "CAST", now)} ability=${c.name}${c.lvl > 0 ? ` lvl=${c.lvl}` : ""} cd=${c.cd.toFixed(1)} mp=${mp.toFixed(2)} e=${e} a=${a}`);
        }
        s.ready[c.name] = ready;
    }
    for (const k of Object.keys(s.ready)) if (!seen[k]) delete s.ready[k];
}

/** Returns true (SafeCall reads nil as an error). */
export function Tick(bot: Unit): boolean {
    if (!Utils.DebugMode || !bot.IsHero() || bot.IsIllusion()) return true;
    const id = bot.GetPlayerID();
    let s = states[id];
    if (s === undefined) {
        s = { pos: -999, item: -999, cast: -999, items: null, ready: {} };
        states[id] = s;
    }
    const now = DotaTime();
    if (now - s.item >= ITEM_PERIOD) {
        s.item = now;
        CheckItems(bot, s, now);
    }
    if (!bot.IsAlive()) return true;
    if (now - s.pos >= POS_PERIOD) {
        s.pos = now;
        Pos(bot, now);
    }
    if (now - s.cast >= CAST_PERIOD) {
        s.cast = now;
        CheckCasts(bot, s, now);
    }
    return true;
}
