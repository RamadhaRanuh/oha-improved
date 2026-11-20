--[[
Your own trash talk lines for bots with the `smartchat` behaviour flag (bots/FunLib/behavior/talk).
They are mixed into the built-in lines for the same moment, at every Trash_Talk_Level from 1 up.

Keys (the moment a line is used for):
  kill, revenge, throwback, streak, first_blood        -- a bot just killed someone
  death_tilt, death_calm, flame_team                   -- a bot just died
  fight_won, fight_lost, cocky, desperate              -- team moments
  our_ancient_low, their_ancient_low, game_start, pile_on
  reply_ez, reply_insult, reply_bot, reply_report, reply_mom, reply_qmark, reply_challenge,
  reply_excuse, reply_chill, reply_compliment, reply_laugh, reply_greet, reply_question, reply_unknown,
  reply_gg_ahead, reply_gg_behind, reply_end_ahead, reply_end_behind   -- a human typed in all chat

Placeholders: {t} target hero ("cm"), {tk} target kills-deaths ("1-6"), {d} target deaths, {me} the bot's
hero, {mk} the bot's kills-deaths, {ally} one of the bot's teammates, {q} the target's own earlier trash
talk, {score} team kills ("20-5"). A "|" splits a line into separate quick messages.

Like general.lua, a copy in <Steam\steamapps\common\dota 2 beta\game\dota\scripts\vscripts\game\Customize>
wins over this file and survives workshop updates.
--]]
return {
    -- kill = { "example line for {t}", "first message|second message" },
}
