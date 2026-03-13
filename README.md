# Globalización y Empleo 2026-2

**Facultad de Contaduría y Administración · UNAM**  
**Dr. Jorge Cardiel**

## Acerca de este repositorio

Este repositorio aloja la página web complementaria del curso **Globalización y Empleo** (semestre 2026-2, FCA UNAM).  
Funciona como apoyo a Moodle con sesiones, actividades y materiales publicados.

Sitio: [https://socyb.github.io/global/](https://socyb.github.io/global/)

## Estructura actual del proyecto

```text
global/
├── index.html                         # Página principal del curso
├── css/                               # Estilos globales y de sesiones
│   ├── styles.css
│   └── session.css
├── img/                               # Íconos y recursos gráficos
├── sesiones/                          # Páginas de sesión y análisis de videos
│   ├── sesion-01.html
│   ├── sesion-02.html
│   ├── video-trump-tariffs.html
│   ├── video-40-horas-fraude.html
│   └── ...otros HTML de clase
├── actividades/                       # Actividades HTML y materiales de trabajo en clase
│   ├── actividad_video_digital_world_and_us_25feb26.html
│   ├── presentacion_globalization_v2.html
│   ├── panorama_aportes_24feb26.html
│   └── ...otros HTML de apoyo
├── foro_noticias/                     # Visualización pública del foro
├── recortes_noticias/                 # Imágenes usadas en presentaciones públicas
├── recursos/                          # Datos procesados para consulta en páginas
│   └── videos/
│       └── 40-horas-fraude-idNoLfrMw1g/
│           ├── metadata.json
│           ├── metadata_with_comments.json
│           ├── transcript.es.srt
│           ├── transcript_clean.txt
│           ├── comments_export.csv
│           ├── comments_export.txt
│           ├── comments_transcript.txt
│           └── mood_summary.json
└── pizarrones/                        # Diagramas SVG publicados
```

## Criterio de organización

- `sesiones/`: solo páginas HTML publicables para clase.
- `actividades/`: actividades y páginas de trabajo didáctico.
- `recursos/videos/<slug-id>/`: salida limpia y versionable por video (metadata, transcripciones, comentarios, mood).

## Tecnologías

- HTML5
- CSS3
- JavaScript
- GitHub Pages

## Licencia

Material académico de uso exclusivo para el curso Globalización y Empleo 2026-2 (FCA UNAM).
