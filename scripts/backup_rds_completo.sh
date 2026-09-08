#!/usr/bin/env bash
set -Eeuo pipefail

# Backup logico completo de MySQL/MariaDB en AWS RDS.
# Ejecutar desde la EC2 o desde un equipo con acceso de red al RDS.
# No guarda la contrasena en el archivo ni en la linea de comandos.

DB_NAME="${DB_NAME:-kore_inventory}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/kore_inventory}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

read -r -p "Endpoint RDS: " DB_HOST
read -r -p "Usuario MySQL: " DB_USER
read -r -s -p "Contrasena MySQL: " DB_PASSWORD
echo

if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASSWORD" ]]; then
  echo "ERROR: endpoint, usuario y contrasena son obligatorios." >&2
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

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# MYSQL_PWD evita exponer la contrasena en argumentos o en el historial.
export MYSQL_PWD="$DB_PASSWORD"
trap 'unset MYSQL_PWD DB_PASSWORD' EXIT

echo "Iniciando backup completo de $DB_NAME en $BACKUP_FILE..."

mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  --set-gtid-purged=OFF \
  --no-tablespaces \
  "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: el archivo de backup esta vacio." >&2
  exit 1
fi

sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

# Verificacion basica: el gzip debe poder leerse hasta el final.
gzip -t "$BACKUP_FILE"
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
