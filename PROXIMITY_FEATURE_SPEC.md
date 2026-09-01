# TAG Proximity Detection Feature

## Implementation Status

### Phase 1: Foundation (IN PROGRESS)
- [ ] Database schema (Supabase migrations)
- [ ] API routes for proximity events
- [ ] ProximityService abstraction
- [ ] Device registration flow
- [ ] Zone event tracking

### Phase 2: Admin & Management
- [ ] Admin dashboard
- [ ] Beacon management
- [ ] Zone configuration
- [ ] Retailer/Store setup

### Phase 3: Customer Experience  
- [ ] Zone entry notifications
- [ ] In-app zone experience
- [ ] Visit history

### Phase 4: Development & Analytics
- [ ] Simulation mode
- [ ] Analytics dashboard
- [ ] RLS security policies

## Database Schema

Tables to create:
- customers (with customer_id UUID)
- devices (device_id, customer_id association)
- retailers
- stores (retailer_id association)
- zones (store_id association)
- beacons (zone_id association)
- zone_events (customer_id, zone_id, event_type)
- customer_visits (aggregated from zone_events)

## Mobile Architecture

ProximityService interface:
- startMonitoring()
- stopMonitoring()
- registerBeacon()
- onZoneEntered(callback)
- onZoneExited(callback)
- getDetectedZones()

Implementations:
- Web/Mock (for development)
- iOS (native Swift with CoreLocation)
- Android (native Kotlin with BLE)
