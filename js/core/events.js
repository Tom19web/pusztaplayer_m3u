const listeners = {};
export function on(event, cb) {
  listeners[event] = listeners[event] || [];
  listeners[event].push(cb);
}
export function emit(event, payload) {
  (listeners[event] || []).forEach(cb => cb(payload));
}
