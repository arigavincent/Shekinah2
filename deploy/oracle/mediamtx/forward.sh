#!/bin/sh
# Forwards the live service to YouTube (or any RTMP address) while it's on.
# MediaMTX runs this when a service starts and restarts it whenever it exits,
# so switching forwarding on in the admin takes effect within seconds.
target=$(wget -q -T 5 -O - --header "X-Internal-Secret: ${LIVE_INTERNAL_SECRET}" "${SHEKINAH_API}/api/v1/live/forward-target" 2>/dev/null)
if [ -z "$target" ]; then
  sleep 10
  exit 0
fi
exec ffmpeg -nostdin -hide_banner -loglevel warning \
  -i "rtmp://127.0.0.1:1935/${MTX_PATH}?internal=${LIVE_INTERNAL_SECRET}" \
  -c copy -f flv "$target"
