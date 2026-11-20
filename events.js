'use strict';

const EVENTS = Object.freeze([
  { id: '222', label: '2×2', name: '2×2 Cube' },
  { id: '333', label: '3×3', name: '3×3 Cube' },
  { id: '444', label: '4×4', name: '4×4 Cube' },
  { id: '555', label: '5×5', name: '5×5 Cube' },
  { id: '666', label: '6×6', name: '6×6 Cube' },
  { id: '777', label: '7×7', name: '7×7 Cube' },
]);

const DEFAULT_EVENT = '333';
const EVENT_IDS = new Set(EVENTS.map((event) => event.id));

function getEvent(id) {
  return EVENTS.find((event) => event.id === id) ?? null;
}

function eventLabel(id) {
  return getEvent(id)?.label ?? id;
}

function isEvent(id) {
  return EVENT_IDS.has(id);
}

module.exports = {
  EVENTS,
  DEFAULT_EVENT,
  EVENT_IDS,
  getEvent,
  eventLabel,
  isEvent,
};
