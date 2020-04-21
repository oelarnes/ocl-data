export enum PrizeType {
    QP = 'QP',
    RANKED = 'Ranked',
    FULL = 'Full', 
    SPECIAL= 'Special'
}

export enum CubeType {
    CLASSIC = 'Classic',
    POWERED = 'Powered',
    INTERACTIVE = 'Interactive'
}

export enum SeasonTag {
    ALLTIME = 'All-Time',
    S19 = '2019',
    S20 = '2020'
} 

export type DraftPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RoundNum = 1 | 2 | 3;
export type PackNum = 1 | 2 | 3;
export type PickNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type TableNum = 1 | 2 | 3 | 4;
export type GameWins = 0 | 1 | 2;

export enum OCLAccount {
    SOWER = 'OCL_Sower',
    OCL1 = 'OCL1_Balance',
    OCL2 = 'OCL2_Opposition',
    OCL3 = 'OCL3_Duress',
    OCL4 = 'OCL4_Fireblast',
    OCL5 = 'OCL5_Rancor',
    OCL6 = 'OCL6_Vindicate',
    OCL7 = 'OCL7_Skullclamp',
    OCL8 = 'OCL8_Wasteland'
} 

export interface PlayerRow {
    // pk
    id: string
    // attr
    fullName: string,
    discordHandle: string,
    discordIdExt: string,
    timeZone: string,
    pronouns: string,
    email: string
}

export interface EventRow {
    // pk
    id: string,
    // attr
    prizeType: PrizeType,
    draftDate: Date,
    completeDate: Date,
    cubeId: string,
    season: string
}

export interface CubeRow {
    // pk
    id: string,
    // attr
    cubeType: CubeType,
    dateActive: Date,
    dateInactive: Date,
    listString: string // newline separated cardnames
}

export interface EntryRow {
    // pk
    eventId: string,
    playerId: string,
    // attr
    seatNum: DraftPosition,
    account: OCLAccount,
    accountPw: string,
    isOpen: boolean, // pw is valid
    finalPosition: DraftPosition,
    qpsAwarded: number,
    cpsAwarded: number
}

export interface PickRow {
    // pk
    eventId: string,
    playerId: string,
    packNum: PackNum,
    pickNum: PickNum,
    // attr
    cardName: string,
    contextString: string, // newline separated cardnames
    isMain: boolean
}

export interface PairingRow {
    // pk
    eventId: string,
    roundNum: RoundNum,
    tableNum: TableNum, 
    // attr
    p1Id: string,
    p2Id: string,
    p1GameWins: GameWins,
    p2GameWins: GameWins,
    p1RoundWin: boolean,
    p2RoundWin: boolean,
    pairingDate: Date,
    completeDate: Date,
}

export interface MTGOCardRow {
    // pk
    mtgoId: number,
    instanceNum: number,
    // attr
    cardName: string,
    setId: string,
    wishlistDate: Date,
    acquireDate: Date,
    unloadDate: Date,
    atAccount: OCLAccount,
}