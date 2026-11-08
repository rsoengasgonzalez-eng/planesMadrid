# Cambios

## 2.0.0 — corrección del mapa local

- Evitadas todas las peticiones a servidores de teselas cuando la app se abre con `file://`.
- Añadido mapa vectorial local con carreteras, río y localidades como fondo funcional sin conexión.
- Añadido `iniciar-app.bat` y servidor PowerShell integrado para iniciar la app en Windows con doble clic.
- Añadido `iniciar-app.sh` para macOS y Linux.
- URL del proveedor raster movida a `config.js` y corregida al formato oficial sin subdominios.
- El modo raster solo se activa desde `http://` o `https://` y conserva atribución visible.
- Las teselas externas ya no son interceptadas por el service worker; se respeta la caché HTTP del proveedor.
- Añadido indicador visible del modo de mapa y documentación de publicación.
