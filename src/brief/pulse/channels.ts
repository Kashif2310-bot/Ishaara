/**
 * The Kalaburagi news accounts the pulse follows. The list lives with the Edge Function that
 * reads their feeds, so the app and the collector can never disagree about it.
 */
export { PULSE_CHANNELS as TRACKED_CHANNELS, type PulseChannel as TrackedChannel, type PulseRow } from '../../../supabase/functions/_shared/pulseSources'
