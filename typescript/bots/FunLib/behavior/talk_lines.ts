/**
 * The chat line bank for behavior/talk (flag `smartchat`). Pure data: compiles to Lua and to JavaScript.
 *
 * Built from how human Dota players trash talk in all chat (Lim et al. 2024, Southeast Asian /all chat logs;
 * Halonen 2024, a 3-million-word Dota chat corpus): taunts right after small wins, a bare "?" after an enemy
 * mistake, provocations even while losing, minimising the enemy's success ("lucky"), quoting scores,
 * challenges, throwing a player's own trash talk back after killing them, flaming one's own team in all
 * chat, and short lowercase messages full of lol / gg / ez / wp / u.
 *
 * Placeholders: {t} target hero nickname, {tk} target kills-deaths, {d} target deaths, {me} speaker
 * nickname, {mk} speaker kills-deaths, {ally} a teammate's nickname, {q} the target's own earlier words,
 * {score} team kills "ours-theirs". A line with a placeholder that cannot be filled is skipped.
 * "|" splits a line into a burst of separate messages.
 *
 * Tiers: `mild` lines are used at every trash-talk level; `harsh` lines (swearing, mom jokes, touch-grass
 * roasts) only at Trash_Talk_Level 3. Persona lines are added to the pool twice, so a persona's voice shows.
 * Rule for every line: it has to be funny. No slurs, nothing about self-harm.
 */
import type { PersonaName } from "./persona";

export interface LineSet {
    mild: string[];
    harsh?: string[];
    persona?: Partial<Record<PersonaName, string[]>>;
}

export type Kind =
    | "kill"
    | "revenge"
    | "throwback"
    | "streak"
    | "first_blood"
    | "death_tilt"
    | "death_calm"
    | "flame_team"
    | "fight_won"
    | "fight_lost"
    | "cocky"
    | "desperate"
    | "our_ancient_low"
    | "their_ancient_low"
    | "game_start"
    | "pile_on"
    | "reply_qmark"
    | "reply_report"
    | "reply_bot"
    | "reply_mom"
    | "reply_ez"
    | "reply_insult"
    | "reply_challenge"
    | "reply_excuse"
    | "reply_chill"
    | "reply_end_ahead"
    | "reply_end_behind"
    | "reply_gg_ahead"
    | "reply_gg_behind"
    | "reply_compliment"
    | "reply_laugh"
    | "reply_greet"
    | "reply_question"
    | "reply_unknown";

export const LINES: Record<Kind, LineSet> = {
    kill: {
        mild: [
            "?",
            "??",
            "ez",
            "sit",
            "sit down {t}",
            "next",
            "{tk} lol",
            "free",
            "thx for the gold {t}",
            "nice try",
            "sleep tight {t}",
            "that was a donation right",
            "lmao",
            "too slow",
            "bro walked straight into me",
            "go farm jungle {t}, its safer",
            "didnt even need ult",
            "deleted",
            "{t} more like free gold",
            "was that the plan?",
            "where u going {t}",
            "that tp was a mistake huh",
            "{t} the walking bounty rune",
            "u ok {t}?",
            "free mmr",
            "outplayed|lol",
        ],
        harsh: [
            "sit the fuck down {t}",
            "holy shit {t} ur bad",
            "what the fuck was that {t}",
            "{tk} jesus christ",
            "who taught u this game, a creep?",
            "go back to turbo {t}",
            "touch grass {t}, the grass misses u",
            "even my courier dodges better than u",
            "is ur monitor on {t}",
            "delete dota, install minesweeper",
            "were u even holding the mouse",
            "ur mom plays {t} better and shes afk",
            "{tk}. uninstall. today.",
            "get fucked {t} lmao",
            "bro is a walking ATM",
            "ur parents should take the pc away {t}",
            "that was so bad i almost felt sorry|almost",
        ],
        persona: {
            bully: ["get off my lane {t}", "u dont want this lane {t}", "again?", "ur afraid of me now right"],
            playmaker: ["found u {t}", "smoke diff", "i'll be back {t}", "ward ur jungle lol"],
            greedy: ["thx for coming to my jungle", "farming u is faster than creeps"],
            hothead: ["SIT", "EZZZZ", "GET REKT {t}"],
            guardian: ["sorry {t}", "oops"],
        },
    },
    revenge: {
        mild: [
            "remember me {t}?",
            "told u im coming {t}",
            "not so ez now huh",
            "who's laughing now",
            "u had ur fun, now sit",
            "i was waiting for this all game {t}",
            "payback",
            "1-1 {t}",
            "karma {t}",
        ],
        harsh: ["payback bitch", "remember me now {t}? fuck off", "thats for earlier u little shit"],
        persona: { hothead: ["REVENGE", "HOW DOES IT FEEL {t}"] },
    },
    throwback: {
        mild: [
            '"{q}" lmao',
            "{q}? ok buddy",
            "still {q} {t}?",
            "typing {q} then dying, classic",
            "remember when u said {q}",
            "{q}|lol",
        ],
        harsh: ['"{q}" he said|then died', "{q} my ass {t}", "type {q} again, i dare u"],
    },
    streak: {
        mild: [
            "{mk} btw",
            "{mk} whos carrying who",
            "im the problem? {mk}",
            "{mk}, somebody stop me pls",
            "ward ur jungle lol {mk}",
            "{mk} and its not even close",
        ],
        harsh: ["{mk} u guys are fucking free", "{mk}, are u all on ur phones?"],
    },
    first_blood: {
        mild: ["first blood ez", "fb lol", "gg already", "1-0", "glhf... well not for u {t}", "that was fast"],
        harsh: ["first blood, first of many {t}", "{t} fb, what a fucking start"],
    },
    death_tilt: {
        mild: [
            "lucky",
            "lucky {t}",
            "nice ult spam",
            "ok {t} u got one, congrats",
            "lag",
            "wtf",
            "this hero is broken",
            "enjoy it while it lasts {t}",
            "u wont get another one",
            "i was afk",
            "report {t} maphack",
            "my team watching like its a movie",
            "ok that was bs",
            "how",
            "imagine needing 3 heroes for me lol",
        ],
        harsh: ["fucking lag", "WTF", "lucky piece of shit", "ok {t} enjoy it, its ur only kill all game", "this game is fucking rigged"],
        persona: {
            hothead: ["WTF", "LUCKY", "HOW IS THAT FAIR"],
            greedy: ["my farm|my precious farm", "i was 2 hits from my item"],
            bully: ["u needed help for that lol", "1v1 me without ur team {t}"],
        },
    },
    death_calm: {
        mild: ["wp", "my bad", "nice one", "ok that was clean", "fair", "wp {t}", "well played"],
        persona: { guardian: ["sorry team", "i'll ward better", "my fault guys"] },
    },
    flame_team: {
        mild: [
            "{ally} where were u",
            "{ally} are u farming or sightseeing",
            "nice tp {ally}, 10 seconds late",
            "5v1 lmao my team",
            "{ally} buy wards or uninstall",
            "thanks for the help team",
            "{ally} report",
            "im playing 1v5 here",
            "{ally} still farming that jungle huh",
            "ok team, i'll do it alone again",
        ],
        harsh: [
            "{ally} where the fuck were u",
            "{ally} ur useless",
            "my team is a fucking charity",
            "{ally} even a creep would have helped",
            "who picked {ally} lmao",
        ],
        persona: { hothead: ["THIS TEAM", "{ally} WAKE UP"], greedy: ["supports no wards again", "{ally} stack a camp for once"] },
    },
    fight_won: {
        mild: ["?", "ez game", "where u going lol", "next", "gg go next", "team diff", "all of u sit", "lol", "ff?", "teamfight diff"],
        harsh: ["get fucked lmao", "that was embarrassing to watch", "holy shit u guys are bad", "5 man and still lost lmao"],
        persona: { hothead: ["EZZZZ", "????"], playmaker: ["perfect", "too easy"], bully: ["who's next", "come back for more"] },
    },
    fight_lost: {
        mild: ["END", "gg", "report my team", "this team lol", "who initiated that, my grandma?", "{ally} nice bkb", "lucky fight", "u needed all 5 for that lol"],
        harsh: ["what the fuck was that team", "{ally} ur fucking blind", "unbelievable shit", "my team is a war crime"],
        persona: { hothead: ["I QUIT", "WHY DID WE FIGHT"], guardian: ["we needed to wait", "regroup pls"] },
    },
    cocky: {
        mild: ["end?", "ff at 20", "gg next", "want us to wait for u to farm?", "{score} lol", "this is like playing vs bots", "are u guys bots?", "can we end, i have dinner"],
        harsh: ["ur team is fucking hopeless", "{score}, just alt f4", "i've seen better teams in turbo"],
    },
    desperate: {
        mild: ["gg", "end", "ok ok u win", "this game is cursed", "{ally} carry us pls", "comeback team", "high ground defence inc", "one fight and we're back"],
        harsh: ["my team is fucking trash", "who drafted this shit"],
    },
    our_ancient_low: {
        mild: ["gg", "gg wp", "report {ally}", "end it", "we'll get u next time"],
        harsh: ["gg my team is shit", "ok whatever, gg"],
    },
    their_ancient_low: {
        mild: ["gg ez", "gg no re", "gg go next", "commend me", "ez mmr", "gg wp|well, gg"],
        harsh: ["gg ez, uninstall", "gg ez noobs"],
    },
    game_start: {
        mild: ["glhf", "gl", "gl hf", "lets go", "plz no report", "mid or feed", "gl, u'll need it"],
        persona: { bully: ["ez"], guardian: ["gl hf all"] },
    },
    pile_on: {
        mild: ["lol", "+1", "this guy", "{t} typing more than farming", "lmao", "^"],
        harsh: ["{t} shut up and play", "someone mute this clown"],
    },
    reply_qmark: {
        mild: ["?", "??", "what", "???", "use words", "question mark guy", "keyboard broken?"],
        harsh: ["? ur mom"],
    },
    reply_report: {
        mild: ["report urself", "reported for being bad", "go ahead, valve doesnt care", "report for what, being better?", "ok i reported u back", "report noob lol"],
        harsh: ["report deez", "cry to valve {t}"],
    },
    reply_bot: {
        mild: [
            "bot? im {mk} vs u",
            "if im a bot what does that make u lol",
            "bot with better kda than u",
            "no ur a bot",
            "imagine losing to a bot",
            "nah im just good",
            "beep boop sit down",
            "my reaction time is just better than urs",
        ],
        harsh: ["the bot is shitting on u {t}", "a bot with a job and a better kda"],
    },
    reply_mom: {
        mild: ["ur mom plays better", "at least my mom doesnt watch me feed", "mom joke, very original", "ur mom told me to go easy on u"],
        harsh: ["ur mom carried harder last night", "ur mom is in my party, she says ur adopted"],
    },
    reply_ez: {
        mild: ["ez? {tk}", "ez for who lol", "says the guy with {d} deaths", "ok mr ez", "ez until it isnt", "talk when u carry", "{tk} and typing ez lol"],
        harsh: ["ez my ass {tk}", "shut the fuck up {t}, u got carried", "ez? u literally died {d} times"],
    },
    reply_insult: {
        mild: [
            "{tk} calling me noob lol",
            "ok {t}",
            "k",
            "cry more",
            "mad?",
            "u type better than u play",
            "noob? kill me then",
            "the scoreboard disagrees",
            "talk is cheap, ur gold is cheaper",
            "ok buddy",
            "{t} is mad lol",
        ],
        harsh: ["shut up and farm {t}", "fuck off {t}", "ur mom says hi", "cope harder {t}", "bitch im {mk}", "u talk a lot of shit for a {tk}"],
        persona: { bully: ["say that in lane"], hothead: ["SAY IT AGAIN", "COME HERE THEN"], guardian: ["ok", "sure"] },
    },
    reply_challenge: {
        mild: ["1v1 mid, loser uninstalls", "come then", "im right here", "bet", "u wont", "kill me then", "ok, mid, no runes"],
        harsh: ["come here and get fucked", "i'll be waiting, bring ur team, u need them"],
    },
    reply_excuse: {
        mild: ["sure, lag", "ya the lag killed u {d} times", "door again?", "unplug ur router, same result", "afk or just bad?"],
        harsh: ["lag my ass", "ur ping is fine, ur brain isnt"],
    },
    reply_chill: {
        mild: ["cry more", "chill its a game, also ur bad", "ok ok", "u started it", "toxic? its called honesty", "relax bro"],
        harsh: ["no u chill, {tk}", "awww is someone sad"],
    },
    reply_end_ahead: {
        mild: ["ok ok, let me farm first", "no, suffer", "ending soon, relax", "patience", "after i get my rapier"],
        harsh: ["no, i want to watch u suffer {t}"],
    },
    reply_end_behind: {
        mild: ["end what lol", "u end, we wait", "not that easy", "come try"],
        harsh: ["end deez, come high ground"],
    },
    reply_gg_ahead: {
        mild: ["gg? we're not done", "gg wp", "already? i wanted more", "gg, but not yet"],
        harsh: ["gg? not yet, suffer"],
    },
    reply_gg_behind: {
        mild: ["gg wp", "not yet", "its not over", "gg my team"],
        harsh: ["gg my team is shit"],
    },
    reply_compliment: {
        mild: ["wp", "ty", "u too", "thx", "ya that was clean", "wp, still gonna kill u tho", "ty ty"],
        persona: { guardian: ["thanks!", "wp u too"] },
    },
    reply_laugh: { mild: ["xd", "lol", "lmao", "haha", "XD"] },
    reply_greet: { mild: ["gl hf", "hi", "glhf", "gl, u'll need it", "hf"] },
    reply_question: {
        mild: ["skill issue", "cuz ur bad", "ask ur team", "idk ask valve", "practice", "watch the replay", "git gud"],
        harsh: ["because ur fucking bad {t}"],
    },
    reply_unknown: {
        mild: ["?", "ok", "k", "cool story", "what", "lol", "and?", "who asked", "typing wont save u"],
        harsh: ["nobody asked {t}"],
    },
};
