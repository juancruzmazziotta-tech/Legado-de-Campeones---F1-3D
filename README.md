# Legado de Campeones - Experiencia Web 3D Inmersiva Móvil

**Materia:** Diseño y Programación Web II  
**Proyecto:** Parcial 2 - Experiencia Web 3D Interactiva para Mobile  
**Tecnologías:** Three.js, React 19, TypeScript, HTML5 Web Audio API, DeviceOrientation API, Tailwind CSS  

---

## 1. Concepto y Propuesta Visual
**"Legado de Campeones"** es una experiencia web 3D inmersiva en tiempo real optimizada específicamente para navegadores móviles (iOS Safari y Android Chrome). Pone al usuario al volante de cuatro monoplazas legendarios de distintas épocas de la Fórmula 1 en tres de los circuitos más representativos del automovilismo mundial (Silverstone, Imola y Spa-Francorchamps).

### Monoplazas Disponibles:
1. **Ferrari F2004 (Era V10):** `2004_ferrari_f2004.glb` (Michael Schumacher)
2. **Generic F1 (Era Turbo Clásica):** `generic_f1.glb` (Ayrton Senna / McLaren)
3. **F1 2022 Genérico (Efecto Suelo):** `f1_2022_generic.glb` (Reglamento moderno)
4. **F1 2026 Regulations (Aerodinámica Activa):** `my_take_on_the_2026_f1_regulations.glb` (Futuro híbrido)

### Circuitos Disponibles:
1. **Silverstone Circuit (2024):** `silverstone_circuit_2024_layout.glb` (Gran Bretaña)
2. **Autodromo Enzo e Dino Ferrari - Imola (2024):** `imola_circuit_2024_layout.glb` (Italia)
3. **Circuit de Spa-Francorchamps (2022):** `circuit_de_spa-francorchamps_2022_layout.glb` (Bélgica)

### Carga Automática de Modelos 3D (.glb):
- Carpeta para monoplazas: `/public/models/cars/`
- Carpeta para circuitos: `/public/models/circuits/`
- **Fallback Inteligente:** Si los archivos `.glb` aún no han sido subidos a las carpetas correspondientes, la aplicación renderiza automáticamente los modelos 3D procedimentales y el asfalto PBR sin interrumpir la experiencia.

---

## 2. Controles e Interacciones Disponibles

### A. Sensores Móviles
1. **Giroscopio (DeviceOrientation API):**
   - Inclinación física del smartphone hacia izquierda/derecha para girar el volante y la dirección del monoplaza con suavizado lineal (`lerp`).
   - Soporte para el flujo de autorización de permisos de iOS 13+ (`DeviceOrientationEvent.requestPermission()`).
2. **Web Audio API & Micrófono:**
   - Síntesis de sonido de motor 100% procedural en tiempo real (oscilador primario diente de sierra, sub-grave triangular, silbido de turbocompresor y petardeo de escape en reducciones).
   - Analizador de espectro (`AnalyserNode`) para vúmetro en vivo y respuesta sonora interactiva.
3. **Respuesta Háptica:**
   - Vibración de retroalimentación táctil (`navigator.vibrate()`) en cambios de marcha, pianos/bordillos y fuera de pista.

### B. Controles en Pantalla (Touch) y Teclado
- **Aceleración y Giro Simultáneos:** Manejador de teclado optimizado que permite presionar `W + A` o `W + D` simultáneamente con aceleración y giro instantáneos.
- **Rampa de Dirección Progresiva:** Suavizado de giro que evita saltos bruscos o hipersensibilidad en el teclado.
- **Salida de Pista con Fricción Progresiva:** Al salir al césped o grava, el auto experimenta resistencia y pérdida gradual de velocidad en lugar de un frenazo seco.
- **Cámara Cockpit Elevada:** Posición de visión del piloto a nivel real de ojos, por encima del volante y el halo, con vista despejada de la pista y el morro.
- **Volante Táctil Dinámico:** Arrastre táctil en pantalla con respuesta angular suave.
- **Pedales Analógicos:** Acelerador (Throttle verde) y Freno (Brake rojo).
- **Activador de DRS:** Botón de apertura de alerón trasero en zonas permitidas.
- **Selector de Cámaras:**
  - **Vista Piloto (Cockpit):** Primera persona dentro del habitáculo.
  - **Vista Trasera (Perseguidora):** Tercera persona detrás del monoplaza.
  - **Vista Cinemática TV:** Cámara de transmisión exterior en pista.
- **Modo Cine (Zen Mode):** Botón para ocultar/mostrar el HUD y apreciar el modelo 3D sin obstrucciones.

---

## 3. Punto de Acceso (Código QR)
La aplicación cuenta con un módulo de generación de Código QR integrado en tiempo real que apunta a la URL del despliegue público, permitiendo escanearlo directamente desde cualquier smartphone o descargar el código en formato PNG junto con la gráfica de presentación para la entrega académica.

---

## 3. Punto de Acceso (Código QR)
La aplicación cuenta con un módulo de generación de Código QR integrado en tiempo real que apunta a la URL del despliegue público, permitiendo escanearlo directamente desde cualquier smartphone o descargarlo en alta resolución junto con su afiche explicativo.

---

## 4. Créditos de Assets y Recursos
- **Geometrías y Modelado 3D:** 100% procedimentales generados mediante la API de Three.js (`BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, `ExtrudeGeometry`, `CatmullRomCurve3`).
- **Texturas:** 100% sintetizadas en tiempo de ejecución en HTML5 Canvas (sin dependencias externas ni imágenes pesadas).
- **Audio:** 100% sintetizado mediante osciladores nativos de la Web Audio API.
