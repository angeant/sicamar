# Sicamar RRHH - Documentación Técnica

Sistema de gestión de RRHH para Sicamar Metales S.A.

## Índice

| Documento | Descripción |
|-----------|-------------|
| [overview.md](./overview.md) | Arquitectura general y flujos del sistema |
| [motor.md](./motor.md) | **Master Doc** - Reglas de negocio del motor de liquidación |
| [database.md](./database.md) | Schema Supabase, tablas y relaciones |
| [api.md](./api.md) | Endpoints REST disponibles |
| [turnos.md](./turnos.md) | Sistema de turnos y rotaciones |
| [liquidaciones.md](./liquidaciones.md) | Motor de liquidación (fórmulas técnicas) |
| [marcaciones.md](./marcaciones.md) | Sincronización de fichadas |
| [vacaciones.md](./vacaciones.md) | Eventos de asistencia y saldos |
| [integraciones.md](./integraciones.md) | Conexiones externas (Bejerman, InWeb) |

## Quick Reference

```
Schema: sicamar
Supabase Project ID: uimqzfmspegwzmdoqjfn
```

### Tablas principales

| Tabla | Registros | Propósito |
|-------|-----------|-----------|
| `empleados` | ~143 | Nómina activa |
| `marcaciones` | ~1,800 | Fichadas del reloj |
| `jornadas_diarias` | ~860 | Jornadas calculadas |
| `liquidacion_detalle` | ~500K | Conceptos liquidados |
| `novedades_liquidacion` | ~10K | Novedades manuales |

### Stack

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Clerk (OTP email)
- **Reloj**: Intelektron InWeb (SQL Server via VPN)

---

*Última actualización: Diciembre 2025*

