# AIS anomaly domain context

## Vessel

A maritime entity identified by its MMSI. A vessel has identity information and a current navigational state.

## Position

A time-stamped observation of a vessel's location and navigational state. A position is one point in a vessel's history.

## Latest position

The most recent known position for a vessel. It is the vessel's current representation on the map until a newer position arrives.

## Track

The ordered history of positions for one vessel over a selected time window.

## Vessel detail

The identity and current navigational state presented for the vessel selected by the operator.

## Connection

The live session through which the operator receives the tracking service's current vessel state and subsequent updates.

## Activity event

An operator-facing lifecycle or diagnostic occurrence, such as a connection change, metadata update, or error. Position updates are data, not activity events, unless they cause a meaningful diagnostic event.
