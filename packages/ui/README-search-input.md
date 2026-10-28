# SearchInput

`SearchInput` is a controlled search field composed from the kit's `InputGroup` primitives. Give it an accessible name, a string `value`, and `onValueChange`; it supplies the search icon and a clear action that returns focus to the input.

```tsx
<SearchInput
  aria-label="Search integrations"
  placeholder="Search integrations"
  value={search}
  onValueChange={setSearch}
/>
```

Retrieve the pinned Pen source and regenerate the fixture with:

```sh
git show <source-revision>:design/opencv.pen > ~/tmp/opencv.pen
node scripts/pen-search-snapshot.mjs ~/tmp/opencv.pen packages/ui/src/design/search.snapshot.json <source-revision>
```

The pinned design source is from `chore/350-design-kit-cli-skills` at `21869429ab4a3bc5530da90fdaee862b946aebe0`. It uses 13px text, a 15px search icon, lighter placeholder and icon colors, and a 1.5px focus border. The kit uses the existing Input's stock 16px mobile and 14px desktop text scale, a stock 16px icon, muted-foreground for both lighter colors, and the existing InputGroup focus ring. Those are intentional approximations.
