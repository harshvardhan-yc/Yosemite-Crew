import {useSyncExternalStore} from 'react';
import LocationService from '@/shared/services/LocationService';

type Coords = {latitude: number; longitude: number} | null;

let _coords: Coords = null;
let _started = false;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(l => l());
}

function start() {
  if (_started) return;
  _started = true;
  LocationService.getLocationWithRetry()
    .then(pos => {
      if (pos) {
        _coords = {latitude: pos.latitude, longitude: pos.longitude};
        notify();
      }
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  _listeners.add(listener);
  start();
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot(): Coords {
  return _coords;
}

export function useLocationStore(): Coords {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
