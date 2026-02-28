# CONGRÉSSAPP — Documento de Historias de Usuario
> Para Product Owner · v1.0 · Febrero 2026

---

## 1. PERFILES DE USUARIO

### 1.1 Asistente (Attendee)
- **Quién:** Profesional médico registrado a un congreso.
- **Acceso:** Código alfanumérico de 8 caracteres entregado por email/QR.
- **Dispositivo:** Móvil (95%), tablet (5%). Sin descarga de app (PWA).
- **Motivación:** Acceder a agenda, servicios contratados, networking y documentos desde un solo lugar.
- **Dolor actual:** Información dispersa en WhatsApp, PDFs, correos y hojas de Excel.

### 1.2 Administrador (Admin)
- **Quién:** Organizador del congreso.
- **Acceso:** Email + contraseña (Supabase Auth).
- **Dispositivo:** Desktop (80%), tablet (20%).
- **Motivación:** Gestionar asistentes, agenda, logística, patrocinadores y comunicaciones de forma centralizada.
- **Dolor actual:** Múltiples herramientas desconectadas, reportes manuales, comunicación ineficiente.

### 1.3 Staff de Check-in
- **Quién:** Personal de apoyo en salas del congreso.
- **Acceso:** Credenciales creadas por admin, con sala asignada.
- **Dispositivo:** Tablet o móvil.
- **Motivación:** Registrar asistencia de forma rápida y confiable.

### 1.4 Proveedor (Provider)
- **Quién:** Empresa de servicios logísticos (transporte, alimentación, tours).
- **Acceso:** Código de acceso + contraseña temporal.
- **Dispositivo:** Móvil o desktop.
- **Motivación:** Ver asistentes asignados a sus servicios y validar tickets.

---

## 2. NAVEGACIÓN Y UI

### 2.1 Asistente — Bottom Navigation (6 tabs)
| Tab | Icono | Pantalla | Propósito |
|-----|-------|----------|-----------|
| Inicio | 🏠 | Home | Credencial QR + info del evento |
| Agenda | 📅 | Agenda | Programa por día con "Me interesa" |
| Check-in | 📱 | CheckIn | Escáner QR para registrar asistencia |
| Tickets | 🎫 | Tickets | Servicios contratados (transporte, comidas) |
| Comercial | 🏢 | Commercial | Directorio de patrocinadores |
| Encuestas | 📊 | Polls | Encuestas en vivo durante sesiones |

### 2.2 Asistente — Menú Hamburguesa (acceso secundario)
| Opción | Pantalla | Propósito |
|--------|----------|-----------|
| Documentos | Documents | Repositorio de archivos del evento |
| Notas | Notes | Notas personales por sesión |
| Mensajería | Messaging | Chat grupal del evento |
| Anuncios | Announcements | Comunicados del organizador |
| Calificaciones | Ratings | Evaluar sesiones (1-5 estrellas) |
| Mi Perfil | AttendeeProfile | Datos personales |
| Contactos | Contacts | Networking entre asistentes |

### 2.3 Admin — Sidebar Navigation
| Sección | Pantalla | Propósito |
|---------|----------|-----------|
| Dashboard | Dashboard | KPIs y métricas en tiempo real |
| Asistentes | Attendees | CRUD de asistentes + import CSV |
| Agenda | Agenda | Constructor de agenda + import Excel |
| Documentos | Documents | Subir/gestionar archivos |
| Patrocinadores | Sponsors | CRUD + import Excel |
| Logística | Logistics | Catálogo de servicios + asignación |
| Proveedores | Providers | Gestión de empresas proveedoras |
| Comunicaciones | Communications | Envío de anuncios y emails |
| Encuestas | Polls | Crear/gestionar encuestas + import |
| Staff Check-in | CheckinStaff | Gestionar personal de check-in |
| Staff | Staff | Gestionar colaboradores del evento |
| Reportes | Reports | Exportación de datos y estadísticas |

---

## 3. ÉPICAS Y HISTORIAS DE USUARIO

---

### ÉPICA 1: ACCESO Y AUTENTICACIÓN

#### EU-1.1 · Acceso por código de evento
**Como** asistente  
**Quiero** ingresar el código de mi evento en la pantalla inicial  
**Para** acceder a la información de mi congreso específico  

**Criterios de aceptación:**
- [ ] El campo acepta códigos alfanuméricos (ej: MEDCONG2026)
- [ ] Si el evento no existe o está inactivo, muestra error "Evento no encontrado"
- [ ] Si el evento es válido, navega a la pantalla de código de acceso
- [ ] El código de evento es case-insensitive

#### EU-1.2 · Login de asistente con código de acceso
**Como** asistente registrado  
**Quiero** ingresar mi código de 8 caracteres  
**Para** acceder a mi cuenta del congreso  

**Criterios de aceptación:**
- [ ] Acepta código de 8 caracteres alfanuméricos
- [ ] Opción alternativa: escanear QR con la cámara
- [ ] Si el código es inválido: "Código de acceso inválido"
- [ ] Si el registro está cancelado: "Tu registro ha sido cancelado"
- [ ] Si es válido: redirige a /home con mensaje "¡Bienvenido de vuelta!"
- [ ] La sesión persiste 7 días
- [ ] El código se valida vía Edge Function (bcrypt, nunca en frontend)

#### EU-1.3 · Login de administrador
**Como** administrador  
**Quiero** acceder con email y contraseña  
**Para** gestionar el congreso desde el panel de administración  

**Criterios de aceptación:**
- [ ] Formulario email + contraseña
- [ ] Validación de que el usuario tiene rol admin/superuser para el evento
- [ ] Sesión expira en 24 horas
- [ ] Redirección a /{event}/admin/dashboard

#### EU-1.4 · Login de staff de check-in
**Como** staff de check-in  
**Quiero** acceder con mis credenciales asignadas  
**Para** registrar asistencia en mi sala asignada  

**Criterios de aceptación:**
- [ ] Login con email + contraseña
- [ ] Acceso limitado solo a funcionalidad de check-in
- [ ] Sala pre-asignada por el admin

#### EU-1.5 · Login de proveedor
**Como** proveedor de servicios  
**Quiero** acceder con mi código de acceso  
**Para** ver los servicios que tengo asignados y validar tickets  

**Criterios de aceptación:**
- [ ] Login con código de evento + código de acceso del proveedor
- [ ] Cambio de contraseña obligatorio en primer acceso
- [ ] Acceso limitado a su portal de proveedor

#### EU-1.6 · Sesión expirada
**Como** asistente con sesión expirada  
**Quiero** ver un mensaje claro al intentar acceder  
**Para** saber que debo ingresar mi código nuevamente  

**Criterios de aceptación:**
- [ ] Mensaje: "Tu sesión ha expirado. Ingresa tu código nuevamente."
- [ ] Redirección automática a pantalla de login

#### EU-1.7 · Cierre de sesión
**Como** usuario autenticado  
**Quiero** cerrar sesión desde el menú  
**Para** salir de mi cuenta de forma segura  

**Criterios de aceptación:**
- [ ] Botón visible en menú hamburguesa (asistente) o sidebar (admin)
- [ ] Limpia sesión local y de Supabase
- [ ] Redirige a pantalla de login

---

### ÉPICA 2: HOME DEL ASISTENTE

#### EU-2.1 · Credencial digital con QR
**Como** asistente  
**Quiero** ver mi credencial QR en la pantalla de inicio  
**Para** mostrarla al personal del evento y agilizar mi registro presencial  

**Criterios de aceptación:**
- [ ] Muestra código QR grande y legible con el `credential_code`
- [ ] Debajo del QR: nombre completo del asistente
- [ ] Debajo del nombre: tipo de paquete o "Asistente" por defecto
- [ ] Texto auxiliar: "Muestra este código al personal del evento"
- [ ] Funciona offline (QR generado localmente)

#### EU-2.2 · Información del evento
**Como** asistente  
**Quiero** ver la información básica del evento en mi pantalla de inicio  
**Para** tener a la mano fechas, lugar y datos generales  

**Criterios de aceptación:**
- [ ] Nombre del evento
- [ ] Rango de fechas (inicio — fin)
- [ ] Nombre y dirección del venue
- [ ] Cantidad de asistentes registrados
- [ ] Descripción del evento (si existe)

---

### ÉPICA 3: AGENDA

#### EU-3.1 · Ver agenda por día
**Como** asistente  
**Quiero** ver las sesiones organizadas por día  
**Para** planificar mi asistencia al congreso  

**Criterios de aceptación:**
- [ ] Selector de días en la parte superior (Día 1, Día 2, etc.)
- [ ] Día activo destacado en color primario (#1A56A0)
- [ ] Sesiones ordenadas cronológicamente por hora de inicio
- [ ] Cada tarjeta muestra: título, horario, sala, ponente, tipo
- [ ] Borde izquierdo coloreado por tipo de actividad:
  - Conferencia: azul (#1A56A0)
  - Taller: teal (#00B89F)
  - Receso: amber (#F59E0B)
  - Plenaria: purple (#8B5CF6)
- [ ] Skeleton loader mientras carga

#### EU-3.2 · Marcar "Me interesa"
**Como** asistente  
**Quiero** marcar sesiones que me interesan  
**Para** crear mi agenda personalizada y recibir recordatorios  

**Criterios de aceptación:**
- [ ] Botón "Me interesa" / "Te interesa" toggle en cada sesión
- [ ] Contador de interesados visible en la tarjeta
- [ ] Estado persistido en base de datos (session_interests)
- [ ] Actualización en tiempo real del contador (Supabase Realtime)

#### EU-3.3 · Detalle de sesión
**Como** asistente  
**Quiero** ver los detalles completos de una sesión  
**Para** decidir si quiero asistir  

**Criterios de aceptación:**
- [ ] Título, descripción, tipo de actividad
- [ ] Fecha, hora inicio, hora fin
- [ ] Sala/ubicación
- [ ] Ponente: nombre y biografía
- [ ] Indicador de check-in requerido
- [ ] Badge de certificado (si aplica)
- [ ] Capacidad (si tiene límite)

---

### ÉPICA 4: CHECK-IN

#### EU-4.1 · Escanear QR de sesión
**Como** asistente  
**Quiero** escanear el QR de una sesión con mi cámara  
**Para** registrar mi asistencia y obtener certificado  

**Criterios de aceptación:**
- [ ] Activa cámara del dispositivo vía getUserMedia()
- [ ] Lee QR code que contiene el `checkin_code` de la sesión
- [ ] Si éxito: toast "Asistencia registrada ✓" + INSERT en attendee_checkins
- [ ] Si duplicado: "Ya registraste asistencia a esta sesión"
- [ ] Si código inválido: "Código de sesión no reconocido"

#### EU-4.2 · Simulación de escaneo (modo desarrollo)
**Como** desarrollador  
**Quiero** un botón "Simular Escaneo" visible solo en dev  
**Para** probar el flujo sin cámara física  

**Criterios de aceptación:**
- [ ] Solo visible cuando `VITE_DEV_MODE=true`
- [ ] Permite ingresar código manualmente
- [ ] Ejecuta el mismo flujo que el escaneo real

#### EU-4.3 · Check-in por staff
**Como** staff de check-in  
**Quiero** escanear la credencial QR del asistente  
**Para** registrar su asistencia desde mi dispositivo  

**Criterios de aceptación:**
- [ ] Vista de check-in con selector de actividad/sala
- [ ] Escanea QR de credencial del asistente
- [ ] Muestra nombre del asistente + confirmación
- [ ] Registro en attendee_checkins

---

### ÉPICA 5: TICKETS / SERVICIOS CONTRATADOS

#### EU-5.1 · Ver mis tickets
**Como** asistente  
**Quiero** ver la lista de servicios que tengo contratados  
**Para** saber qué servicios puedo utilizar durante el congreso  

**Criterios de aceptación:**
- [ ] Tarjetas resumen superiores: "X Pendientes" + "X Usados"
- [ ] Filtros por tabs: Todos / Pendientes / Usados
- [ ] Cada ticket muestra: nombre del servicio, tipo, horario, estado
- [ ] Iconos por tipo: transport→bus, food→tenedor, special→sparkles, tour→mapa
- [ ] Badge de estado: Pendiente (azul) / Usado (gris)

#### EU-5.2 · QR de ticket
**Como** asistente  
**Quiero** ver el QR de cada ticket individual  
**Para** mostrarlo al proveedor y que valide mi servicio  

**Criterios de aceptación:**
- [ ] Cada ticket tiene un QR único generado con ticket_code
- [ ] El QR es escaneable por el proveedor
- [ ] El asistente NO puede marcar como "usado" — solo el proveedor/admin

---

### ÉPICA 6: DIRECTORIO COMERCIAL (PATROCINADORES)

#### EU-6.1 · Listar patrocinadores
**Como** asistente  
**Quiero** ver el directorio de patrocinadores del evento  
**Para** conocer las empresas participantes y visitar sus stands  

**Criterios de aceptación:**
- [ ] Lista con logo, nombre, nivel, ubicación de stand
- [ ] Filtro por categoría (chips multi-select): farmacéutica, tecnología, equipamiento, servicios, educación, otro
- [ ] Badge de nivel: Gold (#F59E0B), Silver (#94A3B8), Bronze (#B45309)
- [ ] Búsqueda por nombre, descripción y ubicación de stand
- [ ] Ordenados por nivel (gold → silver → bronze → exhibitor)

#### EU-6.2 · Detalle de patrocinador
**Como** asistente  
**Quiero** ver la información completa de un patrocinador  
**Para** conocer sus productos y contactarlos  

**Criterios de aceptación:**
- [ ] Logo en alta resolución
- [ ] Descripción completa
- [ ] Ubicación del stand
- [ ] Enlace al sitio web (trackea clicks: website_clicks)
- [ ] Botón WhatsApp con mensaje predefinido (trackea: whatsapp_clicks)
- [ ] Redes sociales: LinkedIn, Twitter/X, Instagram
- [ ] Materiales descargables (trackea: materials_downloads)
- [ ] Video promocional (si existe)
- [ ] Contador de vistas de perfil (profile_views)

#### EU-6.3 · Sponsor Lead (dejar datos)
**Como** asistente  
**Quiero** dejar mis datos de contacto a un patrocinador  
**Para** que me contacten después del evento  

**Criterios de aceptación:**
- [ ] Botón "Dejar mis datos" en perfil del sponsor
- [ ] Registra automáticamente al asistente como lead (sponsor_leads)
- [ ] Opción de agregar nota personal
- [ ] Solo un registro por asistente por sponsor

---

### ÉPICA 7: ENCUESTAS EN VIVO

#### EU-7.1 · Ver encuestas activas
**Como** asistente  
**Quiero** ver las encuestas activas durante una sesión  
**Para** participar en preguntas en tiempo real  

**Criterios de aceptación:**
- [ ] Lista de encuestas con estado (activa/cerrada)
- [ ] Tipos soportados: selección única, opción múltiple, escala 1-5, respuesta abierta
- [ ] Indicador "Ya respondiste esta encuesta" si ya participó
- [ ] Contador de respuestas recibidas
- [ ] Estado vacío: "No hay encuestas activas"

#### EU-7.2 · Responder encuesta
**Como** asistente  
**Quiero** responder una encuesta activa  
**Para** dar mi opinión durante la sesión  

**Criterios de aceptación:**
- [ ] Selección única: radio buttons
- [ ] Selección múltiple: checkboxes
- [ ] Escala: selector 1-5 con etiquetas (Muy malo → Excelente)
- [ ] Texto abierto: campo de texto libre
- [ ] Solo una respuesta por asistente por encuesta
- [ ] Confirmación visual al enviar

---

### ÉPICA 8: DOCUMENTOS

#### EU-8.1 · Ver documentos del evento
**Como** asistente  
**Quiero** acceder a los documentos compartidos del evento  
**Para** consultar material de referencia y presentaciones  

**Criterios de aceptación:**
- [ ] Lista de documentos con: título, tipo de archivo, tamaño, descripción
- [ ] Iconos por tipo: PDF, PPT, DOC
- [ ] Asociación opcional a sesión de la agenda
- [ ] Contador de descargas
- [ ] Descarga vía signed URL (nunca URL pública)

---

### ÉPICA 9: NOTAS PERSONALES

#### EU-9.1 · Crear y editar notas
**Como** asistente  
**Quiero** tomar notas durante las sesiones  
**Para** recordar puntos clave del congreso  

**Criterios de aceptación:**
- [ ] Crear nota libre o asociada a una sesión
- [ ] Edición en tiempo real con auto-guardado
- [ ] Lista de notas con fecha de última actualización
- [ ] Solo el asistente puede ver sus propias notas (RLS)

---

### ÉPICA 10: MENSAJERÍA

#### EU-10.1 · Chat grupal del evento
**Como** asistente  
**Quiero** participar en el chat grupal del congreso  
**Para** comunicarme con otros asistentes en tiempo real  

**Criterios de aceptación:**
- [ ] Canal único para todos los asistentes del evento
- [ ] Mensajes en tiempo real (Supabase Realtime)
- [ ] Muestra nombre del remitente y hora
- [ ] Separadores de fecha (Hoy, Ayer)
- [ ] Estado vacío: "No hay mensajes aún. ¡Sé el primero en escribir!"

#### EU-10.2 · Mensajes directos (futuro)
**Como** asistente  
**Quiero** enviar mensajes privados a otros asistentes  
**Para** coordinar reuniones o compartir información de forma privada  

**Criterios de aceptación:**
- [ ] Tab "Mensajes" en pantalla de mensajería
- [ ] Placeholder: "Mensajes directos próximamente"

---

### ÉPICA 11: ANUNCIOS

#### EU-11.1 · Ver anuncios del organizador
**Como** asistente  
**Quiero** recibir comunicados oficiales del organizador  
**Para** estar informado de cambios, horarios y novedades  

**Criterios de aceptación:**
- [ ] Lista cronológica inversa (más reciente primero)
- [ ] Cada anuncio: título, cuerpo, fecha/hora de envío
- [ ] Notificación push cuando se publica uno nuevo
- [ ] Actualización en tiempo real (Supabase Realtime)

---

### ÉPICA 12: CALIFICACIONES

#### EU-12.1 · Calificar sesión
**Como** asistente  
**Quiero** evaluar las sesiones a las que asistí  
**Para** dar feedback al organizador sobre la calidad del contenido  

**Criterios de aceptación:**
- [ ] Rating 1-5 estrellas
- [ ] Comentario opcional
- [ ] Una calificación por asistente por sesión
- [ ] Solo sesiones a las que asistió (con check-in)

---

### ÉPICA 13: CONTACTOS / NETWORKING

#### EU-13.1 · Ver lista de participantes
**Como** asistente  
**Quiero** ver el directorio de asistentes del evento  
**Para** identificar colegas y hacer networking  

**Criterios de aceptación:**
- [ ] Lista de asistentes: nombre, especialidad, institución
- [ ] Avatar con iniciales
- [ ] Indicador de actividad: punto verde = activo en últimos 5 min
- [ ] Búsqueda por nombre

#### EU-13.2 · Intercambiar contacto
**Como** asistente  
**Quiero** conectar con otro asistente escaneando su QR  
**Para** agregar a mi red de contactos del evento  

**Criterios de aceptación:**
- [ ] Mostrar mi QR para que otro escanee
- [ ] Escanear QR de otro asistente
- [ ] Conexión mutua: ambos deben aceptar
- [ ] "Mis Contactos" = conexiones mutuas aceptadas

#### EU-13.3 · Mi perfil
**Como** asistente  
**Quiero** ver y gestionar mi perfil  
**Para** que otros asistentes conozcan mi información profesional  

**Criterios de aceptación:**
- [ ] Nombre, email, teléfono
- [ ] Tipo/número de documento
- [ ] Código de credencial
- [ ] Paquete seleccionado

---

### ÉPICA 14: ADMINISTRACIÓN — DASHBOARD

#### EU-14.1 · Dashboard de KPIs
**Como** administrador  
**Quiero** ver métricas clave del evento en tiempo real  
**Para** tomar decisiones informadas durante el congreso  

**Criterios de aceptación:**
- [ ] Total de asistentes registrados vs confirmados vs presentes (check-in)
- [ ] Tasa de check-in por sesión
- [ ] Tickets utilizados vs pendientes
- [ ] Estadísticas de encuestas
- [ ] Gráficos con Recharts

---

### ÉPICA 15: ADMINISTRACIÓN — GESTIÓN DE ASISTENTES

#### EU-15.1 · Listar asistentes
**Como** administrador  
**Quiero** ver la tabla completa de asistentes  
**Para** gestionar registros del evento  

**Criterios de aceptación:**
- [ ] Tabla con columnas: nombre, email, estado, paquete, fecha de registro
- [ ] Búsqueda y filtros
- [ ] Paginación
- [ ] Badge de estado: Confirmado (verde), Pendiente (azul), Cancelado (rojo)

#### EU-15.2 · Crear asistente individual
**Como** administrador  
**Quiero** registrar un asistente manualmente  
**Para** agregar registros que no vienen por importación  

**Criterios de aceptación:**
- [ ] Modal con formulario: nombre, email, paquete, documento, teléfono
- [ ] Validación con Zod
- [ ] Genera credential_code automáticamente
- [ ] Genera access_code_hash automáticamente

#### EU-15.3 · Importar asistentes por CSV
**Como** administrador  
**Quiero** importar asistentes masivamente desde un CSV  
**Para** cargar la base de datos inicial del evento  

**Criterios de aceptación:**
- [ ] Acepta archivo CSV
- [ ] Preview de datos antes de importar
- [ ] Validación de formato y datos duplicados
- [ ] Reporte de éxitos y errores

#### EU-15.4 · Ver detalle de asistente
**Como** administrador  
**Quiero** ver toda la información de un asistente  
**Para** gestionar su registro y servicios  

**Criterios de aceptación:**
- [ ] Drawer lateral con información completa
- [ ] Servicios asignados
- [ ] Historial de check-ins
- [ ] Opción de agregar servicios
- [ ] Panel de calidad de datos

#### EU-15.5 · Eliminar asistente (soft delete)
**Como** administrador  
**Quiero** eliminar un asistente  
**Para** remover registros incorrectos o cancelados  

**Criterios de aceptación:**
- [ ] Confirmación antes de eliminar
- [ ] Soft delete (marca deleted_at, no borra)
- [ ] No aparece en listas después de eliminar

---

### ÉPICA 16: ADMINISTRACIÓN — AGENDA

#### EU-16.1 · Crear sesión
**Como** administrador  
**Quiero** crear sesiones en la agenda  
**Para** construir el programa del evento  

**Criterios de aceptación:**
- [ ] Modal: título, tipo, fecha, hora inicio/fin, sala, ponente, descripción
- [ ] Tipos: talk, workshop, ceremony, networking, symposium, conference_day, other
- [ ] Check-in requerido (sí/no)
- [ ] Capacidad (opcional)
- [ ] Genera checkin_code automático si requiere check-in

#### EU-16.2 · Importar agenda por Excel
**Como** administrador  
**Quiero** importar la agenda desde un archivo Excel  
**Para** cargar múltiples sesiones de forma eficiente  

**Criterios de aceptación:**
- [ ] Acepta .xlsx
- [ ] Template descargable
- [ ] Preview antes de importar
- [ ] Validación de datos

#### EU-16.3 · Detalle de sesión (admin)
**Como** administrador  
**Quiero** ver estadísticas de una sesión  
**Para** monitorear interés y asistencia  

**Criterios de aceptación:**
- [ ] Drawer con detalle completo
- [ ] Contador de "Me interesa"
- [ ] Asistentes con check-in
- [ ] Calificación promedio

---

### ÉPICA 17: ADMINISTRACIÓN — DOCUMENTOS

#### EU-17.1 · Subir documento
**Como** administrador  
**Quiero** subir archivos al repositorio del evento  
**Para** compartir material con los asistentes  

**Criterios de aceptación:**
- [ ] Upload a Supabase Storage (bucket privado)
- [ ] Asociar opcionalmente a sesión
- [ ] Campos: título, descripción, archivo
- [ ] Tipos permitidos: PDF, PPTX, DOC

#### EU-17.2 · Editar/eliminar documento
**Como** administrador  
**Quiero** actualizar o eliminar documentos  
**Para** mantener el repositorio actualizado  

#### EU-17.3 · Panel de calidad de documentos
**Como** administrador  
**Quiero** verificar la completitud de documentos  
**Para** asegurar que cada sesión tiene su material  

---

### ÉPICA 18: ADMINISTRACIÓN — PATROCINADORES

#### EU-18.1 · CRUD de patrocinadores
**Como** administrador  
**Quiero** gestionar patrocinadores del evento  
**Para** mantener el directorio comercial actualizado  

**Criterios de aceptación:**
- [ ] Crear: nombre, nivel, categoría, descripción, stand, sitio web, WhatsApp, redes, logo, video, materiales, email
- [ ] Editar y eliminar
- [ ] Niveles: gold, silver, bronze, exhibitor
- [ ] Categorías: pharmaceutical, technology, medical_equipment, services, education, other

#### EU-18.2 · Importar patrocinadores por Excel
**Como** administrador  
**Quiero** importar patrocinadores desde Excel  
**Para** cargar el directorio de forma masiva  

#### EU-18.3 · Detalle de patrocinador (admin)
**Como** administrador  
**Quiero** ver métricas de engagement de cada patrocinador  
**Para** reportar el valor generado a los sponsors  

**Criterios de aceptación:**
- [ ] Profile views, website clicks, WhatsApp clicks, materials downloads
- [ ] Lista de leads capturados
- [ ] Drawer lateral con toda la información

---

### ÉPICA 19: ADMINISTRACIÓN — LOGÍSTICA

#### EU-19.1 · Catálogo de servicios
**Como** administrador  
**Quiero** definir los servicios disponibles del evento  
**Para** asignarlos a los asistentes según su paquete  

**Criterios de aceptación:**
- [ ] CRUD de servicios: nombre, tipo (transport/food/special/tour), descripción, horarios, ubicación
- [ ] Asociar a día específico del evento

#### EU-19.2 · Asignar servicios a asistentes
**Como** administrador  
**Quiero** asignar servicios a asistentes individuales o por paquete  
**Para** que cada asistente tenga sus tickets correspondientes  

**Criterios de aceptación:**
- [ ] Asignación individual o masiva
- [ ] Genera ticket con QR automáticamente
- [ ] Vista de asignados por servicio (drawer)

---

### ÉPICA 20: ADMINISTRACIÓN — PROVEEDORES

#### EU-20.1 · Gestionar proveedores
**Como** administrador  
**Quiero** crear y administrar proveedores de servicios  
**Para** que puedan acceder a su portal y validar tickets  

**Criterios de aceptación:**
- [ ] CRUD: empresa, categoría, contacto, email, teléfono
- [ ] Genera código de acceso único
- [ ] Asignar servicios del catálogo al proveedor
- [ ] Activar/desactivar acceso

#### EU-20.2 · Portal del proveedor
**Como** proveedor  
**Quiero** ver los servicios que tengo asignados y sus asistentes  
**Para** gestionar la entrega de mis servicios  

**Criterios de aceptación:**
- [ ] Dashboard con servicios asignados
- [ ] Lista de asistentes por servicio
- [ ] Validar ticket escaneando QR o por código
- [ ] Cambio de contraseña

---

### ÉPICA 21: ADMINISTRACIÓN — COMUNICACIONES

#### EU-21.1 · Enviar anuncio
**Como** administrador  
**Quiero** enviar un anuncio a todos los asistentes  
**Para** comunicar cambios, recordatorios o novedades  

**Criterios de aceptación:**
- [ ] Formulario: título + cuerpo
- [ ] Alcance: todos o por tipo de paquete
- [ ] Envía push notification
- [ ] Registra en tabla announcements
- [ ] Visible en sección de anuncios del asistente en tiempo real

#### EU-21.2 · Enviar emails
**Como** administrador  
**Quiero** enviar emails a asistentes  
**Para** comunicar información importante por correo  

**Criterios de aceptación:**
- [ ] Integración con servicio de email (Resend)
- [ ] Templates predefinidos
- [ ] Envío individual o masivo

---

### ÉPICA 22: ADMINISTRACIÓN — ENCUESTAS

#### EU-22.1 · Crear encuesta
**Como** administrador  
**Quiero** crear encuestas para las sesiones  
**Para** recopilar feedback en tiempo real  

**Criterios de aceptación:**
- [ ] Tipos: single, multiple, rating, open
- [ ] Opciones personalizables (para single/multiple)
- [ ] Asociar opcionalmente a sesión
- [ ] Estado: draft, active, closed
- [ ] Programar apertura/cierre

#### EU-22.2 · Importar encuestas
**Como** administrador  
**Quiero** importar encuestas desde un archivo  
**Para** crear múltiples encuestas eficientemente  

#### EU-22.3 · Ver resultados de encuesta
**Como** administrador  
**Quiero** ver los resultados de las encuestas  
**Para** analizar el feedback de los asistentes  

---

### ÉPICA 23: ADMINISTRACIÓN — STAFF

#### EU-23.1 · Gestionar staff de check-in
**Como** administrador  
**Quiero** crear y administrar personal de check-in  
**Para** que puedan registrar asistencia en las salas  

**Criterios de aceptación:**
- [ ] Crear: nombre, email, sala asignada, fecha de expiración
- [ ] Enviar invitación (crea usuario en Supabase Auth)
- [ ] Estado de invitación: pending, accepted
- [ ] Activar/desactivar acceso

#### EU-23.2 · Gestionar colaboradores del evento
**Como** administrador  
**Quiero** agregar colaboradores con roles específicos  
**Para** delegar tareas de gestión del evento  

---

### ÉPICA 24: ADMINISTRACIÓN — REPORTES

#### EU-24.1 · Exportar datos
**Como** administrador  
**Quiero** exportar datos del evento en formatos descargables  
**Para** crear reportes y análisis fuera de la plataforma  

**Criterios de aceptación:**
- [ ] Exportar asistentes (Excel/CSV)
- [ ] Exportar check-ins por sesión
- [ ] Exportar encuestas con respuestas
- [ ] Exportar leads de patrocinadores
- [ ] Exportar uso de tickets/servicios

---

### ÉPICA 25: FUNCIONALIDADES TRANSVERSALES

#### EU-25.1 · Modo oscuro
**Como** usuario  
**Quiero** que la app respete mi preferencia de tema del sistema  
**Para** tener una experiencia visual cómoda  

**Criterios de aceptación:**
- [ ] Detecta `prefers-color-scheme` automáticamente
- [ ] Sin toggle manual
- [ ] Todos los componentes tienen variantes `dark:`

#### EU-25.2 · Multi-idioma
**Como** usuario  
**Quiero** usar la app en español o inglés  
**Para** navegar en mi idioma preferido  

**Criterios de aceptación:**
- [ ] Toggle de idioma en el header (🌐)
- [ ] Español por defecto
- [ ] Todos los textos via i18next, cero hardcoded
- [ ] Persiste preferencia

#### EU-25.3 · Notificaciones push
**Como** asistente  
**Quiero** recibir notificaciones push  
**Para** enterarme de anuncios y recordatorios sin abrir la app  

**Criterios de aceptación:**
- [ ] Solicitar permiso de notificaciones al primer login
- [ ] Registrar subscription en push_subscriptions
- [ ] Triggers: nuevo anuncio, sesión próxima (15 min), mensaje directo
- [ ] Funciona con app cerrada (Service Worker)

#### EU-25.4 · Funcionamiento offline
**Como** asistente  
**Quiero** acceder a mi agenda y credencial sin internet  
**Para** no depender de conectividad durante el congreso  

**Criterios de aceptación:**
- [ ] Cache-first: agenda, info del evento, credencial QR
- [ ] Network-first: mensajes, anuncios, encuestas
- [ ] Sync en background cuando recupera conexión

#### EU-25.5 · PWA instalable
**Como** asistente  
**Quiero** instalar la app en mi pantalla de inicio  
**Para** acceder rápidamente sin navegar al URL  

**Criterios de aceptación:**
- [ ] manifest.json completo con iconos 192x192 y 512x512
- [ ] Service Worker registrado
- [ ] Prompt de instalación nativo del navegador

---

## 4. MATRIZ DE PRIORIDAD

| Prioridad | Épicas | Justificación |
|-----------|--------|---------------|
| **P0 — Must Have** | 1 (Auth), 2 (Home), 3 (Agenda), 4 (Check-in), 5 (Tickets), 14 (Dashboard), 15 (Asistentes) | Core del producto. Sin esto no hay MVP. |
| **P1 — Should Have** | 6 (Sponsors), 7 (Polls), 11 (Anuncios), 16 (Agenda admin), 19 (Logística), 21 (Comunicaciones) | Valor diferencial alto. Necesario para primer evento. |
| **P2 — Nice to Have** | 8 (Docs), 9 (Notas), 10 (Mensajería), 12 (Ratings), 13 (Contactos), 17-18 (Docs/Sponsors admin) | Enriquecen la experiencia pero no son bloqueantes. |
| **P3 — Future** | 20 (Providers), 22-24 (Polls/Staff/Reports admin), 25.3-25.5 (Push/Offline/PWA) | Segunda fase del producto. |

---

## 5. DEFINICIÓN DE HECHO (Definition of Done)

Toda historia se considera **DONE** cuando:

- [ ] Código en TypeScript estricto sin `any`
- [ ] Componentes con estados de loading, error y vacío
- [ ] Textos via i18n (es + en)
- [ ] Dark mode implementado con `dark:` variants
- [ ] RLS policies para las tablas involucradas (anon + authenticated)
- [ ] Datos filtrados por `event_id`
- [ ] Responsive mobile-first
- [ ] Validación con Zod en formularios
- [ ] Datos vía TanStack Query (no llamadas directas en componentes)
- [ ] Sin strings hardcodeados en UI
- [ ] Sin colores hardcodeados (usar design tokens)

---

## 6. GLOSARIO

| Término | Definición |
|---------|-----------|
| **event_code** | Código único del evento usado en la URL (ej: ACQFH-2026) |
| **access_code** | Código de 8 caracteres que el asistente usa para hacer login |
| **credential_code** | Código completo de credencial mostrado en QR (ej: ACQFH-2026-001234) |
| **checkin_code** | Código QR de cada sesión que el asistente escanea para registrar asistencia |
| **ticket_code** | Código QR de un ticket de servicio que el proveedor valida |
| **service_catalog** | Catálogo de servicios logísticos disponibles en el evento |
| **attendee_services** | Instancia de un servicio asignado a un asistente específico |
| **sponsor_lead** | Registro de un asistente que dejó sus datos a un patrocinador |
| **RLS** | Row Level Security — políticas de acceso a nivel de fila en PostgreSQL |

---

*CONGRÉSSAPP · Product Owner User Stories · v1.0 · Confidencial*
