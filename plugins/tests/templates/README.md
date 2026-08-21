# Templates

Shapes a repository copies in, and the values it then measures for itself.

| file | what it is |
|---|---|
| `starter.tests.config.json` | the config with recommended defaults; `install.sh` seeds it and never overwrites |

## Two values in the starter config are placeholders, not recommendations

`coverage.uncoveredLineCap` starts at `0` and `mutation.target` starts empty. Both are
**deliberately unusable** until measured.

A cap is a ratchet, so its first value has to come from a real run: set it just above what the
repository actually measures, then only ever lower it. A number copied from a template would be a
number nobody derived, and the standard forbids exactly that — a value in a rule that came from
somewhere else is the defect this whole standard spent its review rounds removing.

A mutation target is narrow on purpose. The run costs minutes per module, so it points at one pure
calculation core rather than at everything, and which module that is nobody but the repository knows.

## Two values are recommendations, and they are paired

`coverage.floorPercent` at 70 and `mutation.maxSurvivingPercent` at 10.

Neither means anything alone. A 70 % floor is satisfied by tests that execute code and assert
nothing, which is the failure the standard exists to prevent; what makes the number mean something is
the mutation bar beside it. And the bar is deliberately harder than the published orientation for
that reason — set at the industry's comfortable middle it would leave the floor as decoration.

Decline either and the repository still meets every rule in the standard. It just pays for the
decline in a way the recommendations report names.
