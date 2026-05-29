// No-op on web — react-native-maps has no web binding for this version,
// so we render nothing instead of letting the native import crash the
// bundle. The native UserLocationMarker.tsx still serves iOS and Android.
export default function UserLocationMarker(): null {
  return null;
}
