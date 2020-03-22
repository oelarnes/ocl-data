const cubeList = require('./cube-list.json');

module.exports = {
    'error_players': [
        {
            playerName: 'Error'
        },
        {
            discordHandle: 'error'
        }
    ],
    'players': [
        {
            playerName: 'Andy',
            discordHandle: 'andy_d',
            mtgoHandle: 'andy_m',
            timeZone: 'EASTERN'
        },
        {
            playerName: 'Beatrice',
            discordHandle: 'beatrice_d',
            email: 'beatrice@gmail.com'
        },
        {
            playerName: 'Corwin',
            discordHandle: 'corwin_d'
        },
        {
            playerName: 'Dalia',
            discordHandle: 'dalia_d'
        },
        {
            playerName: 'Earnest',
            discordHandle: 'earnest_d'
        },
        {
            playerName: 'Frances',
            discordHandle: 'frances_d'
        },
        {
            playerName: 'George',
            discordHandle: 'george_d'
        },
        {
            playerName: 'Harriet',
            discordHandle: 'harriet_d'
        }
    ],
    event: {
        eventName: 'qp-weekly-1Jan19'
    },
    cube: {
        list: cubeList
    },
    errorDecklists: [
        // less than 40 card main deck
        {
            main: [],
            sideboard: cubeList.filter((_, i) => (i<45)),
        },
        // illegal cards in sideboard
        {
            main: cubeList.filter((_, i) => (i<44)),
            sideboard: ['One With Nothing']
        },
        // repeats
        {
            main: cubeList.filter((_, i) => (i<44)),
            sideboard: [cubeList[0]]
        },
        // wrong total number of cards
        {
            main: cubeList.filter((_, i) => (i<44)),
            sideboard: ['Forest']
        },
        // will conflict with existing deck
        {
            main: cubeList.filter((_, i) => {i<45}),
            sideboard: []
        }
    ],
    decklists: [
        {
            main: cubeList.filter((_, i) => (i<45)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=45 && i<90)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=90 && i<135)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=135 && i<180)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=180 && i<225)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=225 && i<270)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=270 && i<315)),
            sideboard: []
        },
        {
            main: cubeList.filter((_, i) => (i>=315 && i<360)),
            sideboard: []
        },
    ]
}