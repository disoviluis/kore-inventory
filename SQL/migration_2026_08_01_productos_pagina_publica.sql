-- Migración: permitir seleccionar qué productos se muestran en la página pública (catálogo web)
-- Default 1 para no romper el comportamiento actual (todos los productos activos se seguían mostrando)
ALTER TABLE productos
  ADD COLUMN mostrar_en_pagina_publica TINYINT(1) NOT NULL DEFAULT 1
  AFTER estado;
