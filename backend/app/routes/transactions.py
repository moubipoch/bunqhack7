from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog, Transaction, Verification
from ..schemas import TransactionInitiateReq, TransactionInitiateRes, Verdict
from ..services import merchant_check, mock_bunq, risk_scorer
from ..util import new_id

router = APIRouter()


@router.get("/user")
def get_user() -> dict:
    u = mock_bunq.get_user()
    return {"id": u.id, "name": u.name, "balance_eur": u.balance_eur}


@router.get("/transactions")
def list_transactions(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Transaction)
        .where(Transaction.user_id == mock_bunq.DEMO_USER_ID)
        .order_by(Transaction.created_at.desc())
        .limit(20)
    ).all()
    return [
        {
            "id": t.id,
            "amount_eur": t.amount_eur,
            "merchant": t.merchant,
            "status": t.status,
            "tier": t.tier,
            "merchant_reputation": t.merchant_reputation,
            "created_at": t.created_at.isoformat(),
        }
        for t in rows
    ]


@router.post("/transaction/initiate", response_model=TransactionInitiateRes)
def initiate(req: TransactionInitiateReq, db: Session = Depends(get_db)) -> TransactionInitiateRes:
    tier = risk_scorer.classify(req.amount_eur, req.merchant, explicit=req.force_tier)
    reputation = merchant_check.lookup(req.merchant)

    tx_id = new_id("txn")
    tx = Transaction(
        id=tx_id,
        user_id=req.user_id,
        amount_eur=req.amount_eur,
        merchant=req.merchant,
        tier=tier,
        merchant_reputation=reputation,
        status="APPROVED" if tier == "NO_RISK" else "PENDING_VERIFICATION",
    )
    db.add(tx)

    if tier == "NO_RISK":
        # Write an audit row even for clean transactions — the pitch says every
        # transaction generates evidence. Keeps the compliance dashboard honest.
        now = datetime.utcnow()
        db.add(
            AuditLog(
                id=new_id("aud"),
                verification_id="",
                transaction_id=tx_id,
                tier=tier,
                hume_scores=None,
                gemini_summary=None,
                merchant_reputation=reputation,
                verdict=Verdict(
                    verdict="APPROVED",
                    confidence=1.0,
                    rationale="No-risk tier: below thresholds and merchant reputable.",
                    recommended_action="Proceed.",
                ).model_dump(),
                started_at=now,
                decided_at=now,
                duration_ms=0,
            )
        )
        db.commit()
        return TransactionInitiateRes(
            transaction_id=tx_id,
            tier=tier,
            status="APPROVED",
            merchant_reputation=reputation,
        )

    ver_id = new_id("ver")
    db.add(Verification(id=ver_id, transaction_id=tx_id, tier=tier, status="PENDING"))
    db.commit()

    return TransactionInitiateRes(
        transaction_id=tx_id,
        tier=tier,
        status="PENDING_VERIFICATION",
        verification_id=ver_id,
        ws_url=f"/ws/verify/{ver_id}",
        merchant_reputation=reputation,
    )
