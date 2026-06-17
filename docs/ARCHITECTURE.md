# Architecture

## Frontend

- React + TypeScript
- Tailwind CSS
- Recharts for dashboard charts
- FullCalendar for equipment reservations
- Lucide icons

## Backend

- Node.js + Express
- JWT session middleware
- RBAC middleware for Admin-only APIs
- PostgreSQL schema for users, equipment, reservations, education, and CMS blocks

## Access Control

| Area | Anonymous | User | Admin |
| --- | --- | --- | --- |
| Home dashboard | Read | Read | Edit CMS/data |
| Equipment list | Read | Read | Create/update/delete |
| Education | Blocked | Apply/certify | Manage sessions |
| Reservation | Blocked | Create/view own | Approve/reject |
| Admin page | Blocked | Blocked | Full access |

## API Surface

- `POST /auth/dev-login`
- `GET /equipment`
- `GET /equipment/:id`
- `GET /reservations`
- `POST /reservations`
- `GET /admin/summary`
