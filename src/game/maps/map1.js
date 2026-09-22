// Forest Crossing - a gentle S-curve through a wooded valley.
// Grid: 22 cols x 13 rows
export const MAP1 = {
  id: 'forest',
  name: 'Forest Crossing',
  emoji: '\u{1F332}',
  blurb: 'S-curve valley · beginner friendly',
  cols: 22,
  rows: 13,
  theme: {
    id: 'forest',
    pathFg: '#443a26', pathBg: '#2b2418', pathEdge: '#10140e',
    cellBg: '#0a1310', cellAlt: '#07100c', accent: '#4aa050', decor: 'trees',
  },
  path: [
    [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],
    [10,3],[10,4],[10,5],[10,6],
    [9,6],[8,6],[7,6],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],
    [1,7],[1,8],[1,9],
    [2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],
    [11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[17,9],[18,9],[19,9],[20,9],[21,9],
  ],
}
