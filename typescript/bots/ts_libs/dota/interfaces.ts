/**
 * The Dota2 bot scriping interfaces from Valve. https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting
 */

import { BotActionType, BotMode, DamageType, Lane, Rune, Team } from "./enums";

export interface Location {}

// https://developer.valvesoftware.com/wiki/Category:Vector
// update for add/sub/div later.
export interface Vector {
    x: number;
    y: number;
    z: number;
    Normalized(): Vector;
}

export interface Ping {
    time: number;
    location: Vector;
    normal_ping: undefined;
    player_id: number;
}

/** One entry of Unit.GetIncomingTrackingProjectiles(). */
export interface TrackingProjectile {
    location: Vector;
    caster: Unit | null;
    player: number;
    ability: Ability | null;
    is_dodgeable: boolean;
    is_attack: boolean;
}

export interface Item {
    GetName(): string;
    GetCurrentCharges(): number;
    GetCooldownTimeRemaining(): number;
}

export interface AvoidanceZone {
    location: Vector;
    ability: Ability;
    caster: Unit;
    radius: number;
    playerid: number;
}

export interface Unit {
    // Seems to be internal to bot script?
    frameProcessTime: number | null;
    assignedRole: number | null;
    DefendLaneDesire: number[] | null;
    laneToDefend: Lane;
    stateTetheredHero: Unit | null;

    IsNull(): boolean;

    CanBeSeen(): boolean;

    GetPrimaryAttribute(): number;

    GetAttributeValue(nAttr: number): number;

    GetPlayerID(): number;

    GetLocation(): Vector;

    GetUnitName(): string;

    GetAbilityCount(): number;

    GetAbilityByIndex(index: number): Ability | null;
    GetAbilityInSlot(index: number): Ability | null;

    IsInvisible(): boolean;

    IsAlive(): boolean;

    IsBuilding(): boolean;

    IsHero(): boolean;

    IsInvulnerable(): boolean;

    IsBot(): boolean;

    GetAttackSpeed(): number;

    GetActualIncomingDamage(damage: number, damageType: DamageType): number;

    Action_AttackMove(location: Vector): void;

    IsCreep(): boolean;

    IsDominated(): boolean;

    IsIllusion(): boolean;

    IsMagicImmune(): boolean;

    NumModifiers(): number;

    GetModifierName(nModifier: number): string;

    GetModifierStackCount(nModifier: number): number;

    GetNearbyCreeps(range: number, enemy: boolean): Unit[];

    GetMostRecentPing(): Ping;

    GetLocation(): Vector;

    GetNearbyHeroes(range: number, includeEnemies: boolean, mode: BotMode): Unit[];
    GetNearbyNeutralCreeps(range: number, includeEnemies: boolean): Unit[];

    GetItemInSlot(slot: number): Item | null;
    NumQueuedActions(): number;

    GetQueuedActionType(index: number): BotActionType;

    GetAnimActivity(): number;

    Action_UseAbilityOnEntity(ability: Ability, target: Unit): void;

    Action_UseAbilityOnLocation(ability: Ability | Item, location: Location): void;

    Action_UseAbility(ability: Ability): void;
    Action_ClearActions(stop: boolean): void;
    Action_MoveToLocation(location: Vector): void;
    Action_AttackUnit(unit: Unit, once: boolean): void;
    Action_Delay(delay: number): void;
    ActionQueue_AttackUnit(unit: Unit, once: boolean): void;
    Action_PickUpRune(rune: Rune): void;
    Action_MoveToUnit(unit: Unit): void;
    Action_UseAbilityOnTree(ability: Ability | Item, tree: number): void;
    GetNearbyTrees(radius: number): number[];
    GetAttackPoint(): number;
    GetSecondsPerAttack(): number;
    GetAnimCycle(): number;
    GetAttackProjectileSpeed(): number;
    GetBaseDamage(): number;
    GetBaseDamageVariance(): number;
    GetIncomingTrackingProjectiles(): TrackingProjectile[];
    IsTower(): boolean;
    GetEstimatedDamageToTarget(currentlyAvailable: boolean, target: Unit, duration: number, damageType: number): number;
    IsFacingLocation(location: Vector, degrees: number): boolean;
    IsUsingAbility(): boolean;
    IsChanneling(): boolean;
    IsDisarmed(): boolean;
    /** OHA override (aba_global_overrides): the engine's max health, unaffected by script tweaks. */
    OriginalGetMaxHealth(): number;
    /** OHA override (aba_global_overrides): the engine's health, unaffected by script tweaks. */
    OriginalGetHealth(): number;
    GetItemSlotType(slot: number): number;

    GetAttackTarget(): Unit | null;
    GetTarget(): Unit | null;
    SetTarget(unit: Unit): void;

    GetTeam(): Team;

    GetLastAttackTime(): number;
    WasRecentlyDamagedByAnyHero(delta: number): boolean;
    WasRecentlyDamagedByHero(hero: Unit, delta: number): boolean;
    WasRecentlyDamagedByTower(delta: number): boolean;
    WasRecentlyDamagedByCreep(delta: number): boolean;
    WasRecentlyDamagedByPlayer(playerId: number, delta: number): boolean;
    GetMaxHealth(): number;
    GetHealth(): number;
    GetRawOffensivePower(): number;
    GetOffensivePower(): number;
    GetHealthRegen(): number;
    GetMaxMana(): number;
    GetMana(): number;
    GetManaRegen(): number;

    GetLevel(): number;
    /** Game totals (scoreboard). */
    GetLastHits(): number;
    GetDenies(): number;
    IsAncientCreep(): boolean;
    HasModifier(modifierName: string): boolean;
    GetActiveMode(): number;
    GetAbilityByName(abilityName: string): Ability;
    GetAttackRange(): number;
    GetCurrentVisionRange(): number;
    GetNetWorth(): number;
    FindItemSlot(itemName: string): number;
    GetNearbyLaneCreeps(radius: number, enemyTeam: boolean): Unit[];
    GetNearbyTowers(radius: number, enemyTeam: boolean): Unit[];
    GetAttackDamage(): number;
    GetActiveModeDesire(): number;
    GetGold(): number;
    GetCurrentMovementSpeed(): number;
    GetAssignedLane(): Lane;
    ActionImmediate_Chat(message: string, globalChat: boolean): void;
    ActionImmediate_PurchaseItem(itemName: string): number;
    ActionImmediate_SwapItems(slot1: number, slot2: number): void;
    DistanceFromFountain(): number;

    /** @param pingType Ping type, "!" if false, "X" otherwise, essentially works as ALT key */
    ActionImmediate_Ping(xCoord: number, yCoord: number, pingType: boolean): void;
}

export interface Ability {
    IsFullyCastable(): boolean;
    GetLevel(): number;
    IsHidden(): boolean;

    GetCastRange(): number;

    IsNull(): boolean;

    GetName(): string;

    IsTrained(): boolean;

    IsActivated(): boolean;

    GetManaCost(): number;

    GetCooldownTimeRemaining(): number;
}

export interface Talent {}
