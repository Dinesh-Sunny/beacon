# Contributing to Beacon

Thank you for wanting to help people find the support that's already theirs.

## Good first contributions

- **Check a rule.** Every amount, age and date lives in a rule pack under [`apps/meta/packs/`](apps/meta/packs) with its official source link. If a line is out of date, open an issue with the new source.
- **Improve a translation.** Welsh, Polish, Spanish, Bengali, Urdu and Arabic were drafted with help and haven't yet been checked by native speakers. Files are in [`apps/meta/src/i18n/messages/`](apps/meta/src/i18n/messages).
- **Add local help.** Council pages, charity grants and community services for a place you know.

## Working on the code

```bash
pnpm install
pnpm --filter meta dev      # http://localhost:3100
pnpm lint                   # Biome, whole repo
pnpm --filter meta typecheck
pnpm --filter meta packs:check   # every rule pack line has a valid source
pnpm --filter meta i18n:check    # every language has every message
```

Before you open a pull request, run these for the parts you touched.

## House rules

- **Models listen, read and explain. Plain code makes every decision.** Nothing a model says reaches a person until code has checked it.
- **Never ask for or store** a name, full address, ID number, bank details, exact amounts or a full date of birth.
- **Copy is plain, warm English in the "you" voice.** Say "likely yours" and "worth checking". See [`VOICE.md`](VOICE.md).
- One branch per change (`feat/`, `fix/`, `docs/`) and [Conventional Commits](https://www.conventionalcommits.org).
