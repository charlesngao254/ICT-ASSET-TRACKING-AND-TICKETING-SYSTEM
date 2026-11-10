from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.constants import AccountStatus, MemoStage, Role, TaskStatus, TicketStatus, VehicleStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class AccessRequestCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    department: str = Field(min_length=2, max_length=120)
    requested_role: Role
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class AccountApproval(BaseModel):
    role: Role


class UserOut(ORMModel):
    id: UUID
    full_name: str
    email: EmailStr
    department: str
    role: Role
    status: AccountStatus
    created_at: datetime


class AccessRequestOut(ORMModel):
    id: UUID
    full_name: str
    email: EmailStr
    department: str
    requested_role: Role | None
    status: AccountStatus
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserOut


class MemoCreate(BaseModel):
    title: str = Field(min_length=4, max_length=200)
    activity: str = Field(min_length=10, max_length=10000)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    shared_with_department: bool = False
    participant_ids: list[UUID] = Field(default_factory=list, max_length=50)


class MemoOut(ORMModel):
    id: UUID
    title: str
    activity: str
    amount: Decimal
    department: str
    initiator_id: UUID
    stage: MemoStage
    shared_with_department: bool
    created_at: datetime
    updated_at: datetime


class MemoTransition(BaseModel):
    action: Literal["approve", "forward", "complete", "return", "resubmit"]


class MemoCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    visible_to_department: bool = False


class MemoCommentOut(ORMModel):
    id: UUID
    memo_id: UUID
    author_id: UUID
    body: str
    visible_to_department: bool
    created_at: datetime


class MemoEventOut(ORMModel):
    id: UUID
    memo_id: UUID
    actor_id: UUID
    event: str
    created_at: datetime


class DocumentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=240)
    document_type: str = Field(min_length=2, max_length=60)
    shared_with_department: bool = False


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=240)
    document_type: str | None = Field(default=None, min_length=2, max_length=60)
    workflow_status: Literal["Draft", "For review", "Approved", "Archived"] | None = None
    shared_with_department: bool | None = None


class DocumentOut(ORMModel):
    id: UUID
    title: str
    document_type: str
    department: str
    owner_id: UUID
    workflow_status: str
    shared_with_department: bool
    created_at: datetime
    updated_at: datetime


class DocumentCommentOut(ORMModel):
    id: UUID
    document_id: UUID
    author_id: UUID
    body: str
    visible_to_department: bool
    created_at: datetime


class TicketCreate(BaseModel):
    title: str = Field(min_length=4, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    category: str = Field(min_length=2, max_length=60)
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    assigned_to_id: UUID | None = None
    priority: Literal["Low", "Normal", "High", "Urgent"] | None = None


class TicketOut(ORMModel):
    id: UUID
    title: str
    description: str
    category: str
    priority: str
    department: str
    requester_id: UUID
    assigned_to_id: UUID | None
    status: TicketStatus
    created_at: datetime
    updated_at: datetime


class AssetCreate(BaseModel):
    asset_tag: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(min_length=2, max_length=60)
    department: str = Field(min_length=2, max_length=120)
    custodian: str = Field(min_length=2, max_length=120)
    condition: str = Field(default="Good", max_length=32)
    status: str = Field(default="In use", max_length=32)
    location: str = Field(min_length=2, max_length=180)


class AssetUpdate(BaseModel):
    custodian: str | None = Field(default=None, min_length=2, max_length=120)
    condition: str | None = Field(default=None, max_length=32)
    status: str | None = Field(default=None, max_length=32)
    location: str | None = Field(default=None, min_length=2, max_length=180)


class AssetOut(ORMModel):
    id: UUID
    asset_tag: str
    name: str
    category: str
    department: str
    custodian: str
    condition: str
    status: str
    location: str
    created_at: datetime
    updated_at: datetime


class VehicleCreate(BaseModel):
    registration: str = Field(min_length=2, max_length=24)
    make_model: str = Field(min_length=2, max_length=120)
    department: str = Field(min_length=2, max_length=120)
    driver: str = Field(min_length=2, max_length=120)
    status: VehicleStatus = VehicleStatus.AVAILABLE
    odometer_km: int = Field(default=0, ge=0)
    fuel_litres_per_100km: Decimal = Field(default=Decimal("0"), ge=0, max_digits=6, decimal_places=2)
    current_location: str = Field(min_length=2, max_length=180)
    next_service_date: date | None = None


class VehicleUpdate(BaseModel):
    driver: str | None = Field(default=None, min_length=2, max_length=120)
    status: VehicleStatus | None = None
    odometer_km: int | None = Field(default=None, ge=0)
    fuel_litres_per_100km: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)
    current_location: str | None = Field(default=None, min_length=2, max_length=180)
    next_service_date: date | None = None


class VehicleLocationIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kph: float = Field(default=0, ge=0, le=300)
    odometer_km: int | None = Field(default=None, ge=0)


class VehicleOut(ORMModel):
    id: UUID
    registration: str
    make_model: str
    department: str
    driver: str
    status: VehicleStatus
    odometer_km: int
    fuel_litres_per_100km: Decimal
    current_location: str
    latitude: float | None
    longitude: float | None
    speed_kph: float
    location_source: str
    location_updated_at: datetime | None
    next_service_date: date | None
    updated_at: datetime


class VehicleLocationOut(ORMModel):
    id: UUID
    vehicle_id: UUID
    latitude: float
    longitude: float
    speed_kph: float
    odometer_km: int | None
    source: str
    recorded_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    instructions: str = Field(min_length=5, max_length=10000)
    assignee_id: UUID
    due_date: date


class TaskUpdate(BaseModel):
    status: TaskStatus


class TaskOut(ORMModel):
    id: UUID
    title: str
    instructions: str
    department: str
    assigner_id: UUID
    assignee_id: UUID
    due_date: date
    status: TaskStatus
    created_at: datetime
    updated_at: datetime


class TaskCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TaskCommentOut(ORMModel):
    id: UUID
    task_id: UUID
    author_id: UUID
    body: str
    created_at: datetime


class AttachmentOut(ORMModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    uploaded_by_id: UUID
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime


class HealthOut(BaseModel):
    status: Literal["ok"]
    database: Literal["postgresql"]