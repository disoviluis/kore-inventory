#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Backup logico completo de MySQL/MariaDB en AWS RDS.
# Ejecutar desde la EC2 o desde un equipo con acceso de red al RDS.
# No guarda la contrasena en el archivo ni en la linea de comandos.

DB_NAME="${DB_NAME:-kore_inventory}"
DB_HOST="${DB_HOST:-kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com}"
DB_USER="${DB_USER:-admin}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/kore_inventory}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}_$$.sql.gz"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

if [[ ! "$DB_HOST" =~ ^[a-zA-Z0-9.-]+$ || -z "$DB_USER" || ! "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: endpoint, usuario o nombre de base invalido." >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "ERROR: mysqldump no esta instalado o no esta en PATH." >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "ERROR: gzip no esta instalado o no esta en PATH." >&2
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "ERROR: sha256sum no esta instalado o no esta en PATH." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TEMP_FILE="$(mktemp "$BACKUP_DIR/.backup_XXXXXX.sql.gz.partial")"
trap 'rm -f -- "$TEMP_FILE"' EXIT

echo "Servidor: $DB_HOST | Usuario: $DB_USER | Base: $DB_NAME"
echo "Iniciando backup completo de $DB_NAME en $BACKUP_FILE..."

mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --password \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  --set-gtid-purged=OFF \
  --no-tablespaces \
  "$DB_NAME" | gzip -9 > "$TEMP_FILE"

if [[ ! -s "$TEMP_FILE" ]]; then
  echo "ERROR: el archivo de backup esta vacio." >&2
  exit 1
fi

gzip -t "$TEMP_FILE"
mv -- "$TEMP_FILE" "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

sha256sum -c "$CHECKSUM_FILE"

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | awk '{print $1}')"

echo
echo "BACKUP COMPLETADO"
echo "Archivo:  $BACKUP_FILE"
echo "Tamano:   $BACKUP_SIZE"
echo "Checksum: $CHECKSUM_FILE"
echo
echo "Para listar objetos exportados:"
echo "  gzip -cd '$BACKUP_FILE' | grep -E '^(CREATE TABLE|CREATE VIEW|CREATE PROCEDURE|CREATE TRIGGER|CREATE EVENT)' | head"
echo
echo "Para restaurar en una base separada:"
echo "  gzip -cd '$BACKUP_FILE' | mysql --host=HOST --user=USUARIO --password BASE_PRUEBA"
