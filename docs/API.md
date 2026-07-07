# API Reference

Base URL: `/api`. All routes except `/auth/login` and `/health` require a
`Authorization: Bearer <jwt>` header. RBAC is enforced server-side from the
permissions matrix; a forbidden action returns `403`.

Standard list responses are paginated:
`{ "data": [...], "pagination": { page, pageSize, total, totalPages } }`
with `?page=`, `?pageSize=`, and (where supported) `?search=` query params.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → `{token, user}` (rate-limited) |
| GET | `/auth/me` | Current user + effective permissions |
| POST | `/auth/change-password` | `{currentPassword,newPassword}` |

## Dashboard
| GET | `/dashboard` | Cockpit KPIs (availability, alerts, MTD cost) |
| GET | `/dashboard/driver` | Driver mobile screen payload (vehicle, docs, staff) |

## Vehicles
| GET | `/vehicles` · `/vehicles/:id` | filters: `status`, `vehicleType`, `storeId`, `search` |
| POST/PATCH/DELETE | `/vehicles` … | CRUD (soft delete) |
| POST | `/vehicles/:id/odometer-correction` | Fleet-Manager only; audited |
| POST | `/vehicles/:id/status` | Change status |
| POST | `/vehicles/:id/purchase` · `/disposal` | Asset lifecycle |

## Drivers
| GET/POST/PATCH/DELETE | `/drivers` … | CRUD + documents/assignments |
| POST | `/drivers/:id/assign` | Assign to a vehicle (versions history) |

## Masters
| CRUD | `/vendors`, `/stores`, `/employees` | typed master data |

## Compliance
| GET/POST/PATCH/DELETE | `/compliance` | one register (vehicle + driver docs) |
| POST | `/compliance/:id/file` | multipart scan upload |

## Fuel
| GET | `/fuel` · `/fuel/efficiency/:vehicleId` · `/fuel/pending-approvals` |
| POST | `/fuel` | manual entry (computes efficiency, flags anomalies) |
| POST | `/fuel/import` | `{commit,rows[]}` dry-run preview + commit (vip_kit/fuel_buddy) |
| POST | `/fuel/:id/approve` | `{approve, reason}` cash approval (Fleet Manager) |

## Maintenance
| GET/POST | `/maintenance/job-cards` | job cards (warranty banner on create) |
| POST | `/maintenance/job-cards/:id/close` | date out, downtime, PM recompute |
| GET/PUT | `/maintenance/pm-schedules[/:vehicleType]` | editable PM defaults |
| GET | `/maintenance/pm-due` | vehicles approaching/overdue PM |
| GET/POST | `/maintenance/tyres` (+ `/:id/tread-check`, `/:id/scrap`) | position-wise |

## Fines & Salik
| GET/POST | `/fines` | auto-attributes driver on offence date |
| POST | `/fines/:id/reassign` · `/fines/:id/pay` | override (audited) / mark paid |
| GET/PUT | `/salik[/:vehicleId]` | tag balance + low threshold |

## Incidents
| GET/POST/PATCH | `/incidents` | claim lifecycle |
| POST | `/incidents/:id/photos` | multipart photo upload |

## Costs & TCO
| GET | `/costs/vehicle/:vehicleId` | per-vehicle TCO; `?period=mtd|ytd` or `?from&to` |
| GET | `/costs/summary` | fleet roll-up + top-5 costliest |

## Staff transport & attendance
| GET/POST | `/transport/routes` (+ `/:id`) | routes |
| POST | `/transport/routes/:id/assign` | vehicle/driver (effective-dated) |
| POST/DELETE | `/transport/routes/:id/employees` | roster mapping |
| GET | `/attendance?routeId&date` | attendance for a route/date |
| POST | `/attendance/mark` | coordinator/driver marks (coordinator precedence) |

## Availability
| GET | `/availability` | read-only board + KPIs; greys out compliance-blocked |

## Alerts
| GET | `/alerts` · `/alerts/summary` | Alert Centre feed / counts |
| POST | `/alerts/run` · `/alerts/:id/resolve` | run engine on demand / resolve |

## Reports (exports)
| GET | `/reports/compliance.xlsx` · `/reports/costs.xlsx` · `/reports/attendance.xlsx` |
| GET | `/reports/vehicle-history/:id.pdf` | full-life PDF sheet |

## Inventory (feature-flagged)
| GET/POST | `/inventory/parts` (+ `/:id/movement`) | 404 while `FEATURE_INVENTORY=false` |

## Settings / Users / Audit
| GET/PUT | `/settings[/:key]` | admin-configurable thresholds & windows |
| GET/POST/PATCH | `/users` | user administration |
| GET | `/audit` | global audit log (Fleet Manager / Management) |
