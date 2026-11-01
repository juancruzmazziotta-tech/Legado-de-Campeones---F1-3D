# Legado de Campeones - Simulador de Fórmula 1 Web 3D

**Materia:** Diseño y Programación Web II  
**Proyecto:** Parcial 2 - Experiencia Web 3D Interactiva para Mobile y Desktop  
**Tecnologías:** Three.js, React 19, TypeScript, HTML5 Web Audio API, DeviceOrientation API, Tailwind CSS, Vite  

---

## 1. Breve descripción del concepto y propuesta visual

### Concepto
**"Legado de Campeones"** es un simulador de carreras y experiencia interactiva en 3D para web que recrea la velocidad, la física y la atmósfera del automovilismo de Fórmula 1. Diseñado desde su concepción con enfoque *mobile-first*, permite ser disfrutado de manera fluida tanto en teléfonos inteligentes (aprovechando sus sensores de orientación física y pantalla táctil) como en computadoras de escritorio.

### Propuesta Visual y Entorno 3D
- **Monoplazas de Alta Fidelidad:**
  - **Ferrari F2004 (Era V10):** Homenaje a la legendaria máquina campeona de Michael Schumacher, con sonido de motor agudo de altas revoluciones y aerodinámica clásica.
  - **F1 2022 Genérico (Efecto Suelo):** Monoplaza moderno con alerones simplificados, túneles Venturi y halo de seguridad.
  - *Física visual de ruedas:* Ambos vehículos cuentan con ensambles de ruedas independientes que rotan sobre sus propios ejes de masa según la velocidad de avance, y dirección sincronizada en las ruedas delanteras que gira fielmente con el volante.
- **Circuitos Recreados:**
  - **Circuit de Spa-Francorchamps (Bélgica):** 7.004 km de curvas míticas como *Eau Rouge*, *Raidillon*, *Pouhon* y *Blanchimont*, con desniveles pronunciados.
  - **Autodromo Enzo e Dino Ferrari - Imola (Italia):** 4.909 km de trazado histórico con las variantes *Tamburello*, *Piratella*, *Acque Minerali* y *Rivazza*.
- **Atmósfera y Entorno:**
  - **Fondos Panorámicos HDRI 360°:** Cielos equirectangulares adaptados al paisaje real de cada circuito (bosques y colinas de las Ardenas belgas para Spa; colinas toscanas de Emilia-Romaña para Imola), que aportan rotación de horizonte según la cámara y reflejos lumínicos realistas en la carrocería del monoplaza.
  - **Vegetación 3D:** Bosque perimetral con 4 variantes de árboles 3D (`arboles2.glb`), renderizados a 60+ FPS mediante `InstancedMesh`, sin colisión obstructiva y con estricta zona de exclusión fuera del asfalto y gradas.
  - **Infraestructura de Circuito:** Tribunas de espectadores (grandstands) con gradas y techo, edificio de boxes con 10 garajes tematizados, calle de boxes (pit lane), muro con puestos de ingenieros y guardarraíles metálicos Armco.
  - **Física de Colisión Sólida:** Contacto físico contra barreras, tribunas y muros de boxes que absorbe la velocidad de forma realista con rebote y audio de impacto, permitiendo retomar la marcha con reversa sin cortar la sesión ni sufrir DNF.

### Modos de Juego
1. **Práctica Libre (Solitario):** Vueltas libres ilimitadas para practicar trazadas y mejorar tiempos de forma continua. Incluye panel de *Historial de Tiempos* con registro de vuelta rápida y parciales por sector (S1, S2, S3).
2. **Carrera (vs 4 Autos de IA):** Competencia a 3 vueltas contra 4 monoplazas controlados por inteligencia artificial con trayectorias dinámicas, adelantamientos y colisiones mutuas físicas. Incluye semáforo de largada FIA con cuenta regresiva de 3 segundos y pantalla final de posiciones/podio.

---

## 2. Controles e Interacciones Disponibles

### A. Dispositivos Móviles (Smartphones)
1. **Giroscopio (DeviceOrientation API):**
   - Girar el teléfono físicamente de forma horizontal como un volante real para dirigir el auto.
   - Calibración automática según orientación (landscape) con zona muerta anti-temblor y suavizado cinemático.
   - Compatible con permisos de sensores en iOS Safari y Android Chrome.
2. **Volante Táctil en Pantalla (Touch Steering):**
   - Disco de volante interactivo en la esquina inferior izquierda para control manual táctil directo.
3. **Pedales Táctiles:**
   - **GAS (Acelerador):** Botón ergonómico en la esquina derecha para aplicar potencia progresiva.
   - **FRENO / REVERSA:** Botón de freno de carbono. Si el auto está detenido (menos de 3 km/h), mantenerlo presionado activa la marcha atrás para salir de despistes.
4. **Respuesta Háptica (`navigator.vibrate`):**
   - Vibraciones táctiles en cambios de marcha, al pasar sobre pianos/bordillos, salidas al césped y colisiones contra barreras.
5. **HUD Compacto:**
   - Interfaz minimalista adaptada a pantallas táctiles para no obstruir la visibilidad de la pista.

### B. Computadora (Teclado)
- **Aceleración:** Tecla `W` o `Flecha Arriba`.
- **Freno / Reversa:** Tecla `S` o `Flecha Abajo` (activa reversa al estar detenido).
- **Giro a la Izquierda:** Tecla `A` o `Flecha Izquierda`.
- **Giro a la Derecha:** Tecla `D` o `Flecha Derecha`.
- **Apertura de DRS:** Barra espaciadora (disponible en zonas autorizadas de recta).
- **Cambio de Cámara:** Tecla `C` o botón de cámara en el HUD superior.
- **Volver a Pista / Reiniciar Posición:** Tecla `R` o botón de reinicio en el HUD.

### C. Cámaras Interactivas
- **Cámara Cockpit (Primera Persona):** Posicionada a la altura de los ojos del piloto sobre el volante y morro, simulando la visión real de carrera.
- **Cámara Chase (Persecución en Tercera Persona):** Perspectiva exterior dinámica ubicada detrás del alerón trasero.
- **Cámara TV / Pista:** Plano amplio de transmisión televisiva.

### D. Audio Interactivo (Web Audio API)
- Síntesis procedural en tiempo real del motor según RPM y marchas (1ª a 8ª marcha).
- Efecto sonoro de petardeo de escape (*backfire pop*) al desacelerar o realizar rebajes.
- Audio de impacto sólido al chocar contra guardarraíles o muros.
- Señal acústica de semáforo de largada.
- Entrada opcional de micrófono para modulación sonora ambiental.

---

## 3. Créditos de Assets y Recursos Utilizados

### Modelos 3D y Licencias Externas
- **Ferrari F2004 (`public/assets/2004_ferrari_f2004.glb`):**
  - Modelo 3D del monoplaza Ferrari F2004.
  - Licencia: *Creative Commons Attribution (CC BY 4.0)*.
  - Adaptación: Separación y calibración de hubs de ruedas, ajuste de pivotes geométricos y optimización de materiales metálicos PBR para Three.js.
- **F1 2022 Genérico (`public/assets/f1_2022_generic.glb`):**
  - Modelo 3D de monoplaza reglamentario 2022.
  - Licencia: *Creative Commons Attribution (CC BY 4.0)*.
  - Adaptación: Integración de ruedas motrices traseras, dirección angular delantera y flap móvil de DRS.
- **Variantes de Árboles (`public/assets/arboles2.glb`):**
  - Conjunto de 4 modelos de árboles (`Arbol001`, `Arbol002`, `Arbol003`, `Arbol004`) con texturas PBR de tronco (`bark_brown`) y follaje (`Rama`) con calado por canal alfa.
  - Licencia: *Creative Commons Attribution (CC BY 4.0)*.
  - Implementación: Normalización de escala a 14.5 m, anclaje a nivel de suelo (`y = 0.00`) y renderizado masivo sin costo de rendimiento mediante `THREE.InstancedMesh`.

### Fondos y Entorno
- **Cielos Panorámicos HDRI 360° (`sky_spa.jpg`, `sky_imola.jpg`):**
  - Mapas equirectangulares de reflexión panorámica generados específicamente para recrear las regiones de Spa (Ardenas, Bélgica) e Imola (Emilia-Romaña, Italia).
  - Mapeo: `THREE.EquirectangularReflectionMapping` aplicado a `scene.background` y `scene.environment`.

### Elementos Procedimentales y Código Propio
- **Trazados de Pista:** Curvas tridimensionales Catmull-Rom basadas en las geometrías oficiales de los circuitos de Imola y Spa.
- **Texturas Procedurales:** Asfalto con grano y línea de trazada engomada, pianos estriados reglamentarios y línea de meta a cuadros generados mediante Canvas 2D en tiempo de ejecución.
- **Instalaciones de Circuito:** Modelado procedural con Three.js del edificio de boxes, garajes, semáforo FIA de 5 columnas, gradas de tribunas y barreras Armco.
- **Motor de Sonido:** Sintetizador procedural 100% nativo mediante nodos osciladores y filtros biquad de la Web Audio API (código abierto, sin archivos de audio pregrabados).
