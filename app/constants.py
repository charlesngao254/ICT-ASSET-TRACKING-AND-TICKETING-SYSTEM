from enum import StrEnum


class Role(StrEnum):
    STAFF = "Staff"
    HOD = "HOD"
    PERMANENT_SECRETARY = "Permanent Secretary"
    CFO = "CFO / Finance"
    ACCOUNTS_KEEPER = "Accounts Keeper"
    RECORDS_OFFICER = "Records Officer"
    ICT_OFFICER = "ICT Officer"
    FLEET_OFFICER = "Fleet Officer"
    SYSTEM_ADMINISTRATOR = "System Administrator"


class AccountStatus(StrEnum):
    PENDING = "Pending approval"
    ACTIVE = "Active"
    DISABLED = "Disabled"


class MemoStage(StrEnum):
    PS_APPROVAL = "PS approval"
    CFO_ACTION = "CFO action"
    ACCOUNTS_PROCESSING = "Accounts processing"
    COMPLETED = "Completed"
    RETURNED = "Returned"


class TicketStatus(StrEnum):
    OPEN = "Open"
    IN_PROGRESS = "In progress"
    WAITING = "Waiting"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class VehicleStatus(StrEnum):
    AVAILABLE = "Available"
    ON_ASSIGNMENT = "On assignment"
    MAINTENANCE = "Maintenance"
    OUT_OF_SERVICE = "Out of service"


class TaskStatus(StrEnum):
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In progress"
    COMPLETED = "Completed"