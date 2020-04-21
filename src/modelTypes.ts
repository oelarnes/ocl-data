import { PlayerRow, EventRow, PickRow, CubeRow, EntryRow, PairingRow, SeasonTag, RoundNum, MTGOCardRow} from './rowTypes';

export interface Player extends PlayerRow {
    entries: Entry[],
    getEntries: (eventId: string, howMany: number) => Promise<Entry[]>,
    getTrophies: (season: SeasonTag) => Promise<Entry[]>,
    getQps: (season: SeasonTag) => Promise<number>,
    getWins: (season: SeasonTag) => Promise<number>,
    getLosses: (season: SeasonTag) => Promise<number>,
    selfRow: Promise<PlayerRow>,
    load: () => Promise<Player>,
    upsert: () => Promise<Player>,
    delete: () => Promise<Player>,
}

export interface Pairing extends PairingRow {
    p1Entry: Entry,
    p2Entry: Entry,
    event: Event,
    selfRow: PairingRow,
    load: () => Promise<Pairing>,
    upsert: () => Promise<Pairing>,
    delete: () => Promise<Pairing>,
}

export interface Cube extends CubeRow {
    list: string[],
    isOwned: boolean,
    ownedCube: MTGOCard[],
    dekExport: string,
    selfRow: CubeRow,
    load: () => Promise<Cube>,
    upsert: () => Promise<Cube>,
    delete: () => Promise<Cube>,
}

export interface Event extends EventRow {
    cube: Cube,
    entries: Entry[], // ranked when complete
    winningEntry: Entry,
    pairings: Pairing[],
    onRound: RoundNum | null,
    getPairing: (player: Player, round: RoundNum) => Pairing
    selfRow: EventRow,
    load: () => Promise<Event>,
    upsert: () => Promise<Event>,
    delete: () => Promise<Event>,
}

export interface Entry extends EntryRow {
    player: Player,
    event: Event,
    deck: DraftDeck,
    pairings: Pairing[],
    selfRow: EntryRow,
    load: () => Promise<Entry>,
    upsert: () => Promise<Entry>,
    delete: () => Promise<Entry>,

}

export interface Pick extends PickRow {
    context: string[],
    ownedPick: MTGOCard,
    ownedContext: MTGOCard[],
    selfRow: PickRow,
    load: () => Promise<Pick>,
    upsert: () => Promise<Pick>,
    delete: () => Promise<Pick>,
}

export interface DraftDeck {
    event: Event,
    player: Player,
    picks: Pick[],
    getPick: (pack: number, pick: number) => Pick,
    mainDeck: string[],
    sideboard: string[],
    ownedList: MTGOCard[],
    dekExport: string
}

export interface MTGOCard extends MTGOCardRow {
    dekRow: string,
    selfRow: MTGOCardRow,
    load: () => Promise<MTGOCard>,
    upsert: () => Promise<MTGOCard>,
    delete: () => Promise<MTGOCard>,
}