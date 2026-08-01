// Strategy (RDS-986) seed data. The pipeline health summary, key
// observations, and weekly focus plan are all computed live off real store
// data in lib/strategy-utils.ts; this file holds the one fixed number that
// live data can't derive itself, the continuity marker's starting count,
// the same "weeks reviewed before this one" pattern Rewind's own archive
// count already establishes (lib/data/rewind.ts's rewindArchive.length).
// Surface: /strategy, the weekly focus plan's plan-set completion card.
export const STRATEGY_REVIEWS_BEFORE_THIS = 2;
