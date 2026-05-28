import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { saveAs } from 'file-saver';
import { useSettings } from './SettingsContext';

export const TAG_TOOLTIP_MAP: Record<string, string> = {
  'Best Of': 'some of the best leaks hosted on the tracker.',
  'Grails': 'the most wanted songs that have not yet leaked in full.',
  'Wanted': 'Songs that are wanted, but not as wanted as "Grails".',
  'Special': 'special songs that are not good enough to be in Best Of, but still deserves to be highlighted.',
  'Worst Of': 'some of the worst leaks hosted on the tracker.',
  'Unwanted': 'Songs that we don\'t want to leak in full because they\'re shit',
  'AI': 'Track contains AI vocals.',
  'Lost Media': 'Is currently lost, or we don\'t have a link to the media.',
  'By YƵYGOLD': 'Leaks & Songs that added by the owner of the site.'
};

export const CUSTOM_IMAGES: Record<string, string> = {
  "The Graduates":               "https://i.ibb.co/bh2Pc9n/093a7274a7bc0f3201f0cb54dc8f952c-480x480x1.jpg",
  "The Classmates":              "https://i.ibb.co/7tZDJtSh/images.png",
  "Owl Pharaoh":                 "https://i.ibb.co/RGyGsxfy/Travis-Scott-Owl-Pharaoh.jpg",
  "Days Before Rodeo":           "https://i.ibb.co/PvFNwQkZ/Days-Before-Rodeo-Cover-Art.jpg",
  "Days Before Rodeo (Re-Release)": "https://i.ibb.co/PvFNwQkZ/Days-Before-Rodeo-Cover-Art.jpg",
  "Rodeo":                       "https://i.ibb.co/35sBRkRT/Travis-Scott-Rodeo.png",
  "Birds":                       "https://i.ibb.co/mCKFXjbZ/Travis-Scott-Birds-in-the-Trap-Sing-Mc-Knight.png",
  "Birds In The Trap Sing McKnight": "https://i.ibb.co/mCKFXjbZ/Travis-Scott-Birds-in-the-Trap-Sing-Mc-Knight.png",
  "Huncho Jack, Jack Huncho":    "https://i.ibb.co/KjGM5CPF/Huncho-Jack-Jack-Huncho-cover.jpg",
  "Astroworld":                  "https://i.ibb.co/LdWPYMcX/Travis-Scott-Astroworld.png",
  "JackBoys":                    "https://i.ibb.co/yBR8M2Mp/JACKBOYS-Album-Cover-by-JACKBOYS-Travis-Scott-December-27-2019.jpg",
  "The Scotts":                  "https://i.ibb.co/TDS0KsRF/05088be594de124bbe7dfc0b5155d227-1000x1000x1.png",
  "Utopia [P1]":                 "https://i.ibb.co/xtZYkj8W/attachment-travis-scott-utopia-cover-1.jpg",
  "Utopia [P2]":                 "https://i.ibb.co/d4HmQdgn/a51d5744-77d5-4de8-9f84-eded386804df-1440x1440.jpg",
  "Utopia":                      "https://i.ibb.co/d4HmQdgn/a51d5744-77d5-4de8-9f84-eded386804df-1440x1440.jpg",
  "JackBoys 2":                  "https://i.ibb.co/YBvxz43k/ab67616d00001e025d0f8a4c3623e02a79928288.jpg",
  "Post-Utopia":                 "https://i.ibb.co/s9wDW6wg/ab6761610000517419c2790744c792d05570bb71.jpg",
  "Unknown":                     "https://i.ibb.co/NndT3vts/2406.webp",
};

export const ALBUM_RELEASE_DATES: Record<string, string> = {
  "Before The College Dropout": "??/??/????",
  "The College Dropout": "02/10/2004",
  "Late Registration": "08/30/2005",
  "Graduation": "09/11/2007",
  "808s & Heartbreak": "11/24/2008",
  "Good Ass Job": "??/??/2009",
  "My Beautiful Dark Twisted Fantasy": "11/22/2010",
  "Watch The Throne": "08/08/2011",
  "Cruel Summer": "09/14/2012",
  "Thank God For Drugs": "??/??/2012",
  "Yeezus": "06/18/2013",
  "Cruel Winter [V1]": "??/??/2013",
  "Yeezus 2": "??/??/2014",
  "So Help Me God": "??/??/????",
  "SWISH": "??/??/2015",
  "The Life Of Pablo": "02/14/2016",
  "Cruel Winter [V2]": "??/??/????",
  "Wolves": "??/??/2016",
  "Turbo Grafx 16": "??/??/2016",
  "LOVE EVERYONE": "??/??/2018",
  "DAYTONA": "05/25/2018",
  "ye": "06/01/2018",
  "KIDS SEE GHOSTS": "06/08/2018",
  "NASIR": "06/15/2018",
  "K.T.S.E.": "06/23/2018",
  "Good Ass Job (2018)": "??/??/2018",
  "Yandhi [V1]": "??/??/2018",
  "Yandhi [V2]": "??/??/????",
  "JESUS IS KING": "10/25/2019",
  "Jesus Is Born": "12/25/2019",
  "God's Country": "??/??/????",
  "JESUS IS KING: The Dr. Dre Version": "??/??/????",
  "DONDA [V1]": "07/18/2020",
  "Donda [V2]": "??/??/????",
  "Donda [V3]": "08/29/2021",
  "Donda 2": "??/??/????",
  "WAR": "04/01/2022",
  "YEBU": "??/??/????",
  "Bad Bitch Playbook": "??/??/2023",
  "VULTURES 1": "02/10/2024",
  "VULTURES 2": "08/03/2024",
  "The Elementary School Dropout": "03/10/2024",
  "VULTURES 3": "??/??/????",
  "BULLY [V2]": "03/28/2026",
  "BULLY [V1]": "03/18/2025",
  "CUCK": "03/06/2025",
  "DONDA 2 (2025)": "04/29/2025",
  "NEVER STOP": "06/27/2025",
  "IN A PERFECT WORLD": "06/22/2025",
  "YE-I": "10/16/2023"
};

export const HIDDEN_ALBUMS = ['NASIR', 'K.T.S.E.', 'NEVER STOP', 'DAYTONA', 'The Elementary School Dropout', 'Jesus Is Born', 'Sunday Service Choir', 'YE-I'];

export const ALBUM_DESCRIPTIONS: Record<string, string> = {
  "DAYTONA": "DAYTONA is the third studio album by American rapper Pusha T. It was released on May 25, 2018, by G.O.O.D. Music and Def Jam Recordings. DAYTONA was announced by Kanye West via Twitter on April 19, 2018, alongside the album's release date. It was one of the Wyoming projects worked on during 2018 by Kanye.",
  "K.T.S.E.": "In an interview with Hot 97 in March of 2018, Taylor revealed that she had been working on music with Kanye in Wyoming, referring to him as \"Polo 'Ye\" - alluding to him returning to his old \"Polo-shirt roots\" (i.e. TCD-era production). The album was eventually put on the tail end of the Wyoming releases, releasing June 22nd, 2018. Kanye was notably still finishing the album on the plane ride to the albums LP, as confirmed in a Tweet from Kim Kardashian.",
  "NEVER STOP": "NEVER STOP is a collaborative album by American rappers King Combs and Ye. King Combs is the son of rapper Diddy. It was released on June 27, 2025, though Goodfellas Entertainment. It follows Combs' second extended play, C3. The album is the first collaborative project from Combs and the sixth collaborative effort from Ye. Combs and West served as executive producers on the album alongside lead artists, and West's daughter North, Jaas, and the Hooligans served as features.",
  "NASIR": "After the 2012 release of Life Is Good, Nas announced in January 2013 that he was working on a new album. Time would pass with little-word on the project, until the 2014 remix to ScHoolboy Q's \"Studio\", where Nas rapped that he, \"finished up [his] new album\" - however, no album ever materialized. In March 2016, Kanye Tweeted that he \"promised Obama Ima do beats on NAS' next album\". As if it was fate, on April 23rd, 2018, Kanye announced that he was executive producing Nas' next album. The album followed its expected release date, dropping June 15th, 2018.",
  "The Elementary School Dropout": "",
  "Before The College Dropout": "Before Kanye released his first album to critical acclaim in 2004, he pursued many other projects, including a rap trio group named the \"Go Getters\" and production for other rappers, including, but not limited to JAY-Z, Common, Talib Kweli, and Scarface. Two years before the release of The College Dropout, Kanye began releasing a series of mixtapes to generate hype and publicity for the eventual release of his first album. Kanye eventually signed with Roc-A-Fella records in August 2002.",
  "Be": "Sometime in 2004, Kanye started officially working on music with fellow Chicago MC, Common. Soon, the following year, Kanye would executive produce his 6th studio album, Be. Considered to be his comeback album after the commercial disaster of his previous release, Electric Circus, it was released under the G.O.O.D. Music label and received much critical acclaim, with many considering it to be Common's \"Magnum Opus\".",
  "The College Dropout": "Following his signing to Roc-A-Fella Records, Kanye released his debut studio album, The College Dropout. It features string arrangements, choirs, and his signature soul sampling, frequently branded as \"chipmunk soul\" for its sped-up and high-pitched nature. Contrary to the popular gangster-persona lyrics at the time, his songs mostly revolved around themes of family, materialism, religion, and racism. The inspiration for finally making his music came when he was in a near-fatal car crash.",
  "Late Registration": "Late Registration continues the social themes introduced in The College Dropout, but now with orchestral production influenced by co-producer Jon Brion. Kanye's newfound success allowed him to expand his ambitions from a single violinist to an entire string orchestra, mixing it with production including chipmunk soul and lullaby-like instrumentals. Lyrically, the album features a mix of more socially charged songs to more personal cuts. Production-wise, inspiration came from artists such as British trip-hop band Portishead and Fiona Apple's second album When The Pawn…",
  "Graduation": "Graduation is the third studio album from Kanye West. Inspiration came from stadium tours, indie rock, and house music. It was a considerable departure from the sound Kanye had used on his first two studio albums, which featured samples and inspirations from the soul and orchestral music Kanye grew up alongside. This album included a much more electronic sound, featuring layering synthesizers. Lyrically, Kanye analyzes himself and talks about his life after becoming famous and how the media criticize him.",
  "808s & Heartbreak": "Following the death of his mother due to complications after cosmetic surgery, his relationship with fiancé Alexis Phifer finally ending for good, and a struggle to adapt to his celebrity status, Kanye felt emotionally drained and lost. Kanye dealt with his pain by channeling it into a sonically stripped-down album, one dominated by his use of the titular Roland TR-808 drum machine and Auto-Tune. This album significantly influenced future hip-hop music, having influenced Drake, Future, Travis Scott, and more.",
  "Good Ass Job": "As far back as 2003, Kanye had planned a four-album series revolving around going to college, with Good Ass Job concluding the series. The death of his mother derailed this plan, with his fourth album becoming the somber 808s & Heartbreak. People still expected Good Ass Job to release, though, as Kanye's next album as late as early 2010. When the wake of the 2009 VMAs incident happened, it would cause Good Ass Job not to release. The title seems to have changed to MBDTF around May 2010 or atleast not called GAJ anymore. The cover included for this era is the original cover for the single \"POWER.\"",
  "My Beautiful Dark Twisted Fantasy": "Conceived during West's self-imposed exile following the 2009 VMA incident and further influenced by his deteriorating relationship with model Amber Rose, My Beautiful Dark Twisted Fantasy is a genre-bending masterpiece that explores the darker sides of celebrity, fame, and love. With grand production that sounds like the natural evolution of all the albums that came before it, this is seen by many as Kanye's best album, even earning an extremely rare 10/10 rating from Pitchfork.",
  "Watch The Throne": "Considered one of the most legendary collab albums of all time, Watch The Throne puts together two of the most legendary figures in music history for a full studio album. Kanye teams up with his big brother, JAY-Z, for an album, focused primarily on luxury, black excellence, and the American dream. The album's production also reflects that, and having been recorded by two future billionaires primarily in New York City's Tribeca Grand Hotel, how could it not?",
  "Cruel Summer": "A compilation of new songs from Kanye's label, G.O.O.D. Music, 2012's Cruel Summer is one of the most collaborative Kanye projects he accomplished. Featuring various collaborations with Pusha T, Big Sean, 2 Chainz, John Legend, and many more, this album spawned many big hits, including \"Mercy\" and the remix of the Chief Keef song \"Don't Like.\" This album also marks the first time Kanye would work with Travis Scott, an at-the-time complete unknown with no mixtape to his name.",
  "Thank God For Drugs": "Before Kanye chose the name Yeezus for his sixth solo album, the name was Thank God For Drugs. Recording started in 2012 and accelerated in early 2013, with Kanye and his producers producing material very quickly. The tracklist for the album boasted 20 songs, with around 3.5 hours of rough material created for the album. After changing the album's name to Yeezus, Kanye recruited Rick Rubin to cut down this material and take the music in a minimal direction.",
  "Yeezus": "Yeezus marked a complete reverse from the bombastic production that Kanye accomplished on My Beautiful Dark Twisted Fantasy. He swapped lush soul and anthemic hooks for splintering electro, acid house, and industrial force while packaging some of his most lewd and heart-crushing tales. Initially envisioned as Thank God For Drugs, a much larger project, Kanye would play the album for Rick Rubin, he later recalled listening to roughly 3-hours of unfinished material that seemed to need months worth of work - despite the release date being a month away. Kanye enlisted Rubin to refine and complete the project, finishing a majority of the songs just two days before release.",
  "Cruel Winter [V1]": "The 2013 version of Cruel Winter, the first version of the sequel to 2012's Cruel Summer, is a mystery. No single for this album was released, and most of the info comes from leakers and insiders. It had many songs with A Tribe Called Quest member Q-Tip, who was notably absent from Cruel Summer despite having already been signed to the label. There is no official cover for this album, so we're using a fanmade cover to represent this era.",
  "Yeezus 2": "After Rick Rubin and Kanye West cut down Yeezus to the final ten tracks, Kanye still saw potential in much of the cut material. Thus, shortly after Yeezus was released, an EP of leftovers titled Lost Yeezus was already being teased. The project then evolved into a full-fledged album of mostly new material, with Yeezus 2 acting as a codename before they could choose the last name. This project would develop into So Help Me God as the songs evolved.",
  "So Help Me God": "Announced in February 2015, So Help Me God is now one of Kanye's most infamous unreleased projects. Essentially being a more advanced version of the songs developed during the Yeezus 2 era, So Help Me God gained significant hype as the teaser tracks of \"Wolves,\" \"All Day,\" and \"Only One\" was revealed to the public. Despite intending to release the album in March 2015, Kanye never finished So Help Me God, and only a few songs from the era ended up on The Life Of Pablo.",
  "SWISH": "After changing the name of his 7th solo album from So Help Me God to SWISH, Kanye began to develop all new songs throughout mid-late 2015 meant for the album, with most of them eventually making it onto the final release of The Life Of Pablo. Kanye also continued to work on many So Help Me God and Yeezus 2 tracks, but by the end of 2015 and the start of 2016, Kanye had dropped most of these tracks from the tracklist for SWISH, which began to resemble the final TLOP tracklist strongly.",
  "The Life Of Pablo": "The Life Of Pablo is Kanye's 7th studio album, with constant name changes before release. Sporadic and scatter-shot, the album is one of a kind. The title refers to three people: artist Pablo Picasso, drug dealer Pablo Escobar, and Paul the Apostle, whose name is Pablo in Spanish. The album was initially released only on TIDAL, but later made its way to other streaming services with some updates. Kanye finally finished it by adding the track \"Saint Pablo.\"",
  "Cruel Winter [V2]": "After the 2013 rendition of Cruel Winter ended production, Kanye revived it in 2016. With only one official single released, this album took many ideas from popular music at the time, including many trap elements, remixes, and the biggest music stars. The label supposedly worked on it as late as November 2017, but the album has yet to come. There isn't an official cover for this album we know of, so we are using the single art for \"Champions.\"",
  "Wolves": "Wolves was meant to be a collabaration album between Kanye West & Drake. The project was first mentioned by Ye in an interview in 2015, and billboards would be spotted with the phrase \"Calabasas Is The New Abu Dhabi\" with the OVO and G.O.O.D. Music logos in mid-2016 which hinted the album was coming soon. Drake later even stated the album was finished and up to Kanye to release, but despite this multiple insiders have stated that Wolves was mainly just a session and nothing much came out of it. The cover used for this era is a recreation of the image used on the billboards.",
  "Turbo Grafx 16": "Immediately after Kanye released The Life of Pablo, he announced a whole new album titled Turbo Grafx 16, intended to be released in the summer of 2016. Kanye intended to pursue a futuristic sound, wanting to incorporate video game samples into the record. However, work on the album was short-lived, as Kanye began touring in August 2016 and scrapped the concept entirely after being diagnosed as bipolar. The cover included for this era is unofficial, despite being popular among Kanye fans.",
  "LOVE EVERYONE": "After Kanye was released from UCLA Medical Hospital and diagnosed as bipolar, he bought a ranch in Wyoming where he would produce his next album and multiple albums for his collaborators. The concept of the album came together in 2018. The album's subject matter varied wildly, with some songs being about introspection and change and others discussing his political views. The public name given for this album is LOVE EVERYONE, but it is known that Kanye likely considered the Hitler title longer.",
  "ye": "ye discusses topics in Kanye's life, including mental health, family, and addiction. He also explicitly announced his diagnosis of bipolar disorder through the album's artwork and a proclamation within the album. The seven-song project, created in Jackson Hole, Wyoming, was released alongside five other projects. Kanye revealed in an interview that after his infamous TMZ interview (in which he stated that slavery was a choice), he completely re-did his album with an entirely new theme.",
  "KIDS SEE GHOSTS": "Out of the five Wyoming projects from 2018, people consider KIDS SEE GHOSTS one of the best. This album focuses heavily on overcoming struggles caused by mental health, which Kanye and Cudi have been fighting. It's characterized by many psychedelic and rock-influenced elements, making for an album that sounds like nothing else. This album was officially released on June 8th, 2018, making it Kanye's second collab album.",
  "Good Ass Job (2018)": "Kanye and Chance collab project that people talked about for years before being officially announced in 2018. The project was supposed to be just seven tracks long, similar to all the Wyoming albums. The central theme of this project is a celebration, as many of the tracks we've heard from this project seem to be very joyful and uplifting. Kanye and Chance presumably canceled it sometime in 2019. This project has no covers we know of, so we have used unofficial artwork.",
  "Yandhi [V1]": "Upon hearing the beat to \"Hurricane\" during sessions for Good Ass Job (2018), Kanye became inspired to create a whole new album titled Yandhi. With the album's concept in his mind, Kanye and his producers began frenzied work as they developed multiple new songs throughout September 2018, aiming for a September 29 release date. As they did not meet this deadline, Kanye went to Uganda to conduct further work on the album, but delayed it indefinitely on November 13.",
  "Yandhi [V2]": "After Kanye delayed Yandhi indefinitely, he began working with record producer Timbaland to create \"more healing music\" for the album. Shortly after the announcement of the delay, Kanye underwent a sudden and dramatic conversion towards born-again evangelical Christianity, debuting the Sunday Service Choir at the start of 2019. The creation of the choir coincided with the songs on Yandhi taking a new Christian lyrical focus. Eventually, the album would morph into the thoroughly Christian JESUS IS KING by mid-2019.",
  "JESUS IS KING": "Following a revelation on Easter 2019 at Coachella, Kanye scrapped Yandhi and reworked it to focus on God and Christianity. This album ended up being JESUS IS KING. After a private listening party in Detroit, Kim Kardashian announced that the album would release on Sunday, September 29, following listening parties in Chicago and New York. It didn't, and there were no updates for almost a month. On October 20, 2019, Kanye suddenly reappeared on Twitter to announce the final release date.",
  "Jesus Is Born": "First announced on Kanye's interview with Zane Lowe on Apple's Beats 1 Radio station, Jesus Is Born is the first - and only - album from the Sunday Service Choir (also referred to as Sunday Service), a gospel choir founded and led by Kanye West. It would release on Christmas Day 2019, peaking at #2 on the Billboard U.S. Gospel charts, and #73 on the Billboard 200 charts. The album does not have a single original song, as all are interpolations of other artists' songs - or interpolations of Kanye West originals.",
  "Sunday Service Choir": "This Tab features all other Sunday Service Choir songs/performances that span across these eras: Yandhi / JESUS IS KING / God's Country / DONDA",
  "God's Country": "Shortly after the release of JESUS IS KING, Kanye (almost immediately) started working on new material. Songs from this era revolve around his faith while also consisting of dark themes (such as prison) and lyrics about current social issues. Initially announced as God's Country on May 20th, 2020 by Arthur Jafa, tracks from this album would go on to be developed further in the DONDA [V1] era, following Kanye getting new inspiration to make an album dedicated to his mother.",
  "JESUS IS KING: The Dr. Dre Version": "The release of JESUS IS KING was met with mixed reviews from fans and critics. Kanye then took to Twitter to announce that he was working on a new album with Dr. Dre. Initially conceived as a remix album, it eventually grew to incorporate mainly unreleased material. During the #WESTDAYEVER campaign, Kanye did on Twitter in 2020, it was supposed to release officially, but never did. It ended up being scrapped sometime in 2020, as stated by producer Dem Jointz. Kanye posted the cover in 2022, which is assumed to be for the album.",
  "DONDA [V1]": "With new inspiration to work on an album dedicated to his mother, Kanye continued working on previous demos and new ideas. The music of this era reflects Donda's impact on Kanye in a colorful sound while reflecting his mania and the stress he was going through focusing on his businesses while also running for President. With multiple failed release dates for the album, Kanye went into silence in early 2021, finishing up tracks until the album morphed into something very different.",
  "Donda [V2]": "After taking a break from music in early 2021, Kanye went to work at the Pio Pico studio in LA with an entirely new vision for the album. While the name remained the same, the sound shifted to be more experimental and less soulful. Working with producers such as E.VAX, Dem Jointz, and Digital Nas, Kanye went through hundreds of beats, laying down vocals and trying to come up with ideas for songs. This era would continue until Kanye decided to finalize the album, shifting to the more minimalistic release sound.",
  "Donda [V3]": "Almost a year after the initial announcement of Donda, a Beats by Dre ad revealed that a listening party would take place at the Mercedes-Benz Stadium in Atlanta. It happened, but the album didn't drop. Kanye moved into the stadium and lived there until the second listening event two weeks later. Once again, the album did not release. Ye later announced a third listening party at Soldier Field in Chicago, with the album coming the next day. It didn't. The album ended up releasing on August 29th, 2021 at 8AM EST, almost two days after the final listening party.",
  "Donda 2": "Donda 2 was announced by Ye via Instagram, being executive produced by Future. Ye then proceeded to get into many significant controversies. He hosted a listening party for it in Miami, in which many of the tracks were unfinished. It was released on the Stem Player a few days later, but it was still incomplete. Months later, Ye got into even more controversies, making him get dropped by Adidas, buy the social media Parler, and lose his billionaire status following his proclaiming \"White Lives Matter\" at Yeezy Season 9.",
  "WAR": "A collaborative project between Ye and James Blake. Sessions for the project began around April 2022. On his third Drink Champs interview, Ye referred to these sessions as work for \"their album\". Three songs from the project were played at a party featured on Naomi Campbell's Instagram, with the song \"What I Would Have Said At Virgil's Funeral\" being previewed in full at YZY Season 9 shortly thereafter. The project was presumably scrapped in the wake of Ye's numerous antisemitic comments.",
  "YEBU": "Days before Ye was set to hold YZY Season 9, he suddenly changed plans for the event and wore a \"White Lives Matter\" shirt. After that, Ye tweeted about going \"death con 3\" on Jewish people. Following an interview with Alex Jones in which he proclaimed himself a Nazi and claimed he \"liked Hitler,\" many fans and artists gave up supporting Ye and his antics. Following this and an \"apology\" posted on Instagram, Ye went silent for months and began working on new material in Italy with his frequent collaborators. Reportedly being made at the same time as VULTURES. The cover for this era is from the \"Someday We'll All Be Free\" single.",
  "Bad Bitch Playbook": "Ye and Ty Dolla $ign frequently collaborated during the sessions for YEBU, hinting at a joint project. A snippet featuring Ty was released on October 2nd, 2023, leading to the song \"BACK TO ME\", and confirming a joint album via Instagram. TMZ later reported that Ye was producing both a solo album and a collaborative one with Ty. Then, during the Saudi Arabia recording sessions for Bad Bitch Playbook Vol. 1 in November 2023, the name for the collaborative project between Ty Dolla $ign & Ye would be changed to Vultures, with that coming a sonic change in the project.",
  "VULTURES 1": "After the album's name change from Bad Bitch Playbook Vol. 1 to VULTURES 1, four listening parties were scheduled between December 12th, 2023, and February 9h, 2024. In 2024, Ye announced that VULTURES would be a trilogy, with the first installment dropping on February 9th, followed by the second and third albums in March and April. VULTURES 1 would end up being released on February 10tth, the day after the final listening party.",
  "VULTURES 2": "VULTURES 2 was announced alongside 2 other volumes of VULTURES, and was meant to release on March 8th, 2024, and then May 3rd, 2024. This album would've became the first release exclusive to the YZYAPP. The cover shows Ty Dolla $ign holding a portrait of his brother Big TC, who is currently in prison. After the album failed to drop on May 3rd, 2024, the direction of the project completely shifted, and was to be censored. The album failed to drop August 2nd and then dropped August 3rd with questionable mixing/songs.",
  "VULTURES 3": "Was announced alongside the 2 other volumes and was set to release on April 5th, 2024, however this didn't happen. The project was thought to have been scrapped after the rushed release of VULTURES 2, and Ye's apparent focus on his solo project BULLY. However, Ty stating that \"V3 boutta rip heads off\" in 88-Keys' Instagram Live chat, and Ye heart reacting a fan's message asking if the project still exists, seem to contridict this. The project was set to drop in 2025, however given Ye's recent statements against Ty Dolla $ign, and his signal on twitter that he was working to remove Ty from Melrose, it's assumed that the project is now scrapped. When asked if the album is coming, Ty Dolla $ign responded with \"Six Seven.\"",
  "BULLY [V1]": "On September 3rd, 2024, the CEO of Channel Candy, Ye's new touring company, confirmed that work on a new solo Ye album had began after the South Korea Vultures listening experience. On September 28th, 2024, on the second Haikou listening event, Ye confirmed that the album name is Bully, which references the movie with the same name that he posted on his Instagram story a few days prior to the event. On January 2nd, 2025, Ye announced the album would have AI on it after months of speculation, and that it could help AI become used more in music. After the release of Bully V1, Ye confirms his intention to re-record the AI on Bully, and stated it was being mixed.",
  "CUCK": "On March 6th, 2025, Ye tweeted, \"this next album got that antisemitic sound\" and \"my new sound called antisemitic\". This would mark a shift in Ye's soundscape, as his antisemitic ideas had been mostly contained to his Twitter at that time, besides a few one-off remarks about Jews on the VULTURES albums. On March 16th, 2025, Ye would tweet an image of a red swastika against a black background, declaring it as a \"NEW ALBUM COVER\". On April 2nd. 2025, DJ Akademiks would post a series of Tweets that eventually led to the announcement of a new album titled WW3, separating this project from BULLY.",
  "DONDA 2 (2025)": "After releasing Donda 2 via the Stem Player in 2022, Ye would eventually move onto other projects. However, the project never left his mind, with some songs continuing to be considered in the Vultures era. 2025 would see Ye enter a new era of creative fuel, once again working on multiple projects at once. With plans to release BULLY and CUCK, Ye also spoke of plans to \"officially\" release Donda 2, repeatedly saying he planned to rerecord verses and upload a \"finished\" version of the album.",
  "IN A PERFECT WORLD": "After taking to Twitter in May 2025 to \"denounce\" his antisemitism, Ye would go return to being mostly absent from social media/public eye. Around this same time, he and Bianca would admit themselves into a wellness retreat, with Bianca posting a snippet to her Instagram of Ye in his DROAM-ified home, backed by a new song that suggested a possible return/shift to religious themes once again. In late-June, Ye would announce another album name change to \"In A Perfect World\".",
  "BULLY [V2]": "After leaking the BULLY V1 visual albums on Twitter, Ye would promise to record over all the album's AI vocals. Throughout 2025, Ye would continue working on the album while teasing numerous release dates that would come and go. On June 20th, 2025, three singles would drop for the album, alongside two more dropping the following week; only one of these songs did not contain AI, being the previously unheard \"DAMN\". Later in 2025 into early 2026, YEEZY and its associates would repeatedly claim the album was now fully recorded, and that no AI would be used on its release. The album would finally drop on March 28th, 2026 with YEEZY only being partially truthful as some songs still contained AI, most prominent on the second half of the album.",
  "Ongoing": "",
  "YE-I": "Fully AI album made by damn james! and Gabe Shaddow in October 2023. Was completely unknown until damn james! revealed it existed and played the full album on his Instagram Live November 22nd, 2025. Somehow, Ye never knew the album existed. damn james! uploaded the album to YouTube on February 23rd, 2025. An updated SoundCloud version was teased but ultimately never released."
};

export const FILTER_TOOLTIPS: Record<string, string> = {
  'Snippet': 'Less than a minute of the song is available.',
  'Partial': 'More than a minute of the song is available.',
  'Beat Only': 'Only the instrumental of the song is available.',
  'Tagged': 'Full song is available, but with added tags not from the song itself.',
  'Stem Bounce': 'Full song that has been exported by anyone else who was not the intended person.',
  'Full': 'The entire song is available, but not the original file.',
  'OG File': 'The original entire file of a song is available.',
  'Confirmed': 'The song is unavailable, but has been confirmed to exist by people who have worked with Kanye.',
  'Rumored': 'The song is unavailable, but has been said to exist by reputable people within the leak community. Please take with a grain of salt.',
  'Conflicting Sources': "There have been reputable people who say the song does exist and reputable people who say the song doesn't exist. As it is not our place to say who's right or wrong, songs with conflicting sources will be marked as such.",

  'Not Available': 'Placeholder for unavailable songs.',
  'Recording': 'A non-digital copy is available. Usually live performances or someone playing the song.',
  'Low Quality': 'Anything lower than 128kbps (YouTube quality). Noticeably worse than High Quality or CD Quality.',
  'High Quality': 'Anything greater than or equal to 128kbps (YouTube quality) and less than 320kbps.',
  'CD Quality': 'Anything around 320kbps. Not a noticeable difference to Lossless quality.',
  'Lossless': 'Raw audio data, usually from leaked stems or sessions. Useful for audio editing, but not noticeably different to CD Quality.'
};

export const createSlug = (name: string) => encodeURIComponent(
  name
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
);

export function getSongSlug(song: any, allSongsInCollection: any[]): string {
  if (!song || !song.name) return 'NoName1';
  
  if (song.name.includes('???') || createSlug(song.name) === '') {
    let index = 1;
    const targetUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    for (const s of allSongsInCollection) {
      if ((s.name && s.name.includes('???')) || createSlug(s.name) === '') {
        const sUrl = s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '');
        if (s.name === song.name && sUrl === targetUrl && s.description === song.description) {
          return `NoName${index}`;
        }
        index++;
      }
    }
    return `NoName1`;
  }
  return createSlug(song.name) || 'NoName1';
}

export function getArtistName(eraName: string | undefined): string {
  if (!eraName) return "Kanye West";
  const albumNames = Object.keys(ALBUM_RELEASE_DATES);
  const donda3Index = albumNames.indexOf("Donda [V3]");
  const eraIndex = albumNames.indexOf(eraName);

  if (donda3Index !== -1 && eraIndex !== -1 && eraIndex > donda3Index) {
    return "YE";
  }
  return "Kanye West";
}

export function buildArtistTag(songName: string, eraName: string | undefined): string {
  let primary: string;
  const dashIdx = songName.indexOf(' - ');
  if (dashIdx !== -1) {
    primary = songName.substring(0, dashIdx);
    Object.keys(TAG_MAP).forEach(emoji => { primary = primary.replaceAll(emoji, ''); });
    primary = primary.replace(/[️]/g, '').trim();
  } else {
    primary = getArtistName(eraName);
  }

  const featMatch = songName.match(/\(feat\.\s*([^)]+)\)/i);
  if (featMatch) {
    return `${primary} feat. ${featMatch[1].trim()}`;
  }
  return primary;
}

export const TAG_MAP: Record<string, string> = {
  '⭐': 'Best Of',
  '🏆': 'Grails',
  '🥇': 'Wanted',
  '🏅': 'Wanted',
  '✨': 'Special',
  '💛': 'By YƵYGOLD',
  '🗑️': 'Worst Of',
  '🗑': 'Worst Of',
  '🚮': 'Unwanted',
  '🤖': 'AI',
  '⁉️': 'Lost Media',
  '⁉': 'Lost Media',
  '❓': 'Unknown'
};

export function formatTextForNotification(text: string | undefined | null, tagsAsEmojis: boolean): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      if (!tagsAsEmojis) {
        tags.push(`[${tag.toUpperCase()}]`);
      }
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tagsAsEmojis) {
    return text;
  }

  if (tags.length === 0) {
    return formattedText;
  }

  return `${formattedText} ${tags.join(' ')}`.trim();
}

export function formatTextWithTags(text: string | undefined | null) {
  if (!text) return null;

  let formattedText = text;
  const tags: { emoji: string, tag: string }[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push({ emoji, tag });
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length === 0) {
    return <>{formattedText}</>;
  }

  return <FormattedTextWithTags tags={tags} formattedText={formattedText} />;
}

function TagComponent({ t, tagsAsEmojis }: { t: { emoji: string, tag: string }, tagsAsEmojis: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tooltipText = TAG_TOOLTIP_MAP[t.tag];

  const updateRect = () => {
    if (tagRef.current) {
      setRect(tagRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isHovered]);

  useEffect(() => {
    if (isHovered) {
      const handleDocClick = (e: MouseEvent) => {
        if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
          setIsHovered(false);
        }
      };
      const timer = setTimeout(() => {
        document.addEventListener('click', handleDocClick);
        document.addEventListener('touchstart', handleDocClick);
      }, 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleDocClick);
        document.removeEventListener('touchstart', handleDocClick);
      };
    }
  }, [isHovered]);

  return (
    <div 
      ref={tagRef}
      className="relative flex items-center shrink-0 cursor-help"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered(!isHovered);
      }}
    >
      {tagsAsEmojis ? (
        <span className="shrink-0 flex items-center justify-center text-sm">{t.emoji}</span>
      ) : (
        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 bg-[var(--theme-color)]/10 text-[var(--theme-color)] font-bold">
          {t.tag}
        </span>
      )}

      {tooltipText && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, x: "-50%", y: "-100%", filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
                zIndex: 99999,
                transformOrigin: 'bottom center'
              }}
              className="w-48 sm:w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base flex items-center justify-center text-[var(--theme-color)]">{t.emoji}</span>
                  <span className="font-bold text-white text-xs">{t.tag}</span>
                </div>
                <p className="text-white/70 text-[11px] leading-snug whitespace-normal line-clamp-3">
                  {tooltipText}
                </p>
              </div>
              <div className="absolute top-full left-1/2 -ml-1.5 -mt-[1px] border-solid border-t-neutral-900 border-x-transparent border-b-transparent border-[6px]" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function FormattedTextWithTags({ tags, formattedText }: { tags: { emoji: string, tag: string }[], formattedText: string }) {
  const { settings } = useSettings();
  
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="truncate">{formattedText}</span>
      {tags.map((t, i) => (
        <TagComponent key={i} t={t} tagsAsEmojis={settings.tagsAsEmojis} />
      ))}
    </div>
  );
}

export function getCleanSongNameWithTags(text: string | undefined | null): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push(tag);
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length > 0) {
    return `${formattedText} [${tags.join(', ')}]`;
  }
  return formattedText;
}

export interface SongMeta {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkUrl?: string;
}

function checkMagicBytes(b: Uint8Array): '.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a' | null {
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return '.wav';
  if (b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return '.flac';
  if (b[0] === 0x46 && b[1] === 0x4F && b[2] === 0x52 && b[3] === 0x4D) return '.aiff';
  if (b[0] === 0x50 && b[1] === 0x4B) return '.zip';
  if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return '.ogg';
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return '.m4a';
  return null;
}

export async function detectAudioExt(blob: Blob): Promise<'.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a'> {
  const header = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(header);

  // If the file starts with an ID3v2 header, skip past it and re-check.
  // Some encoders prepend ID3 tags to lossless formats (FLAC, WAV) which would
  // otherwise be misdetected as MP3.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes[3] >= 2 && bytes[3] <= 4) {
    const sizeBuf = await blob.slice(6, 10).arrayBuffer();
    const sb = new Uint8Array(sizeBuf);
    const tagSize = ((sb[0] & 0x7F) << 21) | ((sb[1] & 0x7F) << 14) | ((sb[2] & 0x7F) << 7) | (sb[3] & 0x7F);
    const afterBuf = await blob.slice(10 + tagSize, 10 + tagSize + 12).arrayBuffer();
    const match = checkMagicBytes(new Uint8Array(afterBuf));
    return match ?? '.mp3';
  }

  return checkMagicBytes(bytes) ?? '.mp3';
}

function isImageBuffer(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, 12);
  // JPEG: FF D8
  if (b[0] === 0xFF && b[1] === 0xD8) return true;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;
  // GIF: 47 49 46
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  // WebP: 52 49 46 46 .... 57 45 42 50
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

async function compressArtworkToJpeg(buf: ArrayBuffer, maxPx = 800, quality = 0.85): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const mime = detectMime(buf);
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width || maxPx, img.height || maxPx));
      const w = Math.max(1, Math.round((img.width || maxPx) * scale));
      const h = Math.max(1, Math.round((img.height || maxPx) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(buf); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(blobUrl);
        if (!b) { resolve(buf); return; }
        b.arrayBuffer().then(resolve).catch(() => resolve(buf));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(buf); };
    img.src = blobUrl;
  });
}

async function fetchArtworkBuffer(artworkUrl: string): Promise<ArrayBuffer | null> {
  const proxies = [
    artworkUrl,
    `https://corsproxy.io/?${encodeURIComponent(artworkUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(artworkUrl)}`,
  ];
  for (const url of proxies) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (isImageBuffer(buf)) return buf;
      }
    } catch {
      // try next proxy
    }
  }
  return null;
}

// Minimal ID3v2.3 writer using Latin-1 encoding so Windows Explorer can edit the Details tab.
// browser-id3-writer writes UTF-16 text frames (encoding 0x01) which Windows can read but not edit.
function latin1Bytes(text: string): Uint8Array {
  return new Uint8Array(Array.from(text).map(c => { const n = c.charCodeAt(0); return n <= 0xFF ? n : 63; }));
}

function id3TextFrame(id: string, text: string): Uint8Array {
  const textBytes = latin1Bytes(text);
  const content = new Uint8Array(1 + textBytes.length); // encoding byte + text
  content[0] = 0x00; // Latin-1
  content.set(textBytes, 1);
  return id3Frame(id, content);
}

function id3ApicFrame(imageData: ArrayBuffer, mimeType: string): Uint8Array {
  const mimeBytes = latin1Bytes(mimeType);
  // encoding(1) + mime + null(1) + picType(1) + description null(1) + imageData
  const content = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + imageData.byteLength);
  let i = 0;
  content[i++] = 0x00; // Latin-1
  content.set(mimeBytes, i); i += mimeBytes.length;
  content[i++] = 0x00; // null terminator for MIME
  content[i++] = 0x03; // picture type: Cover front
  content[i++] = 0x00; // empty description (null terminator)
  content.set(new Uint8Array(imageData), i);
  return id3Frame('APIC', content);
}

function id3Frame(id: string, content: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + content.length);
  const view = new DataView(frame.buffer);
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
  view.setUint32(4, content.length, false);
  // bytes 8-9 are flags, left as 0x00 0x00
  frame.set(content, 10);
  return frame;
}

function stripID3v2(buffer: ArrayBuffer): ArrayBuffer {
  const b = new Uint8Array(buffer);
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b[3] >= 2 && b[3] <= 4) {
    const size = ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) | ((b[8] & 0x7F) << 7) | (b[9] & 0x7F);
    return buffer.slice(10 + size);
  }
  return buffer;
}

function detectMime(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, 4);
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  return 'image/jpeg';
}

// ─── FLAC → WAV conversion ────────────────────────────────────────────────────
// Decodes FLAC via WebAudio and re-encodes as 16-bit PCM WAV so downstream
// tag embedding can use the simpler ID3 path and players don't choke on
// the FLAC Vorbis-comment block.
function wavWriteString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export async function flacToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  let rawBuf = await blob.arrayBuffer();
  // Strip prepended ID3v2 header — browsers' FLAC decoders don't tolerate it.
  const hdr = new Uint8Array(rawBuf, 0, Math.min(10, rawBuf.byteLength));
  if (hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33 && hdr[3] >= 2 && hdr[3] <= 4) {
    const tagSize = ((hdr[6] & 0x7F) << 21) | ((hdr[7] & 0x7F) << 14) | ((hdr[8] & 0x7F) << 7) | (hdr[9] & 0x7F);
    rawBuf = rawBuf.slice(10 + tagSize);
  }
  const decoded = await ctx.decodeAudioData(rawBuf);
  ctx.close();

  const numCh = decoded.numberOfChannels;
  const sr = decoded.sampleRate;
  const numSamples = decoded.length;
  const dataSize = numSamples * numCh * 2; // 16-bit = 2 bytes
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  wavWriteString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  wavWriteString(view, 8, 'WAVE');
  wavWriteString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                          // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);             // byte rate
  view.setUint16(32, numCh * 2, true);                  // block align
  view.setUint16(34, 16, true);                         // bits per sample
  wavWriteString(view, 36, 'data'); view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, decoded.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

// Embeds ID3v2 tags into a WAV file as an 'id3 ' RIFF chunk.
// This keeps the file starting with "RIFF" (valid WAV) while carrying full
// ID3 metadata (title, artist, album, year, artwork) readable by macOS Music,
// foobar2000, VLC, and all other modern players.
export async function embedWAVTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  let src = new Uint8Array(await blob.arrayBuffer());
  // Strip a prepended ID3v2 header so we can reach the RIFF signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  if (src[0] !== 0x52 || src[1] !== 0x49 || src[2] !== 0x46 || src[3] !== 0x46) return blob;

  // Build ID3v2.3 tag
  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title)       frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album)  frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }
  if (meta.artworkUrl) {
    const artBuf = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuf) frames.push(id3ApicFrame(artBuf, detectMime(artBuf)));
  }
  if (frames.length === 0) return blob;

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const id3 = new Uint8Array(10 + framesSize);
  const id3v = new DataView(id3.buffer);
  id3[0] = 0x49; id3[1] = 0x44; id3[2] = 0x33; // "ID3"
  id3[3] = 0x03; id3[4] = 0x00; id3[5] = 0x00;  // v2.3, no flags
  id3v.setUint8(6, (framesSize >> 21) & 0x7F);
  id3v.setUint8(7, (framesSize >> 14) & 0x7F);
  id3v.setUint8(8, (framesSize >>  7) & 0x7F);
  id3v.setUint8(9,  framesSize        & 0x7F);
  let off = 10;
  for (const f of frames) { id3.set(f, off); off += f.length; }

  // Wrap in 'id3 ' RIFF chunk (pad to even length)
  const padded = id3.length + (id3.length % 2);
  const chunk = new Uint8Array(8 + padded);
  const cv = new DataView(chunk.buffer);
  wavWriteString(cv, 0, 'id3 '); cv.setUint32(4, id3.length, true);
  chunk.set(id3, 8);

  const out = new Uint8Array(src.length + chunk.length);
  out.set(src); out.set(chunk, src.length);
  new DataView(out.buffer).setUint32(4, out.length - 8, true); // update RIFF size
  return new Blob([out], { type: 'audio/wav' });
}

export async function embedID3Tags(blob: Blob, meta: SongMeta, cleanTitle: string, mimeType = 'audio/mpeg'): Promise<Blob> {
  const audioBuffer = await blob.arrayBuffer();
  const audio = stripID3v2(audioBuffer);

  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title) frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album) frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }

  if (meta.artworkUrl) {
    const artBuffer = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuffer) {
      frames.push(id3ApicFrame(artBuffer, detectMime(artBuffer)));
    }
  }

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const tag = new Uint8Array(10 + framesSize);
  const view = new DataView(tag.buffer);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // "ID3"
  tag[3] = 0x03; tag[4] = 0x00; // version 2.3.0
  tag[5] = 0x00; // no flags
  // synchsafe tag body size
  view.setUint8(6, (framesSize >> 21) & 0x7F);
  view.setUint8(7, (framesSize >> 14) & 0x7F);
  view.setUint8(8, (framesSize >> 7) & 0x7F);
  view.setUint8(9, framesSize & 0x7F);
  let offset = 10;
  for (const f of frames) { tag.set(f, offset); offset += f.length; }

  const out = new Uint8Array(tag.length + audio.byteLength);
  out.set(tag, 0);
  out.set(new Uint8Array(audio), tag.length);
  return new Blob([out], { type: mimeType });
}

// ─── FLAC tag embedding ────────────────────────────────────────────────────
// FLAC uses Vorbis comments (type 4) and PICTURE blocks (type 6), not ID3.

function u32LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]);
}
function u32BE(n: number): Uint8Array {
  return new Uint8Array([(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]);
}
function flacBlockHdr(type: number, isLast: boolean, length: number): Uint8Array {
  return new Uint8Array([
    (isLast ? 0x80 : 0x00) | (type & 0x7F),
    (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF,
  ]);
}
function utf8B(s: string): Uint8Array { return new TextEncoder().encode(s); }

function buildVorbisComment(comments: string[]): Uint8Array {
  const vendor = utf8B('reference libFLAC 1.3.4 20220220');
  const parts: Uint8Array[] = [u32LE(vendor.length), vendor, u32LE(comments.length)];
  for (const c of comments) { const cb = utf8B(c); parts.push(u32LE(cb.length), cb); }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildFLACPicture(imgData: ArrayBuffer, mime: string): Uint8Array {
  const mimeB = utf8B(mime); const imgB = new Uint8Array(imgData);
  const parts: Uint8Array[] = [
    u32BE(3), u32BE(mimeB.length), mimeB,
    u32BE(0), u32BE(0), u32BE(0), u32BE(0), u32BE(0),
    u32BE(imgB.length), imgB,
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function embedFLACTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  let src = new Uint8Array(buf);
  // Strip a prepended ID3v2 header so we can reach the fLaC signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  // Must start with fLaC
  if (src[0] !== 0x66 || src[1] !== 0x4C || src[2] !== 0x61 || src[3] !== 0x43) return blob;

  // Walk existing metadata blocks; strip any existing VORBIS_COMMENT (4) / PICTURE (6)
  const kept: { type: number; body: Uint8Array }[] = [];
  let pos = 4; let audioStart = 4;
  while (pos + 4 <= src.length) {
    const hdr = src[pos]; const isLast = (hdr & 0x80) !== 0; const type = hdr & 0x7F;
    if (type === 0x7F) break;
    const len = (src[pos + 1] << 16) | (src[pos + 2] << 8) | src[pos + 3];
    if (pos + 4 + len > src.length) break;
    if (type !== 4 && type !== 6) kept.push({ type, body: src.slice(pos + 4, pos + 4 + len) });
    audioStart = pos + 4 + len; pos = audioStart;
    if (isLast) break;
  }

  // Build Vorbis comment fields
  // Field names follow the Vorbis comment spec and Apple Music's expected keys.
  const comments: string[] = [];
  const title = meta.title || cleanTitle;
  if (title) comments.push(`TITLE=${title}`);
  if (meta.artist) {
    comments.push(`ARTIST=${meta.artist}`);
    // Apple Music uses ALBUMARTIST to group tracks into albums; without it,
    // songs often appear under "Unknown Album Artist."
    comments.push(`ALBUMARTIST=${meta.artist}`);
  }
  if (meta.album) comments.push(`ALBUM=${meta.album}`);
  if (meta.year) { const y = parseInt(meta.year, 10); if (!isNaN(y)) { comments.push(`DATE=${y}`); comments.push(`YEAR=${y}`); } }

  const vcBody = buildVorbisComment(comments);
  const rawArtBuf = meta.artworkUrl ? await fetchArtworkBuffer(meta.artworkUrl) : null;
  const artBuf = rawArtBuf ? await compressArtworkToJpeg(rawArtBuf) : null;
  const picBody = artBuf ? buildFLACPicture(artBuf, 'image/jpeg') : null;

  // Reassemble: fLaC + existing blocks + VORBIS_COMMENT + optional PICTURE + audio
  const blocks: { type: number; body: Uint8Array }[] = [...kept, { type: 4, body: vcBody }];
  if (picBody) blocks.push({ type: 6, body: picBody });

  const parts: Uint8Array[] = [new Uint8Array([0x66, 0x4C, 0x61, 0x43])];
  for (let i = 0; i < blocks.length; i++) {
    const { type, body } = blocks[i];
    parts.push(flacBlockHdr(type, i === blocks.length - 1, body.length), body);
  }
  parts.push(src.slice(audioStart));

  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }

  // Verify output block structure so we can diagnose tag visibility issues
  try {
    let vp = 4; let bi = 0;
    while (vp + 4 <= out.length) {
      const vh = out[vp]; const vl = (out[vp+1] << 16) | (out[vp+2] << 8) | out[vp+3];
      const vtype = vh & 0x7F; const vlast = (vh & 0x80) !== 0;
      if (vtype === 4) {
        // Log VORBIS_COMMENT body preview
        const bodyStart = vp + 4;
        const vendorLen = out[bodyStart] | (out[bodyStart+1]<<8) | (out[bodyStart+2]<<16) | (out[bodyStart+3]<<24);
        const commentCountOff = bodyStart + 4 + vendorLen;
        const commentCount = out[commentCountOff] | (out[commentCountOff+1]<<8) | (out[commentCountOff+2]<<16) | (out[commentCountOff+3]<<24);
        console.log(`[flac verify] block[${bi}] VORBIS_COMMENT len=${vl} last=${vlast} vendorLen=${vendorLen} commentCount=${commentCount}`);
        // Log first comment
        let cp = commentCountOff + 4;
        for (let ci = 0; ci < Math.min(commentCount, 4); ci++) {
          const cl = out[cp] | (out[cp+1]<<8) | (out[cp+2]<<16) | (out[cp+3]<<24);
          const cs = new TextDecoder().decode(out.slice(cp+4, cp+4+cl));
          console.log(`  comment[${ci}]: ${cs}`);
          cp += 4 + cl;
        }
      } else {
        console.log(`[flac verify] block[${bi}] type=${vtype} len=${vl} last=${vlast}`);
      }
      bi++; vp += 4 + vl;
      if (vlast) { console.log(`[flac verify] audio starts at byte ${vp} of ${out.length}`); break; }
    }
  } catch {}

  return new Blob([out], { type: 'audio/flac' });
}

function openFallback(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  // For same-origin URLs (e.g. /api/audio-proxy?...) the download attribute is
  // respected by the browser and overrides the server's Content-Disposition
  // filename.  Cross-origin URLs ignore the attribute, but we still set it so
  // same-origin fallbacks (which are the common case) get the right name.
  if (fileName) a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  // Google app (GSA), Facebook, Instagram, and similar WebViews don't support saveAs
  return /GSA\/|FBAN|FBAV|Instagram\//.test(ua);
}

function parseOgFilename(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(/^OG Filename:\s*(.+)$/im);
  if (!match) return null;
  const raw = match[1].trim().replace(/^["']|["']$/g, '');
  // Strip known audio extensions so extension logic below can normalize them
  return raw.replace(/\.(mp3|wav|flac|aif|aiff|m4a|ogg)$/i, '');
}

export async function resolveUrl(url: string): Promise<{ fetchUrl: string; isImage: boolean; imageExt?: string; headers?: Record<string, string> }> {
  if (url.includes('temp.imgur.gg/f/')) {
    const id = url.split('/f/')[1];
    if (id) {
      const res = await fetch(`https://temp.imgur.gg/api/file/${id}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.cdnUrl) return { fetchUrl: data.cdnUrl, isImage: false };
      }
    }
    return { fetchUrl: url, isImage: false };
  }
  if (url.includes('pillows.su/f/') || url.includes('pillowcase.su/f/')) {
    const pathPart = url.split('/f/')[1];
    const apiBase = url.includes('pillowcase.su') ? 'https://api.pillowcase.su' : 'https://api.pillows.su';
    return { fetchUrl: pathPart ? `${apiBase}/api/download/${pathPart}` : url, isImage: false };
  }
  if (url.includes('ibb.co')) {
    const apiRes = await fetch(`https://imgbb-file-get-api.vercel.app/api?url=${url}`).catch(() => null);
    if (apiRes && apiRes.ok) {
      const apiData = await apiRes.json().catch(() => null);
      if (apiData?.direct_link) return { fetchUrl: apiData.direct_link, isImage: true };
    }
    return { fetchUrl: url, isImage: true };
  }
  if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
    const match = url.match(/\.(png|jpg|jpeg)$/i);
    return { fetchUrl: url, isImage: true, imageExt: match ? match[0] : '.png' };
  }
  return { fetchUrl: url, isImage: false };
}

async function compressImageBlob(blob: Blob, maxDim = 2048, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(out => resolve(out ?? blob), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(blob); };
    img.src = objUrl;
  });
}

export async function handleDownloadFile(url: string, suggestedName: string, tagsAsEmojis: boolean, meta?: SongMeta, description?: string) {
  if (!url) return;
  let finalUrl = url;
  try {
    const ogName = parseOgFilename(description);
    let fileName = ogName ?? suggestedName;
    if (!tagsAsEmojis && !ogName) {
      fileName = formatTextForNotification(suggestedName, false);
    }

    let isImage = false;
    let ext = '.mp3';

    if (url.includes('temp.imgur.gg/f/')) {
        const id = url.split('/f/')[1];
        if (id) {
            const res = await fetch(`https://temp.imgur.gg/api/file/${id}`).catch(() => null);
            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.cdnUrl) finalUrl = data.cdnUrl;
            }
        }
    } else if (url.includes('pillows.su/f/') || url.includes('pillowcase.su/f/')) {
        const pathPart = url.split('/f/')[1];
        if (pathPart) {
            // Route through Pages Function proxy to avoid CORS block on api.pillows.su
            finalUrl = `/api/audio-proxy?url=${encodeURIComponent(`https://api.pillows.su/api/download/${pathPart}`)}`;
        }
    } else if (url.includes('ibb.co')) {
       isImage = true;
       ext = '';
       const apiRes = await fetch(`https://imgbb-file-get-api.vercel.app/api?url=${url}`).catch(() => null);
       if (apiRes && apiRes.ok) {
           const apiData = await apiRes.json().catch(() => null);
           if (apiData && apiData.direct_link) {
               finalUrl = apiData.direct_link;
           }
       }
    } else if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
        isImage = true;
        const match = url.match(/\.(png|jpg|jpeg)$/i);
        ext = match ? match[0] : '.png';
    } 

    if (!fileName.endsWith('.mp3') && !isImage) {
        fileName += ext;
    } else if (isImage && !fileName.match(/\.(png|jpg|jpeg)$/i)) {
        fileName += ext;
    }

    // In-app browsers (Google app, Facebook, Instagram) don't support saveAs via
    // the download attribute. Navigate directly to the download URL so the OS
    // download manager or system browser can handle it. Use the /api/download/
    // path (which includes the filename) so the server sends Content-Disposition:
    // attachment, triggering a real download instead of inline playback.
    if (isInAppBrowser()) {
      let directUrl = finalUrl;
      if (url.includes('pillows.su/f/') || url.includes('pillowcase.su/f/')) {
        const pathPart = url.split('/f/')[1];
        const apiBase = url.includes('pillowcase.su') ? 'https://api.pillowcase.su' : 'https://api.pillows.su';
        if (pathPart) directUrl = `${apiBase}/api/download/${pathPart}`;
      }
      window.location.href = directUrl;
      return;
    }

    let blob: Blob;
    try {
      const getWithTimeout = async (requestUrl: string, timeoutMs: number, extraHeaders?: Record<string, string>) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(requestUrl, {
            signal: controller.signal,
            ...(extraHeaders ? { headers: extraHeaders } : {}),
          });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          return null;
        }
      };

      // Use plain fetch (no timeout) for audio — mirrors the zip download path.
      // The 3-second getWithTimeout was aborting before pillows.su responded.
      // Images still get the short timeout + proxy fallback chain.
      let response: Response | null = isImage
        ? await getWithTimeout(finalUrl, 3000)
        : await fetch(finalUrl).catch(() => null);

      if (!response || !response.ok) {
        if (isImage) {
          const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(finalUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`
          ];

          for (const proxy of proxies) {
            response = await getWithTimeout(proxy, 4000);
            if (response && response.ok) break;
          }

          if (!response || !response.ok) {
             throw new Error("All proxies failed");
          }
        } else {
          throw new Error("Network error");
        }
      }

      // Guard: reject clearly non-audio/non-binary responses (HTML error pages, JSON, etc.)
      const responseCt = response.headers.get('content-type') ?? '';
      if (responseCt.startsWith('text/html') || responseCt.startsWith('application/json')) {
        throw new Error('Server returned non-audio content');
      }

      // For pillows.su, detect image vs audio from Content-Type since the URL alone doesn't distinguish them
      if ((url.includes('pillows.su/f/') || url.includes('pillowcase.su/f/')) && response) {
        if (responseCt.startsWith('image/')) {
          isImage = true;
          // Strip any .mp3 suffix that was pre-assigned, then use image extension
          fileName = fileName.replace(/\.mp3$/i, '');
        }
      }

      blob = await response.blob();
      if (isImage) {
        blob = await compressImageBlob(blob);
        fileName = fileName.replace(/\.(png|jpeg|jpg)$/i, '') + '.jpg';
      } else {
        let actualExt = await detectAudioExt(blob);

        // If magic-byte detection fell back to .mp3, cross-check the Content-Type
        // so that FLAC/WAV/OGG files that evade byte detection still get the right ext.
        if (actualExt === '.mp3') {
          if (responseCt.includes('flac'))                                   actualExt = '.flac';
          else if (responseCt.includes('wav') || responseCt.includes('wave')) actualExt = '.wav';
          else if (responseCt.includes('aiff'))                               actualExt = '.aiff';
          else if (responseCt.includes('ogg') || responseCt.includes('opus')) actualExt = '.ogg';
          else if (responseCt.includes('m4a') || (responseCt.includes('mp4') && !responseCt.includes('video'))) actualExt = '.m4a';
        }

        // Also honour Content-Disposition filename extension when present
        const disposition = response.headers.get('content-disposition') ?? '';
        const dispExt = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/i)?.[2]
          ?.trim().match(/\.(flac|wav|aiff?|ogg|opus|m4a|zip)$/i)?.[0].toLowerCase();
        if (dispExt) actualExt = dispExt as typeof actualExt;

        if (actualExt !== '.mp3' && fileName.endsWith('.mp3')) {
          fileName = fileName.slice(0, -4) + actualExt;
        }

        if (meta) {
          const cleanTitle = meta.title || formatTextForNotification(suggestedName, false);
          if (actualExt === '.mp3') {
            try {
              blob = await embedID3Tags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('ID3 tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.wav') {
            try {
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('WAV tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.flac') {
            try {
              blob = await flacToWav(blob);
              actualExt = '.wav';
              fileName = fileName.replace(/\.flac$/i, '.wav');
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              // decodeAudioData unsupported or failed — fall back to FLAC with embedded tags
              console.warn('[flac→wav] conversion failed, falling back to tagged FLAC:', e);
              try {
                blob = await embedFLACTags(blob, meta, cleanTitle);
              } catch (e2) {
                console.warn('[flac tags] fallback tagging also failed, saving without tags:', e2);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Download failed:', e);
      openFallback(finalUrl, fileName);
      return;
    }

    saveAs(blob, fileName);
  } catch (e) {
    console.error('Download failed:', e);
    openFallback(finalUrl, formatTextForNotification(suggestedName, false));
  }
}

export function isSongNotAvailable(song: any, rawUrl: string): boolean {
  if (song.quality?.toLowerCase() === 'not available') return true;
  if (!rawUrl) return false;
  const lowerUrl = rawUrl.toLowerCase().trim();
  return lowerUrl.includes('link needed') || lowerUrl.includes('link%20needed') || lowerUrl.includes('source needed') || lowerUrl.includes('source%20needed') || lowerUrl === 'n/a';
}

export function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;

  if (!duration.includes(':')) {
    const num = Number(duration);
    return isNaN(num) ? 0 : num;
  }

  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

export function matchesFilters(song: any, searchQuery: string, filters: any): boolean {
  const lowerQuery = searchQuery.toLowerCase();
  const searchMatch = !searchQuery ||
    song.name.toLowerCase().includes(lowerQuery) ||
    (song.extra && song.extra.toLowerCase().includes(lowerQuery)) ||
    (song.description && song.description.toLowerCase().includes(lowerQuery));

  if (!searchMatch) return false;

  if (filters.tags && filters.tags.length > 0) {
    const hasAllTags = filters.tags.every((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });

    if (!hasAllTags) {
      return false;
    }
  }

  if (filters.excludedTags && filters.excludedTags.length > 0) {
    const hasExcludedTag = filters.excludedTags.some((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });
    if (hasExcludedTag) {
      return false;
    }
  }

  if (filters.qualities && filters.qualities.length > 0) {
    const hasAnyQuality = filters.qualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (!hasAnyQuality) {
      return false;
    }
  }

  if (filters.excludedQualities && filters.excludedQualities.length > 0) {
    const hasExcludedQuality = filters.excludedQualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (hasExcludedQuality) {
      return false;
    }
  }

  if (filters.availableLengths && filters.availableLengths.length > 0) {
    const hasAnyLength = filters.availableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (!hasAnyLength) {
      return false;
    }
  }

  if (filters.excludedAvailableLengths && filters.excludedAvailableLengths.length > 0) {
    const hasExcludedLength = filters.excludedAvailableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (hasExcludedLength) {
      return false;
    }
  }

  if (filters.durationValue && filters.durationValue.trim() !== '') {
    const songSeconds = parseDurationToSeconds(song.track_length);
    if (!songSeconds) return false;

    let targetSeconds = 0;
    if (!filters.durationValue.includes(':')) {
      const raw = Number(filters.durationValue);
      targetSeconds = !isNaN(raw) ? raw * 60 : 0;
    } else {
      targetSeconds = parseDurationToSeconds(filters.durationValue);
    }

    if (filters.durationOp === '>') {
      if (songSeconds <= targetSeconds) return false;
    } else if (filters.durationOp === '<') {
      if (songSeconds >= targetSeconds) return false;
    } else if (filters.durationOp === '=') {
      if (songSeconds !== targetSeconds) return false;
    }
  }

  if (filters.playableOnly) {
    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    const isNotAvailable = song.quality?.toLowerCase() === 'not available';
    if (!rawUrl || !(rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/')) || isNotAvailable) {
      return false;
    }
  }

  if (filters.albums && filters.albums.length > 0) {
    const hasAnyAlbum = filters.albums.some((album: string) => {
      const songAlbum = song.extra2 || song.realEra?.name || song.extra;
      return songAlbum && songAlbum.toLowerCase() === album.toLowerCase();
    });
    if (!hasAnyAlbum) {
      return false;
    }
  }


  return true;
}
