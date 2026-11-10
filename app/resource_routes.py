from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.config import get_settings
from app.constants import AccountStatus, MemoStage, Role, TaskStatus, TicketStatus, VehicleStatus
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    ActivityMemo,
    Attachment,
    DepartmentDocument,
    DocumentComment,
    DelegatedTask,
    FleetVehicle,
    ICTAsset,
    MemoComment,
    MemoEvent,
    MemoParticipant,
    ServiceTicket,
    TaskComment,
    User,
    VehicleLocationEvent,
)
from app.schemas import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    AttachmentOut,
    DocumentCommentOut,
    DocumentCreate,
    DocumentOut,
    DocumentUpdate,
    MemoCommentCreate,
    MemoCommentOut,
    MemoCreate,
    MemoEventOut,
    MemoOut,
    MemoTransition,
    TaskCommentCreate,
    TaskCommentOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TicketCreate,
    TicketOut,
    TicketUpdate,
    UserOut,
    VehicleCreate,
    VehicleLocationIn,
    VehicleLocationOut,
    VehicleOut,
    VehicleUpdate,
)


router = APIRouter(prefix="/api/v1", tags=["department operations"])
admin = require_roles(Role.SYSTEM_ADMINISTRATOR)
ict_staff = require_roles(Role.ICT_OFFICER, Role.SYSTEM_ADMINISTRATOR)
fleet_staff = require_roles(Role.FLEET_OFFICER, Role.SYSTEM_ADMINISTRATOR)
memo_stage_roles = {
    MemoStage.PS_APPROVAL.value: Role.PERMANENT_SECRETARY.value,
    MemoStage.CFO_ACTION.value: Role.CFO.value,
    MemoStage.ACCOUNTS_PROCESSING.value: Role.ACCOUNTS_KEEPER.value,
}
allowed_upload_types = {"application/pdf", "image/png", "image/jpeg", "text/plain"}


def fail_not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")


def memo_is_visible(db: Session, user: User, memo: ActivityMemo) -> bool:
    if memo.shared_with_department or memo.initiator_id == user.id:
        return True
    if memo_stage_roles.get(memo.stage) == user.role:
        return True
    return db.get(MemoParticipant, {"memo_id": memo.id, "user_id": user.id}) is not None


def visible_memo_query(db: Session, user: User):
    conditions = [
        ActivityMemo.shared_with_department.is_(True),
        ActivityMemo.initiator_id == user.id,
        ActivityMemo.id.in_(select(MemoParticipant.memo_id).where(MemoParticipant.user_id == user.id)),
    ]
    active_stage = next((stage for stage, role in memo_stage_roles.items() if role == user.role), None)
    if active_stage:
        conditions.append(ActivityMemo.stage == active_stage)
    return select(ActivityMemo).where(or_(*conditions))


def document_is_visible(db: Session, user: User, document: DepartmentDocument) -> bool:
    return (
        document.owner_id == user.id
        or document.shared_with_department
        or user.role == Role.RECORDS_OFFICER.value
    )


def task_is_visible(user: User, task: DelegatedTask) -> bool:
    return task.assigner_id == user.id or task.assignee_id == user.id


@router.get("/memos", response_model=list[MemoOut])
def list_memos(
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActivityMemo]:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    query = visible_memo_query(db, user).order_by(ActivityMemo.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(query))


@router.post("/memos", response_model=MemoOut, status_code=status.HTTP_201_CREATED)
def create_memo(
    payload: MemoCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityMemo:
    participant_ids = set(payload.participant_ids)
    participants = list(db.scalars(select(User).where(User.id.in_(participant_ids)))) if participant_ids else []
    if len(participants) != len(participant_ids) or any(person.status != AccountStatus.ACTIVE.value for person in participants):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid memo participant")
    memo = ActivityMemo(
        title=payload.title.strip(),
        activity=payload.activity.strip(),
        amount=payload.amount,
        department=user.department,
        initiator_id=user.id,
        stage=MemoStage.PS_APPROVAL.value,
        shared_with_department=payload.shared_with_department,
    )
    db.add(memo)
    db.flush()
    db.add(MemoEvent(memo_id=memo.id, actor_id=user.id, event="Submitted for PS approval"))
    for participant in participants:
        db.add(MemoParticipant(memo_id=memo.id, user_id=participant.id))
    record_audit(db, user, "memo.created", "memo", memo.id, {"amount": str(memo.amount)})
    db.commit()
    db.refresh(memo)
    return memo


@router.get("/memos/{memo_id}", response_model=MemoOut)
def get_memo(memo_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ActivityMemo:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()
    return memo


@router.post("/memos/{memo_id}/transition", response_model=MemoOut)
def transition_memo(
    memo_id: UUID,
    payload: MemoTransition,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityMemo:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()

    action = payload.action
    if action == "resubmit":
        if memo.initiator_id != user.id or memo.stage != MemoStage.RETURNED.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the initiator can resubmit a returned memo")
        memo.stage = MemoStage.PS_APPROVAL.value
        event = "Resubmitted for PS approval"
    else:
        required_role = memo_stage_roles.get(memo.stage)
        if required_role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the assigned approver can act on this memo")
        transitions = {
            (MemoStage.PS_APPROVAL.value, "approve"): MemoStage.CFO_ACTION.value,
            (MemoStage.CFO_ACTION.value, "forward"): MemoStage.ACCOUNTS_PROCESSING.value,
            (MemoStage.ACCOUNTS_PROCESSING.value, "complete"): MemoStage.COMPLETED.value,
        }
        if action == "return":
            memo.stage = MemoStage.RETURNED.value
            event = "Returned to initiator"
        elif (memo.stage, action) in transitions:
            memo.stage = transitions[(memo.stage, action)]
            event = {
                "approve": "Approved and forwarded to CFO / Finance",
                "forward": "Finance action completed and forwarded to Accounts Keeper",
                "complete": "Accounts processing completed",
            }[action]
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That action is not valid at this workflow stage")
        if db.get(MemoParticipant, {"memo_id": memo.id, "user_id": user.id}) is None:
            db.add(MemoParticipant(memo_id=memo.id, user_id=user.id))
    db.add(MemoEvent(memo_id=memo.id, actor_id=user.id, event=event))
    record_audit(db, user, "memo.transitioned", "memo", memo.id, {"stage": memo.stage, "action": action})
    db.commit()
    db.refresh(memo)
    return memo


@router.get("/memos/{memo_id}/events", response_model=list[MemoEventOut])
def list_memo_events(memo_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MemoEvent]:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()
    return list(db.scalars(select(MemoEvent).where(MemoEvent.memo_id == memo_id).order_by(MemoEvent.created_at)))


@router.get("/memos/{memo_id}/comments", response_model=list[MemoCommentOut])
def list_memo_comments(memo_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MemoComment]:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()
    query = select(MemoComment).where(MemoComment.memo_id == memo_id)
    query = query.where(or_(MemoComment.author_id == user.id, and_(memo.shared_with_department, MemoComment.visible_to_department)))
    return list(db.scalars(query.order_by(MemoComment.created_at)))


@router.post("/memos/{memo_id}/comments", response_model=MemoCommentOut, status_code=status.HTTP_201_CREATED)
def create_memo_comment(
    memo_id: UUID,
    payload: MemoCommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoComment:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()
    if payload.visible_to_department and not memo.shared_with_department:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="This memo is not shared with the department")
    comment = MemoComment(
        memo_id=memo.id,
        author_id=user.id,
        body=payload.body.strip(),
        visible_to_department=payload.visible_to_department,
    )
    db.add(comment)
    record_audit(db, user, "memo.comment_created", "memo", memo.id)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DepartmentDocument]:
    conditions = [
        DepartmentDocument.owner_id == user.id,
        DepartmentDocument.shared_with_department.is_(True),
    ]
    if user.role == Role.RECORDS_OFFICER.value:
        return list(db.scalars(select(DepartmentDocument).order_by(DepartmentDocument.created_at.desc()).limit(min(max(limit, 1), 100)).offset(max(offset, 0))))
    return list(db.scalars(select(DepartmentDocument).where(or_(*conditions)).order_by(DepartmentDocument.created_at.desc()).limit(min(max(limit, 1), 100)).offset(max(offset, 0))))


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DepartmentDocument:
    document = DepartmentDocument(
        title=payload.title.strip(),
        document_type=payload.document_type,
        department=user.department,
        owner_id=user.id,
        shared_with_department=payload.shared_with_department,
    )
    db.add(document)
    db.flush()
    record_audit(db, user, "document.created", "document", document.id)
    db.commit()
    db.refresh(document)
    return document


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DepartmentDocument:
    document = db.get(DepartmentDocument, document_id)
    if document is None or not document_is_visible(db, user, document):
        fail_not_found()
    return document


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DepartmentDocument:
    document = db.get(DepartmentDocument, document_id)
    if document is None or not document_is_visible(db, user, document):
        fail_not_found()
    updates = payload.model_dump(exclude_unset=True)
    if "workflow_status" in updates and user.role != Role.RECORDS_OFFICER.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Records Officers can change document workflow status")
    if document.owner_id != user.id and user.role != Role.RECORDS_OFFICER.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner or a Records Officer can update this document")
    for field, value in updates.items():
        setattr(document, field, value)
    record_audit(db, user, "document.updated", "document", document.id, {"fields": sorted(updates)})
    db.commit()
    db.refresh(document)
    return document


@router.get("/documents/{document_id}/comments", response_model=list[DocumentCommentOut])
def list_document_comments(document_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DocumentComment]:
    document = db.get(DepartmentDocument, document_id)
    if document is None or not document_is_visible(db, user, document):
        fail_not_found()
    query = select(DocumentComment).where(DocumentComment.document_id == document_id)
    query = query.where(or_(DocumentComment.author_id == user.id, and_(document.shared_with_department, DocumentComment.visible_to_department)))
    return list(db.scalars(query.order_by(DocumentComment.created_at)))


@router.post("/documents/{document_id}/comments", response_model=DocumentCommentOut, status_code=status.HTTP_201_CREATED)
def create_document_comment(
    document_id: UUID,
    payload: MemoCommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentComment:
    document = db.get(DepartmentDocument, document_id)
    if document is None or not document_is_visible(db, user, document):
        fail_not_found()
    if payload.visible_to_department and not document.shared_with_department:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="This document is not shared with the department")
    comment = DocumentComment(
        document_id=document.id,
        author_id=user.id,
        body=payload.body.strip(),
        visible_to_department=payload.visible_to_department,
    )
    db.add(comment)
    record_audit(db, user, "document.comment_created", "document", document.id)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/tickets", response_model=list[TicketOut])
def list_tickets(
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ServiceTicket]:
    query = select(ServiceTicket)
    if user.role not in {Role.ICT_OFFICER.value, Role.SYSTEM_ADMINISTRATOR.value}:
        query = query.where(ServiceTicket.requester_id == user.id)
    query = query.order_by(ServiceTicket.created_at.desc()).limit(min(max(limit, 1), 100)).offset(max(offset, 0))
    return list(db.scalars(query))


@router.post("/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceTicket:
    ticket = ServiceTicket(
        title=payload.title.strip(),
        description=payload.description.strip(),
        category=payload.category,
        priority=payload.priority,
        department=user.department,
        requester_id=user.id,
    )
    db.add(ticket)
    db.flush()
    record_audit(db, user, "ticket.created", "ticket", ticket.id)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    user: User = Depends(ict_staff),
    db: Session = Depends(get_db),
) -> ServiceTicket:
    ticket = db.get(ServiceTicket, ticket_id)
    if ticket is None:
        fail_not_found()
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(ticket, field, value.value if hasattr(value, "value") else value)
    record_audit(db, user, "ticket.updated", "ticket", ticket.id, {"fields": sorted(updates)})
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/assets", response_model=list[AssetOut])
def list_assets(
    limit: int = 100,
    offset: int = 0,
    _: User = Depends(ict_staff),
    db: Session = Depends(get_db),
) -> list[ICTAsset]:
    query = select(ICTAsset).order_by(ICTAsset.asset_tag).limit(min(max(limit, 1), 250)).offset(max(offset, 0))
    return list(db.scalars(query))


@router.post("/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    user: User = Depends(ict_staff),
    db: Session = Depends(get_db),
) -> ICTAsset:
    asset = ICTAsset(**payload.model_dump())
    db.add(asset)
    db.flush()
    record_audit(db, user, "asset.created", "asset", asset.id, {"asset_tag": asset.asset_tag})
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: UUID,
    payload: AssetUpdate,
    user: User = Depends(ict_staff),
    db: Session = Depends(get_db),
) -> ICTAsset:
    asset = db.get(ICTAsset, asset_id)
    if asset is None:
        fail_not_found()
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(asset, field, value)
    record_audit(db, user, "asset.updated", "asset", asset.id, {"fields": sorted(updates)})
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/fleet/vehicles", response_model=list[VehicleOut])
def list_vehicles(
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FleetVehicle]:
    if user.role not in {
        Role.FLEET_OFFICER.value,
        Role.PERMANENT_SECRETARY.value,
        Role.SYSTEM_ADMINISTRATOR.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fleet access is restricted")
    query = select(FleetVehicle).order_by(FleetVehicle.registration).limit(min(max(limit, 1), 250)).offset(max(offset, 0))
    return list(db.scalars(query))


@router.post("/fleet/vehicles", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    user: User = Depends(fleet_staff),
    db: Session = Depends(get_db),
) -> FleetVehicle:
    vehicle = FleetVehicle(
        **payload.model_dump(),
        location_source="Manual update",
        location_updated_at=datetime.now(UTC),
    )
    db.add(vehicle)
    db.flush()
    record_audit(db, user, "vehicle.created", "vehicle", vehicle.id)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.patch("/fleet/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    user: User = Depends(fleet_staff),
    db: Session = Depends(get_db),
) -> FleetVehicle:
    vehicle = db.get(FleetVehicle, vehicle_id)
    if vehicle is None:
        fail_not_found()
    updates = payload.model_dump(exclude_unset=True)
    if "odometer_km" in updates and updates["odometer_km"] < vehicle.odometer_km:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Odometer mileage cannot decrease")
    for field, value in updates.items():
        setattr(vehicle, field, value.value if hasattr(value, "value") else value)
    vehicle.location_source = "Manual update"
    vehicle.location_updated_at = datetime.now(UTC)
    record_audit(db, user, "vehicle.updated", "vehicle", vehicle.id, {"fields": sorted(updates)})
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.post("/fleet/vehicles/{vehicle_id}/locations", response_model=VehicleLocationOut, status_code=status.HTTP_201_CREATED)
def record_vehicle_location(
    vehicle_id: UUID,
    payload: VehicleLocationIn,
    user: User = Depends(fleet_staff),
    db: Session = Depends(get_db),
) -> VehicleLocationEvent:
    vehicle = db.get(FleetVehicle, vehicle_id)
    if vehicle is None:
        fail_not_found()
    if payload.odometer_km is not None and payload.odometer_km < vehicle.odometer_km:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Odometer mileage cannot decrease")
    event = VehicleLocationEvent(
        vehicle_id=vehicle.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed_kph=payload.speed_kph,
        odometer_km=payload.odometer_km,
        source="Fleet operator",
    )
    vehicle.latitude = payload.latitude
    vehicle.longitude = payload.longitude
    vehicle.speed_kph = payload.speed_kph
    vehicle.location_source = "Fleet operator"
    vehicle.location_updated_at = datetime.now(UTC)
    if payload.odometer_km is not None:
        vehicle.odometer_km = payload.odometer_km
    db.add(event)
    record_audit(db, user, "vehicle.location_recorded", "vehicle", vehicle.id)
    db.commit()
    db.refresh(event)
    return event


@router.get("/fleet/vehicles/{vehicle_id}/locations", response_model=list[VehicleLocationOut])
def list_vehicle_locations(
    vehicle_id: UUID,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[VehicleLocationEvent]:
    if user.role not in {Role.FLEET_OFFICER.value, Role.PERMANENT_SECRETARY.value, Role.SYSTEM_ADMINISTRATOR.value}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fleet access is restricted")
    if db.get(FleetVehicle, vehicle_id) is None:
        fail_not_found()
    query = select(VehicleLocationEvent).where(VehicleLocationEvent.vehicle_id == vehicle_id)
    query = query.order_by(VehicleLocationEvent.recorded_at.desc()).limit(min(max(limit, 1), 500))
    return list(db.scalars(query))


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DelegatedTask]:
    query = select(DelegatedTask).where(or_(DelegatedTask.assigner_id == user.id, DelegatedTask.assignee_id == user.id))
    query = query.order_by(DelegatedTask.due_date).limit(min(max(limit, 1), 250)).offset(max(offset, 0))
    return list(db.scalars(query))


@router.get("/tasks/assignees", response_model=list[UserOut])
def list_task_assignees(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    if user.role != Role.HOD.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HODs can delegate tasks")
    query = select(User).where(
        User.department == user.department,
        User.role == Role.STAFF.value,
        User.status == AccountStatus.ACTIVE.value,
    ).order_by(User.full_name)
    return list(db.scalars(query))


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DelegatedTask:
    if user.role != Role.HOD.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HODs can delegate tasks")
    assignee = db.get(User, payload.assignee_id)
    if (
        assignee is None
        or assignee.status != AccountStatus.ACTIVE.value
        or assignee.role != Role.STAFF.value
        or assignee.department != user.department
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Assignee must be active staff in your department")
    task = DelegatedTask(
        title=payload.title.strip(),
        instructions=payload.instructions.strip(),
        department=user.department,
        assigner_id=user.id,
        assignee_id=assignee.id,
        due_date=payload.due_date,
    )
    db.add(task)
    db.flush()
    record_audit(db, user, "task.delegated", "task", task.id, {"assignee_id": str(assignee.id)})
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DelegatedTask:
    task = db.get(DelegatedTask, task_id)
    if task is None or not task_is_visible(user, task):
        fail_not_found()
    if user.id != task.assignee_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the assigned staff member can update task status")
    task.status = payload.status.value
    record_audit(db, user, "task.status_updated", "task", task.id, {"status": task.status})
    db.commit()
    db.refresh(task)
    return task


@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentOut])
def list_task_comments(task_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TaskComment]:
    task = db.get(DelegatedTask, task_id)
    if task is None or not task_is_visible(user, task):
        fail_not_found()
    query = select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at)
    return list(db.scalars(query))


@router.post("/tasks/{task_id}/comments", response_model=TaskCommentOut, status_code=status.HTTP_201_CREATED)
def create_task_comment(
    task_id: UUID,
    payload: TaskCommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskComment:
    task = db.get(DelegatedTask, task_id)
    if task is None or not task_is_visible(user, task):
        fail_not_found()
    comment = TaskComment(task_id=task.id, author_id=user.id, body=payload.body.strip())
    db.add(comment)
    record_audit(db, user, "task.private_comment_created", "task", task.id)
    db.commit()
    db.refresh(comment)
    return comment


def can_upload_to(db: Session, user: User, entity_type: str, entity_id: UUID) -> bool:
    if entity_type == "memo":
        memo = db.get(ActivityMemo, entity_id)
        return memo is not None and memo.initiator_id == user.id
    if entity_type == "document":
        document = db.get(DepartmentDocument, entity_id)
        return document is not None and (document.owner_id == user.id or user.role == Role.RECORDS_OFFICER.value)
    return False


def can_view_attachment(db: Session, user: User, attachment: Attachment) -> bool:
    if attachment.entity_type == "memo":
        memo = db.get(ActivityMemo, attachment.entity_id)
        return memo is not None and memo_is_visible(db, user, memo)
    if attachment.entity_type == "document":
        document = db.get(DepartmentDocument, attachment.entity_id)
        return document is not None and document_is_visible(db, user, document)
    return False


async def store_attachment(
    entity_type: str,
    entity_id: UUID,
    upload: UploadFile,
    user: User,
    db: Session,
) -> Attachment:
    if not can_upload_to(db, user, entity_type, entity_id):
        fail_not_found()
    content_type = upload.content_type or ""
    if content_type not in allowed_upload_types:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, PNG, JPG, and plain text files are supported")
    settings = get_settings()
    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Attachment exceeds the configured size limit")
    signatures = {
        "application/pdf": content.startswith(b"%PDF-"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "text/plain": b"\x00" not in content,
    }
    if not content or not signatures[content_type]:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match the declared type")
    filename = Path(upload.filename or "attachment").name.replace("\x00", "")[:255]
    storage_key = uuid4().hex
    storage_directory = settings.upload_directory.resolve()
    storage_directory.mkdir(parents=True, exist_ok=True)
    storage_path = storage_directory / storage_key
    storage_path.write_bytes(content)
    attachment = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        uploaded_by_id=user.id,
        original_filename=filename,
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(content),
    )
    db.add(attachment)
    record_audit(db, user, "attachment.uploaded", entity_type, entity_id, {"attachment_id": str(attachment.id)})
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise
    db.refresh(attachment)
    return attachment


@router.get("/memos/{memo_id}/attachments", response_model=list[AttachmentOut])
def list_memo_attachments(memo_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Attachment]:
    memo = db.get(ActivityMemo, memo_id)
    if memo is None or not memo_is_visible(db, user, memo):
        fail_not_found()
    return list(db.scalars(select(Attachment).where(Attachment.entity_type == "memo", Attachment.entity_id == memo_id).order_by(Attachment.created_at)))


@router.post("/memos/{memo_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_memo_attachment(
    memo_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Attachment:
    return await store_attachment("memo", memo_id, file, user, db)


@router.get("/documents/{document_id}/attachments", response_model=list[AttachmentOut])
def list_document_attachments(document_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Attachment]:
    document = db.get(DepartmentDocument, document_id)
    if document is None or not document_is_visible(db, user, document):
        fail_not_found()
    return list(db.scalars(select(Attachment).where(Attachment.entity_type == "document", Attachment.entity_id == document_id).order_by(Attachment.created_at)))


@router.post("/documents/{document_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_document_attachment(
    document_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Attachment:
    return await store_attachment("document", document_id, file, user, db)


@router.get("/attachments/{attachment_id}/preview")
def preview_attachment(
    attachment_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None or not can_view_attachment(db, user, attachment):
        fail_not_found()
    storage_path = get_settings().upload_directory.resolve() / attachment.storage_key
    if not storage_path.is_file():
        fail_not_found()
    safe_filename = quote(attachment.original_filename, safe="")
    record_audit(db, user, "attachment.previewed", attachment.entity_type, attachment.entity_id)
    db.commit()
    return Response(
        content=storage_path.read_bytes(),
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{safe_filename}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )