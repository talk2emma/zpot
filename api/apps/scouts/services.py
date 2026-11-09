"""Source evidence → pending verification → authorised review → approved/rejected → canonical update → audit."""

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import ZpotAPIError
from apps.core.models import record_audit
from apps.core.uploads import sanitise_image

from .models import AssignmentStatus, Outcome, ScoutPhoto, ScoutSubmission


@transaction.atomic
def submit(assignment, *, scout, outcome, observed_rules="", notes="", photos=()):
    if assignment.status not in (AssignmentStatus.ASSIGNED, AssignmentStatus.REJECTED):
        raise ZpotAPIError("This task was already submitted.", code="already_submitted", status_code=409)
    if outcome != Outcome.NO_ACCESS and not photos:
        raise ZpotAPIError(
            "Add at least one photo of the signs.",
            code="validation_error",
            details={"photos": ["A photo is required unless you couldn't access the street."]},
        )
    if outcome == Outcome.DIFFERS and len(observed_rules.strip()) < 10:
        raise ZpotAPIError(
            "Describe the rules you saw.",
            code="validation_error",
            details={"observed_rules": ["At least 10 characters."]},
        )
    sub = ScoutSubmission.objects.create(
        assignment=assignment, scout=scout, outcome=outcome, observed_rules=observed_rules.strip(), notes=notes.strip()
    )
    for f in list(photos)[:5]:
        clean, meta = sanitise_image(f)
        p = ScoutPhoto(submission=sub, **meta)
        p.file.save(clean.name, clean, save=True)
    assignment.status = AssignmentStatus.SUBMITTED
    assignment.save(update_fields=["status", "updated_at"])
    record_audit("scout.submitted", actor=scout, target=assignment, outcome=outcome)
    return sub


@transaction.atomic
def review(submission, *, reviewer, approve, note=""):
    """Approval creates evidence and (for a match) refreshes the area's verification date. A 'differs' outcome is
    approved as evidence only: rule edits are made by the reviewer in admin, which writes ParkingDataRevision rows."""
    from apps.parking.models import EvidenceKind, ParkingDataSource, ParkingEvidence, SourceKind, VerificationStatus

    if submission.review_status != "pending":
        raise ZpotAPIError("Already reviewed.", code="already_reviewed", status_code=409)
    now = timezone.now()
    a = submission.assignment
    submission.review_status = "approved" if approve else "rejected"
    submission.reviewed_by, submission.reviewed_at, submission.review_note = reviewer, now, note
    submission.save()
    a.status = AssignmentStatus.APPROVED if approve else AssignmentStatus.REJECTED
    a.save(update_fields=["status", "updated_at"])
    if approve and submission.outcome != Outcome.NO_ACCESS:
        src, _ = ParkingDataSource.objects.get_or_create(
            name="Zpot scout verification",
            defaults={"kind": SourceKind.SCOUT, "attribution": "Field verification by Zpot scouts"},
        )
        ParkingEvidence.objects.create(
            area=a.area,
            kind=EvidenceKind.SCOUT_VISIT,
            source=src,
            captured_at=submission.submitted_at,
            description=f"Scout: {submission.get_outcome_display()}. {submission.observed_rules}"[:300],
        )
        if submission.outcome == Outcome.MATCHES:
            area = a.area
            area.verified_at = now
            if area.verification_status == VerificationStatus.COMMUNITY:
                area.verification_status = VerificationStatus.VERIFIED
            area.save(update_fields=["verified_at", "verification_status", "updated_at"])
        if a.report_id:
            from apps.reports.models import ModerationDecision
            from apps.reports.services import moderate

            rep = a.report
            if rep.status in ("pending_review", "under_review"):
                moderate(
                    rep,
                    moderator=reviewer,
                    decision=ModerationDecision.ACCEPT
                    if submission.outcome == Outcome.DIFFERS
                    else ModerationDecision.REJECT,
                    reason=""
                    if submission.outcome == Outcome.DIFFERS
                    else "A scout checked and the rules match what Zpot shows.",
                )
    record_audit("scout.reviewed", actor=reviewer, target=a, approve=approve, outcome=submission.outcome)
    return submission
