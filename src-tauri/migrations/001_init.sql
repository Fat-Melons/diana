DROP INDEX IF EXISTS "idx_match_details_entryPlayerPuuid";
DROP INDEX IF EXISTS "idx_match_timeline_mid";
DROP INDEX IF EXISTS "idx_match_details_participants";
DROP INDEX IF EXISTS "idx_match_details_teams";
DROP INDEX IF EXISTS "idx_match_timeline_events";
DROP INDEX IF EXISTS "idx_match_timeline_participantFrames";

DROP TABLE IF EXISTS "match_timeline" CASCADE;
DROP TABLE IF EXISTS "match_details" CASCADE;
DROP TABLE IF EXISTS "summoners" CASCADE;
DROP TABLE IF EXISTS "regions" CASCADE;

CREATE TABLE public.summoners (
    puuid                  varchar(200) PRIMARY KEY,
    "gameName"             varchar(100) NOT NULL,
    "tagLine"              varchar(10)  NOT NULL,
    region                 varchar(20)  NOT NULL DEFAULT 'EU_WEST',
    "matchRegionPrefix"    varchar(10),
    "deepLolLink"          varchar(150),
    tier                   varchar(15)  NOT NULL DEFAULT 'UNRANKED',
    rank                   varchar(15),
    lp                     integer      NOT NULL DEFAULT 0,
    "currentMatchId"       varchar(50),
    "discordChannelId"     varchar(50),
    "regionGroup"          varchar(50),
    "lastUpdated"          timestamptz  NOT NULL DEFAULT now(),
    "lastMissingDataNotification" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.match_details (
    mid                    bigserial PRIMARY KEY,
    "matchId"              varchar(50)  NOT NULL UNIQUE,
    "entryPlayerPuuid"     varchar(200) NOT NULL REFERENCES public.summoners(puuid) ON DELETE CASCADE,
    "gameVersion"          varchar(50),
    "gameCreation"         bigint,
    "gameStartTime"        bigint,
    "gameEndTime"          bigint,
    "gameDuration"         integer,
    "gameMode"             varchar(50),
    "gameType"             varchar(50),
    "queueType"            integer,
    "mapName"              integer,
    participants           jsonb,
    teams                  jsonb,
    "lastUpdated"          timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE public.match_timeline (
    tid                    bigserial PRIMARY KEY,
    mid                    bigint       NOT NULL REFERENCES public.match_details(mid) ON DELETE CASCADE,
    "entryParticipantId"   varchar(200) NOT NULL,
    "frameIndex"           integer,
    "timestamp"            bigint,
    "participantFrames"    jsonb,
    events                 jsonb,
    "lastUpdated"          timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_details_entryPlayerPuuid ON public.match_details("entryPlayerPuuid");
CREATE INDEX IF NOT EXISTS idx_match_details_gameCreation ON public.match_details("gameCreation" DESC);
CREATE INDEX IF NOT EXISTS idx_match_timeline_mid ON public.match_timeline(mid);
CREATE INDEX IF NOT EXISTS idx_match_details_participants ON public.match_details USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_match_details_teams ON public.match_details USING GIN (teams);
CREATE INDEX IF NOT EXISTS idx_match_timeline_events ON public.match_timeline USING GIN (events);
CREATE INDEX IF NOT EXISTS idx_match_timeline_participantFrames ON public.match_timeline USING GIN ("participantFrames");
