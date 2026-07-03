# Skill: Google Maps

Procesa ubicaciones GPS enviadas por el cliente.

Responsabilidades:

- Leer coordenadas del dispositivo.
- Reverse geocoding si hay API key.
- Calcular distancia y duración cuando la empresa tiene coordenadas.
- Generar enlace de navegación para el repartidor.

Variables requeridas:

- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_MAPS_GEOCODING_URL`
- `GOOGLE_MAPS_DISTANCE_MATRIX_URL`
