# Known on main

Run of `node scripts/ui.mjs sweep screen paper-home coach-home settings` on 2026-11-13 against `33cdfab1` with this skill's rules: 80 `HIG` findings, 4 `FAIL` cases (same on `64864f32`). The `HIG` rules report without failing until these are fixed. When you fix one, rerun the sweep on its screen and remove its row here.

| Screen                 | Size                      | Rule              | Measured                                                                                 | Root cause                                                                         |
| ---------------------- | ------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| paper-home, coach-home | 1440x900                  | `hig-contrast`    | sidebar group label "Your work": 12px/500 text #969799 on #efeff0 is 2.54:1, needs 4.5:1 | sidebar group label colour                                                         |
| paper-home             | 1440x900, 390x844         | `hig-text-size`   | 16 and 5 text elements "did not grow" at 200% (13px stays 13px)                          | type set in px (`text-[13px]`, `text-[12.5px]` and others) while spacing is in rem |
| coach-home             | 1440x900, 390x844         | `hig-text-size`   | 17 and 7 "did not grow", including "How can I help?" 20px                                | same                                                                               |
| settings               | 1440x900, 390x844         | `hig-text-size`   | 20 and 12 "did not grow"                                                                 | same                                                                               |
| settings               | 390x844                   | `hig-text-size`   | Language row clipped at 200%: content 467px wide in a 324px box                          | rem padding grows inside a row that does not wrap                                  |
| settings               | 320x568, 390x844, 390x560 | `fits` (FAIL)     | language buttons "English" 60x26 and "Tiếng Việt" 78x26, under 44x44                     | segmented control height at phone width                                            |
| paper-home             | 1440x900                  | `requests` (FAIL) | 41 requests while opening, over 30; `get-session` 6 times, over 3                        | repeated session and Paper reads                                                   |

Checked and quiet on the same run: `hig-focus-ring` (16, 16 and 13 Tab stops, all with a visible ring), `hig-reduced-motion` (no running animation under reduced motion on any of the three screens), `hig-contrast` at 390 on all three screens.
