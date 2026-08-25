# Deployment Guide — RITMO

## Pre-deployment Checklist

### Security
- [ ] Verificar que no haya secretos en código (ejecutar `git log -p | grep -i "password\|secret\|key"`)
- [ ] Configurar variables de entorno en Vercel/servidor
- [ ] Habilitar HTTPS obligatorio
- [ ] Configurar CORS correctamente
- [ ] Verificar que robots.txt y sitemap.xml sean accesibles

### Performance
- [ ] Ejecutar `npm run build` y revisar bundle size
- [ ] Verificar Lighthouse score (>90)
- [ ] Probar en 3G lento
- [ ] Verificar Core Web Vitals en PageSpeed Insights

### Functionality
- [ ] Probar login/registro en producción
- [ ] Probar importación/exportación de datos
- [ ] Verificar que modo offline funciona (DevTools > Network > Offline)
- [ ] Probar en Safari, Chrome, Firefox (móvil + desktop)
- [ ] Verificar accesibilidad con screen reader

## Deployment Options

### Vercel (Recomendado)
```bash
# 1. Conectar repo a vercel.com
# 2. Configurar variables de entorno:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
EDAMAM_APP_ID
EDAMAM_APP_KEY
NEXT_PUBLIC_APP_URL=https://ritmo.app

# 3. Deploy automático en push a main
```

### Self-hosted (Docker)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t ritmo .
docker run -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL=... ritmo
```

### Supabase (Functions + Storage)
- Usar Supabase Functions para API endpoints
- Guardar exports JSON en Storage
- Usar Row Level Security (RLS) para todos los datos

## Post-deployment

1. **Monitor**
   - Configurar error tracking (Sentry, LogRocket)
   - Monitorear Supabase logs
   - Verificar uptime con Statuspage.io

2. **Analytics** (sin trackers invasivos)
   - Configurar Web Vitals
   - Usar Vercel Analytics
   - Tracking de eventos en Supabase

3. **Backups**
   - Configurar backups automáticos en Supabase
   - Exportar datos regularmente

## Performance Tips

- Imágenes: usar Next.js Image optimization
- Fonts: preload en layout.tsx
- Code splitting: automático con Next.js
- Caché: configurado en next.config.ts

## Seguridad Post-deployment

- Monitorear rate limiting en API
- Revisar logs de Supabase regularmente
- Mantener dependencias actualizadas (`npm update`)
- Usar GitHub security alerts
