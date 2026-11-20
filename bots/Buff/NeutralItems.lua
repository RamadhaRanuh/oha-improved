if NeutralItems == nil
then
    NeutralItems = {}
end

local isTierOneDone   = false
local isTierTwoDone   = false
local isTierThreeDone = false
local isTierFourDone  = false
local DOTA_ITEM_NEUTRAL_SLOT = 16

-- 7.42: 4 tiers (0:00 / 15:00 / 30:00 / 50:00 in game). Each tier list is the flat
-- union of that tier's 4 pools in neutral_items.txt (12 items per tier).
local Tier1NeutralItems = {
    -- pool_a
    --[[Chipped Vest]]          "item_chipped_vest",
    --[[Ash Legion Shield]]     "item_ash_legion_shield",
    --[[Possessed Mask]]        "item_possessed_mask",
    -- pool_b
    --[[Dormant Curio]]         "item_dormant_curio",
    --[[Red Ledger]]            "item_red_ledger",
    --[[Weighted Dice]]         "item_weighted_dice",
    -- pool_c
    --[[Polliwog Charm]]        "item_polliwog_charm",
    --[[Seeds of Serenity]]     "item_seeds_of_serenity",
    --[[Forager's Kit]]         "item_foragers_kit",
    -- pool_d
    --[[Kobold Cup]]            "item_kobold_cup",
    --[[Stonefeather Satchel]]  "item_stonefeather_satchel",
    --[[Tumbler's Toy]]         "item_pogo_stick",
}

local Tier2NeutralItems = {
    -- pool_a
    --[[Psychic Headband]]      "item_psychic_headband",
    --[[Safety Bubble]]         "item_safety_bubble",
    --[[Metamorphic Mandible]]  "item_metamorphic_mandible",
    -- pool_b
    --[[Jidi Pollen Bag]]       "item_jidi_pollen_bag",
    --[[Brick]]                 "item_brick",
    --[[Crippling Crossbow]]    "item_crippling_crossbow",
    -- pool_c
    --[[Imp Claw]]              "item_imp_claw",
    --[[Gunpowder Gauntlets]]   "item_gunpowder_gauntlets",
    --[[Defiant Shell]]         "item_defiant_shell",
    -- pool_d
    --[[Partisan's Brand]]      "item_partisans_brand",
    --[[Spellslinger]]          "item_spellslinger",
    --[[Mana Draught]]          "item_mana_draught",
}

local Tier3NeutralItems = {
    -- pool_a
    --[[Prophet's Pendulum]]    "item_prophets_pendulum",
    --[[Dandelion Amulet]]      "item_dandelion_amulet",
    --[[Idol of Screeauk]]      "item_idol_of_screeauk",
    -- pool_b
    --[[Balmhook]]              "item_balmhook",
    --[[Rattlecage]]            "item_rattlecage",
    --[[Stormcrafter]]          "item_stormcrafter",
    -- pool_c
    --[[Enchanter's Bauble]]    "item_enchanters_bauble",
    --[[Ceremonial Robe]]       "item_ceremonial_robe",
    --[[Harmonizer]]            "item_harmonizer",
    -- pool_d
    --[[Vile Phial]]            "item_vile_phial",
    --[[Serrated Shiv]]         "item_serrated_shiv",
    --[[Revenant's Brooch]]     "item_revenants_brooch",
}

local Tier4NeutralItems = {
    -- pool_a
    --[[Fallen Sky]]            "item_fallen_sky",
    --[[Flicker]]               "item_flicker",
    --[[Minotaur Horn]]         "item_minotaur_horn",
    -- pool_b
    --[[Mind Breaker]]          "item_mind_breaker",
    --[[Divine Regalia]]        "item_divine_regalia",
    --[[Witchbane]]             "item_heavy_blade",
    -- pool_c
    --[[Helm of the Hivemind]]  "item_helm_of_the_hivemind",
    --[[Dezun Bloodrite]]       "item_dezun_bloodrite",
    --[[Conjurer's Catalyst]]   "item_conjurers_catalyst",
    -- pool_d
    --[[Giant's Ring]]          "item_giants_ring",
    --[[Book of the Dead]]      "item_demonicon",
    --[[Riftshadow Prism]]      "item_riftshadow_prism",
}

-- 7.42 enchantments per neutral tier: the union of the global and per-attribute
-- lists in neutral_items.txt (this script does not pick by attribute).
local enhancements = {
    -- Tier 1 enhancements
    { name = "item_enhancement_quickened", tier = 1, roles = {1, 1, 1, 2, 1}, realName = "Quickened Enhancement" },
    { name = "item_enhancement_vital",     tier = 1, roles = {1, 1, 1, 1, 1}, realName = "Vital Enhancement" },
    { name = "item_enhancement_brawny",    tier = 1, roles = {1, 1, 3, 2, 2}, realName = "Brawny Enhancement" },
    { name = "item_enhancement_tough",     tier = 1, roles = {1, 1, 2, 2, 1}, realName = "Tough Enhancement" },
    { name = "item_enhancement_alert",     tier = 1, roles = {1, 2, 1, 1, 1}, realName = "Alert Enhancement" },
    { name = "item_enhancement_mystical",  tier = 1, roles = {1, 1, 1, 1, 1}, realName = "Mystical Enhancement" },

    -- Tier 2 enhancements
    { name = "item_enhancement_quickened", tier = 2, roles = {1, 1, 1, 2, 1}, realName = "Quickened Enhancement" },
    { name = "item_enhancement_vital",     tier = 2, roles = {1, 1, 1, 1, 1}, realName = "Vital Enhancement" },
    { name = "item_enhancement_brawny",    tier = 2, roles = {1, 1, 3, 2, 2}, realName = "Brawny Enhancement" },
    { name = "item_enhancement_tough",     tier = 2, roles = {1, 1, 2, 2, 1}, realName = "Tough Enhancement" },
    { name = "item_enhancement_alert",     tier = 2, roles = {1, 2, 1, 1, 1}, realName = "Alert Enhancement" },
    { name = "item_enhancement_mystical",  tier = 2, roles = {1, 1, 1, 1, 1}, realName = "Mystical Enhancement" },
    { name = "item_enhancement_crude",     tier = 2, roles = {1, 1, 1, 1, 1}, realName = "Crude Enhancement" },
    { name = "item_enhancement_nimble",    tier = 2, roles = {1, 1, 1, 1, 1}, realName = "Nimble Enhancement" },
    { name = "item_enhancement_keen_eyed", tier = 2, roles = {1, 1, 1, 1, 2}, realName = "Keen Eyed Enhancement" },
    { name = "item_enhancement_titanic",   tier = 2, roles = {1, 1, 1, 1, 1}, realName = "Titanic Enhancement" },

    -- Tier 3 enhancements (Greedy is T3 only in 7.42; Vital stops at T2)
    { name = "item_enhancement_quickened", tier = 3, roles = {1, 1, 1, 2, 1}, realName = "Quickened Enhancement" },
    { name = "item_enhancement_greedy",    tier = 3, roles = {1, 1, 1, 2, 2}, realName = "Greedy Enhancement" },
    { name = "item_enhancement_brawny",    tier = 3, roles = {1, 1, 3, 2, 2}, realName = "Brawny Enhancement" },
    { name = "item_enhancement_tough",     tier = 3, roles = {1, 1, 2, 2, 1}, realName = "Tough Enhancement" },
    { name = "item_enhancement_alert",     tier = 3, roles = {1, 2, 1, 1, 1}, realName = "Alert Enhancement" },
    { name = "item_enhancement_mystical",  tier = 3, roles = {1, 1, 1, 1, 1}, realName = "Mystical Enhancement" },
    { name = "item_enhancement_crude",     tier = 3, roles = {1, 1, 1, 1, 1}, realName = "Crude Enhancement" },
    { name = "item_enhancement_nimble",    tier = 3, roles = {1, 1, 1, 1, 1}, realName = "Nimble Enhancement" },
    { name = "item_enhancement_keen_eyed", tier = 3, roles = {1, 1, 1, 1, 2}, realName = "Keen Eyed Enhancement" },
    { name = "item_enhancement_titanic",   tier = 3, roles = {1, 1, 1, 1, 1}, realName = "Titanic Enhancement" },

    -- Tier 4 enhancements (the former tier 5 set)
    { name = "item_enhancement_timeless",    tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Timeless Enhancement" },
    { name = "item_enhancement_evolved",     tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Evolved Enhancement" },
    { name = "item_enhancement_fleetfooted", tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Fleetfooted Enhancement" },
    { name = "item_enhancement_vampiric",    tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Vampiric Enhancement" },
    { name = "item_enhancement_hulking",     tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Hulking Enhancement" },
    { name = "item_enhancement_audacious",   tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Audacious Enhancement" },
    { name = "item_enhancement_feverish",    tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Feverish Enhancement" },
    { name = "item_enhancement_manic",       tier = 4, roles = {1, 1, 1, 1, 1}, realName = "Manic Enhancement" },
}

function NeutralItems:GetRandomEnhanByTier(tier)
    local filtered = {}
    for _, enh in ipairs(enhancements) do
        if enh.tier == tier then
            table.insert(filtered, enh)
        end
    end

    if #filtered == 0 then
        return nil  -- No enhancement found for this tier
    end

    -- Return a random enhancement from the filtered list.
    return filtered[math.random(#filtered)]
end


-- Just give out random for now.
-- Will work out a decent algorithm later to better assign suitable items.
-- 7.42 timings: 0 / 17 / 32 / 52 min (2 min behind the game's 0 / 15 / 30 / 50), halved in turbo.
function NeutralItems.GiveNeutralItems(TeamRadiant, TeamDire)
    local isTurboMode = Helper.IsTurboMode()

    -- Tier 1 Neutral Items
    if (isTurboMode and Helper.DotaTime() >= 0 or Helper.DotaTime() >= 0)
    and not isTierOneDone
    then
        GameRules:SendCustomMessage('Bots receiving Tier 1 Neutral Items...', 0, 0)

        for _, h in pairs(TeamRadiant) do
            NeutralItems.GiveItem(Tier1NeutralItems[RandomInt(1, #Tier1NeutralItems)], h, isTierOneDone, 1)
        end

        for _, h in pairs(TeamDire) do
            NeutralItems.GiveItem(Tier1NeutralItems[RandomInt(1, #Tier1NeutralItems)], h, isTierOneDone, 1)
        end

        isTierOneDone = true
    end

    -- Tier 2 Neutral Items
    if (isTurboMode and Helper.DotaTime() >= 8.5 * 60 or Helper.DotaTime() >= 17 * 60)
    and not isTierTwoDone
    then
        GameRules:SendCustomMessage('Bots receiving Tier 2 Neutral Items...', 0, 0)

        for _, h in pairs(TeamRadiant) do
            NeutralItems.GiveItem(Tier2NeutralItems[RandomInt(1, #Tier2NeutralItems)], h, isTierOneDone, 2)
        end

        for _, h in pairs(TeamDire) do
            NeutralItems.GiveItem(Tier2NeutralItems[RandomInt(1, #Tier2NeutralItems)], h, isTierOneDone, 2)
        end

        isTierTwoDone = true
    end

    -- Tier 3 Neutral Items
    if (isTurboMode and Helper.DotaTime() >= 16 * 60 or Helper.DotaTime() >= 32 * 60)
    and not isTierThreeDone
    then
        GameRules:SendCustomMessage('Bots receiving Tier 3 Neutral Items...', 0, 0)

        for _, h in pairs(TeamRadiant) do
            NeutralItems.GiveItem(Tier3NeutralItems[RandomInt(1, #Tier3NeutralItems)], h, isTierTwoDone, 3)
        end

        for _, h in pairs(TeamDire) do
            NeutralItems.GiveItem(Tier3NeutralItems[RandomInt(1, #Tier3NeutralItems)], h, isTierTwoDone, 3)
        end

        isTierThreeDone = true
    end

    -- Tier 4 Neutral Items (last tier in 7.42)
    if (isTurboMode and Helper.DotaTime() >= 26 * 60 or Helper.DotaTime() >= 52 * 60)
    and not isTierFourDone
    then
        GameRules:SendCustomMessage('Bots receiving Tier 4 Neutral Items...', 0, 0)

        for _, h in pairs(TeamRadiant) do
            NeutralItems.GiveItem(Tier4NeutralItems[RandomInt(1, #Tier4NeutralItems)], h, isTierThreeDone, 4)
        end

        for _, h in pairs(TeamDire) do
            NeutralItems.GiveItem(Tier4NeutralItems[RandomInt(1, #Tier4NeutralItems)], h, isTierThreeDone, 4)
        end

        isTierFourDone = true
    end
end

function NeutralItems.GiveItem(itemName, hero, isTierDone, nTier)
    NeutralItems:RemoveEnhan(hero)
    if hero:HasRoomForItem(itemName, true, true)
    then
        local item = CreateItem(itemName, hero, hero)
        item:SetPurchaseTime(0)

        if NeutralItems.HasNeutralItem(hero)
        and isTierDone
        then
            hero:RemoveItem(hero:GetItemInSlot(DOTA_ITEM_NEUTRAL_SLOT))
            NeutralItems:RemoveEnhan(hero)
            hero:AddItem(item)
        else
            hero:AddItem(item)
        end
        local enhancement = NeutralItems:GetRandomEnhanByTier(nTier)
        if enhancement then
            local enha = CreateItem(enhancement.name, hero, hero)
            enha:SetPurchaseTime(0)
            hero:AddItem(enha)
        end
    end
end

function NeutralItems:RemoveEnhan(unit)
	for idx = 1, 20 do
		local currentItem = unit:GetItemInSlot(idx)
		if currentItem ~= nil then
			if string.find(currentItem:GetName(), "item_enhancement") then
				unit:RemoveItem(currentItem)
				-- return
			end
		end
	end
end

function NeutralItems.HasNeutralItem(hero)
    if not hero then
        return false
    end

    local item = hero:GetItemInSlot(DOTA_ITEM_NEUTRAL_SLOT)
    if item then
        return true
    end

    return false
end

return NeutralItems
