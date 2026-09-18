from datetime import datetime, date, timezone
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func
from backend.extensions import db
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.constituency import Constituency
from backend.models.election_constituency import ElectionConstituency
from backend.models.participation import ParticipationRecord
from backend.models.audit import AuditLog
from backend.services.audit_service import log_audit_event
from backend.middleware.auth_guard import require_role
from backend.config import Config

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/api/v1/admin")

# 1. VOTER REGISTRY (PRE-PROVISIONED)
@admin_bp.route("/voters", methods=["POST"])
@require_role(["ADMIN"])
def register_voter():
    """
    Voter registry is pre-provisioned.
    Admin voter registration is disabled.
    """
    return jsonify({
        "error": "VOTER_REGISTRY_PREPROVISIONED",
        "message": "Voter registration through the administration console is disabled. The electoral registry is pre-provisioned."
    }), 403

@admin_bp.route("/voters", methods=["GET"])
@require_role(["ADMIN"])
def list_voters():
    """
    Read-only / aggregate overview of the pre-provisioned voter registry.
    Exposes aggregate counts and voter rosters without credential editing.
    """
    voters = User.query.filter_by(role="VOTER").order_by(User.created_at.desc()).all()
    
    # Aggregate statistics
    constituency_counts = {}
    for v in voters:
        constituency_counts[v.constituency] = constituency_counts.get(v.constituency, 0) + 1

    return jsonify({
        "voters": [v.to_dict() for v in voters],
        "summary": {
            "total_registered_voters": len(voters),
            "active_voters": sum(1 for v in voters if v.is_active),
            "constituency_counts": constituency_counts
        }
    }), 200

# 2. CONSTITUENCY MANAGEMENT
@admin_bp.route("/constituencies", methods=["GET"])
@require_role(["ADMIN"])
def list_constituencies():
    constituencies = Constituency.query.order_by(Constituency.name.asc()).all()
    return jsonify({"constituencies": [c.to_dict() for c in constituencies]}), 200

@admin_bp.route("/constituencies", methods=["POST"])
@require_role(["ADMIN"])
def create_constituency():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    code = data.get("code", "").strip()
    state = data.get("state", "Example State").strip()

    if not name or not code:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Name and code are required."}), 400

    existing = Constituency.query.filter((Constituency.name == name) | (Constituency.code == code)).first()
    if existing:
        return jsonify({"error": "CONFLICT", "message": f"Constituency with name '{name}' or code '{code}' already exists."}), 409

    constituency = Constituency(name=name, code=code, state=state)
    db.session.add(constituency)
    log_audit_event(
        "CONSTITUENCY_CREATED",
        user_id=g.current_user["id"],
        details={"name": constituency.name, "code": constituency.code, "state": constituency.state}
    )
    db.session.commit()

    return jsonify({"message": "Constituency created.", "constituency": constituency.to_dict()}), 201

# 3. ELECTION MANAGEMENT
@admin_bp.route("/elections", methods=["POST"])
@require_role(["ADMIN"])
def create_election():
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    election_type = data.get("election_type", "State Legislative Assembly").strip()
    state = data.get("state", "Example State").strip()
    election_date_str = data.get("election_date")
    voting_open_at_str = data.get("voting_open_at")
    voting_close_at_str = data.get("voting_close_at")
    constituency_ids = data.get("constituency_ids", [])

    if not title:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Election title is required."}), 400

    election_date = None
    if election_date_str:
        try:
            election_date = date.fromisoformat(election_date_str)
        except ValueError:
            return jsonify({"error": "VALIDATION_ERROR", "message": "Invalid election_date format (YYYY-MM-DD required)."}), 400

    voting_open_at = None
    if voting_open_at_str:
        try:
            voting_open_at = datetime.fromisoformat(voting_open_at_str)
        except ValueError:
            return jsonify({"error": "VALIDATION_ERROR", "message": "Invalid voting_open_at format."}), 400

    voting_close_at = None
    if voting_close_at_str:
        try:
            voting_close_at = datetime.fromisoformat(voting_close_at_str)
        except ValueError:
            return jsonify({"error": "VALIDATION_ERROR", "message": "Invalid voting_close_at format."}), 400

    if voting_open_at and voting_close_at and voting_close_at <= voting_open_at:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Voting close time must be after open time."}), 400

    # Initial state is strictly DRAFT (is_active = False)
    election = Election(
        title=title,
        description=description,
        election_type=election_type,
        state=state,
        election_date=election_date,
        voting_open_at=voting_open_at,
        voting_close_at=voting_close_at,
        status="DRAFT",
        is_active=False
    )
    db.session.add(election)
    db.session.flush()

    # Link participating constituencies
    for cid in constituency_ids:
        const = Constituency.query.filter_by(id=cid).first()
        if const:
            assoc = ElectionConstituency(election_id=election.id, constituency_id=const.id)
            db.session.add(assoc)
            # Ensure NOTA option is auto-provisioned
            nota_candidate = Candidate(
                election_id=election.id,
                constituency_id=const.id,
                constituency=const.name,
                name="None of the Above (NOTA)",
                party="NOTA",
                ballot_position=999,
                is_active=True,
                is_nota=True
            )
            db.session.add(nota_candidate)

    log_audit_event(
        "ELECTION_CREATED", 
        user_id=g.current_user["id"], 
        details={"election_id": election.id, "title": election.title, "status": election.status}
    )
    db.session.commit()

    return jsonify({"message": "Election created in DRAFT status.", "election": election.to_dict()}), 201

@admin_bp.route("/elections", methods=["GET"])
@require_role(["ADMIN"])
def list_elections():
    elections = Election.query.order_by(Election.created_at.desc()).all()
    return jsonify({"elections": [e.to_dict() for e in elections]}), 200

@admin_bp.route("/elections/<string:election_id>", methods=["GET"])
@require_role(["ADMIN"])
def get_election(election_id):
    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Election not found."}), 404
    return jsonify({"election": election.to_dict()}), 200

@admin_bp.route("/elections/<string:election_id>", methods=["PATCH"])
@require_role(["ADMIN"])
def update_election(election_id):
    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Election not found."}), 404

    # Configuration locking: only DRAFT elections are editable
    if election.status != "DRAFT":
        return jsonify({
            "error": "LOCKED",
            "message": f"Election configuration is locked. Cannot edit parameters while in '{election.status}' status."
        }), 409

    data = request.get_json() or {}
    if "title" in data:
        election.title = data["title"].strip()
    if "description" in data:
        election.description = data["description"].strip()
    if "election_type" in data:
        election.election_type = data["election_type"].strip()
    if "state" in data:
        election.state = data["state"].strip()
    if "election_date" in data:
        election.election_date = date.fromisoformat(data["election_date"]) if data["election_date"] else None
    if "voting_open_at" in data:
        election.voting_open_at = datetime.fromisoformat(data["voting_open_at"]) if data["voting_open_at"] else None
    if "voting_close_at" in data:
        election.voting_close_at = datetime.fromisoformat(data["voting_close_at"]) if data["voting_close_at"] else None

    if election.voting_open_at and election.voting_close_at and election.voting_close_at <= election.voting_open_at:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Voting close time must be after open time."}), 400

    log_audit_event(
        "ELECTION_UPDATED",
        user_id=g.current_user["id"],
        details={"election_id": election.id, "title": election.title}
    )
    db.session.commit()
    return jsonify({"message": "Election updated.", "election": election.to_dict()}), 200

@admin_bp.route("/elections/<string:election_id>/status", methods=["PATCH"])
@require_role(["ADMIN"])
def update_election_status(election_id):
    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Election not found."}), 404

    data = request.get_json() or {}
    target_status = data.get("status", "").strip().upper()
    if not target_status:
        return jsonify({"error": "VALIDATION_ERROR", "message": "'status' field required (DRAFT, PUBLISHED, OPEN, CLOSED)."}), 400

    # Lifecycle validation: DRAFT -> PUBLISHED -> OPEN -> CLOSED
    valid_transitions = {
        "DRAFT": ["PUBLISHED"],
        "PUBLISHED": ["DRAFT", "OPEN"],
        "OPEN": ["CLOSED"],
        "CLOSED": []
    }

    allowed = valid_transitions.get(election.status, [])
    if target_status not in allowed:
        return jsonify({
            "error": "INVALID_TRANSITION",
            "message": f"Cannot transition from '{election.status}' to '{target_status}'. Allowed transitions: {allowed}"
        }), 400

    # Readiness checks when transitioning to PUBLISHED or OPEN
    if target_status in ["PUBLISHED", "OPEN"]:
        const_count = ElectionConstituency.query.filter_by(election_id=election.id).count()
        if const_count == 0:
            return jsonify({
                "error": "PREPARATION_INCOMPLETE",
                "message": "Cannot advance election: No participating constituencies have been configured."
            }), 400

    try:
        election.set_status(target_status)
    except ValueError as e:
        return jsonify({"error": "VALIDATION_ERROR", "message": str(e)}), 400

    log_audit_event(
        "ELECTION_STATUS_UPDATED",
        user_id=g.current_user["id"],
        details={"election_id": election.id, "status": election.status, "is_active": election.is_active}
    )
    db.session.commit()

    return jsonify({"message": f"Election status updated to {election.status}.", "election": election.to_dict()}), 200

@admin_bp.route("/elections/<string:election_id>/constituencies", methods=["POST"])
@require_role(["ADMIN"])
def add_election_constituency(election_id):
    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Election not found."}), 404

    if election.status != "DRAFT":
        return jsonify({
            "error": "LOCKED",
            "message": f"Constituency configuration locked. Cannot modify constituencies while in '{election.status}' status."
        }), 409

    data = request.get_json() or {}
    constituency_id = data.get("constituency_id")
    if not constituency_id:
        return jsonify({"error": "VALIDATION_ERROR", "message": "'constituency_id' is required."}), 400

    constituency = Constituency.query.filter_by(id=constituency_id).first()
    if not constituency:
        return jsonify({"error": "NOT_FOUND", "message": "Constituency not found."}), 404

    existing = ElectionConstituency.query.filter_by(election_id=election_id, constituency_id=constituency_id).first()
    if existing:
        return jsonify({"error": "CONFLICT", "message": "Constituency is already participating in this election."}), 409

    assoc = ElectionConstituency(election_id=election_id, constituency_id=constituency_id)
    db.session.add(assoc)

    # Automatically ensure NOTA option exists for this constituency
    nota_exists = Candidate.query.filter_by(election_id=election_id, constituency_id=constituency_id, is_nota=True).first()
    if not nota_exists:
        max_pos = db.session.query(func.coalesce(func.max(Candidate.ballot_position), 0))\
            .filter_by(election_id=election_id, constituency_id=constituency_id).scalar()
        nota = Candidate(
            election_id=election_id,
            constituency_id=constituency.id,
            constituency=constituency.name,
            name="None of the Above (NOTA)",
            party="NOTA",
            ballot_position=max(max_pos + 1, 999),
            is_active=True,
            is_nota=True
        )
        db.session.add(nota)

    log_audit_event(
        "ELECTION_CONSTITUENCY_ADDED",
        user_id=g.current_user["id"],
        details={"election_id": election_id, "constituency_id": constituency_id, "constituency_name": constituency.name}
    )
    db.session.commit()

    return jsonify({"message": f"Constituency '{constituency.name}' added to election.", "association": assoc.to_dict()}), 201

# 4. CANDIDATE MANAGEMENT
@admin_bp.route("/candidates", methods=["POST"])
@require_role(["ADMIN"])
def create_candidate():
    data = request.get_json() or {}
    election_id = data.get("election_id", "").strip()
    constituency_id = data.get("constituency_id", "").strip()
    name = data.get("name", "").strip()
    party = data.get("party", "").strip()
    ballot_position = data.get("ballot_position")

    if not election_id or not constituency_id or not name or not party:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Election, constituency, name, and party are required."}), 400

    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Target election does not exist."}), 404

    # Configuration locking: candidates can only be added when election is in DRAFT
    if election.status != "DRAFT":
        return jsonify({
            "error": "LOCKED",
            "message": f"Candidate roster locked. Cannot add candidates while election is in '{election.status}' status."
        }), 409

    constituency = Constituency.query.filter_by(id=constituency_id).first()
    if not constituency:
        return jsonify({"error": "NOT_FOUND", "message": "Constituency does not exist."}), 404

    # Ensure constituency is participating
    assoc = ElectionConstituency.query.filter_by(election_id=election_id, constituency_id=constituency_id).first()
    if not assoc:
        return jsonify({"error": "VALIDATION_ERROR", "message": "Constituency is not configured as participating in this election."}), 400

    # Ensure duplicate candidate name in this constituency is rejected
    existing = Candidate.query.filter_by(election_id=election_id, constituency_id=constituency_id, name=name).first()
    if existing:
        return jsonify({"error": "CONFLICT", "message": f"Candidate '{name}' already registered in this constituency."}), 409

    # Determine ballot position
    # Fetch existing non-NOTA count to place standard candidate before NOTA
    current_non_nota = Candidate.query.filter_by(election_id=election_id, constituency_id=constituency_id, is_nota=False).count()
    if ballot_position is None or int(ballot_position) <= 0:
        assigned_position = current_non_nota + 1
    else:
        assigned_position = int(ballot_position)

    # Shift any existing positions if needed to maintain uniqueness
    conflict = Candidate.query.filter_by(election_id=election_id, constituency_id=constituency_id, ballot_position=assigned_position).first()
    if conflict and not conflict.is_nota:
        return jsonify({"error": "CONFLICT", "message": f"Ballot position {assigned_position} is already taken in this constituency."}), 409

    # If NOTA exists and could collide with assigned_position, move it to 99999 first
    nota = Candidate.query.filter_by(election_id=election_id, constituency_id=constituency_id, is_nota=True).first()
    if nota:
        nota.ballot_position = 99999
        db.session.flush()

    candidate = Candidate(
        election_id=election_id,
        constituency_id=constituency_id,
        constituency=constituency.name,
        name=name,
        party=party,
        ballot_position=assigned_position,
        is_active=True,
        is_nota=False
    )
    db.session.add(candidate)
    db.session.flush()

    # Reposition NOTA to always be strictly last
    max_reg = db.session.query(func.coalesce(func.max(Candidate.ballot_position), 0))\
        .filter_by(election_id=election_id, constituency_id=constituency_id, is_nota=False).scalar()
    if nota:
        nota.ballot_position = max_reg + 1
    else:
        # Create NOTA if missing
        nota = Candidate(
            election_id=election_id,
            constituency_id=constituency_id,
            constituency=constituency.name,
            name="None of the Above (NOTA)",
            party="NOTA",
            ballot_position=max_reg + 1,
            is_active=True,
            is_nota=True
        )
        db.session.add(nota)

    log_audit_event(
        "CANDIDATE_CREATED",
        user_id=g.current_user["id"],
        details={
            "candidate_id": candidate.id,
            "name": candidate.name,
            "party": candidate.party,
            "constituency": candidate.constituency,
            "ballot_position": candidate.ballot_position
        }
    )
    db.session.commit()

    return jsonify({"message": "Candidate added successfully.", "candidate": candidate.to_dict()}), 201

@admin_bp.route("/candidates", methods=["GET"])
@require_role(["ADMIN"])
def list_candidates():
    election_id = request.args.get("election_id")
    constituency_id = request.args.get("constituency_id")
    constituency_name = request.args.get("constituency")

    query = Candidate.query
    if election_id:
        query = query.filter_by(election_id=election_id)
    if constituency_id:
        query = query.filter_by(constituency_id=constituency_id)
    elif constituency_name:
        query = query.filter_by(constituency=constituency_name)

    # Sort standard candidates by ballot_position, with NOTA strictly last
    candidates = query.order_by(Candidate.is_nota.asc(), Candidate.ballot_position.asc()).all()
    return jsonify({"candidates": [c.to_dict() for c in candidates]}), 200

# 5. AGGREGATE PARTICIPATION STATISTICS (ZERO CHOICE/VOTER DISCLOSURE)
@admin_bp.route("/elections/<string:election_id>/participation-stats", methods=["GET"])
@require_role(["ADMIN"])
def get_participation_stats(election_id):
    """
    Returns aggregate participation statistics without any voter or candidate linkage.
    Approved notice:
    "Voter participation is stored separately from the encrypted ballot. The system does not store a voter-to-candidate mapping."
    """
    election = Election.query.filter_by(id=election_id).first()
    if not election:
        return jsonify({"error": "NOT_FOUND", "message": "Election not found."}), 404

    # Participating constituencies
    participating_assocs = ElectionConstituency.query.filter_by(election_id=election.id).all()
    constituency_ids = [a.constituency_id for a in participating_assocs]
    constituency_names = [a.constituency.name for a in participating_assocs if a.constituency]

    # Calculate eligible voters
    eligible_voters = User.query.filter(
        User.role == "VOTER",
        User.is_active == True,
        User.constituency.in_(constituency_names)
    ).all()
    total_eligible = len(eligible_voters)

    # Calculate total votes cast
    votes_cast_count = ParticipationRecord.query.filter_by(
        election_id=election.id,
        has_voted=True
    ).count()

    overall_turnout = round((votes_cast_count / total_eligible * 100), 2) if total_eligible > 0 else 0.0

    # Constituency-level breakdown
    constituency_stats = []
    for assoc in participating_assocs:
        cname = assoc.constituency.name
        c_eligible = sum(1 for v in eligible_voters if v.constituency == cname)
        # Count participation for voters in this constituency
        c_voter_ids = [v.id for v in eligible_voters if v.constituency == cname]
        c_voted = ParticipationRecord.query.filter(
            ParticipationRecord.election_id == election.id,
            ParticipationRecord.has_voted == True,
            ParticipationRecord.voter_id.in_(c_voter_ids)
        ).count() if c_voter_ids else 0
        c_turnout = round((c_voted / c_eligible * 100), 2) if c_eligible > 0 else 0.0

        constituency_stats.append({
            "constituency_id": assoc.constituency_id,
            "constituency_name": cname,
            "eligible_voters": c_eligible,
            "votes_cast": c_voted,
            "turnout_percentage": c_turnout
        })

    return jsonify({
        "election_id": election.id,
        "election_title": election.title,
        "status": election.status,
        "is_active": election.is_active,
        "total_eligible_voters": total_eligible,
        "total_votes_cast": votes_cast_count,
        "overall_turnout_percentage": overall_turnout,
        "constituency_breakdown": constituency_stats,
        "privacy_guarantee": "Voter participation is stored separately from the encrypted ballot. The system does not store a voter-to-candidate mapping."
    }), 200

# 6. AUDIT LOGS & QUANTUM LAB
@admin_bp.route("/audit-logs", methods=["GET"])
@require_role(["ADMIN"])
def list_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
    return jsonify({"audit_logs": [log.to_dict() for log in logs]}), 200

@admin_bp.route("/simulation-config", methods=["POST", "GET"])
@require_role(["ADMIN"])
def simulation_config():
    if request.method == "POST":
        data = request.get_json() or {}
        simulate = data.get("simulate_eavesdropping")
        if simulate is not None:
            Config.SIMULATE_EAVESDROPPING = bool(simulate)
        qubit_count = data.get("qubit_count")
        if qubit_count and isinstance(qubit_count, int) and 32 <= qubit_count <= 256:
            Config.BB84_DEFAULT_QUBIT_COUNT = qubit_count

    return jsonify({
        "simulate_eavesdropping": Config.SIMULATE_EAVESDROPPING,
        "qubit_count": Config.BB84_DEFAULT_QUBIT_COUNT,
        "qber_threshold": Config.BB84_QBER_THRESHOLD
    }), 200
