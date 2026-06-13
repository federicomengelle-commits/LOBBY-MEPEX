# tools/SETUP.md — red de seguridad local

`tools/check.sh` ya existe (smoke-check: `node --check` de todos los JS + caza `console.log` DEBUG olvidados + verifica que los `?v=` estén bumpeados). Pero hoy hay que acordarse de correrlo a mano. Esta guía lo automatiza para matar la clase de bug "pusheé pero no se ve / rompí la sintaxis".

## 1. Pre-commit hook (recomendado — bloquea el commit si algo falla)

Crear `.git/hooks/pre-commit` (no se versiona; cada máquina lo instala una vez):

```bash
#!/usr/bin/env bash
# Corre el smoke-check antes de cada commit. Si falla, aborta.
./tools/check.sh || {
  echo "❌ check.sh falló — commit abortado. Arreglá y reintentá (o 'git commit --no-verify' para saltearlo a propósito)."
  exit 1
}
```

Instalación:
```bash
chmod +x .git/hooks/pre-commit
chmod +x tools/check.sh   # por las dudas
```

> En Windows: el hook corre vía el Git Bash que trae Git para Windows, así que el shebang `bash` anda igual.

## 2. (Opcional) CI en GitHub Actions

`.github/workflows/ci.yml`:
```yaml
name: check
on: [push, pull_request]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: bash tools/check.sh
```

## 3. Atajo manual

```bash
alias check='bash tools/check.sh'   # agregar al ~/.bashrc
```

## Relacionado
- **Cache-busting automático por git-hash** (idea en PLAN-MAESTRO §Ideas de mejora): un `tools/hash-bump.sh` que reescriba los `?v=` con el short-hash del commit, llamado desde el hook — elimina del todo el "me olvidé de bumpear".
