// ============================================================
//  ARTIST CONFIG — Travis Scott / CACTIGOLD
// ============================================================

export const SITE_NAME = "CACTIgold";
export const SITE_DESCRIPTION = "The Best Travis Scott Tracker In The World!";
export const SITE_URL = "https://cactigold.pages.dev/";
export const OG_IMAGE_URL = "";

export function getArtistName(eraName?: string): string {
  return "Travis Scott";
}

export const CUSTOM_IMAGES: Record<string, string> = {
  "The Graduates":              "",
  "The Classmates":             "",
  "Owl Pharaoh":                "https://i.ibb.co/3yHnBdZ/owl-pharaoh.jpg",
  "Days Before Rodeo":          "https://i.ibb.co/k8Q6vhV/days-before-rodeo.jpg",
  "Days Before Rodeo (Re-Release)": "https://i.ibb.co/k8Q6vhV/days-before-rodeo.jpg",
  "Rodeo":                      "https://i.ibb.co/Gp4V1bX/rodeo.jpg",
  "Birds":                      "https://i.ibb.co/jMpV5sB/birds-in-the-trap.jpg",
  "Huncho Jack, Jack Huncho":   "https://i.ibb.co/FqMzNgY/huncho-jack.jpg",
  "Astroworld":                 "https://i.ibb.co/Gp1rq4N/astroworld.jpg",
  "JackBoys":                   "https://i.ibb.co/NWkyqzG/jackboys.jpg",
  "The Scotts":                 "https://i.ibb.co/MnKtGkq/the-scotts.jpg",
  "Utopia [P1]":                "https://i.ibb.co/Kz3mVnF/utopia.jpg",
  "Utopia [P2]":                "https://i.ibb.co/Kz3mVnF/utopia.jpg",
  "JackBoys 2":                 "",
  "Post-Utopia":                "",
  "Unknown":                    "",
};

// ORDER MATTERS — determines era sort order on the grid
export const ALBUM_RELEASE_DATES: Record<string, string> = {
  "The Graduates":              "??/??/????",
  "The Classmates":             "??/??/????",
  "Owl Pharaoh":                "05/25/2013",
  "Days Before Rodeo":          "08/27/2014",
  "Rodeo":                      "09/04/2015",
  "Birds":                      "09/02/2016",
  "Huncho Jack, Jack Huncho":   "12/21/2017",
  "Astroworld":                 "08/03/2018",
  "JackBoys":                   "12/27/2019",
  "The Scotts":                 "04/29/2020",
  "Utopia [P1]":                "??/??/????",
  "Utopia [P2]":                "07/28/2023",
  "JackBoys 2":                 "??/??/????",
  "Post-Utopia":                "??/??/????",
  "Unknown":                    "??/??/????",
};

export const HIDDEN_ALBUMS: string[] = ["Unknown"];

export const ALBUM_DESCRIPTIONS: Record<string, string> = {
  "The Graduates":
    "Travis Scott's early duo work with childhood friend Christopher Jones (as Chris Holloway). They released one EP on MySpace in 2008 and possibly other lost projects. Era spans April 2007–April 2009.",
  "The Classmates":
    "Collaborative era with OG Chess. The duo released several projects on MySpace and Facebook including the B.A.P.E. Mixtape, Buddy Rich, Cruis'n USA, and The Classmates EP. Era spans April 2009–2011.",
  "Owl Pharaoh":
    "Travis Scott's breakout mixtape era, featuring heavy Kanye West collaboration and production. Released as a free EP on May 25, 2013. Era spans 2011–2013.",
  "Days Before Rodeo":
    "Acclaimed free mixtape released August 27, 2014, featuring production from Kanye West, Mike Dean, WondaGurl, and others. Songs from this era overlap with early Rodeo sessions.",
  "Rodeo":
    "Travis Scott's debut studio album, released September 4, 2015 on Epic Records. Features guest appearances from Kanye West, Justin Bieber, Juicy J, Young Thug, and more.",
  "Birds":
    "Birds in the Trap Sing McKnight — Travis Scott's second studio album, released September 2, 2016. Features André 3000, Kid Cudi, Kendrick Lamar, and more. Sessions overlap with Astroworld.",
  "Huncho Jack, Jack Huncho":
    "Collaborative album with Quavo of Migos, released December 21, 2017. Songs fit within the Birds and Astroworld timeframes.",
  "Astroworld":
    "Travis Scott's third studio album, released August 3, 2018. Named after a defunct Houston amusement park. Features Drake, Frank Ocean, The Weeknd, Kid Cudi, and more.",
  "JackBoys":
    "Cactus Jack Records collective EP featuring Travis Scott, Don Toliver, Sheck Wes, Luxury Tax, and Chase B. Released December 27, 2019.",
  "The Scotts":
    "Collaborative project between Travis Scott and Kid Cudi, released April 29, 2020.",
  "Utopia [P1]":
    "First phase of sessions for Travis Scott's fourth studio album Utopia. Work began circa 2019–2021, featuring extensive collaboration with producers including Mike Dean, Gesaffelstein, and Tame Impala.",
  "Utopia [P2]":
    "Second phase of Utopia sessions leading up to the album's release on July 28, 2023. Features James Blake, SZA, Bon Iver, and many more.",
  "JackBoys 2":
    "Sequel to the JackBoys collective EP, status currently unknown.",
  "Post-Utopia":
    "Travis Scott's ongoing musical era following the release of Utopia in 2023.",
};

export const CUSTOM_ALBUM_INFO: Record<string, string[]> = {};

// Map speculative eras (asterisk) and alternate spellings to canonical names
export const ERA_MAPPINGS: Record<string, string> = {
  "The Graduates*":            "The Graduates",
  "The Classmates*":           "The Classmates",
  "Owl Pharaoh*":              "Owl Pharaoh",
  "Days Before Rodeo*":        "Days Before Rodeo",
  "Rodeo*":                    "Rodeo",
  "Birds*":                    "Birds",
  "Astroworld*":               "Astroworld",
  "JackBoys*":                 "JackBoys",
  "Utopia [P1]*":              "Utopia [P1]",
  "Utopia [P2]*":              "Utopia [P2]",
  "JackBoys 2*":               "JackBoys 2",
  "Post-Utopia*":              "Post-Utopia",
  // Released sheet uses "Utopia" without phase designation
  "Utopia":                    "Utopia [P2]",
};

export const TAG_MAP: Record<string, string> = {
  "⭐": "Best Of",
  "🏆": "Grails",
  "🥇": "Wanted",
  "🏅": "Wanted",
  "✨": "Notable",
  "💛": "By CACTIgold",
  "🗑️": "Worst Of",
  "🗑": "Worst Of",
  "🚮": "Unwanted",
  "🤖": "AI",
  "⁉️": "Lost Media",
  "⁉": "Lost Media",
  "❓": "Unknown",
};

export const CHATBOT_NAME = "CactiBot";
export const CHATBOT_SUBTITLE = "Ask anything about Travis's music";
export const CHATBOT_AVATAR_URL = "";

export const TAG_TOOLTIP_MAP: Record<string, string> = {
  "Best Of":      "Some of the best leaks hosted on the tracker.",
  "Grails":       "The most wanted songs that have not yet leaked in full.",
  "Wanted":       "Songs that are wanted, but not as much as Grails.",
  "Notable":      "Notable songs worth highlighting.",
  "Worst Of":     "Some of the worst leaks on the tracker.",
  "Unwanted":     "Songs we don't want to see leak in full.",
  "AI":           "Track contains AI vocals.",
  "Lost Media":   "Currently lost, or no link to the media is known.",
  "By CACTIgold": "Leaks & songs added by the owner of the site.",
};
