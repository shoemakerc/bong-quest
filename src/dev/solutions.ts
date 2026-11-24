/**
 * Recorded playthroughs of the levels with moving enemies, as `playtest.seq` scripts (see
 * ./playtest.ts for the token format). Each one runs from the level's start to its flag without
 * dying; `playtest.solve(index)` replays one and `playtest.solveAll()` replays them all. If you
 * change a level or the physics, rerun them: a script that no longer finishes shows where to look.
 */
export const SOLUTIONS: Record<string, string[]> = {
  buzzkill: [
    'R>8.6 RJ! R~', // stomp the first Buzzkill
    'R>22.9 N40 R>23.3 RJ! R~ R6 RJ! R~', // over the pit, then over the second
    'R>34.6 RJ! R~ RJ! R~', // onto the mesa and over the third
    'R>49.2 RJ! R1 RJ! R~', // double jump the wide pit
    'R>57 RJ! R~ R>62 RJ! R~ R>65.3 RJ! R~ R>72',
  ],
  'spark-up': [
    'R>11.4 RJ! R1 RJ! RJ>21.3 R1 RJ! RJ>32.3 R1 RJ! RJ~', // glide, relight, glide, relight, glide
    'R>55.4 RD1 R12 RD1 R12 RD1 R12', // three dashes under the spiked ceiling
    'R>79.1 N8 J! N1 J! N1 J! N1 RJ! RJ~ R>88', // straight up the lighter ladder, then onto the mesa
  ],
  'bad-vibes': [
    'R>19.4 RJ! R1 RJ! R22 RJ8 RJ! R1 RJ! RJ~', // drop onto the first Bad Vibe, bounce, glide the rest
    'R>61.15 N8 N@9940/1000000', // wait beside the lift until it is at the bottom
    'J! N1 J! RJ11 J8 J! N1 J! RD1 R12 R~ R>77', // land on it as it rises, bounce, double jump, dash onto the mesa
  ],
  'hot-coals': [
    'R>9.3 N@1300/2200 RJ! R~ R>16.3 N@450/2200 RJ! R~ R>23.3 N@1750/2200 RJ! R~', // hop each pit as its Ember lands
    'R>37.2 N@0/2200 R>41.2 N@450/2200 R>45.2 N@900/2200', // walk over each tunnel hole while its Ember is down
    'R>59.4 RJ! R1 RJ! RJ~', // double jump and glide over the last three
    'R>84.5 RJ! R~ R>90',
  ],
  'pest-control': [
    'R>7.6 RJ! R~ R2 RJ! R~ R1 RJ! R~', // single jumps over the three Buzzkills: a double would hit the spikes
    'R>30.6 RJ! R~', // onto the checkpoint ledge
    'R>36.3 RJ! R1 RJ! RD1 R12 RJ~', // double jump, dash and glide over both pits and the island
    'R>65.15 N8 N@9940/1000000 J! N1 J! RJ11 J8 J! N1 J! RD1 R12 R~', // ride the lift, as in Bad Vibes
    'RJ! R~ R>80', // over the mesa's Buzzkill to the flag
  ],
  'chain-smoker': [
    'R>11.05 N8 J! N1 J! N1 J! N1 J! N1 RJ! R~', // jump, double jump, then one more jump per lighter
    'L<14.45 N6 LJ! N1 J! N1 J! N1 J! N1 LJ! L~', // hop off the ledge into the next chain, then left onto the Buzzkill
    'R>7.95 N8 J! N1 RJ! R3 N12 J6', // double jump out over the Bad Vibe and drop onto it with jump held
    'J! N1 J! N1 J! RJ~ R>20', // bounce, double jump, lighter, glide to the flag
  ],
  'storm-front': [
    'R>9.4 RJ! R1 RJ! R8 N15 RJ6 RJ! R1 RJ! RJ>36.8 R~', // drop onto a Bad Vibe, bounce, glide to the island
    'R>43.4 RJ! R1 RJ! RJ>52.3 R1 RJ! RJ>62.3 R1 RJ! RJ>72.5 R~', // two lighters, gliding over the lift and Embers
    'R>79.3 RJ! R1 RJ! R24 RJ6 RJ! R1 RJ! RJ>100 RJ~ R>114', // one more bounce, then glide in
  ],
  'fire-escape': [
    'R>5.3 RJ! RJ>15.6 N~', // jump and glide over the Embers, drop through the gap onto the checkpoint
    'L<15.3 LJ! LJ<5.25 Nv26', // glide over the Buzzkill and fall well below the shelf
    'RJ>14.5 RJ>16.8 Nv40 J~', // air jump, glide right under the shelf, drop to the floor
    'L<15.9 N@650/2200 L<11.9 N@200/2200 L<7.9 N@1950/2200 L<2.4', // walk under each Ember while it is up
  ],
  'roach-motel': [
    'R>12.2 N@700/2200 R>14.4 RJ4 R>26.2', // over the Ember hole, then hop-stomp both Buzzkills in the crawlspace
    'R>31.7 RJ! R~', // onto the checkpoint ledge
    'R>42.4 RD1 R12 RD1 R12 RD1 R12 RD1 R12', // four dashes, relit by three lighters
    'R>62.2 RJ! R~ R>68.6 RJ! R~ RJ! R~ RJ! R~', // up the stairs, hopping each Buzzkill
    'RJ! RJ>93 R~ R>96', // glide over the last Ember hole
  ],
  cashed: [
    'R>7.6 RJ! R~ R2 RJ! R~ R>26.6 RJ! R~', // Buzzkills under spikes
    'R>36.4 RD1 R12 RD1 R12 RD1 R12', // three-dash tunnel
    'R>59.05 N8 N@9940/1000000 J! N1 J! RJ11 J8 J! N1 J! RD1 R12 R~', // the lift
    'R6 RJ! R~', // stomp the mesa's Buzzkill
    'R>76.4 RJ! R1 RJ! RJ>107 R~', // double jump and glide high over the Bad Vibes and Embers
    'R>117.1 N8 J! N1 J! N1 J! N1 RJ! RJ~ R>126', // lighter ladder to the last flag
  ],
};
