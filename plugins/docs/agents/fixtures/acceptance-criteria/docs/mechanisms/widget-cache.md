# Widget cache

The widget cache holds a rendered widget's output in memory for a short window, so a page that
requests the same widget twice in quick succession does not recompute it.

## How it works

A request first checks the cache for a matching key. On a hit, the cached output is returned as-is.
On a miss, the widget renders normally and its output is stored under that key before it is
returned.

## Invalidation

An entry expires after its window passes, or immediately if the underlying data it rendered from
changes.
