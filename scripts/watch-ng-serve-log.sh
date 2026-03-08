#!/usr/bin/env bash
set -euo pipefail

log_file=".agent/logs/ng-serve.log"
once=0
all_lines=0

print_usage() {
  cat <<'EOF'
Usage: watch-ng-serve-log.sh [options]

Options:
  --log <path>   Log file to follow (default: .agent/logs/ng-serve.log)
  --once         Exit after the next build success/failure marker
  --all          Print all appended log lines (default: print build/watch events only)
  -h, --help     Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --log" >&2
        exit 2
      fi
      log_file="$2"
      shift 2
      ;;
    --once)
      once=1
      shift
      ;;
    --all)
      all_lines=1
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage >&2
      exit 2
      ;;
  esac
done

echo "[watch] Following $log_file (event-driven). Press Ctrl+C to stop."
echo "[watch] Waiting for next appended lines..."

# tail -F follows file updates and retries automatically if the file does not exist yet.
tail -n 0 -F "$log_file" 2>&1 | awk -v once="$once" -v all_lines="$all_lines" '
function timestamp(  cmd, out) {
  cmd = "date +%H:%M:%S"
  cmd | getline out
  close(cmd)
  return out
}
{
  line = $0
  event = ""

  if (line ~ /Changes detected\. Rebuilding\.\.\./ || line ~ /Building\.\.\./) {
    event = "BUILD_START"
  } else if (line ~ /Application bundle generation complete\./ || line ~ /bundle generation complete/) {
    event = "BUILD_SUCCESS"
  } else if (line ~ /Application bundle generation failed\./ || line ~ /bundle generation failed/) {
    event = "BUILD_FAILED"
  } else if (line ~ /Watch mode enabled\. Watching for file changes/) {
    event = "WATCH_READY"
  }

  if (event != "") {
    printf "[%s] %s: %s\n", timestamp(), event, line
    fflush()

    if (once == 1 && (event == "BUILD_SUCCESS" || event == "BUILD_FAILED")) {
      exit 0
    }
  } else if (all_lines == 1) {
    printf "[%s] %s\n", timestamp(), line
    fflush()
  }
}
'
