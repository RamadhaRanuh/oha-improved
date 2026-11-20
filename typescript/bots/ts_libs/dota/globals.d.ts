/*
 * Dota 2 scripting API globals functions and constants. https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting
 */

import { Unit, Vector, AvoidanceZone } from "./interfaces";
import { Lane, Rune, Team, UnitType } from ".";

declare global {
    function print(...args: any[]): void;
    function pcall(func: any, path?: string): LuaMultiReturn<[boolean, any]>;

    function GetBot(): Unit;

    function GetOpposingTeam(): Team;

    function GetTeam(): Team;

    function IsHeroAlive(nPlayerID: number): boolean;

    function GetTeamPlayers(team: Team): number[];
    function GetTeamPlayers(team: Team, bypass: boolean): number[];

    function GetAvoidanceZones(): AvoidanceZone[];

    function GetTeamMember(playerNumberOnTeam: number): Unit | null;

    function GetUnitList(unitType: UnitType): Unit[];

    function GameTime(): number;
    /** Real-world seconds since Dota started; does not pause. */
    function RealTime(): number;

    function IsLocationPassable(loc: Vector): boolean;

    function IsPlayerBot(playerId: number): boolean;

    function RandomInt(a: number, b: number): number;

    function GetScriptDirectory(): string;

    function Vector(x: number, y: number, z: number): Vector;

    function DotaTime(): number;

    function GetItemCost(itemName: string): number;

    function IsTeamPlayer(nPlayerID: number): boolean;

    function GetIncomingTeleports(): IncomingTeleport[];

    function GetHeroLastSeenInfo(nPlayerID: number): LastSeenInfo[];

    function DebugDrawCircle(vCenter: Vector, fRadius: number, nRed: number, nGreen: number, nBlue: number): void;

    function GetSelectedHeroName(nPlayerID: number): string;

    function GetHeroLevel(playerId: number): number;
    function GetTower(team: Team, tower: number): Unit | null;
    function GetBarracks(team: Team, barracks: number): Unit | null;
    function GetUnitToUnitDistance(unit1: Unit, unit2: Unit): number;
    function GetUnitToLocationDistance(unit: Unit, location: Vector): number;
    function GetAncient(team: Team): Unit;
    function GetHeroKills(playerId: number): number;
    function GetHeroDeaths(playerId: number): number;
    /** Bot VM chat hook: called for every chat message the team can see (one callback per VM). */
    function InstallChatCallback(callback: (this: void, chat: { player_id: number; string: string; team_only: boolean }) => void): void;
    function GetNeutralSpawners(): any;
    /** Location `amount` (0..1) along the lane; which end is 0 is not documented, so callers check. */
    function GetLocationAlongLane(lane: Lane, amount: number): Vector;
    function GetLaneFrontLocation(team: Team, lane: Lane, deltaFromFront: number): Vector;
    function GetLaneFrontAmount(team: Team, lane: Lane, ignoreTowers: boolean): number;
    function GetTreeLocation(tree: number): Vector;
    function IsLocationVisible(location: Vector): boolean;
    function RandomVector(length: number): Vector;
    function GetRuneSpawnLocation(rune: Rune): Vector;
    /** RUNE_STATUS_UNKNOWN / RUNE_STATUS_AVAILABLE / RUNE_STATUS_MISSING */
    function GetRuneStatus(rune: Rune): number;
    function Clamp(value: number, min: number, max: number): number;
    function RemapValClamped(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number;
    function GetDefendLaneDesire(lane: Lane): number;
    function GetPushLaneDesire(lane: Lane): number;
    function GetUnitToLocationDistance(unit: any, location: Vector): number;

    function RandomFloat(min: number, max: number): number;

    interface HTTPRequest {
        SetHTTPRequestRawPostBody(contentType: string, body: string): void;
        SetHTTPRequestGetOrPostParameter(aString: string, bString: string): boolean;
        Send(callback: (result: any) => void): void;
    }

    interface LastSeenInfo {
        location: Vector;
        time_since_seen: number;
    }

    interface IncomingTeleport {
        playerid: number; // 回城卷轴使用者的玩家ID
        location: Vector; // 回城卷轴的使用位置
        time_remaining: number; // 回城卷轴离传送完毕的剩余时间
    }

    function CreateRemoteHTTPRequest(url: string): HTTPRequest;
    function IsCMPickedHero(team: Team, heroName: string): boolean;
    function IsCMBannedHero(heroName: string): boolean;
    function GetCMPhaseTimeRemaining(): number;
    function SelectHero(playerId: number, heroName: string): void;
    function GetHeroPickState(): number;
    function GetHeroPickState(): number;
    function PickCaptain(): void;
    function BansHero(): void;
    function PicksHero(): void;
    function CMPickHero(heroName: string): void;
    function GetCMCaptain(): number;
    function CMBanHero(heroName: string): void;
    function SetCMCaptain(playerId: number): void;
    function IsPlayerInHeroSelectionControl(playerId: number): boolean;
    function GetGameState(): number;
    function GetGameMode(): number;
}

export {};
