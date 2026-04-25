from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog, Transaction, Verification
from ..schemas import MerchantReputation, Tier, TransactionInitiateReq, TransactionInitiateRes, Verdict
from ..services import embedding_cache, merchant_check, mock_bunq, risk_scorer
from ..util import new_id

router = APIRouter()


class RiskPreviewReq(BaseModel):
    amount_eur: float = Field(gt=0)
    merchant: str


class RiskPreviewRes(BaseModel):
    tier: Tier
    merchant_reputation: MerchantReputation
    risk: float | None = None
    n_emb: float | None = None
    n_amt: float | None = None
    n_time: float | None = None
    p_merch: float | None = None
    descriptor: str | None = None
    cold_start: bool = False


@router.post("/risk/preview", response_model=RiskPreviewRes)
async def preview_risk(req: RiskPreviewReq) -> RiskPreviewRes:
    """Score a transaction WITHOUT persisting it or adding to the embedding cache.

    Use this from the demo's 'Check risk' button — repeated calls won't pollute
    the user's history baseline (which would otherwise wash out novelty signals).
    """
    tier, scores = await risk_scorer.classify_async(req.amount_eur, req.merchant)
    reputation = merchant_check.lookup(req.merchant)
    if scores is None:
        return RiskPreviewRes(tier=tier, merchant_reputation=reputation, cold_start=True)
    return RiskPreviewRes(
        tier=tier,
        merchant_reputation=reputation,
        risk=scores["risk"],
        n_emb=scores["n_emb"],
        n_amt=scores["n_amt"],
        n_time=scores["n_time"],
        p_merch=scores["p_merch"],
        descriptor=scores["descriptor"],
    )


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
async def initiate(req: TransactionInitiateReq, db: Session = Depends(get_db)) -> TransactionInitiateRes:
    tier, risk_scores = await risk_scorer.classify_async(
        req.amount_eur, req.merchant, explicit=req.force_tier
    )
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
        rationale = (
            "No-risk tier: behavioral signals match user's normal pattern."
            if risk_scores
            else "No-risk tier: below thresholds and merchant reputable."
        )
        audit = AuditLog(
            id=new_id("aud"),
            verification_id=None,
            transaction_id=tx_id,
            tier=tier,
            hume_scores=None,
            gemini_summary=None,
            merchant_reputation=reputation,
            verdict=Verdict(
                verdict="APPROVED",
                confidence=1.0,
                rationale=rationale,
                recommended_action="Proceed.",
            ).model_dump(),
            risk_signals=risk_scores,
            started_at=now,
            decided_at=now,
            duration_ms=0,
        )
        db.add(audit)
        db.commit()

        # NOTE: deliberately do NOT add this auto-approved tx to the embedding
        # cache. Demo runs would otherwise pollute the history with whatever
        # the user keeps tapping (€9k purchases at "Apples Store" mid-demo
        # eventually drown out the novelty signal). The seed history is the
        # baseline; real production would refresh embeddings on a slower
        # cadence (nightly batch) anyway.

        return TransactionInitiateRes(
            transaction_id=tx_id,
            tier=tier,
            status="APPROVED",
            merchant_reputation=reputation,
        )

    ver_id = new_id("ver")
    ver = Verification(id=ver_id, transaction_id=tx_id, tier=tier, status="PENDING")
    if risk_scores is not None:
        ver.risk_signals = risk_scores
    db.add(ver)
    db.commit()

    return TransactionInitiateRes(
        transaction_id=tx_id,
        tier=tier,
        status="PENDING_VERIFICATION",
        verification_id=ver_id,
        ws_url=f"/ws/verify/{ver_id}",
        merchant_reputation=reputation,
    )
