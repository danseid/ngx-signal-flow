# [1.0.0](https://github.com/danseid/ngx-signal-flow/compare/v0.4.0...v1.0.0) (2026-09-24)


### Bug Fixes

* **deps:** require rxjs 7.5.5 and drop the unused @angular/common peer ([425a9cf](https://github.com/danseid/ngx-signal-flow/commit/425a9cf6a7e71cde10d2a6a51c24c555855cec9e))
* ignore values returned by combined source reducers ([9047681](https://github.com/danseid/ngx-signal-flow/commit/9047681a19f72d997b600a619876c63c09536435))
* keep null source start values and tighten source types ([af2c2a6](https://github.com/danseid/ngx-signal-flow/commit/af2c2a6ae4512ad876977fcb8dca088409c48385))
* keep store state in one signal and publish changes in order ([a50abcb](https://github.com/danseid/ngx-signal-flow/commit/a50abcb871237077e61bbb70fbe02c0a6e6a1cf5))
* scope effect errors to their effect and replay early results ([f5e6162](https://github.com/danseid/ngx-signal-flow/commit/f5e61627c0ab67a28e0185bf7ee43afd04128d7a))


### Features

* make history and Map/Set opt-in features ([23bab79](https://github.com/danseid/ngx-signal-flow/commit/23bab79b38eac58434fc8eb3042545d0574d5f0c))


### BREAKING CHANGES

* **deps:** rxjs versions before 7.5.5 are no longer accepted as a peer
dependency.
* the { withPatches, withMapSet, historyLimit } options were
removed and throw an error that points to the replacement. Use withHistory(),
withHistory({limit}) and withMapSet(). History keeps 100 steps unless
withHistory({limit: Infinity}) is used. canUndo and canRedo are signals; calls
like store.canUndo() keep working.
* calling a source without a value only compiles when its type
accepts undefined, for example Source<T, void>. A Source<T, number> called
without an argument used to emit undefined.
* store.effect(fn) returns a StoreEffect with only destroy().
Its loading signal was always false and its reduce did nothing.

# [0.4.0](https://github.com/danseid/ngx-signal-flow/compare/v0.3.0...v0.4.0) (2026-09-23)


### Bug Fixes

* **ci:** restore library build before semantic-release ([a969e13](https://github.com/danseid/ngx-signal-flow/commit/a969e13baa54704cbc78b0a399c3523f7d5613b9))
* prevent Angular effect feedback loops and restore effect loading state ([5251098](https://github.com/danseid/ngx-signal-flow/commit/5251098d56a861c1803b82ad93124c73128e7641))


### Features

* add a core store, bounded undo history, and performance checks ([f4a662e](https://github.com/danseid/ngx-signal-flow/commit/f4a662ee5273440641cb90e40a110003514c9fbe))
* add source.connect to forward Angular signals and inputs ([e61f8b0](https://github.com/danseid/ngx-signal-flow/commit/e61f8b033e6d3cbaa26c7cc89824f6ad64ac850c))

# [0.3.0](https://github.com/danseid/ngx-signal-flow/compare/v0.2.3...v0.3.0) (2026-08-18)


### Bug Fixes

* **ci:** allow npm version when the library is already at the next release ([2df92db](https://github.com/danseid/ngx-signal-flow/commit/2df92dbed4abbaa49595052785376e0e9562fadb))
* **ci:** build the library before semantic-release ([f431590](https://github.com/danseid/ngx-signal-flow/commit/f431590b24c70910e4f483ae03d9f0441f4ae0c6))


### Features

* support Angular 19–22 and switch tests to Vitest ([a1aa05a](https://github.com/danseid/ngx-signal-flow/commit/a1aa05ac46142cb420637dd6d2b733f4e6007248))
