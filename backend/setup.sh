#!/usr/bin/env bash
# One-time setup. Run from the repo root:  bash backend/setup.sh
# Creates the Spring Boot build files (pom.xml, mvnw) if they are missing, then adds the libraries Iryo needs.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [ ! -f pom.xml ] || [ ! -f mvnw ]; then
  echo "Downloading the Spring Boot starter files..."
  TMP="$(mktemp -d)"
  curl -fL "https://start.spring.io/starter.zip?type=maven-project&language=java&groupId=com.iryo&artifactId=iryo-backend&name=IryoBackend&packageName=com.iryo.backend&javaVersion=21&dependencies=web,validation,security,data-jpa,postgresql" -o "$TMP/starter.zip"
  unzip -q "$TMP/starter.zip" -d "$TMP/starter"
  cp "$TMP/starter/pom.xml" "$TMP/starter/mvnw" "$TMP/starter/mvnw.cmd" .
  cp -r "$TMP/starter/.mvn" .
  rm -rf "$TMP"
fi
chmod +x mvnw
# The generated sample test needs a live database, so it is not kept.
rm -f src/test/java/com/iryo/backend/*ApplicationTests.java

python3 - <<'PY'
import re
p = "pom.xml"
s = open(p).read()
if "nimbus-jose-jwt" in s:
    print("pom.xml already has the Iryo dependencies")
    raise SystemExit
v = re.search(r"<parent>.*?<version>([^<]+)</version>", s, re.S).group(1)
print("Spring Boot version:", v)
fly = ('<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-flyway</artifactId></dependency>'
       if v.startswith("4.") else
       '<dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>')
add = ('\n    <dependency><groupId>com.nimbusds</groupId><artifactId>nimbus-jose-jwt</artifactId><version>9.37.3</version></dependency>'
       '\n    ' + fly +
       '\n    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>\n  ')
i = s.index("</dependencies>")
open(p, "w").write(s[:i] + add + s[i:])
print("Added Iryo dependencies to pom.xml")
PY

echo
echo "Backend setup done. Next:"
echo "  cp backend/.env.example backend/.env   (then fill it in)"
echo "  ./backend/mvnw -f backend/pom.xml test"
