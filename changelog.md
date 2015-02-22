# 2.0.0

– 21 Feb 2015

  * Upgraded to the 2.4 version of Less.
  * Updated dependencies to the latest versions.
  * Removed `options.parser` since Less is simplifying to just a `render` function.
  * Using `options.render` for passing through all rendering options directly to the less rendering.
  * Changed `options.storeCss` arguments from `(pathname, css, next)` to `(pathname, css, req, next)`
  * Added `postprocess.sourcemap` option for modifying the sourcemap.
  * Added `storeSourcemap` option for manipulating the sourcemap storage.
  * Removed pre `0.1.x` warning
