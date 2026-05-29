# Notas técnicas del dashboard ILOSTAT

Archivo de presentacion:

- `unidad4/dashboard_ilostat_actividad12.html`

Servidor local recomendado:

```bash
python3 unidad4/ilostat_dashboard_server.py
```

Abre la URL que imprime la terminal. El servidor sirve el HTML y expone `/ilostat?source=...` como proxy local para que el navegador pueda leer los CSV de ILOSTAT sin bloqueo CORS. La página también conserva valores de respaldo si se abre sin ese servidor o si ILOSTAT no responde.

## Entregas revisadas

Revise los cuatro controles en `local/controles/actividad12`. Los indicadores y comparaciones que se repitieron fueron:

- Informalidad laboral: México, Argentina, Chile y mundo.
- Desempleo: México, Argentina, Chile y mundo.
- Eje interpretativo comun: una tasa de desempleo baja o estable no prueba que exista trabajo decente si gran parte del empleo sigue siendo informal.

## Indicadores ILOSTAT usados

- `EMP_NIFL_SEX_RT_A`: tasa nacional de empleo informal por sexo, anual.
- `EMP_2IFL_SEX_RT_A`: tasa de empleo informal, estimaciones modeladas OIT, anual.
- `UNE_2EAP_SEX_AGE_RT_A`: tasa de desempleo por sexo y edad, estimaciones modeladas OIT, anual.

Filtros usados:

- Paises: `MEX`, `ARG`, `CHL`.
- Mundo: `X01`.
- Sexo total: `SEX_T`.
- Edad total para desempleo: `AGE_YTHADULT_YGE15`.
- Periodo: `2015-2027`, porque ILOSTAT puede incluir proyecciones.

## Fuentes consultadas

- ILOSTAT Get started: https://ilostat.ilo.org/about/get-started/
- ILOSTAT Informality data catalogue: https://ilostat.ilo.org/topics/informality/#data-catalogue
- ILOSTAT Data tools: https://ilostat.ilo.org/data/
- ILOSTAT Bulk download facility: https://ilostat.ilo.org/data/bulk/
- Informe base de la actividad: https://www.ilo.org/publications/flagship-reports/employment-and-social-trends-2026

## Nota sobre actualizacion

La API filtrada de `https://rplumber.ilo.org/data/indicator` responde desde terminal, pero el navegador puede bloquearla cuando la página se sirve desde `localhost` por política CORS. Por eso agregué el servidor local `ilostat_dashboard_server.py`: el HTML sigue viviendo en `unidad4`, pero las llamadas a ILOSTAT se hacen a través del proxy local y se actualizan al cargar, al presionar "Actualizar datos" y cada 30 minutos.
