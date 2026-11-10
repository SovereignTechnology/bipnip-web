# bipnip-web

The web client of [bipnip](https://github.com/SovereignTechnology/bipnip): a fork of the
[RoboSats](https://github.com/RoboSats/robosats) user interface (its `frontend/` directory, with its
history). It is not affiliated with the RoboSats project.

The plan, in order:

1. **W0, pure RoboSats.** The UI unchanged, built in RoboSats' self-hosted mode, served by a small host in
   the `bipnip` repo that proxies each coordinator over Tor. The page only ever talks to its own origin.
2. **W1, bipnip.** The same UI talks to bipnip instances through your own bipnip agent. Chats, feeds and
   user ratings are replaced: Mostro's encrypted peer chat, a feed of node-bound posts and liquidity
   announcements, and ratings of users plus portable reputation. A liquidity tab (leases, rings) and
   node-binding settings are added. RoboSats coordinators stay selectable beside bipnip instances.
3. **W2.** A rewrite in Rust/WebAssembly, tracked as an issue in this repository.

Status: **W0**. Nothing here is ready for real funds.

## Build

```sh
npm ci --ignore-scripts
npm run typecheck && npm test && npm run lint
npm run build:bipnip      # dist/basic.html, dist/pro.html, dist/static/
```

`npm run build` still runs RoboSats' own multi-target build (it writes outside this repository and is kept
only so upstream releases merge cleanly); use `build:bipnip`.

## Security model

The browser tab is treated as untrusted: keys and node access live in the bipnip agent, which checks every
request against your limits and asks for confirmation it renders itself before money moves. See
`docs/decisions/0009-web-client-security.md` in the `bipnip` repository.

## Upstream

`upstream` is RoboSats (fetch only). Each RoboSats release is brought in by re-running
`git subtree split --prefix=frontend <release>` on a RoboSats clone and merging the result; the split is
deterministic, so merges stay clean. The fork point is tag `robosats-v0.8.8-alpha-frontend` (`a06a27e`,
RoboSats `v0.8.8-alpha`, 2026-11-08).

## License

AGPL-3.0, as RoboSats (`LICENSE`). The source of any running copy must be available to its users: this
repository is that source.
