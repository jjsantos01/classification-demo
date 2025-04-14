document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const canvas = document.getElementById('scatter-plot');
    const ctx = canvas.getContext('2d');
    const lineBtn = document.getElementById('line-btn');
    const curveBtn = document.getElementById('curve-btn');
    const clearBtn = document.getElementById('clear-btn');
    const evaluateBtn = document.getElementById('evaluate-btn');
    const trainAccuracyEl = document.getElementById('train-accuracy');
    const testAccuracyEl = document.getElementById('test-accuracy');
    const lineEquationEl = document.getElementById('line-equation');
    const showTrainCheckbox = document.getElementById('show-train');
    const showTestCheckbox = document.getElementById('show-test');

    // Configuración del canvas
    let canvasWidth, canvasHeight;
    let xScale, yScale;
    let xOffset, yOffset;
    let pointRadius = 5;

    // Estado de la aplicación
    let drawingMode = 'line';  // 'line' o 'curve'
    let isDrawing = false;
    let points = [];           // Puntos de la línea/curva dibujada
    let trainData = [];        // Datos de entrenamiento
    let testData = [];         // Datos de prueba
    
    // Rangos para escalado
    let xMin = 30, xMax = 60;  // Rango aproximado para bill_length_mm
    let yMin = 12, yMax = 22;  // Rango aproximado para bill_depth_mm

    // Colores por especie
    const colors = {
        'Adelie': '#3498db',    // Azul
        'Chinstrap': '#e74c3c'  // Rojo
    };

    // Inicialización
    function init() {
        // Configurar tamaño del canvas
        setupCanvas();
        
        // Cargar datos desde CSV
        loadCSVData('https://raw.githubusercontent.com/mwaskom/seaborn-data/master/penguins.csv');
        
        // Configurar event listeners
        setupEventListeners();
    }
    
    // Configurar el tamaño del canvas y las escalas
    function setupCanvas() {
        // Hacer el canvas responsive
        canvasWidth = canvas.clientWidth;
        canvasHeight = canvas.clientHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Calcular escalas con margen del 10%
        const xMargin = (xMax - xMin) * 0.1;
        const yMargin = (yMax - yMin) * 0.1;
        
        xScale = canvasWidth / ((xMax - xMin) + 2 * xMargin);
        yScale = canvasHeight / ((yMax - yMin) + 2 * yMargin);
        
        xOffset = xMin - xMargin;
        yOffset = yMin - yMargin;
    }
    
    // Convertir coordenadas de datos a coordenadas de canvas
    function dataToCanvas(x, y) {
        return {
            x: (x - xOffset) * xScale,
            y: canvasHeight - (y - yOffset) * yScale  // Invertir eje y
        };
    }
    
    // Convertir coordenadas de canvas a coordenadas de datos
    function canvasToData(x, y) {
        return {
            x: x / xScale + xOffset,
            y: (canvasHeight - y) / yScale + yOffset  // Invertir eje y
        };
    }
    
    // Función para calcular y mostrar la ecuación de la recta
    function updateLineEquation() {
        if (drawingMode !== 'line' || points.length < 2) {
            lineEquationEl.textContent = '-';
            return;
        }
        
        // Convertir los puntos del canvas a coordenadas de datos
        const p1 = canvasToData(points[0].x, points[0].y);
        const p2 = canvasToData(points[1].x, points[1].y);
        
        // Calcular pendiente
        const m = (p2.y - p1.y) / (p2.x - p1.x);
        
        // Calcular intersección con el eje y (b en y = mx + b)
        const b = p1.y - m * p1.x;
        
        // Formatear la ecuación
        const mFormatted = m.toFixed(2);
        const bFormatted = Math.abs(b).toFixed(2);
        const bSign = b >= 0 ? '+' : '-';
        
        // Mostrar la ecuación
        lineEquationEl.textContent = `y = ${mFormatted}x ${bSign} ${bFormatted}`;
    }
    
    // Cargar datos desde un archivo CSV
    async function loadCSVData(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            // Parsear CSV
            const lines = text.split('\n');
            const headers = lines[0].split(',');
            
            // Índices de las columnas que necesitamos
            const speciesIdx = headers.indexOf('species');
            const lengthIdx = headers.indexOf('bill_length_mm');
            const depthIdx = headers.indexOf('bill_depth_mm');
            
            if (speciesIdx === -1 || lengthIdx === -1 || depthIdx === -1) {
                throw new Error('Columnas requeridas no encontradas en el CSV');
            }
            
            // Leer datos
            const allData = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(',');
                const species = values[speciesIdx];
                
                // Solo incluir Adelie y Chinstrap
                if (species !== 'Adelie' && species !== 'Chinstrap') continue;
                
                const length = parseFloat(values[lengthIdx]);
                const depth = parseFloat(values[depthIdx]);
                
                // Verificar que los valores sean válidos
                if (isNaN(length) || isNaN(depth)) continue;
                
                allData.push({
                    species,
                    bill_length_mm: length,
                    bill_depth_mm: depth
                });
            }
            
            // Actualizar rangos para escalado
            xMin = Math.min(...allData.map(d => d.bill_length_mm));
            xMax = Math.max(...allData.map(d => d.bill_length_mm));
            yMin = Math.min(...allData.map(d => d.bill_depth_mm));
            yMax = Math.max(...allData.map(d => d.bill_depth_mm));
            
            // División aleatoria en train/test (80/20)
            const shuffled = [...allData].sort(() => 0.5 - Math.random());
            const testSize = Math.floor(shuffled.length * 0.2);
            
            testData = shuffled.slice(0, testSize);
            trainData = shuffled.slice(testSize);
            
            console.log(`Datos cargados: ${trainData.length} entrenamiento, ${testData.length} prueba`);
            
            // Actualizar canvas y dibujar puntos
            setupCanvas();
            drawPoints();
            
        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos. Por favor, recarga la página para intentar nuevamente.');
        }
    }
    
    // Dibujar los puntos de datos
    function drawPoints() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Dibujar regiones de clasificación si existe la línea o curva definida
        if (points.length >= 2) {
            drawClassificationRegions();
        }
        
        // Dibujar ejes
        drawAxes();
        
        // Dibujar puntos de entrenamiento si está marcado el checkbox
        if (showTrainCheckbox.checked) {
            trainData.forEach(point => {
                const canvasPoint = dataToCanvas(point.bill_length_mm, point.bill_depth_mm);
                
                ctx.beginPath();
                ctx.arc(canvasPoint.x, canvasPoint.y, pointRadius, 0, Math.PI * 2);
                ctx.fillStyle = colors[point.species];
                ctx.fill();
            });
        }
        
        // Dibujar puntos de test si está marcado el checkbox
        if (showTestCheckbox.checked) {
            testData.forEach(point => {
                const canvasPoint = dataToCanvas(point.bill_length_mm, point.bill_depth_mm);
                
                ctx.beginPath();
                ctx.arc(canvasPoint.x, canvasPoint.y, pointRadius, 0, Math.PI * 2);
                ctx.fillStyle = colors[point.species];
                ctx.fill();
                
                // Añadir un borde para distinguir puntos de test
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }
        
        // Si hay una línea o curva dibujada, redibujarla
        if (points.length > 0) {
            redrawClassifier();
        }
    }
    
    // Dibujar ejes X e Y con etiquetas
    function drawAxes() {
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#555';
        
        // Eje X
        const xAxisY = canvasHeight - dataToCanvas(0, yOffset).y;
        ctx.beginPath();
        ctx.moveTo(0, xAxisY);
        ctx.lineTo(canvasWidth, xAxisY);
        ctx.stroke();
        
        // Etiquetas eje X
        const xStep = (xMax - xMin) / 5;
        for (let x = xMin; x <= xMax; x += xStep) {
            const canvasX = dataToCanvas(x, 0).x;
            ctx.fillText(x.toFixed(1), canvasX - 10, xAxisY + 15);
        }
        ctx.fillText('Longitud del pico (mm)', canvasWidth / 2 - 60, canvasHeight - 5);
        
        // Eje Y
        const yAxisX = dataToCanvas(xOffset, 0).x;
        ctx.beginPath();
        ctx.moveTo(yAxisX, 0);
        ctx.lineTo(yAxisX, canvasHeight);
        ctx.stroke();
        
        // Etiquetas eje Y
        const yStep = (yMax - yMin) / 5;
        for (let y = yMin; y <= yMax; y += yStep) {
            const canvasY = dataToCanvas(0, y).y;
            ctx.fillText(y.toFixed(1), yAxisX - 30, canvasY + 4);
        }
        
        // Texto vertical "Profundidad del pico (mm)"
        ctx.save();
        ctx.translate(10, canvasHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Profundidad del pico (mm)', -80, 0);
        ctx.restore();
    }
    
    // Redibujar el clasificador (línea o curva)
    function redrawClassifier() {
        if (points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        if (drawingMode === 'line') {
            // Dibujar línea recta
            ctx.lineTo(points[1].x, points[1].y);
            
            // Actualizar la ecuación de la recta
            updateLineEquation();
        } else {
            // Dibujar curva
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            
            // Limpiar la ecuación en modo curva
            lineEquationEl.textContent = '-';
        }
        
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    // Configurar event listeners
    function setupEventListeners() {
        // Botones de modo de dibujo
        lineBtn.addEventListener('click', function() {
            setDrawingMode('line');
        });
        
        curveBtn.addEventListener('click', function() {
            setDrawingMode('curve');
        });
        
        // Botón para borrar
        clearBtn.addEventListener('click', function() {
            clearClassifier();
        });
        
        // Botón para evaluar en datos de test
        evaluateBtn.addEventListener('click', function() {
            evaluateOnTestSet();
            
            // Cambiar la visualización a mostrar datos de test y ocultar entrenamiento
            showTrainCheckbox.checked = false;
            showTestCheckbox.checked = true;
            drawPoints();
        });
        
        // Checkboxes para mostrar/ocultar datos
        showTrainCheckbox.addEventListener('change', drawPoints);
        showTestCheckbox.addEventListener('change', drawPoints);
        
        // Eventos del canvas
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        
        // Evento de redimensionamiento
        window.addEventListener('resize', function() {
            setupCanvas();
            drawPoints();
        });
    }
    
    // Establecer modo de dibujo
    function setDrawingMode(mode) {
        drawingMode = mode;
        
        // Actualizar clases de botones
        lineBtn.classList.toggle('active', mode === 'line');
        curveBtn.classList.toggle('active', mode === 'curve');
        
        // Reiniciar el canvas
        clearClassifier();
    }
    
    // Limpiar el clasificador
    function clearClassifier() {
        points = [];
        isDrawing = false;
        drawPoints();
        trainAccuracyEl.textContent = '-';
        testAccuracyEl.textContent = '-';
        lineEquationEl.textContent = '-';
    }
    
    // Manejo de eventos de ratón
    function handleMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (drawingMode === 'line') {
            // Para línea recta, iniciar nueva línea
            points = [{ x, y }];
            isDrawing = true;
        } else if (drawingMode === 'curve') {
            // Para curva, agregar punto
            if (!isDrawing) {
                points = [{ x, y }];
                isDrawing = true;
            } else {
                points.push({ x, y });
                redrawClassifier();
            }
        }
    }
    
    function handleMouseMove(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (drawingMode === 'line' && points.length === 1) {
            // Para línea recta, mostrar preview
            drawPoints();
            
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
    
    function handleMouseUp(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (drawingMode === 'line') {
            // Para línea recta, finalizar con segundo punto
            points.push({ x, y });
            isDrawing = false;
            redrawClassifier();
            evaluateOnTrainSet();
        } else if (drawingMode === 'curve' && points.length >= 3) {
            // Para curva, se mantiene isDrawing = true para seguir agregando puntos
            // pero calculamos accuracy
            evaluateOnTrainSet();
        }
    }
    
    // Clasificar un punto según la línea/curva dibujada
    function classifyPoint(point) {
        if (points.length < 2) return null;
        
        // Convertir punto de datos a coordenadas de canvas
        const canvasPoint = dataToCanvas(point.bill_length_mm, point.bill_depth_mm);
        
        if (drawingMode === 'line') {
            // Clasificación con línea recta
            // Calculamos en qué lado de la línea está el punto
            
            const p1 = points[0];
            const p2 = points[1];
            
            // Ecuación de la línea: (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1) = 0
            // Si el resultado es positivo, está en un lado; si es negativo, en el otro
            const side = (canvasPoint.y - p1.y) * (p2.x - p1.x) - 
                         (canvasPoint.x - p1.x) * (p2.y - p1.y);
            
            // Determinamos qué especie corresponde a cada lado
            // Para esto, clasificamos un punto de cada especie y vemos en qué lado cae
            const adelieSample = trainData.find(d => d.species === 'Adelie');
            const adeliePoint = dataToCanvas(adelieSample.bill_length_mm, adelieSample.bill_depth_mm);
            const adelieSide = (adeliePoint.y - p1.y) * (p2.x - p1.x) - 
                              (adeliePoint.x - p1.x) * (p2.y - p1.y);
            
            // Si side y adelieSide tienen el mismo signo, el punto es Adelie
            return (side * adelieSide > 0) ? 'Adelie' : 'Chinstrap';
            
        } else if (drawingMode === 'curve') {
            // Clasificación con curva
            // Usamos ray casting algorithm para determinar si el punto está arriba o abajo de la curva
            
            // Construimos un rayo vertical desde el punto hacia arriba
            let isAbove = false;
            let intersections = 0;
            
            // Comprobamos intersecciones con cada segmento de la curva
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                // Verificar si el segmento cruza la línea horizontal del punto
                if ((p1.y > canvasPoint.y && p2.y <= canvasPoint.y) || 
                    (p2.y > canvasPoint.y && p1.y <= canvasPoint.y)) {
                    
                    // Calcular el punto de intersección
                    const intersectX = p1.x + (p2.x - p1.x) * 
                                      (canvasPoint.y - p1.y) / (p2.y - p1.y);
                    
                    // Si la intersección está a la derecha del punto, cuenta como intersección
                    if (intersectX > canvasPoint.x) {
                        intersections++;
                    }
                }
            }
            
            // Número impar de intersecciones significa que está dentro
            isAbove = (intersections % 2 === 1);
            
            // Determinamos qué especie corresponde a cada lado (arriba/abajo)
            const adelieSample = trainData.find(d => d.species === 'Adelie');
            const adeliePoint = dataToCanvas(adelieSample.bill_length_mm, adelieSample.bill_depth_mm);
            
            let adelieAbove = false;
            let adelieIntersections = 0;
            
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                if ((p1.y > adeliePoint.y && p2.y <= adeliePoint.y) || 
                    (p2.y > adeliePoint.y && p1.y <= adeliePoint.y)) {
                    
                    const intersectX = p1.x + (p2.x - p1.x) * 
                                      (adeliePoint.y - p1.y) / (p2.y - p1.y);
                    
                    if (intersectX > adeliePoint.x) {
                        adelieIntersections++;
                    }
                }
            }
            
            adelieAbove = (adelieIntersections % 2 === 1);
            
            // Si tienen el mismo estado (ambos arriba o ambos abajo), el punto es Adelie
            return (isAbove === adelieAbove) ? 'Adelie' : 'Chinstrap';
        }
        
        return null;
    }
    
    // Evaluar en conjunto de entrenamiento
    function evaluateOnTrainSet() {
        if (points.length < 2) {
            trainAccuracyEl.textContent = '-';
            return;
        }
        
        let correct = 0;
        
        trainData.forEach(point => {
            const predicted = classifyPoint(point);
            if (predicted === point.species) {
                correct++;
            }
        });
        
        const accuracy = (correct / trainData.length * 100).toFixed(1);
        trainAccuracyEl.textContent = `${accuracy}%`;
    }
    
    // Evaluar en conjunto de prueba
    function evaluateOnTestSet() {
        if (points.length < 2) {
            testAccuracyEl.textContent = '-';
            return;
        }
        
        let correct = 0;
        
        testData.forEach(point => {
            const predicted = classifyPoint(point);
            if (predicted === point.species) {
                correct++;
            }
        });
        
        const accuracy = (correct / testData.length * 100).toFixed(1);
        testAccuracyEl.textContent = `${accuracy}%`;
    }
    
    // Función para dibujar las regiones de clasificación
    function drawClassificationRegions() {
        if (points.length < 2) return;
        
        const gridSize = 10; // Tamaño del bloque para la rejilla
        for (let y = 0; y < canvasHeight; y += gridSize) {
            for (let x = 0; x < canvasWidth; x += gridSize) {
                // Calculamos el centro del bloque
                const dataPoint = canvasToData(x + gridSize / 2, y + gridSize / 2);
                const fakePoint = {
                    bill_length_mm: dataPoint.x,
                    bill_depth_mm: dataPoint.y
                };
                const predicted = classifyPoint(fakePoint);
                if (predicted) {
                    ctx.fillStyle = predicted === 'Adelie' ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)';
                    ctx.fillRect(x, y, gridSize, gridSize);
                }
            }
        }
    }
    
    // Iniciar la aplicación
    init();
});
