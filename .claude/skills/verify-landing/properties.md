# verify-landing properties

The checker still measures 26 properties at 1440x900, 390x844 and reduced motion. Ids 01 to 13 are text rules. Ids 14 to 26 are page checks. A property that described the previous four-surface page was replaced with the equivalent on the first-release page.

| Id  | Name                                | Why it changed                                                                                                                      |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 01  | h1-length-and-aim                   | Kept. "seat" counts as the outcome, because the design H1 is "Get your butt in your dream seat."                                    |
| 02  | statement-names-cv                  | Replaces audience-in-h1-or-subhead. The design does not put "Vietnamese students" in the H1. The statement names opencv and the CV. |
| 03  | subhead-two-beats                   | Kept the two-sentence limit. Dropped the "is a product" regex. The statement defines the product.                                   |
| 04  | no-marketese                        | Kept. Exempt phrases are now "your best work", "dream seat" and "fits best", which are the design's words.                          |
| 05  | plain-sentences                     | Word cap moved from 20 to 24. The plan line in the design is 21 words.                                                              |
| 06  | feature-titles-three-to-six-words   | Replaces the Coach/Paper/Apply/Pitch label rule. The four feature titles are outcome lines.                                         |
| 07  | one-primary-label                   | The hero has no sign-up link. Nav and the close each have one "Get started".                                                        |
| 08  | label-has-object                    | "Get started" is the design's primary label, so it is allowed. Start free, Learn more and Join still fail.                          |
| 10  | objection-above-first-surface       | The statement mentions "your CV" or "your work" before the first feature.                                                           |
| 11  | feature-first-sentence-ties-to-hero | Each feature's first sentence names proof, a CV, a role, a letter, a site or a claim.                                               |
| 12  | designed-logos-and-quotes           | Replaces the ban on logos and quotes. The design draws both. Prices stay on /pricing. No star rating and no invented user count.    |
| 13  | sample-person-alt                   | An alt names a student. An alt names a CV or letter. None says placeholder.                                                         |
| 14  | hero-photo-in-first-view-1440       | Replaces the Coach frame. The hero photo is the chair.                                                                              |
| 15  | nav-links-before-fold-390           | Replaces the four surface names. Product, Examples, Stories and Pricing are the nav.                                                |
| 16  | hero-has-no-button                  | The design hero has no button.                                                                                                      |
| 17  | light-field-one-accent              | Kept.                                                                                                                               |
| 18  | h1-sentence-case-solid              | Kept.                                                                                                                               |
| 19  | images-named-and-local              | Alts name the chair, Coach, Paper, Apply, a CV or a letter. The chair is not a product surface.                                     |
| 20  | headline-visible-at-first-paint     | Kept.                                                                                                                               |
| 20b | other-text-visible-at-first-paint   | Kept.                                                                                                                               |
| 21  | reduced-motion-disables-animation   | Kept.                                                                                                                               |
| 22  | no-video-or-carousel                | Kept.                                                                                                                               |
| 23  | text-contrast                       | Kept.                                                                                                                               |
| 24  | target-size-24                      | Kept.                                                                                                                               |
| 25  | hero-image-attrs-and-paint          | Kept. The hero image is the chair.                                                                                                  |
| 26  | no-sideways-scroll                  | Added. The page must not scroll sideways at 1440 or 390.                                                                            |

Pinned copy the rules read: `LANDING_HEADLINE`, `LANDING_SUBHEAD`, `LANDING_STATEMENT_LEAD`, `LANDING_STATEMENT_REST`, `LANDING_FEATURES`, `LANDING_LOGO_LABEL`, `LANDING_QUOTES`, `LANDING_PRIMARY_LABEL`.

Sync commit: set on the commit that follows the green checker. The checker printed 26 PASS on the quote-role fix.
