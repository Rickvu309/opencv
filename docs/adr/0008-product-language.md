# English is the product language

Users are Vietnamese early-career people; the product ships in English. This records the QVE-150 owner decision. Supersede only with a follow-up ADR.

**English first.** Chrome, starter content, receipts, and the Coach persona are English. There is no locale default, no language toggle, and no i18n setup.

**No Vietnamese-first Coach.** Do not extend the persona prompt or the eval harness for Vietnamese. The existing English persona stands. Do not ship unmeasured prompt changes for language.

**Incidental Vietnamese is allowed.** If a User writes in Vietnamese, the Coach may still answer — that is the model's native capability, not a product feature. Do not add locale config, language detection, or a translation pass to enable it.

**Full i18n stays out.** Chrome, starter content, and receipts are not translated. A separate spec is required before any translation pass.

**Out of scope here:** Changing the persona voice, adding evals for Vietnamese quality, or building locale infrastructure.
