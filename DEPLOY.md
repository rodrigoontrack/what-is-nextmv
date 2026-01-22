# 🚀 Guía de Despliegue en Vercel (Súper Sencilla)

## Paso 1: Sube tu código a GitHub

Si aún no lo has hecho:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## Paso 2: Despliega en Vercel (5 minutos)

### Opción A: Desde la Web (MÁS FÁCIL) ⭐

1. **Ve a**: https://vercel.com
2. **Inicia sesión** con tu cuenta de GitHub
3. **Haz clic en**: "Add New Project" o "New Project"
4. **Selecciona** tu repositorio de la lista
5. **Vercel detectará automáticamente** que es un proyecto Vite - ¡no necesitas cambiar nada!
6. **Agrega las variables de entorno** (antes de hacer clic en Deploy):
   - En la página de configuración del proyecto, busca la sección **"Environment Variables"** o **"Variables de Entorno"**
   - Haz clic en **"Add"** o **"Agregar"** para cada variable
   - Agrega estas 3 variables una por una:
     
     **Variable 1:**
     - Name: `VITE_SUPABASE_URL`
     - Value: `https://tu-proyecto.supabase.co` (tu URL de Supabase)
     - Marca todas las opciones: Production, Preview, Development
     
     **Variable 2:**
     - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`
     - Value: `tu_clave_anon_de_supabase` (la clave anon public)
     - Marca todas las opciones: Production, Preview, Development
     
     **Variable 3:**
     - Name: `VITE_NEXTMV_API_KEY`
     - Value: `tu_api_key_de_nextmv`
     - Marca todas las opciones: Production, Preview, Development
   
   📍 **Ubicación exacta**: En la página de configuración, justo antes del botón "Deploy", verás una sección expandible llamada "Environment Variables". Haz clic para expandirla.

7. **Haz clic en**: "Deploy"
8. **¡Listo!** En 2-3 minutos tendrás tu app desplegada 🎉

### Opción B: Desde la Terminal

```bash
# Instala Vercel CLI
npm i -g vercel

# Despliega
vercel

# Sigue las instrucciones en pantalla
# Te pedirá las variables de entorno
```

## 📍 ¿Dónde agregar las variables de entorno en Vercel?

### Durante el PRIMER deploy (Recomendado):

1. Cuando estés en la página de configuración del proyecto en Vercel
2. **Busca la sección "Environment Variables"** - está justo antes del botón "Deploy"
3. Si está colapsada (cerrada), haz clic para expandirla
4. Verás un botón **"Add"** o **"Add New"**
5. Haz clic y agrega cada variable una por una

**Ruta visual:**
```
Vercel Dashboard 
  → Add New Project 
    → Selecciona tu repo 
      → Página de configuración
        → [Aquí está la sección "Environment Variables"] ← AQUÍ
          → Botón "Deploy"
```

### Si YA desplegaste el proyecto:

1. Ve a https://vercel.com/dashboard
2. Haz clic en el nombre de tu proyecto
3. En la parte superior, haz clic en **"Settings"** (Configuración)
4. En el menú lateral izquierdo, busca y haz clic en **"Environment Variables"**
5. Haz clic en **"Add New"** para agregar cada variable

**Ruta visual:**
```
Vercel Dashboard 
  → Tu Proyecto 
    → Settings (arriba)
      → Environment Variables (menú lateral izquierdo) ← AQUÍ
```

## Paso 3: Configurar Variables de Entorno

### ¿Dónde conseguir las variables?

**VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY:**
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a Settings → API
4. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

**VITE_NEXTMV_API_KEY:**
- Esta es tu API key de NextMV (ya la tienes en tu código local)

### Agregar variables en Vercel (si ya desplegaste sin agregarlas):

**Opción 1: Desde el Dashboard del Proyecto**
1. Ve a https://vercel.com/dashboard
2. Haz clic en tu proyecto
3. En el menú superior, haz clic en **"Settings"**
4. En el menú lateral izquierdo, haz clic en **"Environment Variables"**
5. Haz clic en el botón **"Add New"** o **"Agregar Nueva"**
6. Para cada variable:
   - **Key/Name**: Escribe el nombre (ej: `VITE_SUPABASE_URL`)
   - **Value**: Pega el valor
   - **Environment**: Marca las 3 opciones (Production, Preview, Development)
   - Haz clic en **"Save"**
7. Repite los pasos 5-6 para las otras 2 variables
8. **IMPORTANTE**: Después de agregar todas las variables, ve a la pestaña **"Deployments"** y haz clic en los 3 puntos (⋯) del último deploy → **"Redeploy"**

**Opción 2: Durante el primer deploy**
- Cuando estés en la página de configuración inicial (antes de hacer clic en Deploy)
- Busca la sección **"Environment Variables"** (puede estar colapsada)
- Expándela y agrega las variables ahí mismo

## Paso 4: ¡Listo!

Tu aplicación estará disponible en una URL como:
`https://tu-proyecto.vercel.app`

Cada vez que hagas `git push`, Vercel desplegará automáticamente la nueva versión.

## ¿Problemas?

- **Error de build**: Verifica que todas las variables de entorno estén configuradas
- **Error de rutas**: El `vercel.json` ya está configurado, no deberías tener problemas
- **Variables no funcionan**: Asegúrate de hacer un nuevo deploy después de agregar variables
- **Error de CORS con NextMV API**: Ya está solucionado con una función serverless en `/api/nextmv`. Solo asegúrate de tener `VITE_NEXTMV_API_KEY` configurada en Vercel.
