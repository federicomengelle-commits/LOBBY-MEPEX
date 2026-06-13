#!/usr/bin/env bash
# =============================================
# MEPEX Lobby — Smoke-check pre-push
# =============================================
# Correr desde la raiz del repo ANTES de cada push:
#   bash tools/check.sh
#
# Chequea 3 cosas:
#   1. Sintaxis valida (node --check) de todos los .js de raiz
#   2. console.log de DEBUG olvidados (marca "DEBUG" en el log)
#   3. Todo .js modificado vs origin/main tiene su ?v= bumpeado en index.html
#
# Exit 0 = todo OK. Exit 1 = hay problemas (los lista).
# =============================================
set -u
cd "$(dirname "$0")/.."

FAIL=0

# --- 1. Sintaxis ---
echo "── 1/3 Sintaxis (node --check) ──"
SYNTAX_ERRORS=0
for f in *.js; do
    [ -f "$f" ] || continue
    if ! node --check "$f" 2>/tmp/mepex_check_err; then
        echo "  ✗ $f"
        sed 's/^/      /' /tmp/mepex_check_err
        SYNTAX_ERRORS=$((SYNTAX_ERRORS+1))
        FAIL=1
    fi
done
[ "$SYNTAX_ERRORS" -eq 0 ] && echo "  ✓ $(ls *.js | wc -l | tr -d ' ') archivos OK"

# --- 2. console.log DEBUG ---
echo "── 2/3 console.log DEBUG olvidados ──"
DEBUG_HITS=$(grep -n "console\.log.*DEBUG" *.js 2>/dev/null || true)
if [ -n "$DEBUG_HITS" ]; then
    echo "$DEBUG_HITS" | sed 's/^/  ✗ /'
    FAIL=1
else
    echo "  ✓ ninguno"
fi

# --- 3. Bumps ?v= coherentes con el diff ---
echo "── 3/3 Bumps ?v= vs diff origin/main ──"
BUMP_ISSUES=0
CHANGED_JS=$(git diff --name-only origin/main...HEAD -- '*.js' 2>/dev/null | grep -v '^tools/' || true)
INDEX_CHANGED=$(git diff --name-only origin/main...HEAD -- index.html 2>/dev/null || true)
for f in $CHANGED_JS; do
    base=$(basename "$f")
    # Solo importa si index.html lo carga con ?v=
    if grep -q "src=\"$base?v=" index.html 2>/dev/null; then
        # El ?v= de ese archivo tiene que haber cambiado en el diff de index.html
        if ! git diff origin/main...HEAD -- index.html | grep -q "^\+.*$base?v="; then
            echo "  ✗ $base modificado pero su ?v= en index.html NO se bumpeó"
            BUMP_ISSUES=$((BUMP_ISSUES+1))
            FAIL=1
        fi
    fi
done
if [ "$BUMP_ISSUES" -eq 0 ]; then
    if [ -z "$CHANGED_JS" ]; then
        echo "  ✓ sin .js modificados vs origin/main"
    else
        echo "  ✓ bumps coherentes"
    fi
fi

echo "─────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
    echo "✅ SMOKE-CHECK OK — listo para push"
else
    echo "❌ SMOKE-CHECK FALLÓ — arreglar antes de pushear"
fi
exit $FAIL
