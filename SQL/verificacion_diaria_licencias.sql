-- Retirado: este archivo no suspende empresas ni emite pagos.
-- La API comprueba vigencia en cada solicitud.
-- Los avisos se procesan con scripts/cron_verificacion_licencias.sh.
SELECT 'Usar el proceso Node de revision de suscripciones; no ejecutar OUTFILE en RDS' AS aviso;