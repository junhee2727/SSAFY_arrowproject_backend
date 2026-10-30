#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${ENJOYTRIP_JAVA_HOME:-$(/usr/libexec/java_home -v 25)}"
export CATALINA_HOME="${CATALINA_HOME:-$(brew --prefix tomcat)/libexec}"
export CATALINA_BASE="$PROJECT_DIR/.runtime/tomcat"
export CATALINA_PID="$CATALINA_BASE/tomcat.pid"
export CATALINA_OPTS="${CATALINA_OPTS:-} -Dfile.encoding=UTF-8"
PORT="${ENJOYTRIP_PORT:-8081}"
case "${1:-start}" in
  start|run)
    if [[ -f "$CATALINA_PID" ]] && kill -0 "$(cat "$CATALINA_PID")" 2>/dev/null; then
      echo "Tomcat is already running (PID $(cat "$CATALINA_PID"))"
      exit 0
    fi
    mkdir -p "$CATALINA_BASE"/{conf,logs,temp,webapps,work}
    if [[ ! -f "$CATALINA_BASE/conf/server.xml" ]]; then
      cp -R "$CATALINA_HOME/conf/." "$CATALINA_BASE/conf/"
    fi
    python3 - "$CATALINA_BASE/conf/server.xml" "$PORT" <<'PY'
import sys
import xml.etree.ElementTree as ET
path, port = sys.argv[1:]
if not port.isdigit() or not 1024 <= int(port) <= 65534:
    raise SystemExit('ENJOYTRIP_PORT must be between 1024 and 65534')
tree = ET.parse(path)
tree.getroot().set('port', str(int(port) + 1))
tree.getroot().set('address', '127.0.0.1')
for connector in tree.findall('.//Connector'):
    if connector.get('protocol') == 'HTTP/1.1':
        connector.set('address', '127.0.0.1')
        connector.set('port', port)
        connector.set('URIEncoding', 'UTF-8')
tree.write(path, encoding='UTF-8', xml_declaration=True)
PY
    cp "$PROJECT_DIR/target/enjoytrip.war" "$CATALINA_BASE/webapps/enjoytrip.war"
    if [[ "${1:-start}" == "run" ]]; then
      echo "$$" > "$CATALINA_PID"
      exec "$CATALINA_HOME/bin/catalina.sh" run
    fi
    "$CATALINA_HOME/bin/catalina.sh" start
    echo "EnjoyTrip: http://127.0.0.1:$PORT/enjoytrip/pages/map.html"
    ;;
  stop)
    "$CATALINA_HOME/bin/catalina.sh" stop 10 -force
    ;;
  version)
    "$CATALINA_HOME/bin/catalina.sh" version
    ;;
  *) echo "Usage: $0 {start|run|stop|version}"; exit 2 ;;
esac
