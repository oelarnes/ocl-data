import { executeSelectOne } from './db'

export function getIdForHandle(handle) {
    return executeSelectOne(`SELECT id FROM player WHERE discordHandle = $handle`, {$handle: handle}, 'id')
}
