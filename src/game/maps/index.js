import { MAP1 } from './map1.js'
import { MAP2 } from './map2.js'
import { decorateMap, generateMap } from './generator.js'

export { MAP1, MAP2, generateMap }
export { THEMES, GEN_COLS, GEN_ROWS } from './generator.js'

export const HANDCRAFTED_MAPS = [decorateMap(MAP1), decorateMap(MAP2)]
